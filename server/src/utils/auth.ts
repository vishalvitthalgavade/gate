import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "./env.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { userId: string };
    return decoded;
  } catch {
    return null;
  }
}
