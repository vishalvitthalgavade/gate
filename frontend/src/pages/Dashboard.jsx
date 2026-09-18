import { useMemo } from "react";
import { Link } from "react-router-dom";

import {
  Clock,
  Flame,
  BookOpen,
  CalendarDays,
  Play,
  ArrowRight,
  CheckCircle2,
  CloudOff,
} from "lucide-react";

import { GATE_SYLLABUS } from "../data/syllabus";
import { useStudy } from "../context/useStudy";

function formatStudyTime(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return "0m";
}

function formatSessionTime(date) {
  if (!date) {
    return "--";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "--";
  }

  return parsedDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getLocalDateKey(date) {
  if (!date) {
    return null;
  }

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  const year = d.getFullYear();

  const month = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSessionDate(session) {
  return (
    session.completedAt ||
    session.date ||
    session.createdAt ||
    session.startedAt
  );
}


/*
 * Calculate consecutive study days.
 *
 * If studied today:
 * today → yesterday → ...
 *
 * If not studied today but studied yesterday:
 * yesterday → day before → ...
 */
function calculateStreak(sessions) {
  if (!sessions.length) {
    return 0;
  }

  const studyDays = new Set(
    sessions
      .map((session) =>
        getLocalDateKey(
          getSessionDate(session)
        )
      )
      .filter(Boolean)
  );

  const today = new Date();

  const todayKey =
    getLocalDateKey(today);

  const yesterday = new Date(today);

  yesterday.setDate(
    yesterday.getDate() - 1
  );

  const yesterdayKey =
    getLocalDateKey(yesterday);

  let currentDate;

  if (studyDays.has(todayKey)) {
    currentDate = new Date(today);
  } else if (studyDays.has(yesterdayKey)) {
    currentDate = new Date(yesterday);
  } else {
    return 0;
  }

  let streak = 0;

  while (true) {
    const dateKey =
      getLocalDateKey(currentDate);

    if (!studyDays.has(dateKey)) {
      break;
    }

    streak++;

    currentDate.setDate(
      currentDate.getDate() - 1
    );
  }

  return streak;
}


function getSessionStatus(session) {
  if (session?.id?.startsWith("local-")) {
    return {
      label: "Pending sync",
      icon: CloudOff,
      className:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
    };
  }

  return {
    label: "Synced",
    icon: CheckCircle2,
    className:
      "border-green-500/20 bg-green-500/10 text-green-400",
  };
}


function Dashboard() {
  const {
    sessions,
    completedTopics,
    isSyncing,
    isOnline,
  } = useStudy();


  // --------------------------------------------------
  // TODAY
  // --------------------------------------------------

  const todayKey =
    getLocalDateKey(new Date());

  const todaySessions = useMemo(() => {
    return sessions.filter(
      (session) =>
        getLocalDateKey(
          getSessionDate(session)
        ) === todayKey
    );
  }, [sessions, todayKey]);


  const todaySeconds = useMemo(() => {
    return todaySessions.reduce(
      (total, session) =>
        total +
        Number(session.duration || 0),
      0
    );
  }, [todaySessions]);


  // --------------------------------------------------
  // TOTAL
  // --------------------------------------------------

  const totalSeconds = useMemo(() => {
    return sessions.reduce(
      (total, session) =>
        total +
        Number(session.duration || 0),
      0
    );
  }, [sessions]);


  // --------------------------------------------------
  // STREAK
  // --------------------------------------------------

  const currentStreak = useMemo(() => {
    return calculateStreak(sessions);
  }, [sessions]);


  // --------------------------------------------------
  // SYLLABUS PROGRESS
  // --------------------------------------------------

  const syllabusStats = useMemo(() => {
    let total = 0;
    let completed = 0;

    const completedSet = new Set(
      (completedTopics || [])
        .filter((item) => item?.completed)
        .map(
          (item) =>
            `${item.subject}|||${item.unit}|||${item.topic}`
        )
    );

    Object.entries(GATE_SYLLABUS).forEach(
      ([subject, units]) => {
        Object.entries(units).forEach(
          ([unit, topics]) => {
            total += topics.length;

            topics.forEach((topic) => {
              const key =
                `${subject}|||${unit}|||${topic}`;

              if (completedSet.has(key)) {
                completed++;
              }
            });
          }
        );
      }
    );

    return {
      total,
      completed,
      percentage:
        total === 0
          ? 0
          : Math.round(
              (completed / total) * 100
            ),
    };
  }, [completedTopics]);


  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  const currentDate =
    new Date().toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );


  // --------------------------------------------------
  // RECENT TODAY'S SESSIONS
  // --------------------------------------------------

  const recentTodaySessions = useMemo(() => {
    return [...todaySessions]
      .sort(
        (a, b) =>
          new Date(
            getSessionDate(b)
          ).getTime() -
          new Date(
            getSessionDate(a)
          ).getTime()
      )
      .slice(0, 5);
  }, [todaySessions]);


  return (
    <div className="w-full bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-[#0b1120] dark:text-white">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <p className="mb-2 text-sm text-gray-500 dark:text-zinc-500">
            {currentDate}
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Dashboard
          </h1>

          <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500 sm:text-base">
            Track your GATE CSE preparation.
          </p>

        </div>

        <Link
          to="/timer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 sm:w-auto"
        >
          <Play size={18} />
          Start Studying
        </Link>

      </div>


      {/* =====================================================
          STAT CARDS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          icon={Clock}
          title="Today's Study"
          value={formatStudyTime(todaySeconds)}
          description={`${todaySessions.length} session${
            todaySessions.length === 1
              ? ""
              : "s"
          } today`}
        />

        <StatCard
          icon={Flame}
          title="Current Streak"
          value={`${currentStreak} day${
            currentStreak === 1
              ? ""
              : "s"
          }`}
          description="Consecutive study days"
        />

        <StatCard
          icon={BookOpen}
          title="Syllabus"
          value={`${syllabusStats.percentage}%`}
          description={`${syllabusStats.completed} / ${syllabusStats.total} topics`}
        />

        <StatCard
          icon={CalendarDays}
          title="Total Study"
          value={formatStudyTime(totalSeconds)}
          description={`${sessions.length} saved session${
            sessions.length === 1
              ? ""
              : "s"
          }`}
        />

      </div>


      {/* =====================================================
          PROGRESS + STREAK
      ===================================================== */}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* SYLLABUS */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6 lg:col-span-2">

          <div className="flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Syllabus Progress
              </h2>

              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
                Overall GATE CSE preparation
              </p>

            </div>

            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {syllabusStats.percentage}%
            </span>

          </div>


          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">

            <div
              className="h-full rounded-full bg-purple-600 transition-all duration-500"
              style={{
                width: `${syllabusStats.percentage}%`,
              }}
            />

          </div>


          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500">

            <span>
              {syllabusStats.completed} completed
            </span>

            <span>
              {syllabusStats.total -
                syllabusStats.completed}{" "}
              remaining
            </span>

          </div>


          <Link
            to="/syllabus"
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-gray-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Open Syllabus
            <ArrowRight size={16} />
          </Link>

        </div>


        {/* STREAK */}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">

          <div className="flex items-center gap-3">

            <div className="rounded-xl bg-orange-500/10 p-3">
              <Flame
                size={22}
                className="text-orange-400"
              />
            </div>

            <div>

              <h2 className="font-semibold text-gray-900 dark:text-white">
                Study Streak
              </h2>

              <p className="text-xs text-gray-500 dark:text-zinc-500">
                Keep it going!
              </p>

            </div>

          </div>


          <div className="mt-8">

            <p className="text-5xl font-bold text-gray-900 dark:text-white">
              {currentStreak}
            </p>

            <p className="mt-2 text-sm text-gray-500 dark:text-zinc-500">
              consecutive day
              {currentStreak === 1
                ? ""
                : "s"}
            </p>

          </div>


          <Link
            to="/heatmap"
            className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
          >
            View Heatmap
            <ArrowRight size={16} />
          </Link>

        </div>

      </div>


      {/* =====================================================
          TODAY'S SESSIONS
      ===================================================== */}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40">

        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-5 dark:border-zinc-800 sm:px-6">

          <div>

            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Sessions
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-500">
              Your study activity today
            </p>

          </div>

          <Link
            to="/history"
            className="flex items-center gap-1 text-sm text-purple-600 transition hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
          >
            View All
            <ArrowRight size={15} />
          </Link>

        </div>


        {recentTodaySessions.length === 0 ? (

          <div className="px-5 py-12 text-center sm:px-6">

            <Clock
              size={32}
              className="mx-auto text-gray-300 dark:text-zinc-700"
            />

            <p className="mt-4 text-sm font-medium text-gray-600 dark:text-zinc-400">
              No study sessions today
            </p>

            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
              Start a timer to record your first
              session.
            </p>

            <Link
              to="/timer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              <Play size={15} />
              Start Timer
            </Link>

          </div>

        ) : (

          <div className="divide-y divide-gray-200 dark:divide-zinc-800">

            {recentTodaySessions.map(
              (session) => {

                const status =
                  getSessionStatus(session);

                const StatusIcon =
                  status.icon;

                return (
                  <div
                    key={
                      session.id ||
                      session.clientId
                    }
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >

                    <div className="min-w-0">

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-md bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                          {session.type ||
                            "Study"}
                        </span>

                        <span className="text-xs text-gray-400 dark:text-zinc-600">
                          {formatSessionTime(
                            getSessionDate(
                              session
                            )
                          )}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${status.className}`}
                        >
                          <StatusIcon
                            size={11}
                          />

                          {status.label}
                        </span>

                      </div>


                      <p className="mt-2 truncate text-sm font-medium text-gray-900 dark:text-white">
                        {session.subject ||
                          "No subject"}
                      </p>

                      <p className="mt-1 truncate text-xs text-gray-500 dark:text-zinc-500">
                        {session.topic ||
                          "No topic"}
                      </p>

                    </div>


                    <div className="text-left sm:text-right">

                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatStudyTime(
                          Number(
                            session.duration ||
                            0
                          )
                        )}
                      </p>

                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
                        Study time
                      </p>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </div>


      {/* =====================================================
          SYNC STATUS
      ===================================================== */}

      <div className="mt-4 flex justify-end">

        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
            isOnline
              ? "border-green-500/20 bg-green-500/10 text-green-500 dark:text-green-400"
              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-500 dark:text-yellow-400"
          }`}
        >

          <span
            className={`h-2 w-2 rounded-full ${
              isOnline
                ? "bg-green-400"
                : "bg-yellow-400"
            }`}
          />

          {isSyncing
            ? "Syncing data..."
            : isOnline
              ? "Data synced"
              : "Offline mode"}

        </div>

      </div>

    </div>
  );
}


function StatCard({
  icon: Icon,
  title,
  value,
  description,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/40">

      <div className="flex items-center gap-3">

        <div className="rounded-xl bg-purple-500/10 p-3">

          <Icon
            size={21}
            className="text-purple-600 dark:text-purple-400"
          />

        </div>

        <p className="text-sm text-gray-500 dark:text-zinc-500">
          {title}
        </p>

      </div>


      <p className="mt-5 text-3xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>


      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-600">
        {description}
      </p>

    </div>
  );
}

export default Dashboard;