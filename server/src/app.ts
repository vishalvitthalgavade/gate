import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error.middleware.js";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { env } from "./utils/env.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ success: true, data: { name: "GATEFLOW API" } });
  });

  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);

  app.use(errorHandler);

  return app;
}
