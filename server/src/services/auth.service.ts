import { prisma } from "../utils/prisma.js";
import { hashPassword, verifyPassword, generateToken } from "../utils/auth.js";
import { DEFAULT_GATE_EXAM_DATE, DEFAULT_PREP_START_DATE } from "../utils/env.js";
import type { RegisterInput, LoginInput } from "../validators/auth.validator.js";

export async function registerUser(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      settings: {
        create: {
          examDate: new Date(DEFAULT_GATE_EXAM_DATE),
          preparationStartDate: new Date(DEFAULT_PREP_START_DATE),
        },
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const token = generateToken(user.id);

  return { user, token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);

  if (!isValid) {
    throw new Error("Invalid credentials");
  }

  const token = generateToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    },
    token,
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
      settings: {
        select: {
          examDate: true,
          preparationStartDate: true,
          timezone: true,
          dailyStudyGoalMinutes: true,
          dailyPomodoroGoal: true,
          dailyQuestionGoal: true,
          soundEnabled: true,
          volume: true,
          completionSound: true,
          pomodoroWorkMinutes: true,
          pomodoroShortBreak: true,
          pomodoroLongBreak: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}
