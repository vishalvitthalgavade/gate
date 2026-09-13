import { apiUrl } from "./utils";
import type { ApiResponse } from "../../shared/types";
import type { AuthResponse, RegisterInput, LoginInput, User } from "../../shared/auth.types";

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: { message: "Network error" },
    };
  }
}

export async function register(input: RegisterInput): Promise<ApiResponse<AuthResponse>> {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<ApiResponse<AuthResponse>> {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<ApiResponse<{ message: string }>> {
  return apiRequest<{ message: string }>("/api/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser(token: string): Promise<ApiResponse<User>> {
  return apiRequest<User>("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("auth_token", token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("auth_token");
  }
  return null;
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("auth_token");
  }
}
