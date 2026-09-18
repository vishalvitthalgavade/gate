import { create } from "zustand";
import type { User } from "../../shared/auth.types";
import { login, register, logout as apiLogout, getCurrentUser, setToken, getToken, removeToken } from "../lib/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isLoading: false,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    const response = await login({ email, password });

    if (response.success && response.data) {
      setToken(response.data.token);
      set({
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } else {
      set({ isLoading: false });
      return { success: false, error: !response.success ? response.error?.message : "Login failed" };
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true });
    const response = await register({ email, password, name });

    if (response.success && response.data) {
      setToken(response.data.token);
      set({
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      return { success: true };
    } else {
      set({ isLoading: false });
      return { success: false, error: !response.success ? response.error?.message : "Registration failed" };
    }
  },

  logout: () => {
    apiLogout();
    removeToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: async () => {
    const token = getToken();
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null });
      return;
    }

    set({ isLoading: true });
    const response = await getCurrentUser(token);

    if (response.success && response.data) {
      set({
        user: response.data,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      removeToken();
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
