import { useEffect, useMemo, useRef, useState } from "react";

import {
  Timer as TimerIcon,
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  SkipForward,
  Maximize,
  Minimize,
  AlertTriangle,
  Quote,
  Shuffle,
} from "lucide-react";

import { GATE_SYLLABUS } from "../data/syllabus";
import { useStudy } from "../context/useStudy";
import { useTheme } from "../context/ThemeContext";
import { useTimer } from "../context/TimerContext";
import CustomSelect from "../components/CustomSelect";
import ConfirmDialog from "../components/ConfirmDialog";

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatShortTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

const MOTIVATIONAL_QUOTES = [
  // Attributions checked against the authors' works or institutional records.
   { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },

  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },

  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },

  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },

  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },

  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },

  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },

  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },

  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },

  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },

  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },

  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },

  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },

  { text: "If you want to achieve greatness, stop asking for permission.", author: "Unknown" },

  { text: "Don't limit your challenges. Challenge your limits.", author: "Jerry Dunn" },

  { text: "The pain of discipline is far less than the pain of regret.", author: "Unknown" },

  { text: "A little progress each day adds up to big results.", author: "Unknown" },

  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },

  { text: "Your limitation—it's only your imagination.", author: "Unknown" },

  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },

  { text: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },

  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },

  { text: "Doubt kills more dreams than failure ever will.", author: "Suzy Kassem" },

  { text: "Success is liking yourself, liking what you do, and liking how you do it.", author: "Maya Angelou" },

  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },

  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },

  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },

  { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },

  { text: "Don't be afraid to give up the good to go for the great.", author: "John D. Rockefeller" },

  { text: "Success is not about being the best. It is about being better than you were yesterday.", author: "Unknown" },

  { text: "Focus on the step in front of you, not the whole staircase.", author: "Unknown" },

  { text: "Consistency is what transforms average into excellence.", author: "Unknown" },

  { text: "One day or day one. You decide.", author: "Paulo Coelho" },

  { text: "Your dreams don't work unless you do.", author: "John C. Maxwell" },

  { text: "Work hard in silence. Let your success make the noise.", author: "Frank Ocean" },

  { text: "The road to success and the road to failure are almost exactly the same. The difference is in how long you keep walking.", author: "Unknown" },

  { text: "Don't compare your beginning to someone else's middle.", author: "Jon Acuff" },

  { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", author: "Nelson Mandela" },

  { text: "You are capable of more than you know.", author: "Unknown" },

  { text: "Difficult roads often lead to beautiful destinations.", author: "Zig Ziglar" },

  { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },

  { text: "If you can dream it, you can achieve it.", author: "Zig Ziglar" },

  { text: "Champions keep playing until they get it right.", author: "Billie Jean King" },

  { text: "The will to win means nothing without the will to prepare.", author: "Juma Ikangaa" },

  { text: "You have to fight through some bad days in order to earn some of the best days of your life.", author: "Unknown" },

  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },

  { text: "Don't count the days. Make the days count.", author: "Muhammad Ali" },

  { text: "I don't believe in motivation. I believe in discipline.", author: "Virat Kohli" },

  { text: "You have to be mentally strong and believe in yourself.", author: "Virat Kohli" },

  { text: "Self-belief and hard work will always earn you success.", author: "Virat Kohli" },

  { text: "Whatever you do, give it your 100 percent and don't worry about the result.", author: "Virat Kohli" },

  { text: "I like to be myself, and I don't pretend.", author: "Virat Kohli" },

  { text: "You have to accept failure to get better.", author: "Virat Kohli" },

  { text: "Every time I go out there, I want to give my best and make a difference.", author: "Virat Kohli" },

  { text: "The hunger to improve has to remain, no matter how much you achieve.", author: "Virat Kohli" },

  { text: "If you stay focused on your process, the results will take care of themselves.", author: "Virat Kohli" },

  { text: "Fitness is not about being better than someone else. It's about being better than you used to be.", author: "Virat Kohli" },

  { text: "You need to believe in yourself when nobody else does.", author: "Virat Kohli" },

  { text: "Keep working hard, keep believing, and keep improving every single day.", author: "Virat Kohli" },

  { text: "The biggest motivation is to keep getting better at what you do.", author: "Virat Kohli" },

  { text: "Don't let one bad day define your journey.", author: "Unknown" }
];

