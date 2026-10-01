export const GATE_EXAM_DATE = "2027-02-01T00:00:00+05:30";

export function getGateDaysLeft(now = new Date()) {
  const examDate = new Date(GATE_EXAM_DATE);
  return Math.max(
    0,
    Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
}
