import { IsOptional, Matches } from "class-validator";
import { Trim } from "common/transformer";

export class RunPayrollDto {
  // C-20: this was `{ period?: string }` with no validation at all -- {period:"abc"} reached the
  // service and 500'd. YYYY-MM only; defaults to the current month when omitted (unchanged).
  @IsOptional()
  @Trim()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "Period must be in YYYY-MM format" })
  period?: string;
}
