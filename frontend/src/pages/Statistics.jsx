import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  Clock,
  CalendarDays,
  Timer,
  BookOpen,
  Flame,
  TrendingUp,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";

import { useStudy } from "../context/useStudy";
import { useTheme } from "../context/ThemeContext";

// --------------------------------------------------
// DATE HELPERS
// --------------------------------------------------

function getSessionDate(session) {
  return (
    session.completedAt ||
    session.startedAt ||
    session.createdAt ||
    session.date ||
    null
  );
}

function getDateKey(date) {
  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function formatFullDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// --------------------------------------------------
// TIME FORMAT
// --------------------------------------------------

function formatStudyTime(seconds) {
  const totalSeconds = Math.max(0, Number(seconds) || 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatMinutes(minutes) {
  const value = Math.round(minutes);

  if (value >= 60) {
    const hours = Math.floor(value / 60);
    const mins = value % 60;

    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${value}m`;
}

// --------------------------------------------------
// STREAK
// --------------------------------------------------

function calculateStreak(sessions) {
  const dates = new Set();

  sessions.forEach((session) => {
    const date = getSessionDate(session);

    if (date && Number(session.duration) > 0) {
      const key = getDateKey(date);

      if (key) {
        dates.add(key);
      }
    }
  });

  if (dates.size === 0) {
    return 0;
  }

  const today = new Date();
  const todayKey = getDateKey(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getDateKey(yesterday);

  let currentDate;

  if (dates.has(todayKey)) {
    currentDate = new Date(`${todayKey}T12:00:00`);
  } else if (dates.has(yesterdayKey)) {
    currentDate = new Date(`${yesterdayKey}T12:00:00`);
  } else {
    return 0;
  }

  let streak = 0;

  while (true) {
    const key = getDateKey(currentDate);

    if (!dates.has(key)) {
      break;
    }

    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

function calculateLongestStreak(sessions) {
  const dates = new Set();

  sessions.forEach((session) => {
    const date = getSessionDate(session);

    if (date && Number(session.duration) > 0) {
      const key = getDateKey(date);

      if (key) {
        dates.add(key);
      }
    }
  });

  if (dates.size === 0) {
    return 0;
  }

  const sortedDates = [...dates].sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const previous = new Date(`${sortedDates[i - 1]}T12:00:00`);
    const currentDate = new Date(`${sortedDates[i]}T12:00:00`);

    const difference = Math.round(
      (currentDate - previous) / (1000 * 60 * 60 * 24)
    );

    if (difference === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

// --------------------------------------------------
// CUSTOM TOOLTIP
// --------------------------------------------------

function StudyTooltip({ active, payload, isDark }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const data = payload[0]?.payload;

  if (!data) {
    return null;
  }

  return (
    <div
      style={{
        background: isDark ? "#18181b" : "#ffffff",
        border: `1px solid ${isDark ? "#3f3f46" : "#e5e7eb"}`,
        borderRadius: "12px",
        padding: "14px 16px",
        boxShadow: isDark
          ? "0 8px 25px rgba(0,0,0,0.35)"
          : "0 8px 25px rgba(0,0,0,0.10)",
        minWidth: "190px",
      }}
    >
      <p
        style={{
          margin: "0 0 8px",
          fontWeight: 700,
          fontSize: "14px",
          color: isDark ? "#ffffff" : "#111827",
        }}
      >
        {formatFullDate(data.date)}
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          fontSize: "13px",
        }}
      >
        <span style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}>
          Study time
        </span>

        <strong style={{ color: isDark ? "#ffffff" : "#111827" }}>
          {formatStudyTime(data.seconds)}
        </strong>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          marginTop: "5px",
          fontSize: "13px",
        }}
      >
        <span style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}>
          Sessions
        </span>

        <strong style={{ color: isDark ? "#ffffff" : "#111827" }}>
          {data.sessions}
        </strong>
      </div>
    </div>
  );
}

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function Statistics() {
  const { sessions = [] } = useStudy();
  const { theme } = useTheme();

  const isDark = theme === "dark";

  const [range, setRange] = useState("30");

  // ------------------------------------------------
  // THEME CLASSES
  // ------------------------------------------------

  const pageBg = isDark ? "bg-zinc-950" : "bg-gray-50";
  const cardBg = isDark ? "bg-zinc-900" : "bg-white";
  const cardBorder = isDark ? "border-zinc-800" : "border-gray-200";
  const divider = isDark ? "border-zinc-800" : "border-gray-100";

  const heading = isDark ? "text-white" : "text-gray-900";
  const bodyText = isDark ? "text-zinc-300" : "text-gray-700";
  const mutedText = isDark ? "text-zinc-400" : "text-gray-500";
  const subtleText = isDark ? "text-zinc-500" : "text-gray-400";

  // ------------------------------------------------
  // BASIC STATISTICS
  // ------------------------------------------------

  const basicStats = useMemo(() => {
    const totalSeconds = sessions.reduce(
      (total, session) =>
        total + (Number(session.duration) || 0),
      0
    );

    const studyDays = new Set();

    sessions.forEach((session) => {
      const date = getSessionDate(session);

      if (date && Number(session.duration) > 0) {
        const key = getDateKey(date);

        if (key) {
          studyDays.add(key);
        }
      }
    });

    const averageSession =
      sessions.length > 0
        ? Math.round(totalSeconds / sessions.length)
        : 0;

    const longestSession =
      sessions.length > 0
        ? Math.max(
            ...sessions.map(
              (session) => Number(session.duration) || 0
            )
          )
        : 0;

    return {
      totalSeconds,
      studyDays: studyDays.size,
      averageSession,
      longestSession,
    };
  }, [sessions]);

  // ------------------------------------------------
  // SUBJECT STATISTICS
  // ------------------------------------------------

  const subjectStats = useMemo(() => {
    const map = {};

    sessions.forEach((session) => {
      const subject =
        session.subject?.trim() || "No subject";

      map[subject] =
        (map[subject] || 0) +
        (Number(session.duration) || 0);
    });

    return Object.entries(map)
      .map(([subject, seconds]) => ({
        subject,
        seconds,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [sessions]);

  // ------------------------------------------------
  // TIMER STATISTICS
  // ------------------------------------------------

  const timerStats = useMemo(() => {
    let pomodoro = 0;
    let regular = 0;

    sessions.forEach((session) => {
      const seconds = Number(session.duration) || 0;

      const type = String(
        session.type || ""
      ).toLowerCase();

      if (type.includes("pomodoro")) {
        pomodoro += seconds;
      } else if (type.includes("regular")) {
        regular += seconds;
      }
    });

    return {
      pomodoro,
      regular,
    };
  }, [sessions]);

  // ------------------------------------------------
  // LINE GRAPH DATA
  // ------------------------------------------------

  const chartData = useMemo(() => {
    const today = new Date();
    const days = range === "7" ? 7 : 30;
    const dailyMap = {};

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);

      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - i);

      const key = getDateKey(date);

      dailyMap[key] = {
        date: key,
        seconds: 0,
        sessions: 0,
      };
    }

    sessions.forEach((session) => {
      const sessionDate = getSessionDate(session);

      if (!sessionDate) {
        return;
      }

      const key = getDateKey(sessionDate);

      if (dailyMap[key]) {
        dailyMap[key].seconds +=
          Number(session.duration) || 0;

        dailyMap[key].sessions += 1;
      }
    });

    return Object.values(dailyMap);
  }, [sessions, range]);

  // ------------------------------------------------
  // GRAPH MAX
  // ------------------------------------------------

  const chartMax = useMemo(() => {
    const maxSeconds = Math.max(
      ...chartData.map((item) => item.seconds),
      0
    );

    const maxMinutes = Math.ceil(maxSeconds / 60);

    if (maxMinutes <= 60) {
      return 60;
    }

    return Math.ceil(maxMinutes / 60) * 60;
  }, [chartData]);

  // ------------------------------------------------
  // STREAKS
  // ------------------------------------------------

  const currentStreak = useMemo(
    () => calculateStreak(sessions),
    [sessions]
  );

  const longestStreak = useMemo(
    () => calculateLongestStreak(sessions),
    [sessions]
  );

  // ------------------------------------------------
  // BEST DAY
  // ------------------------------------------------

  const bestDay = useMemo(() => {
    if (chartData.length === 0) {
      return null;
    }

    return chartData.reduce((best, current) =>
      current.seconds > best.seconds ? current : best
    );
  }, [chartData]);

  // ------------------------------------------------
  // MOST STUDIED SUBJECT
  // ------------------------------------------------

  const mostStudiedSubject =
    subjectStats.length > 0
      ? subjectStats[0]
      : null;

  // ------------------------------------------------
  // EMPTY STATE
  // ------------------------------------------------

  if (sessions.length === 0) {
    return (
      <div
        className={`min-h-screen p-4 transition-colors duration-200 sm:p-6 lg:p-8 ${pageBg}`}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="text-sm font-medium text-indigo-500">
              GATE CSE
            </p>

            <h1
              className={`mt-1 text-3xl font-bold ${heading}`}
            >
              Study Analytics
            </h1>

            <p className={`mt-2 ${mutedText}`}>
              Your study trends will appear here after
              you complete your first session.
            </p>
          </div>

          <div
            className={`rounded-2xl border p-10 text-center shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <BarChart3
              className={`mx-auto mb-4 ${
                isDark ? "text-zinc-600" : "text-gray-400"
              }`}
              size={48}
            />

            <h2
              className={`text-xl font-semibold ${heading}`}
            >
              No study data yet
            </h2>

            <p className={`mt-2 ${mutedText}`}>
              Complete a timer session to start building
              your statistics.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------
  // UI
  // ------------------------------------------------

  return (
    <div
      className={`min-h-screen p-4 transition-colors duration-200 sm:p-6 lg:p-8 ${pageBg}`}
    >
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-500">
              <BarChart3 size={19} />

              <span className="text-sm font-semibold">
                STUDY ANALYTICS
              </span>
            </div>

            <h1
              className={`mt-1 text-3xl font-bold tracking-tight ${heading}`}
            >
              Your Study Insights
            </h1>

            <p className={`mt-2 ${mutedText}`}>
              Understand how consistently and efficiently
              you are preparing for GATE.
            </p>
          </div>

          {/* RANGE SELECTOR */}
          <div
            className={`flex w-fit rounded-xl border p-1 shadow-sm ${
              isDark
                ? "border-zinc-700 bg-zinc-900"
                : "border-gray-200 bg-white"
            }`}
          >
            <button
              type="button"
              onClick={() => setRange("7")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                range === "7"
                  ? isDark
                    ? "bg-white text-zinc-900"
                    : "bg-gray-900 text-white"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              7 Days
            </button>

            <button
              type="button"
              onClick={() => setRange("30")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                range === "30"
                  ? isDark
                    ? "bg-white text-zinc-900"
                    : "bg-gray-900 text-white"
                  : isDark
                    ? "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        {/* INSIGHT STRIP */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* TOTAL STUDY */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${mutedText}`}>
                  Total Study Time
                </p>

                <p
                  className={`mt-2 text-2xl font-bold ${heading}`}
                >
                  {formatStudyTime(
                    basicStats.totalSeconds
                  )}
                </p>
              </div>

              <div
                className={`rounded-xl p-3 ${
                  isDark
                    ? "bg-indigo-950 text-indigo-400"
                    : "bg-indigo-50 text-indigo-600"
                }`}
              >
                <Clock size={21} />
              </div>
            </div>
          </div>

          {/* STUDY DAYS */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${mutedText}`}>
                  Active Study Days
                </p>

                <p
                  className={`mt-2 text-2xl font-bold ${heading}`}
                >
                  {basicStats.studyDays}
                </p>
              </div>

              <div
                className={`rounded-xl p-3 ${
                  isDark
                    ? "bg-blue-950 text-blue-400"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <CalendarDays size={21} />
              </div>
            </div>
          </div>

          {/* CURRENT STREAK */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${mutedText}`}>
                  Current Streak
                </p>

                <p
                  className={`mt-2 text-2xl font-bold ${heading}`}
                >
                  {currentStreak}{" "}
                  <span
                    className={`text-base font-medium ${mutedText}`}
                  >
                    days
                  </span>
                </p>
              </div>

              <div
                className={`rounded-xl p-3 ${
                  isDark
                    ? "bg-orange-950 text-orange-400"
                    : "bg-orange-50 text-orange-500"
                }`}
              >
                <Flame size={21} />
              </div>
            </div>
          </div>
        </div>

        {/* MAIN GRAPH */}
        <section
          className={`mb-6 overflow-hidden rounded-2xl border shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
        >
          <div
            className={`border-b px-5 py-5 sm:px-7 ${divider}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  className={`text-lg font-bold ${heading}`}
                >
                  Study Time Trend
                </h2>

                <p className={`mt-1 text-sm ${mutedText}`}>
                  Daily study time for the selected period
                </p>
              </div>

              <div
                className={`flex items-center gap-2 text-sm ${mutedText}`}
              >
                {isDark ? (
                  <Moon size={17} />
                ) : (
                  <Sun size={17} />
                )}

                {isDark
                  ? "Dark mode"
                  : "Light mode"}{" "}
                • Hover a point
              </div>
            </div>
          </div>

          {/* GRAPH */}
          <div
            className={`px-2 pb-6 pt-6 transition-colors duration-200 sm:px-6 ${
              isDark ? "bg-zinc-900" : "bg-white"
            }`}
          >
            <div className="h-[320px] w-full sm:h-[380px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 15,
                    left: 0,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={
                      isDark ? "#3f3f46" : "#e5e7eb"
                    }
                  />

                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{
                      fontSize: 11,
                      fill: isDark
                        ? "#a1a1aa"
                        : "#6b7280",
                    }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={20}
                  />

                  <YAxis
                    domain={[0, chartMax]}
                    tickFormatter={(value) =>
                      formatMinutes(value)
                    }
                    tick={{
                      fontSize: 11,
                      fill: isDark
                        ? "#a1a1aa"
                        : "#6b7280",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={55}
                  />

                  <Tooltip
                    content={(props) => (
                      <StudyTooltip
                        {...props}
                        isDark={isDark}
                      />
                    )}
                    cursor={{
                      stroke: isDark
                        ? "#71717a"
                        : "#d1d5db",
                      strokeDasharray: "4 4",
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="seconds"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{
                      r: 3,
                      fill: "#6366f1",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 7,
                      stroke: isDark
                        ? "#18181b"
                        : "#ffffff",
                      strokeWidth: 3,
                    }}
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p
              className={`mt-3 text-center text-xs ${subtleText}`}
            >
              Study time is calculated from completed timer
              sessions.
            </p>
          </div>
        </section>

        {/* QUICK INSIGHTS */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* AVERAGE */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-purple-950 text-purple-400"
                    : "bg-purple-50 text-purple-600"
                }`}
              >
                <Timer size={19} />
              </div>

              <span
                className={`text-sm font-medium ${mutedText}`}
              >
                Average Session
              </span>
            </div>

            <p
              className={`text-xl font-bold ${heading}`}
            >
              {formatStudyTime(
                basicStats.averageSession
              )}
            </p>
          </div>

          {/* LONGEST */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-green-950 text-green-400"
                    : "bg-green-50 text-green-600"
                }`}
              >
                <Clock size={19} />
              </div>

              <span
                className={`text-sm font-medium ${mutedText}`}
              >
                Longest Session
              </span>
            </div>

            <p
              className={`text-xl font-bold ${heading}`}
            >
              {formatStudyTime(
                basicStats.longestSession
              )}
            </p>
          </div>

          {/* LONGEST STREAK */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-orange-950 text-orange-400"
                    : "bg-orange-50 text-orange-500"
                }`}
              >
                <Flame size={19} />
              </div>

              <span
                className={`text-sm font-medium ${mutedText}`}
              >
                Longest Streak
              </span>
            </div>

            <p
              className={`text-xl font-bold ${heading}`}
            >
              {longestStreak}{" "}
              <span
                className={`text-sm font-medium ${mutedText}`}
              >
                days
              </span>
            </p>
          </div>

          {/* BEST DAY */}
          <div
            className={`rounded-2xl border p-5 shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  isDark
                    ? "bg-blue-950 text-blue-400"
                    : "bg-blue-50 text-blue-600"
                }`}
              >
                <TrendingUp size={19} />
              </div>

              <span
                className={`text-sm font-medium ${mutedText}`}
              >
                Best Day
              </span>
            </div>

            <p
              className={`text-xl font-bold ${heading}`}
            >
              {bestDay
                ? formatStudyTime(bestDay.seconds)
                : "0m"}
            </p>

            {bestDay && bestDay.seconds > 0 && (
              <p className={`mt-1 text-xs ${subtleText}`}>
                {formatDateLabel(bestDay.date)}
              </p>
            )}
          </div>
        </div>

        {/* SUBJECT + TIMER */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* SUBJECT BREAKDOWN */}
          <section
            className={`rounded-2xl border shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div
              className={`border-b px-6 py-5 ${divider}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-2.5 ${
                    isDark
                      ? "bg-indigo-950 text-indigo-400"
                      : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  <BookOpen size={20} />
                </div>

                <div>
                  <h2
                    className={`font-bold ${heading}`}
                  >
                    Subject Breakdown
                  </h2>

                  <p className={`text-sm ${mutedText}`}>
                    Where your study time goes
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {subjectStats.length === 0 ? (
                <p className={`text-sm ${mutedText}`}>
                  No subject data available.
                </p>
              ) : (
                <div className="space-y-5">
                  {subjectStats.map((item, index) => {
                    const percentage =
                      basicStats.totalSeconds > 0
                        ? (item.seconds /
                            basicStats.totalSeconds) *
                          100
                        : 0;

                    return (
                      <div key={item.subject}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                isDark
                                  ? "bg-zinc-800 text-zinc-300"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {index + 1}
                            </span>

                            <span
                              className={`truncate text-sm font-medium ${bodyText}`}
                            >
                              {item.subject}
                            </span>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`text-sm font-semibold ${heading}`}
                            >
                              {formatStudyTime(
                                item.seconds
                              )}
                            </span>

                            <span
                              className={`ml-2 text-xs ${subtleText}`}
                            >
                              {Math.round(
                                percentage
                              )}
                              %
                            </span>
                          </div>
                        </div>

                        <div
                          className={`h-2 overflow-hidden rounded-full ${
                            isDark
                              ? "bg-zinc-800"
                              : "bg-gray-100"
                          }`}
                        >
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* TIMER USAGE */}
          <section
            className={`rounded-2xl border shadow-sm transition-colors duration-200 ${cardBg} ${cardBorder}`}
          >
            <div
              className={`border-b px-6 py-5 ${divider}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-xl p-2.5 ${
                    isDark
                      ? "bg-purple-950 text-purple-400"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  <Timer size={20} />
                </div>

                <div>
                  <h2
                    className={`font-bold ${heading}`}
                  >
                    Timer Usage
                  </h2>

                  <p className={`text-sm ${mutedText}`}>
                    Time spent using each timer
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6">

              {/* POMODORO */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${bodyText}`}
                  >
                    Pomodoro
                  </span>

                  <span
                    className={`text-sm font-semibold ${heading}`}
                  >
                    {formatStudyTime(
                      timerStats.pomodoro
                    )}
                  </span>
                </div>

                <div
                  className={`h-3 overflow-hidden rounded-full ${
                    isDark
                      ? "bg-zinc-800"
                      : "bg-gray-100"
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{
                      width: `${
                        timerStats.pomodoro +
                          timerStats.regular >
                        0
                          ? (timerStats.pomodoro /
                              (timerStats.pomodoro +
                                timerStats.regular)) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* REGULAR */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${bodyText}`}
                  >
                    Regular Timer
                  </span>

                  <span
                    className={`text-sm font-semibold ${heading}`}
                  >
                    {formatStudyTime(
                      timerStats.regular
                    )}
                  </span>
                </div>

                <div
                  className={`h-3 overflow-hidden rounded-full ${
                    isDark
                      ? "bg-zinc-800"
                      : "bg-gray-100"
                  }`}
                >
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${
                        timerStats.pomodoro +
                          timerStats.regular >
                        0
                          ? (timerStats.regular /
                              (timerStats.pomodoro +
                                timerStats.regular)) *
                            100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* MOST STUDIED */}
              <div
                className={`mt-8 rounded-xl p-4 ${
                  isDark
                    ? "bg-zinc-800"
                    : "bg-gray-50"
                }`}
              >
                <p
                  className={`text-xs font-medium uppercase tracking-wide ${subtleText}`}
                >
                  Most Studied Subject
                </p>

                <p
                  className={`mt-1 text-lg font-bold ${heading}`}
                >
                  {mostStudiedSubject
                    ? mostStudiedSubject.subject
                    : "No subject"}
                </p>

                {mostStudiedSubject && (
                  <p
                    className={`mt-1 text-sm ${mutedText}`}
                  >
                    {formatStudyTime(
                      mostStudiedSubject.seconds
                    )}{" "}
                    total study time
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
