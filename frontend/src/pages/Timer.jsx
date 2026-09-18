import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Timer as TimerIcon,
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings,
  SkipForward,
  Volume2,
  Maximize,
  Minimize,
  Monitor,
  Sun as SunIcon,
  Moon as MoonIcon,
} from "lucide-react";

import { GATE_SYLLABUS } from "../data/syllabus";
import { useStudy } from "../context/useStudy";
import { useTheme } from "../context/ThemeContext";

/* -------------------------
   TIME FORMATTERS
------------------------- */

function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  return [
    hours,
    minutes,
    seconds,
  ]
    .map((value) =>
      String(value).padStart(2, "0")
    )
    .join(":");
}

function formatShortTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

/* -------------------------
   TIMER
------------------------- */

function Timer() {
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  /* -------------------------
     SHARED STUDY STATE
  ------------------------- */

  const {
    addSession,
    pomodoroSettings,
    updatePomodoroSettings,
  } = useStudy();

  /* -------------------------
     TIMER MODE
  ------------------------- */

  const [timerMode, setTimerMode] =
    useState("simple");

  /* -------------------------
     SUBJECT / TOPIC
  ------------------------- */

  const [selectedSubject, setSelectedSubject] =
    useState("");

  const [selectedTopic, setSelectedTopic] =
    useState("");

  const availableTopics = useMemo(() => {
    if (!selectedSubject) return [];

    return Object.values(
      GATE_SYLLABUS[selectedSubject]
    ).flat();
  }, [selectedSubject]);

  /* -------------------------
     SIMPLE TIMER
  ------------------------- */

  const [simpleSeconds, setSimpleSeconds] =
    useState(0);

  const [simpleRunning, setSimpleRunning] =
    useState(false);

  const simpleStartTime = useRef(null);

  const simpleElapsedBeforeStart =
    useRef(0);

  useEffect(() => {
    if (!simpleRunning) return;

    simpleStartTime.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() -
          simpleStartTime.current) /
          1000
      );

      setSimpleSeconds(
        simpleElapsedBeforeStart.current +
          elapsed
      );
    }, 250);

    return () => clearInterval(interval);
  }, [simpleRunning]);

  function startSimpleTimer() {
    setSimpleRunning(true);
  }

  function pauseSimpleTimer() {
    if (!simpleRunning) return;

    const elapsed = Math.floor(
      (Date.now() -
        simpleStartTime.current) /
        1000
    );

    simpleElapsedBeforeStart.current +=
      elapsed;

    setSimpleSeconds(
      simpleElapsedBeforeStart.current
    );

    setSimpleRunning(false);
  }

  function stopSimpleTimer() {
    if (simpleRunning) {
      const elapsed = Math.floor(
        (Date.now() -
          simpleStartTime.current) /
          1000
      );

      simpleElapsedBeforeStart.current +=
        elapsed;
    }

    const finalSeconds =
      simpleElapsedBeforeStart.current;

    setSimpleRunning(false);

    if (finalSeconds <= 0) return;

    saveSession(
      finalSeconds,
      "Regular Timer"
    );

    setSimpleSeconds(0);
    simpleElapsedBeforeStart.current = 0;
  }

  function resetSimpleTimer() {
    setSimpleRunning(false);
    setSimpleSeconds(0);

    simpleElapsedBeforeStart.current = 0;
  }

  /* -------------------------
     POMODORO
  ------------------------- */

  const [pomodoroMode, setPomodoroMode] =
    useState("study");

  const [pomodoroSeconds, setPomodoroSeconds] =
    useState(
      pomodoroSettings.study * 60
    );

  const [pomodoroRunning, setPomodoroRunning] =
    useState(false);

  const [completedPomodoros, setCompletedPomodoros] =
    useState(0);

  const [showSettings, setShowSettings] =
    useState(false);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const timerCardRef = useRef(null);

  const pomodoroEndTime =
    useRef(null);

  /* -------------------------
     POMODORO TIMER
  ------------------------- */

  useEffect(() => {
    if (!pomodoroRunning) return;

    pomodoroEndTime.current =
      Date.now() +
      pomodoroSeconds * 1000;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (pomodoroEndTime.current -
            Date.now()) /
            1000
        )
      );

      setPomodoroSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        completePomodoro();
      }
    }, 250);

    return () =>
      clearInterval(interval);
  }, [pomodoroRunning]);

  function startPomodoro() {
    setPomodoroRunning(true);
  }

  function pausePomodoro() {
    if (!pomodoroRunning) return;

    const remaining = Math.max(
      0,
      Math.ceil(
        (pomodoroEndTime.current -
          Date.now()) /
          1000
      )
    );

    setPomodoroSeconds(remaining);
    setPomodoroRunning(false);
  }

  function resetPomodoro() {
    setPomodoroRunning(false);
    setPomodoroMode("study");

    setPomodoroSeconds(
      pomodoroSettings.study * 60
    );
  }

  function completePomodoro() {
    setPomodoroRunning(false);

    playNotificationSound();

    if (pomodoroMode === "study") {
      const newCount =
        completedPomodoros + 1;

      setCompletedPomodoros(newCount);

      saveSession(
        pomodoroSettings.study * 60,
        "Pomodoro"
      );

      if (
        newCount %
          pomodoroSettings.sessionsBeforeLongBreak ===
        0
      ) {
        setPomodoroMode("longBreak");

        setPomodoroSeconds(
          pomodoroSettings.longBreak * 60
        );
      } else {
        setPomodoroMode("shortBreak");

        setPomodoroSeconds(
          pomodoroSettings.shortBreak * 60
        );
      }
    } else {
      setPomodoroMode("study");

      setPomodoroSeconds(
        pomodoroSettings.study * 60
      );
    }
  }

  function skipPomodoro() {
    setPomodoroRunning(false);

    if (pomodoroMode === "study") {
      setPomodoroMode("shortBreak");

      setPomodoroSeconds(
        pomodoroSettings.shortBreak * 60
      );
    } else {
      setPomodoroMode("study");

      setPomodoroSeconds(
        pomodoroSettings.study * 60
      );
    }
  }

  /* -------------------------
     SOUND
  ------------------------- */

  function playNotificationSound() {
    try {
      const audio = new Audio(
        "/notification.mp3"
      );

      audio.volume = 0.8;

      audio
        .play()
        .catch(playBrowserBeep);
    } catch {
      playBrowserBeep();
    }
  }

  function playBrowserBeep() {
    try {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContext) return;

      const context =
        new AudioContext();

      const oscillator =
        context.createOscillator();

      const gain =
        context.createGain();

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gain.gain.value = 0.15;

      oscillator.connect(gain);
      gain.connect(
        context.destination
      );

      oscillator.start();

      setTimeout(() => {
        oscillator.stop();
        context.close();
      }, 500);
    } catch {
      console.log(
        "Sound unavailable"
      );
    }
  }

  /* -------------------------
     SAVE SESSION
  ------------------------- */

  function saveSession(
    duration,
    type
  ) {
    addSession(
      duration,
      type,
      selectedSubject || "No subject",
      selectedTopic || "No topic"
    );
  }

  /* -------------------------
     SUBJECT CHANGE
  ------------------------- */

  function handleSubjectChange(
    subject
  ) {
    setSelectedSubject(subject);
    setSelectedTopic("");
  }

  /* -------------------------
     FULLSCREEN TIMER
  ------------------------- */

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await timerCardRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(
        Boolean(document.fullscreenElement)
      );
    }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

  /* -------------------------
     PAGE TITLE
  ------------------------- */

  useEffect(() => {
    if (
      timerMode === "pomodoro" &&
      pomodoroRunning
    ) {
      document.title =
        `${formatShortTime(
          pomodoroSeconds
        )} • GATE CSE`;
    } else if (
      timerMode === "simple" &&
      simpleRunning
    ) {
      document.title =
        `${formatShortTime(
          simpleSeconds
        )} • GATE CSE`;
    } else {
      document.title =
        "GATE CSE Tracker";
    }

    return () => {
      document.title =
        "GATE CSE Tracker";
    };
  }, [
    timerMode,
    pomodoroRunning,
    pomodoroSeconds,
    simpleRunning,
    simpleSeconds,
  ]);

  /* -------------------------
     RENDER
  ------------------------- */

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-zinc-950 text-slate-900 dark:text-white" : "bg-slate-50 text-slate-900"}`}>mx-auto w-full max-w-5xl"

      {/* PAGE HEADER */}

      <div className="mb-6">
        <div className="flex items-center gap-3">

          <div className="rounded-xl bg-purple-600/15 p-3">
            <TimerIcon
              size={24}
              className="text-purple-400"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Study Timer
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
              Track your GATE CSE study sessions
            </p>
          </div>

        </div>
      </div>

      {/* TIMER MODE */}

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-2">

        <button
          onClick={() =>
            setTimerMode("simple")
          }
          className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
            timerMode === "simple"
              ? "bg-purple-600 text-white"
              : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:bg-zinc-800 hover:text-slate-900 dark:text-white"
          }`}
        >
          ⏱ Simple Timer
        </button>

        <button
          onClick={() =>
            setTimerMode("pomodoro")
          }
          className={`rounded-lg px-3 py-3 text-sm font-semibold transition ${
            timerMode === "pomodoro"
              ? "bg-purple-600 text-white"
              : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:bg-zinc-800 hover:text-slate-900 dark:text-white"
          }`}
        >
          🍅 Pomodoro
        </button>

      </div>

      {/* SUBJECT / TOPIC */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Subject
          </label>

          <select
            value={selectedSubject}
            onChange={(e) =>
              handleSubjectChange(
                e.target.value
              )
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="">
              Select Subject
            </option>

            {Object.keys(
              GATE_SYLLABUS
            ).map((subject) => (
              <option
                key={subject}
                value={subject}
              >
                {subject}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Topic
          </label>

          <select
            value={selectedTopic}
            onChange={(e) =>
              setSelectedTopic(
                e.target.value
              )
            }
            disabled={!selectedSubject}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-40 focus:border-purple-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
          >
            <option value="">
              {selectedSubject
                ? "Select Topic"
                : "Select subject first"}
            </option>

            {availableTopics.map(
              (topic) => (
                <option
                  key={topic}
                  value={topic}
                >
                  {topic}
                </option>
              )
            )}
          </select>
        </div>

      </div>

      {/* TIMER CARD */}

      <div
        ref={timerCardRef}
        className={`
          relative rounded-2xl border border-slate-200 dark:border-zinc-800
          bg-white dark:bg-zinc-900/50 shadow-2xl transition-all duration-300
          ${
            isFullscreen
              ? "flex min-h-screen w-full items-center justify-center overflow-auto rounded-none border-0 bg-slate-50 dark:bg-[#0b1120] p-4 sm:p-8"
              : "p-5 sm:p-8"
          }
        `}
      >
        {/* FULLSCREEN BUTTON */}

        <button
          type="button"
          onClick={toggleFullscreen}
          title={
            isFullscreen
              ? "Exit fullscreen"
              : "Fullscreen timer"
          }
          className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-white/90 dark:bg-zinc-900/80 px-3 py-2 text-slate-600 dark:text-zinc-400 backdrop-blur transition hover:border-purple-500/50 hover:bg-slate-200 dark:bg-zinc-800 hover:text-slate-900 dark:text-white"
        >
          {isFullscreen ? (
            <>
              <Minimize size={17} />
              <span className="hidden sm:inline">
                Exit Fullscreen
              </span>
            </>
          ) : (
            <>
              <Maximize size={17} />
              <span className="hidden sm:inline">
                Fullscreen
              </span>
            </>
          )}
        </button>

        {/* TIMER CONTENT */}

        <div className={isFullscreen ? "w-full max-w-5xl" : "w-full"}>

        {/* SIMPLE TIMER */}

        {timerMode === "simple" && (
          <div className="text-center">

            <p className="mb-4 text-sm uppercase tracking-widest text-slate-500 dark:text-zinc-500">
              Regular Study Timer
            </p>

            <div
              className={`
                break-all font-bold tabular-nums text-slate-900 dark:text-white
                ${
                  isFullscreen
                    ? "text-6xl sm:text-8xl md:text-9xl"
                    : "text-5xl sm:text-7xl"
                }
              `}
            >
              {formatTime(
                simpleSeconds
              )}
            </div>

            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">
              {selectedSubject
                ? `${selectedSubject}${
                    selectedTopic
                      ? ` • ${selectedTopic}`
                      : ""
                  }`
                : "No subject selected"}
            </p>

            {/* CONTROLS */}

            <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:justify-center">

              {!simpleRunning ? (
                <button
                  onClick={
                    startSimpleTimer
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-purple-500"
                >
                  <Play size={18} />
                  Start
                </button>
              ) : (
                <button
                  onClick={
                    pauseSimpleTimer
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-yellow-600 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-yellow-500"
                >
                  <Pause size={18} />
                  Pause
                </button>
              )}

              <button
                onClick={
                  stopSimpleTimer
                }
                disabled={
                  simpleSeconds === 0
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-zinc-800 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-slate-300 dark:hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Square size={18} />
                Save
              </button>

              <button
                onClick={
                  resetSimpleTimer
                }
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-700 px-5 py-3 font-semibold text-slate-700 dark:text-zinc-300 transition hover:bg-slate-200 dark:bg-zinc-800 hover:text-slate-900 dark:text-white sm:col-span-1"
              >
                <RotateCcw size={18} />
                Reset
              </button>

            </div>
          </div>
        )}

        {/* POMODORO */}

        {timerMode === "pomodoro" && (
          <div className="text-center">

            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-purple-400">
                {pomodoroMode ===
                "study"
                  ? "Focus"
                  : pomodoroMode ===
                    "shortBreak"
                  ? "Short Break"
                  : "Long Break"}
              </span>
            </div>

            <div
              className={`
                font-bold tabular-nums text-slate-900 dark:text-white
                ${
                  isFullscreen
                    ? "text-8xl sm:text-9xl md:text-[11rem]"
                    : "text-7xl sm:text-8xl"
                }
              `}
            >
              {formatShortTime(
                pomodoroSeconds
              )}
            </div>

            <p className="mt-4 text-sm text-slate-500 dark:text-zinc-500">
              Completed:{" "}
              {completedPomodoros}{" "}
              pomodoros
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:justify-center">

              {!pomodoroRunning ? (
                <button
                  onClick={
                    startPomodoro
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-purple-500"
                >
                  <Play size={18} />
                  Start
                </button>
              ) : (
                <button
                  onClick={
                    pausePomodoro
                  }
                  className="flex items-center justify-center gap-2 rounded-xl bg-yellow-600 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-yellow-500"
                >
                  <Pause size={18} />
                  Pause
                </button>
              )}

              <button
                onClick={
                  skipPomodoro
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-slate-200 dark:bg-zinc-800 px-5 py-3 font-semibold text-slate-900 dark:text-white transition hover:bg-slate-300 dark:hover:bg-zinc-700"
              >
                <SkipForward size={18} />
                Skip
              </button>

              <button
                onClick={
                  resetPomodoro
                }
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-zinc-700 px-5 py-3 font-semibold text-slate-700 dark:text-zinc-300 transition hover:bg-slate-200 dark:bg-zinc-800 hover:text-slate-900 dark:text-white sm:col-span-1"
              >
                <RotateCcw size={18} />
                Reset
              </button>

            </div>

            {/* SETTINGS */}

            <div className="mt-8 border-t border-slate-200 dark:border-zinc-800 pt-6">

              <button
                onClick={() =>
                  setShowSettings(
                    !showSettings
                  )
                }
                className="mx-auto flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 transition hover:text-slate-900 dark:text-white"
              >
                <Settings size={16} />
                Pomodoro Settings
              </button>

              {showSettings && (
                <div className="mx-auto mt-5 grid max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2">

                  <SettingInput
                    label="Study"
                    value={
                      pomodoroSettings.study
                    }
                    onChange={(value) =>
                      updatePomodoroSettings({
                        study: value,
                      })
                    }
                  />

                  <SettingInput
                    label="Short Break"
                    value={
                      pomodoroSettings.shortBreak
                    }
                    onChange={(value) =>
                      updatePomodoroSettings({
                        shortBreak: value,
                      })
                    }
                  />

                  <SettingInput
                    label="Long Break"
                    value={
                      pomodoroSettings.longBreak
                    }
                    onChange={(value) =>
                      updatePomodoroSettings({
                        longBreak: value,
                      })
                    }
                  />

                  <SettingInput
                    label="Sessions Before Long Break"
                    value={
                      pomodoroSettings.sessionsBeforeLongBreak
                    }
                    onChange={(value) =>
                      updatePomodoroSettings({
                        sessionsBeforeLongBreak:
                          value,
                      })
                    }
                  />

                </div>
              )}

            </div>
          </div>
        )}

        </div>

      </div>

      {/* INFO */}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 p-4">

          <div className="flex items-center gap-3">

            <Volume2
              size={18}
              className="text-purple-400"
            />

            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Timer Sound
              </p>

              <p className="text-xs text-slate-500 dark:text-zinc-500">
                Add notification.mp3 to public/
              </p>
            </div>

          </div>

        </div>

        <div className="rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 p-4">

          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Automatic Saving
          </p>

          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Completed study sessions are saved automatically.
          </p>

        </div>

        {/* THEME SETTING */}

        <div className={`rounded-xl border p-4 ${
          isDark
            ? "border-zinc-800 bg-zinc-900/30"
            : "border-slate-200 bg-white"
        }`}>

          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              {isDark ? (
                <MoonIcon size={18} className="text-purple-400" />
              ) : (
                <SunIcon size={18} className="text-amber-500" />
              )}

              <div>
                <p className={`text-sm font-medium ${isDark ? "text-slate-900 dark:text-white" : "text-slate-900"}`}>
                  {isDark ? "Dark Mode" : "Light Mode"}
                </p>
                <p className={`mt-1 text-xs ${isDark ? "text-slate-500 dark:text-zinc-500" : "text-slate-500"}`}>
                  Switch the timer appearance.
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={toggleTheme}
              role="switch"
              aria-checked={isDark}
              aria-label="Toggle dark and light mode"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isDark ? "bg-purple-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform shadow ${
                  isDark ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>

          </div>

        </div>

        {/* FULLSCREEN SETTING */}

        <div className="rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30 p-4">

          <div className="flex items-center justify-between gap-4">

            <div className="flex items-center gap-3">

              <Monitor
                size={18}
                className="text-purple-400"
              />

              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Fullscreen Timer
                </p>

                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                  Focus without distractions.
                </p>
              </div>

            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              role="switch"
              aria-checked={isFullscreen}
              aria-label="Toggle fullscreen timer"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                isFullscreen
                  ? "bg-purple-600"
                  : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                  isFullscreen
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}

/* -------------------------
   SETTINGS INPUT
------------------------- */

function SettingInput({
  label,
  value,
  onChange,
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-sm text-slate-600 dark:text-zinc-400">
        {label}
      </span>

      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) =>
          onChange(
            Math.max(
              1,
              Number(e.target.value)
            )
          )
        }
        className="w-full rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-purple-500"
      />

    </label>
  );
}

export default Timer;