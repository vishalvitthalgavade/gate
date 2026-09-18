export type HealthPayload = {
  status: "ok";
  service: string;
  database: "up" | "down";
  examDate: string;
};
