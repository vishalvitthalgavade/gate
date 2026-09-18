import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Trash2,
  Filter,
  Search,
  X,
  History as HistoryIcon,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from "lucide-react";

import { useStudy } from "../context/useStudy";
import { useTheme } from "../context/ThemeContext";


/* =========================================================
   HELPERS
========================================================= */

function formatDuration(seconds) {
  const totalSeconds = Math.max(
    0,
    Number(seconds) || 0
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}


function formatDate(dateValue) {
  if (!dateValue) {
    return "Unknown date";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}


function formatTime(dateValue) {
  if (!dateValue) {
    return "--";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function getSessionDate(session) {
  return (
    session.completedAt ||
    session.date ||
    session.createdAt ||
    session.startedAt
  );
}


function getDateKey(dateValue) {
  if (!dateValue) {
    return "unknown";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}


/* =========================================================
   TIMER TYPE HELPERS

   Handles both:
   "pomodoro"
   "Pomodoro"

   and:
   "regular"
   "Regular Timer"
========================================================= */

function normalizeType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}


function isPomodoro(type) {
  const value = normalizeType(type);

  return value === "pomodoro";
}


function isRegularTimer(type) {
  const value = normalizeType(type);

  return (
    value === "regular" ||
    value === "regular timer"
  );
}


function isStudySession(type) {
  const value = normalizeType(type);

  return (
    value === "study" ||
    value === "regular" ||
    value === "regular timer" ||
    value === "pomodoro"
  );
}


function getTypeLabel(type) {
  const value = normalizeType(type);

  if (value === "pomodoro") {
    return "Pomodoro";
  }

  if (
    value === "regular" ||
    value === "regular timer"
  ) {
    return "Regular Timer";
  }

  if (value === "study") {
    return "Study";
  }

  if (value === "shortbreak") {
    return "Short Break";
  }

  if (value === "longbreak") {
    return "Long Break";
  }

  return type || "Study";
}


function getTypeBadgeClass(type) {
  const value = normalizeType(type);

  if (value === "pomodoro") {
    return "border-purple-500/20 bg-purple-500/10 text-purple-600 dark:text-purple-300";
  }

  if (
    value === "regular" ||
    value === "regular timer"
  ) {
    return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300";
  }

  if (value === "study") {
    return "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-300";
  }

  if (
    value === "shortbreak" ||
    value === "longbreak"
  ) {
    return "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300";
  }

  return "border-gray-200 bg-gray-100 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}


/* =========================================================
   WEEK HELPERS

   Sunday = 0
   Monday = 1
   ...
   Saturday = 6
========================================================= */

function getStartOfWeek(date = new Date()) {
  const result = new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  result.setDate(
    result.getDate() -
      result.getDay()
  );

  return result;
}


function getEndOfWeek(date = new Date()) {
  const result = getStartOfWeek(date);

  result.setDate(
    result.getDate() + 6
  );

  result.setHours(
    23,
    59,
    59,
    999
  );

  return result;
}


function getStartOfMonth(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
    0,
    0,
    0,
    0
  );
}


function getEndOfMonth(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}


/* =========================================================
   HISTORY
========================================================= */

export default function History() {
  const {
    sessions,
    deleteSession,
    clearSessions,
    isLoading,
    isSyncing,
    isOnline,
  } = useStudy();

  const { theme } = useTheme();


  /* =======================================================
     FILTER STATE
  ======================================================= */

  const [filterType, setFilterType] =
    useState("all");

  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("all");


  /* =======================================================
     DELETE MODAL
  ======================================================= */

  const [deleteModal, setDeleteModal] =
    useState({
      open: false,
      type: null,
      sessionId: null,
    });


  /* =======================================================
     SORTED SESSIONS
  ======================================================= */

  const sortedSessions = useMemo(() => {
    return [...sessions].sort(
      (a, b) => {
        const dateA = new Date(
          getSessionDate(a)
        ).getTime();

        const dateB = new Date(
          getSessionDate(b)
        ).getTime();

        return dateB - dateA;
      }
    );
  }, [sessions]);


  /* =======================================================
     AVAILABLE DATES
  ======================================================= */

  const availableDates = useMemo(() => {
    const dates = new Map();

    sortedSessions.forEach(
      (session) => {
        const value =
          getSessionDate(session);

        if (!value) {
          return;
        }

        const key =
          getDateKey(value);

        if (key === "unknown") {
          return;
        }

        dates.set(
          key,
          formatDate(value)
        );
      }
    );

    return [...dates.entries()];
  }, [sortedSessions]);


  /* =======================================================
     ALL-TIME TOTAL

     This intentionally ignores filters.
  ======================================================= */

  const totalTimeStudied = useMemo(() => {
    return sessions.reduce(
      (total, session) =>
        total +
        (Number(session.duration) || 0),
      0
    );
  }, [sessions]);


  /* =======================================================
     CURRENT WEEK

     Sunday → Saturday
  ======================================================= */

  const weeklyStats = useMemo(() => {
    const today = new Date();

    const weekStart =
      getStartOfWeek(today);

    const weekEnd =
      getEndOfWeek(today);

    const dailySeconds =
      Array(7).fill(0);

    sessions.forEach(
      (session) => {
        const dateValue =
          getSessionDate(session);

        if (!dateValue) {
          return;
        }

        const date =
          new Date(dateValue);

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return;
        }

        if (
          date < weekStart ||
          date > weekEnd
        ) {
          return;
        }

        dailySeconds[
          date.getDay()
        ] +=
          Number(session.duration) || 0;
      }
    );

    const totalSeconds =
      dailySeconds.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    /*
      Average is across all 7 days:
      Sunday → Saturday
    */

    const averageSeconds =
      totalSeconds / 7;

    const studyDays =
      dailySeconds.filter(
        (seconds) =>
          seconds > 0
      ).length;

    return {
      totalSeconds,
      averageSeconds,
      studyDays,
      dailySeconds,
      weekStart,
      weekEnd,
    };
  }, [sessions]);


  /* =======================================================
     CURRENT MONTH TOTAL
  ======================================================= */

  const monthlyTotal = useMemo(() => {
    const today = new Date();

    const monthStart =
      getStartOfMonth(today);

    const monthEnd =
      getEndOfMonth(today);

    return sessions.reduce(
      (total, session) => {
        const dateValue =
          getSessionDate(session);

        if (!dateValue) {
          return total;
        }

        const date =
          new Date(dateValue);

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return total;
        }

        if (
          date >= monthStart &&
          date <= monthEnd
        ) {
          return (
            total +
            (Number(
              session.duration
            ) || 0)
          );
        }

        return total;
      },
      0
    );
  }, [sessions]);


  /* =======================================================
     FILTERED SESSIONS
  ======================================================= */

  const filteredSessions =
    useMemo(() => {
      return sortedSessions.filter(
        (session) => {
          const normalized =
            normalizeType(
              session.type
            );

          let typeMatch = true;

          if (
            filterType ===
            "pomodoro"
          ) {
            typeMatch =
              isPomodoro(
                normalized
              );
          }

          if (
            filterType ===
            "regular"
          ) {
            typeMatch =
              isRegularTimer(
                normalized
              );
          }

          if (
            filterType ===
            "study"
          ) {
            typeMatch =
              normalized ===
              "study";
          }

          const query =
            searchQuery
              .trim()
              .toLowerCase();

          const searchMatch =
            !query ||
            String(
              session.subject || ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              session.topic || ""
            )
              .toLowerCase()
              .includes(query) ||
            String(
              session.type || ""
            )
              .toLowerCase()
              .includes(query);

          const sessionDate =
            getSessionDate(
              session
            );

          const dateMatch =
            selectedDate ===
              "all" ||
            getDateKey(
              sessionDate
            ) === selectedDate;

          return (
            typeMatch &&
            searchMatch &&
            dateMatch
          );
        }
      );
    }, [
      sortedSessions,
      filterType,
      searchQuery,
      selectedDate,
    ]);


  /* =======================================================
     FILTERED TOTAL
  ======================================================= */

  const filteredTotalDuration =
    useMemo(() => {
      return filteredSessions.reduce(
        (total, session) =>
          total +
          (Number(
            session.duration
          ) || 0),
        0
      );
    }, [filteredSessions]);


  /* =======================================================
     STUDY SESSION COUNT
  ======================================================= */

  const studySessionCount =
    useMemo(() => {
      return filteredSessions.filter(
        (session) =>
          isStudySession(
            session.type
          )
      ).length;
    }, [filteredSessions]);


  /* =======================================================
     GROUPED SESSIONS
  ======================================================= */

  const groupedSessions =
    useMemo(() => {
      const groups = {};

      filteredSessions.forEach(
        (session) => {
          const dateValue =
            getSessionDate(
              session
            );

          const dateKey =
            dateValue
              ? getDateKey(
                  dateValue
                )
              : "unknown";

          const key =
            dateKey === "unknown"
              ? "unknown"
              : dateKey;

          if (!groups[key]) {
            groups[key] = {
              dateValue,
              sessions: [],
            };
          }

          groups[
            key
          ].sessions.push(
            session
          );
        }
      );

      return Object.entries(
        groups
      ).sort(
        ([, groupA], [, groupB]) => {
          const dateA =
            new Date(
              groupA.dateValue ||
                0
            ).getTime();

          const dateB =
            new Date(
              groupB.dateValue ||
                0
            ).getTime();

          return dateB - dateA;
        }
      );
    }, [filteredSessions]);


  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = (id) => {
    setDeleteModal({
      open: true,
      type: "single",
      sessionId: id,
    });
  };


  const handleClear = () => {
    if (!sessions.length) {
      return;
    }

    setDeleteModal({
      open: true,
      type: "all",
      sessionId: null,
    });
  };


  const confirmDelete =
    async () => {
      if (
        deleteModal.type ===
        "single"
      ) {
        await deleteSession(
          deleteModal.sessionId
        );
      }

      if (
        deleteModal.type ===
        "all"
      ) {
        await clearSessions();
      }

      setDeleteModal({
        open: false,
        type: null,
        sessionId: null,
      });
    };


  const closeDeleteModal =
    () => {
      setDeleteModal({
        open: false,
        type: null,
        sessionId: null,
      });
    };


  const clearFilters = () => {
    setFilterType("all");
    setSearchQuery("");
    setSelectedDate("all");
  };


  /* =======================================================
     LOADING
  ======================================================= */

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50 dark:bg-[#0b1120]">
        <div className="text-center">

          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-purple-500 dark:border-zinc-700 dark:border-t-purple-500" />

          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Loading study history...
          </p>

        </div>
      </div>
    );
  }


  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <>
      <div className="min-h-full space-y-6 bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white">


        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="rounded-xl bg-purple-500/10 p-2.5">

                <HistoryIcon
                  size={24}
                  className="text-purple-500 dark:text-purple-400"
                />

              </div>

              <div>

                <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                  Study History
                </h1>

                <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
                  Review your completed study sessions
                </p>

              </div>

            </div>

          </div>


          {/* RIGHT SIDE */}

          <div className="flex items-center gap-2">

            {/* ONLINE STATUS */}

            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                isOnline
                  ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                  : "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
              }`}
            >

              <span
                className={`h-2 w-2 rounded-full ${
                  isOnline
                    ? "bg-green-500 dark:bg-green-400"
                    : "bg-yellow-500 dark:bg-yellow-400"
                }`}
              />

              {isSyncing
                ? "Syncing..."
                : isOnline
                ? "Online"
                : "Offline"}

            </div>


            {/* CLEAR ALL */}

            {sessions.length >
              0 && (
              <button
                onClick={
                  handleClear
                }
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-500 transition hover:bg-red-500/10 dark:text-red-400"
              >

                <Trash2 size={16} />

                <span className="hidden sm:inline">
                  Clear All
                </span>

              </button>
            )}

          </div>

        </div>


        {/* =================================================
            NEW ANALYTICS BLOCKS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">


          {/* =================================================
              WEEKLY AVERAGE
          ================================================= */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-gray-500 dark:text-zinc-500">
                  Weekly Average
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(
                    Math.round(
                      weeklyStats.averageSeconds
                    )
                  )}
                </p>

              </div>

              <div className="rounded-xl bg-purple-500/10 p-2.5">

                <TrendingUp
                  size={20}
                  className="text-purple-500 dark:text-purple-400"
                />

              </div>

            </div>


            <div className="mt-4">

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500">

                <span>
                  Sunday
                </span>

                <span>
                  Saturday
                </span>

              </div>


              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">

                <div
                  className="h-full rounded-full bg-purple-500 transition-all"
                  style={{
                    width:
                      weeklyStats.totalSeconds >
                      0
                        ? `${Math.min(
                            100,
                            (weeklyStats.totalSeconds /
                              (7 *
                                4 *
                                3600)) *
                              100
                          )}%`
                        : "0%",
                  }}
                />

              </div>


              <p className="mt-2 text-xs text-gray-400 dark:text-zinc-600">

                {weeklyStats.studyDays} of 7 days studied

              </p>

            </div>

          </div>


          {/* =================================================
              MONTHLY TOTAL
          ================================================= */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-gray-500 dark:text-zinc-500">
                  Monthly Total
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(
                    monthlyTotal
                  )}
                </p>

              </div>

              <div className="rounded-xl bg-blue-500/10 p-2.5">

                <BarChart3
                  size={20}
                  className="text-blue-500 dark:text-blue-400"
                />

              </div>

            </div>


            <p className="mt-5 text-xs text-gray-400 dark:text-zinc-600">

              {new Date().toLocaleDateString(
                "en-IN",
                {
                  month: "long",
                  year: "numeric",
                }
              )}

            </p>

          </div>


          {/* =================================================
              TOTAL TIME STUDIED
          ================================================= */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-gray-500 dark:text-zinc-500">
                  Total Time Studied
                </p>

                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                  {formatDuration(
                    totalTimeStudied
                  )}
                </p>

              </div>

              <div className="rounded-xl bg-green-500/10 p-2.5">

                <Clock3
                  size={20}
                  className="text-green-500 dark:text-green-400"
                />

              </div>

            </div>


            <p className="mt-5 text-xs text-gray-400 dark:text-zinc-600">

              All saved study sessions

            </p>

          </div>

        </div>


        {/* =================================================
            SUMMARY CARDS
        ================================================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">


          {/* SESSIONS */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="mb-3 flex items-center justify-between">

              <p className="text-sm text-gray-500 dark:text-zinc-500">
                Sessions
              </p>

              <div className="rounded-lg bg-purple-500/10 p-2">

                <HistoryIcon
                  size={18}
                  className="text-purple-500 dark:text-purple-400"
                />

              </div>

            </div>

            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredSessions.length}
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Matching your filters
            </p>

          </div>


          {/* STUDY SESSIONS */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="mb-3 flex items-center justify-between">

              <p className="text-sm text-gray-500 dark:text-zinc-500">
                Study Sessions
              </p>

              <div className="rounded-lg bg-blue-500/10 p-2">

                <Clock3
                  size={18}
                  className="text-blue-500 dark:text-blue-400"
                />

              </div>

            </div>

            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {studySessionCount}
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Pomodoro + regular study
            </p>

          </div>


          {/* FILTERED TIME */}

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

            <div className="mb-3 flex items-center justify-between">

              <p className="text-sm text-gray-500 dark:text-zinc-500">
                Filtered Time
              </p>

              <div className="rounded-lg bg-green-500/10 p-2">

                <CalendarDays
                  size={18}
                  className="text-green-500 dark:text-green-400"
                />

              </div>

            </div>

            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatDuration(
                filteredTotalDuration
              )}
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Time represented by filters
            </p>

          </div>

        </div>


        {/* =================================================
            FILTERS
        ================================================= */}

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-950">

          <div className="mb-4 flex items-center gap-2">

            <Filter
              size={17}
              className="text-purple-500 dark:text-purple-400"
            />

            <h2 className="font-semibold text-gray-900 dark:text-white">
              Filters
            </h2>

          </div>


          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">


            {/* SEARCH */}

            <div className="relative">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-600"
              />

              <input
                type="text"
                value={
                  searchQuery
                }
                onChange={(
                  event
                ) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search subject or topic..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-purple-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600"
              />

              {searchQuery && (
                <button
                  onClick={() =>
                    setSearchQuery(
                      ""
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-white"
                >
                  <X size={15} />
                </button>
              )}

            </div>


            {/* TYPE */}

            <select
              value={
                filterType
              }
              onChange={(
                event
              ) =>
                setFilterType(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >

              <option value="all">
                All Timer Types
              </option>

              <option value="regular">
                Regular Timer
              </option>

              <option value="pomodoro">
                Pomodoro
              </option>

              <option value="study">
                Study
              </option>

            </select>


            {/* DATE */}

            <select
              value={
                selectedDate
              }
              onChange={(
                event
              ) =>
                setSelectedDate(
                  event.target.value
                )
              }
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-500/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            >

              <option value="all">
                All Dates
              </option>

              {availableDates.map(
                ([
                  dateKey,
                  label,
                ]) => (
                  <option
                    key={
                      dateKey
                    }
                    value={
                      dateKey
                    }
                  >
                    {label}
                  </option>
                )
              )}

            </select>

          </div>


          {(filterType !==
            "all" ||
            searchQuery ||
            selectedDate !==
              "all") && (
            <button
              onClick={
                clearFilters
              }
              className="mt-3 text-xs text-purple-500 hover:text-purple-400 dark:text-purple-400"
            >
              Clear filters
            </button>
          )}

        </div>


        {/* =================================================
            EMPTY STATE
        ================================================= */}

        {filteredSessions.length ===
          0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-900">

              <HistoryIcon
                size={25}
                className="text-gray-400 dark:text-zinc-600"
              />

            </div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">

              {sessions.length ===
              0
                ? "No study sessions yet"
                : "No matching sessions"}

            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-zinc-500">

              {sessions.length ===
              0
                ? "Complete a timer session and your study activity will appear here."
                : "Try changing your search or filters."}

            </p>

            {sessions.length >
              0 && (
              <button
                onClick={
                  clearFilters
                }
                className="mt-5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-500"
              >
                Clear Filters
              </button>
            )}

          </div>
        )}


        {/* =================================================
            SESSION GROUPS
        ================================================= */}

        <div className="space-y-6">

          {groupedSessions.map(
            ([
              dateKey,
              group,
            ]) => {

              const dayTotal =
                group.sessions.reduce(
                  (
                    total,
                    session
                  ) =>
                    total +
                    (Number(
                      session.duration
                    ) || 0),
                  0
                );

              return (
                <section
                  key={
                    dateKey
                  }
                >

                  {/* DATE HEADER */}

                  <div className="mb-3 flex items-center justify-between">

                    <div className="flex items-center gap-2">

                      <CalendarDays
                        size={17}
                        className="text-purple-500 dark:text-purple-400"
                      />

                      <h2 className="font-semibold text-gray-900 dark:text-white">

                        {dateKey ===
                        "unknown"
                          ? "Unknown Date"
                          : formatDate(
                              group.dateValue
                            )}

                      </h2>

                    </div>


                    <span className="text-xs text-gray-500 dark:text-zinc-500">

                      {group.sessions.length}{" "}

                      {group.sessions.length ===
                      1
                        ? "session"
                        : "sessions"}

                      {" · "}

                      {formatDuration(
                        dayTotal
                      )}

                    </span>

                  </div>


                  {/* SESSIONS */}

                  <div className="space-y-3">

                    {group.sessions.map(
                      (
                        session
                      ) => (

                        <div
                          key={
                            session.id ||
                            session.clientId
                          }
                          className="group rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                        >

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">


                            {/* LEFT */}

                            <div className="flex min-w-0 items-start gap-3">

                              <div className="mt-0.5 rounded-xl bg-gray-100 p-2.5 dark:bg-zinc-900">

                                <Clock3
                                  size={19}
                                  className="text-purple-500 dark:text-purple-400"
                                />

                              </div>


                              <div className="min-w-0">

                                <div className="flex flex-wrap items-center gap-2">

                                  <h3 className="truncate font-semibold text-gray-900 dark:text-white">

                                    {session.subject ||
                                      "No subject"}

                                  </h3>


                                  {/* TYPE */}

                                  <span
                                    className={`rounded-full border px-2 py-0.5 text-[11px] ${getTypeBadgeClass(
                                      session.type
                                    )}`}
                                  >
                                    {getTypeLabel(
                                      session.type
                                    )}
                                  </span>


                                  {/* SYNC STATUS */}

                                  {session.id?.startsWith(
                                    "local-"
                                  ) ? (

                                    <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-600 dark:text-yellow-400">
                                      Pending sync
                                    </span>

                                  ) : (

                                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-600 dark:text-green-400">
                                      Synced
                                    </span>

                                  )}

                                </div>


                                <p className="mt-1 truncate text-sm text-gray-500 dark:text-zinc-500">

                                  {session.topic ||
                                    "No topic"}

                                </p>


                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-zinc-600">

                                  <span>
                                    {formatTime(
                                      getSessionDate(
                                        session
                                      )
                                    )}
                                  </span>


                                  {session.startedAt &&
                                    session.completedAt && (

                                      <span>

                                        {formatTime(
                                          session.startedAt
                                        )}

                                        {" → "}

                                        {formatTime(
                                          session.completedAt
                                        )}

                                      </span>

                                    )}

                                </div>

                              </div>

                            </div>


                            {/* RIGHT */}

                            <div className="flex items-center justify-between gap-4 sm:justify-end">

                              <div className="text-left sm:text-right">

                                <p className="text-lg font-bold text-gray-900 dark:text-white">

                                  {formatDuration(
                                    session.duration
                                  )}

                                </p>

                                <p className="text-xs text-gray-400 dark:text-zinc-600">
                                  duration
                                </p>

                              </div>


                              {/* DELETE */}

                              <button
                                onClick={() =>
                                  handleDelete(
                                    session.id
                                  )
                                }
                                title="Delete session"
                                className="rounded-lg p-2 text-gray-400 opacity-100 transition hover:bg-red-500/10 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 dark:text-zinc-600 dark:hover:text-red-400"
                              >

                                <Trash2
                                  size={17}
                                />

                              </button>

                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                </section>
              );
            }
          )}

        </div>

      </div>


      {/* =====================================================
          DELETE MODAL
      ===================================================== */}

      {deleteModal.open && (

        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={
            closeDeleteModal
          }
        >

          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* ICON + TEXT */}

            <div className="flex items-start gap-4">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10">

                <AlertTriangle
                  size={22}
                  className="text-red-500 dark:text-red-400"
                />

              </div>


              <div className="min-w-0">

                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">

                  {deleteModal.type ===
                  "all"
                    ? "Clear all history?"
                    : "Delete this session?"}

                </h2>


                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-zinc-400">

                  {deleteModal.type ===
                  "all"
                    ? "This will permanently delete all your study sessions from your history."
                    : "This study session will be permanently removed from your history."}

                </p>

              </div>

            </div>


            {/* BUTTONS */}

            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={
                  closeDeleteModal
                }
                className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={
                  confirmDelete
                }
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
              >

                {deleteModal.type ===
                "all"
                  ? "Clear All"
                  : "Delete"}

              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}