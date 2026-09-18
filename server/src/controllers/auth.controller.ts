import type { Request, Response } from "express";
import { registerUser, loginUser, getCurrentUser } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

export async function register(req: Request, res: Response) {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        success: false,
        error: { message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: "Registration failed" },
      });
    }
  }
}

export async function login(req: Request, res: Response) {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({
        success: false,
        error: { message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: "Login failed" },
      });
    }
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: "Unauthorized" },
      });
      return;
    }

    const user = await getCurrentUser(userId);

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(404).json({
        success: false,
        error: { message: error.message },
      });
    } else {
      res.status(500).json({
        success: false,
        error: { message: "Failed to get user" },
      });
    }
  }
}

export async function logout(_req: Request, res: Response) {
  res.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
}