function Timer() {
  const { theme } = useTheme();
  const { pomodoroSettings, updatePomodoroSettings } = useStudy();
  const {
    timerMode,
    changeTimerMode,
    selectedSubject,
    selectedTopic,
    handleSubjectChange,
    setSelectedTopic,
    simpleSeconds,
    simpleRunning,
    startSimpleTimer,
    pauseSimpleTimer,
    stopSimpleTimer,
    resetSimpleTimer,
    pomodoroMode,
    pomodoroSeconds,
    pomodoroRunning,
    completedPomodoros,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    skipPomodoro,
    restoring,
    isRunning,
    timerConflict,
    takeOverTimer,
    dismissTimerConflict,
  } = useTimer();

  const isDark = theme === "dark";
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const timerCardRef = useRef(null);
  const wakeLockRef = useRef(null);
  const [takeoverMinutes, setTakeoverMinutes] = useState("");
  const [takeoverSubmitting, setTakeoverSubmitting] = useState(false);
  const [takeoverError, setTakeoverError] = useState("");
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));

  const availableTopics = useMemo(() => {
    if (!selectedSubject) {
      return [];
    }

    return Object.values(GATE_SYLLABUS[selectedSubject] || {}).flat();
  }, [selectedSubject]);

  useEffect(() => {
    if (!timerConflict) {
      setTakeoverMinutes("");
      setTakeoverSubmitting(false);
    }
  }, [timerConflict]);

  const conflictElapsedSeconds = Number(timerConflict?.activeStudy?.elapsedSeconds || 0);
  const conflictElapsedMinutes = Math.floor(conflictElapsedSeconds / 60);

  async function handleTakeover() {
    const minutes = Number(takeoverMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    const studiedSeconds = Math.round(minutes * 60);
    if (studiedSeconds > conflictElapsedSeconds) return;

    setTakeoverSubmitting(true);
    try {
      const result = await takeOverTimer(studiedSeconds);
      if (!result?.ok) {
        setTakeoverError(result?.data?.message || "The other timer changed before takeover. Please try again.");
      }
    } finally {
      setTakeoverSubmitting(false);
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const timerCard = timerCardRef.current;
        if (!timerCard?.requestFullscreen) return;
        await timerCard.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }

  const requestScreenWakeLock = async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    if (wakeLockRef.current) {
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch (error) {
      // Wake Lock can be denied by the browser/OS or unavailable in a
      // particular installed-PWA environment. Fullscreen still works.
      console.warn("Screen wake lock unavailable:", error);
    }
  };

  const releaseScreenWakeLock = async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // Ignore release failures.
    } finally {
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    async function handleFullscreenChange() {
      const fullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(fullscreen);

      if (fullscreen) {
        await requestScreenWakeLock();
      } else {
        await releaseScreenWakeLock();
      }
    }

    async function handleVisibilityChange() {
      // Browsers can release a Wake Lock when the document becomes hidden.
      // Re-acquire it when the fullscreen timer becomes visible again.
      if (!document.hidden && document.fullscreenElement) {
        await requestScreenWakeLock();
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseScreenWakeLock();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.code !== "Space") {
        return;
      }

      event.preventDefault();

      if (timerMode === "simple") {
        if (simpleRunning) {
          pauseSimpleTimer();
        } else {
          startSimpleTimer();
        }
      } else if (pomodoroRunning) {
        pausePomodoro();
      } else {
        startPomodoro();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    pausePomodoro,
    pauseSimpleTimer,
    pomodoroRunning,
    simpleRunning,
    startPomodoro,
    startSimpleTimer,
    timerMode,
  ]);

  useEffect(() => {
    if (timerMode === "pomodoro" && pomodoroRunning) {
      document.title = `${formatShortTime(pomodoroSeconds)} • GATE CSE`;
    } else if (timerMode === "simple" && simpleRunning) {
      document.title = `${formatShortTime(simpleSeconds)} • GATE CSE`;
    } else {
      document.title = "GATE CSE Tracker";
    }

    return () => {
      document.title = "GATE CSE Tracker";
    };
  }, [
    timerMode,
    pomodoroRunning,
    pomodoroSeconds,
    simpleRunning,
    simpleSeconds,
  ]);

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden transition-colors duration-300 ${
        isDark
          ? "bg-zinc-950 text-slate-900 dark:text-white"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      {timerConflict && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <AlertTriangle size={19} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Timer already running</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  This account's timer is active in another tab or browser. Do you want to take control here?
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-zinc-500">Recorded time in the other tab</span>
                <span className="font-mono font-semibold text-white">{formatTime(conflictElapsedSeconds)}</span>
              </div>
              {timerConflict.activeStudy?.ownerLabel && (
                <p className="mt-2 text-[10px] text-zinc-600">{timerConflict.activeStudy.ownerLabel}</p>
              )}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-xs font-medium text-zinc-300">How much did you actually study?</span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, conflictElapsedMinutes)}
                  step="0.1"
                  value={takeoverMinutes}
                  onChange={(e) => setTakeoverMinutes(e.target.value)}
                  placeholder={`0 – ${conflictElapsedMinutes} minutes`}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 pr-20 text-sm text-white outline-none transition focus:border-purple-500"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-600">minutes</span>
              </div>
              <p className="mt-2 text-[10px] text-zinc-600">Only the amount you enter will be recorded for the previous timer.</p>
            </label>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={dismissTimerConflict}
                disabled={takeoverSubmitting}
                className="flex-1 rounded-xl border border-zinc-700 px-4 py-3 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-50"
              >
                Keep other timer
              </button>
              <button
                type="button"
                onClick={handleTakeover}
                disabled={takeoverSubmitting || takeoverMinutes === "" || Number(takeoverMinutes) < 0 || Number(takeoverMinutes) * 60 > conflictElapsedSeconds}
                className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-xs font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {takeoverSubmitting ? "Taking over…" : "Take control"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="mb-5 sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-purple-600/15 p-2.5 sm:p-3">
              <TimerIcon
                size={22}
                className="text-purple-400 sm:hidden"
              />
              <TimerIcon
                size={24}
                className="hidden text-purple-400 sm:block"
              />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-3xl">
                Study Timer
              </h1>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-500 sm:text-sm">
                Press Space to start or pause. The timer keeps running if you
                leave this page.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900/60 sm:mb-6 sm:gap-2 sm:p-2">
          <button
            type="button"
            onClick={() => changeTimerMode("simple")}
            className={`min-h-11 rounded-lg px-2 py-2.5 text-xs font-semibold transition active:scale-[0.98] sm:px-3 sm:py-3 sm:text-sm ${
              timerMode === "simple"
                ? "bg-purple-600 text-white"
                : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
          >
            Simple Timer
          </button>

          <button
            type="button"
            onClick={() => changeTimerMode("pomodoro")}
            className={`min-h-11 rounded-lg px-2 py-2.5 text-xs font-semibold transition active:scale-[0.98] sm:px-3 sm:py-3 sm:text-sm ${
              timerMode === "pomodoro"
                ? "bg-purple-600 text-white"
                : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
          >
            Pomodoro
          </button>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Subject
            </label>
            <CustomSelect
              ariaLabel="Subject"
              value={selectedSubject}
              onChange={handleSubjectChange}
              placeholder="Select Subject (optional)"
              options={[
                { value: "", label: "Select Subject (optional)" },
                ...Object.keys(GATE_SYLLABUS).map((subject) => ({ value: subject, label: subject })),
              ]}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
              Topic
            </label>
            <CustomSelect
              ariaLabel="Topic"
              value={selectedTopic}
              onChange={setSelectedTopic}
              disabled={!selectedSubject}
              placeholder={selectedSubject ? "Select Topic" : "Select subject first"}
              options={[
                { value: "", label: selectedSubject ? "Select Topic" : "Select subject first" },
                ...availableTopics.map((topic) => ({ value: topic, label: topic })),
              ]}
            />
          </div>
        </div>

        <div
          ref={timerCardRef}
          className={`relative rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900/50 ${
            isRunning ? "gate-timer-card-live" : ""
          } ${
            isFullscreen
              ? "flex min-h-screen w-full items-center justify-center overflow-auto rounded-none border-0 bg-black p-4 text-white sm:p-8"
              : "p-5 sm:p-8"
          }`}
        >
          <div className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-center justify-end gap-2 sm:inset-x-4 sm:top-4">
            <button
              type="button"
              onClick={() => setZenMode((value) => !value)}
              aria-pressed={zenMode}
              title={zenMode ? "Show timer" : "Zen mode — blur timer"}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur transition hover:border-purple-500/50 ${
                zenMode
                  ? "border-purple-500/60 bg-purple-600/15 text-purple-300"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              <span className="hidden sm:inline">{zenMode ? "Zen On" : "Zen Mode"}</span>
              <span className="sm:hidden">Zen</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen timer"}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-600 backdrop-blur transition hover:border-purple-500/50 hover:bg-slate-200 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400 dark:hover:text-white"
          >
              {isFullscreen ? (
                <>
                  <Minimize size={17} />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize size={17} />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </button>
          </div>

          {restoring && (
            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              Syncing your timer with the server...
            </div>
          )}

          <div className={`w-full ${isFullscreen ? "max-w-5xl" : ""} timer-landscape-content`}>
            {timerMode === "simple" && (
              <div className="w-full pt-12 text-center sm:pt-10">
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500 sm:mb-4 sm:text-sm sm:tracking-widest">
                  Regular Study Timer
                </p>

                <div
                  className={`break-all font-bold tabular-nums text-slate-900 dark:text-white gate-timer-digits transition-all duration-300 ${
                    simpleRunning ? "gate-timer-live" : ""
                  } ${
                    zenMode ? "gate-zen-blur select-none" : ""
                  } ${
                    isFullscreen
                      ? "text-7xl sm:text-9xl md:text-[12rem]"
                      : "text-4xl sm:text-7xl"
                  }`}
                  aria-label={zenMode ? "Timer hidden in Zen mode" : `Elapsed time ${formatTime(simpleSeconds)}`}
                >
                  {formatTime(simpleSeconds)}
                </div>

                <p className="mx-auto mt-3 max-w-full truncate px-2 text-xs text-slate-500 dark:text-zinc-500 sm:mt-4 sm:text-sm">
                  {selectedSubject
                    ? `${selectedSubject}${
                        selectedTopic ? ` • ${selectedTopic}` : ""
                      }`
                    : "No subject selected"}
                </p>

                <div className="timer-action-row mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:justify-center sm:gap-3">
                  {!simpleRunning ? (
                    <button
                      type="button"
                      onClick={startSimpleTimer}
                      disabled={pomodoroRunning}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/15 transition hover:bg-purple-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                      <Play size={18} />
                      Start
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pauseSimpleTimer}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-[0.98] sm:px-5"
                    >
                      <Pause size={18} />
                      Pause
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={stopSimpleTimer}
                    disabled={simpleSeconds === 0}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 sm:px-5"
                  >
                    <Square size={18} />
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={resetSimpleTimer}
                    className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white sm:col-span-1 sm:px-5"
                  >
                    <RotateCcw size={18} />
                    Reset
                  </button>
                </div>
              </div>
            )}

            {timerMode === "pomodoro" && (
              <div className="w-full pt-12 text-center sm:pt-10">
                <div className="mb-4 flex items-center justify-center gap-2">
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-400">
                    {pomodoroMode === "study"
                      ? "Focus"
                      : pomodoroMode === "shortBreak"
                        ? "Short Break"
                        : "Long Break"}
                  </span>
                </div>

                <div
                  className={`font-bold tabular-nums text-slate-900 dark:text-white gate-timer-digits transition-all duration-300 ${
                    pomodoroRunning ? "gate-timer-live" : ""
                  } ${
                    zenMode ? "gate-zen-blur select-none" : ""
                  } ${
                    isFullscreen
                      ? "text-8xl sm:text-9xl md:text-[13rem]"
                      : "text-6xl sm:text-8xl"
                  }`}
                  aria-label={zenMode ? "Timer hidden in Zen mode" : `Remaining time ${formatShortTime(pomodoroSeconds)}`}
                >
                  {formatShortTime(pomodoroSeconds)}
                </div>

                <p className="mx-auto mt-3 max-w-full truncate px-2 text-xs text-slate-500 dark:text-zinc-500 sm:mt-4 sm:text-sm">
                  Completed: {completedPomodoros} pomodoros
                </p>

                <div className="timer-action-row mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:justify-center sm:gap-3">
                  {!pomodoroRunning ? (
                    <button
                      type="button"
                      onClick={startPomodoro}
                      disabled={simpleRunning}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/15 transition hover:bg-purple-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-5"
                    >
                      <Play size={18} />
                      Start
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pausePomodoro}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-yellow-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 active:scale-[0.98] sm:px-5"
                    >
                      <Pause size={18} />
                      Pause
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={skipPomodoro}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-200 px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
                  >
                    <SkipForward size={18} />
                    Skip
                  </button>

                  <button
                    type="button"
                    onClick={resetPomodoro}
                    className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white sm:col-span-1 sm:px-5"
                  >
                    <RotateCcw size={18} />
                    Reset
                  </button>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5 dark:border-zinc-800 sm:mt-8 sm:pt-6">
                  <button
                    type="button"
                    onClick={() => setShowSettings(!showSettings)}
                    className="mx-auto flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <Settings size={16} />
                    Pomodoro Settings
                  </button>

                  {showSettings && (
                    <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
                      <SettingInput
                        label="Study (minutes)"
                        value={pomodoroSettings.study}
                        onChange={(value) =>
                          updatePomodoroSettings({ study: value })
                        }
                        disabled={isRunning}
                      />
                      <SettingInput
                        label="Short Break"
                        value={pomodoroSettings.shortBreak}
                        onChange={(value) =>
                          updatePomodoroSettings({ shortBreak: value })
                        }
                        disabled={isRunning}
                      />
                      <SettingInput
                        label="Long Break"
                        value={pomodoroSettings.longBreak}
                        onChange={(value) =>
                          updatePomodoroSettings({ longBreak: value })
                        }
                        disabled={isRunning}
                      />
                      <SettingInput
                        label="Sessions Before Long Break"
                        value={pomodoroSettings.sessionsBeforeLongBreak}
                        onChange={(value) =>
                          updatePomodoroSettings({
                            sessionsBeforeLongBreak: value,
                          })
                        }
                        disabled={isRunning}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <section
          aria-label="Motivational quote"
          className={`relative mt-5 overflow-hidden rounded-2xl border p-5 sm:mt-6 sm:p-7 ${
            isDark
              ? "border-purple-500/20 bg-gradient-to-br from-purple-950/30 via-zinc-900/70 to-zinc-950"
              : "border-purple-100 bg-gradient-to-br from-purple-50 via-white to-slate-50"
          }`}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${isDark ? "bg-purple-500/15 text-purple-300" : "bg-purple-100 text-purple-600"}`}>
              <Quote size={18} aria-hidden="true" />
            </div>

            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isDark ? "text-purple-300/80" : "text-purple-600"}`}>
              Focus thought
            </p>

            <blockquote
              key={quoteIndex}
              className={`mt-4 max-w-2xl text-lg font-medium leading-relaxed sm:text-2xl ${isDark ? "text-white" : "text-slate-900"}`}
            >
              “{MOTIVATIONAL_QUOTES[quoteIndex].text}”
            </blockquote>

            <div className="mt-4 flex items-center justify-center gap-2">
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                — {MOTIVATIONAL_QUOTES[quoteIndex].author}
              </p>
              <span
                aria-label={`Quote number ${quoteIndex + 1}`}
                className={`text-[10px] font-medium tracking-wide ${isDark ? "text-zinc-600" : "text-slate-400"}`}
              >
                #{quoteIndex + 1}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuoteIndex((current) => {
                  if (MOTIVATIONAL_QUOTES.length <= 1) return current;
                  let next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
                  while (next === current) {
                    next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
                  }
                  return next;
                });
              }}
              aria-label="Show another motivational quote"
              title="New motivational quote"
              className={`mt-6 flex h-12 w-12 items-center justify-center rounded-full border shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                isDark
                  ? "border-purple-400/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                  : "border-purple-200 bg-white text-purple-600 hover:bg-purple-50"
              }`}
            >
              <Shuffle size={18} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(takeoverError)}
        title="Timer takeover unavailable"
        message={takeoverError}
        confirmText="Got it"
        cancelText="Close"
        onConfirm={() => setTakeoverError("")}
        onCancel={() => setTakeoverError("")}
      />
    </div>
  );
}

function SettingInput({ label, value, onChange, disabled }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-slate-600 dark:text-zinc-400">
        {label}
      </span>
      <input
        type="number"
        min="1"
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(Math.max(1, Number(e.target.value) || 1))
        }
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-purple-500 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      />
    </label>
  );
}

export default Timer;
