import type { Request, Response } from "express";
import { env } from "../utils/env.js";
import { prisma } from "../utils/prisma.js";

export async function getHealth(_req: Request, res: Response) {
  let database: "up" | "down" = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  res.json({
    success: true,
    data: {
      status: "ok",
      service: "gateflow-api",
      database,
      examDate: env.gateExamDate,
    },
  });
}
