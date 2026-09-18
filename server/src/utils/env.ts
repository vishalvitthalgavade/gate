import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  gateExamDate: process.env.GATE_EXAM_DATE ?? "2027-02-06",
  gatePrepStartDate: process.env.GATE_PREP_START_DATE ?? "2026-09-01",
};

export const DEFAULT_GATE_EXAM_DATE = env.gateExamDate;
export const DEFAULT_PREP_START_DATE = env.gatePrepStartDate;
