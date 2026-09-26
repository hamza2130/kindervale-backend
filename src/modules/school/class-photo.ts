import { sql } from "drizzle-orm";
import { documentsTable } from "models/school";

export const CLASS_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

// Class photos are stored as documents whose JSON metadata (in `description`) carries kind = "classPhoto".
const CLASS_PHOTO_MARKER = '%"kind":"classPhoto"%';

export const classPhotoCutoff = () => new Date(Date.now() - CLASS_PHOTO_TTL_MS);

export const isClassPhoto = (description?: string | null) => (description ?? "").includes('"kind":"classPhoto"');

export const isExpiredClassPhoto = (doc: Record<string, any>) =>
  isClassPhoto(doc.description) && new Date(doc.createdAt).getTime() < classPhotoCutoff().getTime();

/** SQL: row is a class photo older than the retention window. */
export const expiredClassPhotoSql = () =>
  sql`coalesce(${documentsTable.description}, '') like ${CLASS_PHOTO_MARKER} and ${documentsTable.createdAt} < ${classPhotoCutoff()}`;
