import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

import Dashboard from "./pages/Dashboard";
import Timer from "./pages/Timer";
import Heatmap from "./pages/Heatmap";
import Syllabus from "./pages/Syllabus";
import History from "./pages/History";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import Leaderboard from "./pages/Leaderboard";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

import { StudyProvider } from "./context/StudyContext";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { TimerProvider } from "./context/TimerContext";

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /*
  ----------------------------------------------------
  GATE EXAM COUNTDOWN
  ----------------------------------------------------
  */

  const GATE_EXAM_DATE =
    "2027-02-07T00:00:00+05:30";

  const [daysLeft, setDaysLeft] = useState(() => {
    const now = new Date();
    const examDate = new Date(
      GATE_EXAM_DATE
    );

    return Math.max(
      0,
      Math.ceil(
        (examDate.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );
  });

  useEffect(() => {
    function updateDaysLeft() {
      const now = new Date();
      const examDate = new Date(
        GATE_EXAM_DATE
      );

      setDaysLeft(
        Math.max(
          0,
          Math.ceil(
            (examDate.getTime() -
              now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        )
      );
    }

    updateDaysLeft();

    const interval = setInterval(
      updateDaysLeft,
      60 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, []);

  return (
    <BrowserRouter>
      {/* ==================================================
          NORMAL USER AUTH
      ================================================== */}

      <AuthProvider>
        {/* ==================================================
            ADMIN AUTH

            This is separate from normal user auth.
        ================================================== */}

        <AdminAuthProvider>
          <StudyProvider>
            <TimerProvider>
            <Routes>

              {/* ============================================
                  NORMAL USER PUBLIC PAGES
              ============================================ */}

              <Route
                path="/login"
                element={<Login />}
              />

              <Route
                path="/signup"
                element={<Signup />}
              />

              {/* ============================================
                  ADMIN PUBLIC LOGIN
              ============================================ */}

              <Route
                path="/admin/login"
                element={<AdminLogin />}
              />

              {/* ============================================
                  ADMIN PROTECTED APPLICATION
              ============================================ */}

              <Route
                element={
                  <AdminProtectedRoute />
                }
              >
                <Route
                  path="/admin"
                  element={<AdminDashboard />}
                />
              </Route>

              {/* ============================================
                  NORMAL USER PROTECTED APPLICATION
              ============================================ */}

              <Route
                element={<ProtectedRoute />}
              >
                <Route
                  path="/*"
                  element={
                    <div className="gate-app-shell min-h-screen bg-gray-50 text-gray-900 dark:bg-[#0b1120] dark:text-white">

                      {/* ====================================
                          SIDEBAR
                      ==================================== */}

                      <Sidebar
                        isOpen={sidebarOpen}
                        setIsOpen={setSidebarOpen}
                      />

                      <div className="md:ml-64">

                        {/* ==================================
                            MOBILE HEADER
                        ================================== */}

                        <header className="gate-mobile-header sticky top-0 z-30 flex h-16 items-center border-b px-4 backdrop-blur md:hidden">

                          <button
                            onClick={() =>
                              setSidebarOpen(true)
                            }
                            className="rounded-lg p-2 text-zinc-300 hover:bg-zinc-900"
                          >
                            <Menu size={24} />
                          </button>

                          <div className="ml-3 min-w-0">
                            <h1 className="text-base font-semibold text-white">
                              GATE CSE
                            </h1>

                            <p className="text-xs text-zinc-500">
                              Study Tracker
                            </p>
                          </div>

                          {/* GATE DAYS COUNTER */}

                          <div className="ml-auto flex shrink-0 items-center gap-2 rounded-lg bg-purple-500/10 px-2.5 py-1.5">

                            <div className="text-right leading-none">
                              <p className="text-[9px] font-semibold uppercase tracking-wider text-purple-300">
                                GATE 2027
                              </p>

                              <p className="mt-0.5 text-[8px] text-zinc-500">
                                Days left
                              </p>
                            </div>

                            <div className="text-right leading-none">
                              <p className="text-lg font-extrabold text-white">
                                {daysLeft}
                              </p>

                              <p className="text-[8px] font-semibold text-purple-400">
                                DAYS
                              </p>
                            </div>

                          </div>
                        </header>

                        {/* ==================================
                            MAIN CONTENT
                        ================================== */}

                        <main className="gate-main-content min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">

                          <div className="gate-page-enter mx-auto w-full max-w-7xl">

                            <Routes>

                              {/* Dashboard */}

                              <Route
                                path="/"
                                element={
                                  <Dashboard />
                                }
                              />

                              {/* Timer */}

                              <Route
                                path="/timer"
                                element={
                                  <Timer />
                                }
                              />

                              {/* Heatmap */}

                              <Route
                                path="/heatmap"
                                element={
                                  <Heatmap />
                                }
                              />

                              {/* Syllabus */}

                              <Route
                                path="/syllabus"
                                element={
                                  <Syllabus />
                                }
                              />

                              {/* History */}

                              <Route
                                path="/history"
                                element={
                                  <History />
                                }
                              />

                              {/* Statistics */}

                              <Route
                                path="/statistics"
                                element={
                                  <Statistics />
                                }
                              />

                              {/* Leaderboard */}

                              <Route
                                path="/leaderboard"
                                element={
                                  <Leaderboard />
                                }
                              />

                              {/* Settings */}

                              <Route
                                path="/settings"
                                element={
                                  <Settings />
                                }
                              />

                            </Routes>

                          </div>

                        </main>

                      </div>

                    </div>
                  }
                />
              </Route>

            </Routes>
            </TimerProvider>
          </StudyProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;