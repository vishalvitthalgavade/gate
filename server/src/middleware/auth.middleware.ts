import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.js";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: { message: "No token provided" },
    });
    return;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({
      success: false,
      error: { message: "Invalid or expired token" },
    });
    return;
  }

  (req as any).userId = decoded.userId;
  next();
}
