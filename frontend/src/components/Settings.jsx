import {
  User,
  Mail,
  Settings as SettingsIcon,
  Sun,
  Moon,
  ShieldCheck,
  LogOut,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const isDark = theme === "dark";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const initial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      className={`min-h-full w-full overflow-x-hidden px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8 ${
        isDark ? "bg-[#0b1120] text-white" : "bg-gray-50 text-gray-900"
      }`}
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 sm:space-y-6">
        {/* Header */}
        <div
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            isDark
              ? "border-zinc-800 bg-zinc-900/80"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600/15 text-xl font-bold text-purple-400">
              {initial}
            </div>

            <div className="min-w-0">
              <h1 className="text-2xl font-bold sm:text-3xl">
                Settings
              </h1>
              <p
                className={`mt-1 text-sm ${
                  isDark ? "text-zinc-500" : "text-gray-500"
                }`}
              >
                Manage your account and app preferences.
              </p>
            </div>
          </div>
        </div>

        {/* Profile */}
        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            isDark
              ? "border-zinc-800 bg-zinc-900/80"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <User size={21} />
            </div>

            <div>
              <h2 className="font-semibold">Profile</h2>
              <p
                className={`text-xs ${
                  isDark ? "text-zinc-500" : "text-gray-500"
                }`}
              >
                Your account information
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className={`mb-2 block text-xs font-medium ${
                  isDark ? "text-zinc-400" : "text-gray-500"
                }`}
              >
                Name
              </label>

              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isDark
                    ? "border-zinc-800 bg-zinc-950 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-900"
                }`}
              >
                <User size={18} className="shrink-0 text-purple-400" />
                <span className="truncate text-sm">
                  {user?.name || "Not available"}
                </span>
              </div>
            </div>

            <div>
              <label
                className={`mb-2 block text-xs font-medium ${
                  isDark ? "text-zinc-400" : "text-gray-500"
                }`}
              >
                Email
              </label>

              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  isDark
                    ? "border-zinc-800 bg-zinc-950 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-900"
                }`}
              >
                <Mail size={18} className="shrink-0 text-purple-400" />
                <span className="truncate text-sm">
                  {user?.email || "Not available"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            isDark
              ? "border-zinc-800 bg-zinc-900/80"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <SettingsIcon size={21} />
            </div>

            <div>
              <h2 className="font-semibold">Appearance</h2>
              <p
                className={`text-xs ${
                  isDark ? "text-zinc-500" : "text-gray-500"
                }`}
              >
                Customize how the tracker looks
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
              isDark
                ? "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon size={20} className="text-purple-400" />
              ) : (
                <Sun size={20} className="text-purple-500" />
              )}

              <div>
                <p className="text-sm font-medium">
                  {isDark ? "Dark Mode" : "Light Mode"}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    isDark ? "text-zinc-500" : "text-gray-500"
                  }`}
                >
                  Click to switch theme
                </p>
              </div>
            </div>

            <div
              className={`relative h-6 w-11 rounded-full ${
                isDark ? "bg-purple-600" : "bg-gray-300"
              }`}
            >
              <div
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  isDark ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </div>
          </button>
        </section>

        {/* Account */}
        <section
          className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${
            isDark
              ? "border-zinc-800 bg-zinc-900/80"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 p-2.5 text-green-400">
              <ShieldCheck size={21} />
            </div>

            <div>
              <h2 className="font-semibold">Account</h2>
              <p
                className={`text-xs ${
                  isDark ? "text-zinc-500" : "text-gray-500"
                }`}
              >
                Manage your signed-in account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition ${
              isDark
                ? "border-red-500/10 text-red-400 hover:bg-red-950/30"
                : "border-red-100 text-red-600 hover:bg-red-50"
            }`}
          >
            <LogOut size={18} />
            Logout
          </button>
        </section>
      </div>
    </div>
  );
}
