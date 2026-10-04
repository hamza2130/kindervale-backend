import type { ReportType } from "models/school";

/**
 * Which report-card template a class uses. Mirrors the two real templates the client sent:
 * Grade 1/2 get the 9-section academic report (separate Urdu/Science/Islamiyat sections, a
 * General Remarks close); every younger class (School Readiness, Pre-Nursery, Nursery, KG) gets
 * the 7-section early-years report instead. Derived from className rather than stored, the same
 * pattern as classNameToPortal() in portal-scope.ts -- a class named "Grade 3" added later would
 * resolve correctly with no code change, since nothing actually enumerates class names here.
 */
export type ReportBand = "academic" | "earlyYears";

export const reportBandFor = (className: string | null | undefined): ReportBand =>
  /^grade/i.test((className ?? "").trim()) ? "academic" : "earlyYears";

type SubjectLabels<Keys extends string> = Record<Keys, string>;

export type AcademicSubjectKey = "english" | "urdu" | "maths" | "science" | "islamiyat" | "physical" | "arts" | "social" | "general";
export type EarlyYearsSubjectKey = "social" | "physical" | "communication" | "literacy" | "numeracy" | "world" | "arts";

const ACADEMIC_SUBJECTS: AcademicSubjectKey[] = ["english", "urdu", "maths", "science", "islamiyat", "physical", "arts", "social", "general"];
const EARLY_YEARS_SUBJECTS: EarlyYearsSubjectKey[] = ["social", "physical", "communication", "literacy", "numeracy", "world", "arts"];

const ACADEMIC_LABELS: Record<ReportType, SubjectLabels<AcademicSubjectKey>> = {
  MIDTERM: {
    english: "English",
    urdu: "Urdu",
    maths: "Maths",
    science: "Science",
    islamiyat: "Islamiyat",
    physical: "Physical Development",
    arts: "Visual Arts",
    social: "Social and Emotional Development",
    general: "General Remarks"
  },
  FINAL: {
    english: "English",
    urdu: "Urdu",
    maths: "Maths",
    science: "Science",
    islamiyat: "Islamiyat",
    physical: "Physical Development",
    arts: "Visual and Performing Arts",
    social: "Social and Emotional Development",
    general: "General Remarks"
  }
};

const EARLY_YEARS_LABELS: Record<ReportType, SubjectLabels<EarlyYearsSubjectKey>> = {
  MIDTERM: {
    social: "Personal, Social & Emotional Development",
    physical: "Physical Development",
    communication: "Language & Communication",
    literacy: "Literacy",
    numeracy: "Numeracy",
    world: "Understanding the World",
    arts: "Expressive Art & Design"
  },
  FINAL: {
    social: "Personal, Social and Emotional Development",
    physical: "Physical Development",
    communication: "Communication and Language",
    literacy: "Literacy",
    numeracy: "Numeracy",
    world: "Knowledge and Understanding of the World",
    arts: "Expressive Arts and Design"
  }
};

/** The ordered subject keys a given class/report-type combination uses. */
export const reportSubjectsFor = (className: string | null | undefined): readonly string[] =>
  reportBandFor(className) === "academic" ? ACADEMIC_SUBJECTS : EARLY_YEARS_SUBJECTS;

/** The exact label text for every subject key, for this class's band and report period. */
export const reportLabelsFor = (className: string | null | undefined, reportType: ReportType): Record<string, string> =>
  reportBandFor(className) === "academic" ? ACADEMIC_LABELS[reportType] : EARLY_YEARS_LABELS[reportType];
