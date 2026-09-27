import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";

/**
 * Shape of an error the `pg` driver (via Drizzle) throws for a constraint violation -- these
 * never go through our own DTOs/services, so without this mapping they fall straight through to
 * the generic 500 branch below (C-20: "unhandled PG errors -> 500").
 */
interface PgDriverError {
  code: string;
  constraint?: string;
  column?: string;
  table?: string;
  detail?: string;
}

function isPgDriverError(error: unknown): error is PgDriverError {
  return typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string";
}

/** Postgres SQLSTATE codes worth turning into a clean 4xx instead of a raw 500. */
const PG_ERROR_MAP: Record<string, { status: number; message: (error: PgDriverError) => string }> = {
  // unique_violation
  "23505": {
    status: HttpStatus.CONFLICT,
    message: (e) => (e.constraint ? `A record with this ${humanizeConstraint(e.constraint)} already exists` : "This record already exists")
  },
  // foreign_key_violation
  "23503": {
    status: HttpStatus.BAD_REQUEST,
    message: () => "This references a record that doesn't exist or has since been removed"
  },
  // not_null_violation
  "23502": {
    status: HttpStatus.BAD_REQUEST,
    message: (e) => (e.column ? `${humanizeConstraint(e.column)} is required` : "A required field is missing")
  },
  // numeric_value_out_of_range
  "22003": {
    status: HttpStatus.BAD_REQUEST,
    message: () => "One of the numbers provided is too large"
  },
  // string_data_right_truncation (value too long for the column)
  "22001": {
    status: HttpStatus.BAD_REQUEST,
    message: () => "One of the values provided is too long"
  },
  // invalid_text_representation (bad enum value, malformed uuid/int, ...)
  "22P02": {
    status: HttpStatus.BAD_REQUEST,
    message: () => "One of the values provided is not in the expected format"
  },
  // check_violation
  "23514": {
    status: HttpStatus.BAD_REQUEST,
    message: () => "One of the values provided isn't allowed"
  }
};

function humanizeConstraint(name: string): string {
  return name
    .replace(/_(pkey|key|fkey|unique|check|idx)$/i, "")
    .replace(/^[a-z_]+?_/, "")
    .replace(/_/g, " ")
    .trim() || name;
}

function isPayloadTooLarge(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { type?: string; status?: number; statusCode?: number };
  return e.type === "entity.too.large" || e.status === 413 || e.statusCode === 413;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else {
        // @ts-expect-error Object Type Error
        message = res?.message || message;
      }

      if (status >= 500) {
        console.error(`[${status}] HttpException:`, message, exception);
      } else {
        console.info(`[${status}] ${message}`);
      }
    } else if (isPayloadTooLarge(exception)) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = "Request body is too large";
      console.info(`[${status}] ${message}`);
    } else if (isPgDriverError(exception)) {
      const mapped = PG_ERROR_MAP[exception.code];
      if (mapped) {
        status = mapped.status;
        message = mapped.message(exception);
        console.info(`[${status}] ${message} (pg code ${exception.code})`);
      } else {
        console.error("Unhandled pg error:", exception);
      }
    } else {
      console.error("Unhandled exception:", exception);
    }

    response.status(status).json({
      success: false,
      message
    });
  }
}
