import { ForbiddenException, NotFoundException } from "@nestjs/common";

/**
 * Which class names belong to the Daycare side of the school. Mirrors the frontend's
 * classNameToPortal() exactly (components/dashboard/exact-portal.tsx) -- there is no portal
 * column on students/teachers, so both sides derive it from className the same way. Keeping
 * this list in one place on each side (rather than scattering the string comparison) is what
 * makes it possible to keep them in sync at all.
 */
export const DAYCARE_CLASS_NAMES = ["Infant Room", "Toddler Room", "Daycare"] as const;

export type SchoolPortal = "Kindervale" | "Daycare";

export const classNameToPortal = (className?: string | null): SchoolPortal =>
  DAYCARE_CLASS_NAMES.includes((className ?? "") as (typeof DAYCARE_CLASS_NAMES)[number]) ? "Daycare" : "Kindervale";

/** Tokens carry the lowercase portal role ("admin", "daycare_admin", "parent", ...). */
const normalizeRole = (role?: string): string => (role ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");

/**
 * The portal an ADMIN or DAYCAREADMIN token is confined to, or null for every other role
 * (PRINCIPAL sees both; PARENT/TEACHER are scoped by their own linked records instead, not by
 * portal). Nothing outside these two roles should ever be restricted by this check.
 */
export const callerPortal = (role?: string): SchoolPortal | null => {
  const normalized = normalizeRole(role);
  if (normalized === "ADMIN") return "Kindervale";
  if (normalized === "DAYCAREADMIN") return "Daycare";
  return null;
};

/**
 * Throws if the caller's role is confined to a portal and the record's className resolves to
 * the other one. A Daycare Admin's token previously reached Kindervale students and teachers
 * with only client-side validation stopping the write -- confirmed live: a PATCH with an
 * invalid body still got past authorization and only failed on "Name must be a string". Reports
 * 404 rather than 403: portal is an implementation detail the two admin roles shouldn't be able
 * to use to confirm which students exist on the other side.
 */
export const assertPortalAccess = (
  role: string | undefined,
  recordClassName: string | null | undefined,
  notFoundMessage: string
): void => {
  const required = callerPortal(role);
  if (!required) return;
  if (classNameToPortal(recordClassName) !== required) {
    throw new NotFoundException(notFoundMessage);
  }
};

/**
 * For create: rejects a className that doesn't belong to the caller's own portal, before any
 * record is written. Reported as a plain permission error (not "not found" -- there is nothing
 * to hide the existence of when nothing exists yet).
 */
export const assertPortalForCreate = (role: string | undefined, className: string | null | undefined): void => {
  const required = callerPortal(role);
  if (!required) return;
  if (classNameToPortal(className) !== required) {
    throw new ForbiddenException(`You can only create records in the ${required} portal`);
  }
};

/**
 * Same idea as assertPortalAccess, but for tables that already carry a real portal column
 * (income, expenses) instead of deriving one from a className -- compares the stored value
 * directly rather than routing it back through classNameToPortal.
 */
export const assertExactPortalAccess = (
  role: string | undefined,
  recordPortal: string | null | undefined,
  notFoundMessage: string
): void => {
  const required = callerPortal(role);
  if (!required) return;
  if ((recordPortal ?? "Kindervale") !== required) {
    throw new NotFoundException(notFoundMessage);
  }
};
