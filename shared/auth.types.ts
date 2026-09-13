export type User = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  settings?: {
    examDate: string;
    preparationStartDate: string;
    timezone: string;
    dailyStudyGoalMinutes: number;
    dailyPomodoroGoal: number;
    dailyQuestionGoal: number;
    soundEnabled: boolean;
    volume: number;
    completionSound: string;
    pomodoroWorkMinutes: number;
    pomodoroShortBreak: number;
    pomodoroLongBreak: number;
  };
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
};

export type LoginInput = {
  email: string;
  password: string;
};
