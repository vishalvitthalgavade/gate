export const DEFAULT_GATE_EXAM_DATE = process.env.GATE_EXAM_DATE ?? "2027-02-06";
export const DEFAULT_PREP_START_DATE = process.env.GATE_PREP_START_DATE ?? "2026-09-01";

export const DEFAULT_GATE_CSE_SUBJECTS = [
  "Engineering Mathematics",
  "Digital Logic",
  "Computer Organization and Architecture",
  "Programming and Data Structures",
  "Algorithms",
  "Theory of Computation",
  "Compiler Design",
  "Operating Systems",
  "Databases",
  "Computer Networks",
] as const;
