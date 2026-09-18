export type HealthStatus = {
  status: "ok";
  service: string;
  database: "up" | "down";
  examDate: string;
};
