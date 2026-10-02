export const DEFAULT_GATE_EXAM_DATE = "2027-02-01";
export const GATE_EXAM_DATE_STORAGE_KEY = "gate-exam-date";
export const GATE_EXAM_DATE_CHANGE_EVENT = "gate-exam-date-change";

export function isValidExamDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function getGateExamDate() {
  try {
    const saved = localStorage.getItem(GATE_EXAM_DATE_STORAGE_KEY);
    if (isValidExamDate(saved)) return saved;
  } catch {
    // Fall back to the configured default when storage is unavailable.
  }
  return DEFAULT_GATE_EXAM_DATE;
}

export function setGateExamDate(value) {
  if (!isValidExamDate(value)) return false;
  try {
    localStorage.setItem(GATE_EXAM_DATE_STORAGE_KEY, value);
  } catch {
    return false;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GATE_EXAM_DATE_CHANGE_EVENT));
  }
  return true;
}

export function getGateDaysLeft(now = new Date(), examDateValue = getGateExamDate()) {
  if (!isValidExamDate(examDateValue)) return 0;
  const [year, month, day] = examDateValue.split("-").map(Number);
  const examDate = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(
    0,
    Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function getGateExamYear(examDateValue = getGateExamDate()) {
  return isValidExamDate(examDateValue)
    ? new Date(`${examDateValue}T00:00:00`).getFullYear()
    : new Date(`${DEFAULT_GATE_EXAM_DATE}T00:00:00`).getFullYear();
}
