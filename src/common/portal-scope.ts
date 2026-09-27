import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

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

/**
 * Tokens carry the lowercase portal role ("admin", "daycare_admin", "parent", ...) -- note the
 * underscore. Stripping only whitespace/hyphen (the pattern used elsewhere in this codebase,
 * e.g. permission.guard.ts's normalizeTokenRole) leaves "DAYCARE_ADMIN", which then fails an
 * exact match against "DAYCAREADMIN" and silently disables this entire module for that one
 * role -- confirmed live: the fix compiled and deployed clean, but a Daycare Admin's PATCH on a
 * Kindervale student still returned 200, because callerPortal() was returning null for them
 * unconditionally. Stripping underscores too (matching common/role-normalizer.ts) fixes it with
 * a single comparison instead of checking both spellings at every call site.
 */
const normalizeRole = (role?: string): string => (role ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");

/**
 * A role string, or the request user. Teachers are the one role whose portal is not implied by
 * the role alone: it comes from the class on their own teacher profile, which PermissionGuard
 * resolves once per request and attaches as `portal`.
 */
export type PortalCaller = string | { role?: string; portal?: SchoolPortal | null } | undefined;

/**
 * The portal a caller is confined to, or null when they are not confined by portal: PRINCIPAL
 * sees both, and PARENT is scoped by their own linked children instead. ADMIN and DAYCAREADMIN
 * are fixed by role. A TEACHER is only confined when handed the user object carrying the portal
 * resolved from their profile -- passing the bare role string cannot know it and returns null,
 * so call sites that must restrict teachers have to pass the user, not `user.role`.
 */
export const callerPortal = (caller?: PortalCaller): SchoolPortal | null => {
  const role = typeof caller === "string" || caller === undefined ? caller : caller.role;
  const normalized = normalizeRole(role);
  if (normalized === "ADMIN") return "Kindervale";
  if (normalized === "DAYCAREADMIN") return "Daycare";
  if (normalized === "TEACHER" && typeof caller === "object") return caller.portal ?? null;
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
  role: PortalCaller,
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
export const assertPortalForCreate = (role: PortalCaller, className: string | null | undefined): void => {
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
  role: PortalCaller,
  recordPortal: string | null | undefined,
  notFoundMessage: string
): void => {
  const required = callerPortal(role);
  if (!required) return;
  if ((recordPortal ?? "Kindervale") !== required) {
    throw new NotFoundException(notFoundMessage);
  }
};

/**
 * A caller carrying the TEACHER-only homeroom className PermissionGuard resolves per request
 * (mirrors how `portal` is already resolved there) -- decision 7: a teacher sees only the class
 * they are homeroom teacher for, not their whole portal. Every other role is unrestricted by
 * this (Admin/Principal/Daycare Admin/Accountant/Parent all use their own, different scoping).
 */
export type HomeroomCaller = { role?: string; homeroomClassName?: string | null } | undefined;

const isTeacherCaller = (caller: HomeroomCaller): boolean => normalizeRole(caller?.role) === "TEACHER";

/**
 * Throws (as "not found", same posture as assertPortalAccess) if the caller is a teacher and the
 * record's className isn't their own homeroom. A teacher with no homeroom assigned yet is
 * confined to a class name that matches nothing, so they see nothing rather than everything.
 */
export const assertHomeroomAccess = (caller: HomeroomCaller, recordClassName: string | null | undefined, notFoundMessage: string): void => {
  if (!isTeacherCaller(caller)) return;
  if ((recordClassName ?? null) !== (caller?.homeroomClassName ?? null) || !caller?.homeroomClassName) {
    throw new NotFoundException(notFoundMessage);
  }
};

/** For create: rejects a teacher writing a className that isn't their own homeroom. */
export const assertHomeroomForCreate = (caller: HomeroomCaller, className: string | null | undefined): void => {
  if (!isTeacherCaller(caller)) return;
  if (!caller?.homeroomClassName || className !== caller.homeroomClassName) {
    throw new ForbiddenException("You can only do this for your own homeroom class");
  }
};

/**
 * The WHERE-clause counterpart, for list endpoints: a SQL condition confining a teacher caller
 * to their own homeroom className, or undefined for every other role (no extra restriction).
 * A teacher with no homeroom yet gets a condition that matches no row, not every row.
 */
export const homeroomFilterCondition = (classNameColumn: PgColumn, caller: HomeroomCaller): SQL | undefined => {
  if (!isTeacherCaller(caller)) return undefined;
  return eq(classNameColumn, caller?.homeroomClassName ?? "__no_homeroom_assigned__");
};
