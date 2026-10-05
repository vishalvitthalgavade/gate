import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { useStudy } from "./useStudy";
import {
  closeTimerNotification,
  requestTimerNotificationPermission,
  showTimerNotification,
} from "../utils/timerNotification";

const TimerContext = createContext(null);

const TIMER_STORAGE_KEY = "gate-timer-state";
const TIMER_OWNER_KEY = "gate-timer-owner-id";

function getTimerOwnerId() {
  try {
    const existing = sessionStorage.getItem(TIMER_OWNER_KEY);
    if (existing) return existing;
    const params = new URLSearchParams(window.location.search);
    const notificationOwner = params.get("timerOwner");
    if (
      (params.get("timerAction") === "pause" || params.get("timerAction") === "resume") &&
      notificationOwner
    ) {
      sessionStorage.setItem(TIMER_OWNER_KEY, notificationOwner);
      return notificationOwner;
    }
    const id = crypto?.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TIMER_OWNER_KEY, id);
    return id;
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function getTimerOwnerLabel() {
  try {
    const ua = navigator.userAgent || "Browser";
    const platform = navigator.userAgentData?.platform || navigator.platform || "Device";
    return `${platform} • ${ua.includes("Mobile") ? "Mobile" : "Browser"}`;
  } catch {
    return "Browser tab";
  }
}

function loadSavedTimer(userId, ownerId) {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const saved = JSON.parse(raw);

    if (saved?.userId && saved.userId !== userId) {
      return null;
    }

    if (saved?.ownerId && saved.ownerId !== ownerId) {
      return null;
    }

    return saved;
  } catch {
    return null;
  }
}

function persistTimer(state) {
  try {
    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Ignore storage failures.
  }
}

function formatNotificationTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function getNotificationLabel(value) {
  if (typeof value !== "string") return "";
  const label = value.trim();
  if (!label || /^(undefined|null|no subject|no topic)$/i.test(label)) return "";
  return label;
}

function truncateNotificationLabel(value, maxLength = 42) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function playBrowserBeep() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return;
    }

    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gain.gain.value = 0.15;

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();

    window.setTimeout(() => {
      oscillator.stop();
      context.close();
    }, 500);
  } catch {
    console.log("Sound unavailable");
  }
}

function playNotificationSound() {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 0.8;
    audio.play().catch(playBrowserBeep);
  } catch {
    playBrowserBeep();
  }
}

/*
====================================================
SYNCHRONOUS LOCAL HYDRATION
====================================================

These run at mount time (no network round-trip)
so the timer keeps counting seamlessly across a
page refresh instead of freezing at 0/paused while
we wait on the server. The server is reconciled
with in the background afterwards.
====================================================
*/

function computeSimpleHydration(saved) {
  const savedSeconds = Number(saved?.simpleSeconds || 0);

  if (saved?.simpleRunning && saved?.simpleStartedAt) {
    /*
     * `simpleSeconds` is the live display value that was last persisted.
     * It is NOT the base value for the current running segment. Adding the
     * full time since `simpleStartedAt` to it after a refresh double-counts
     * time that has already been included in `simpleSeconds`.
     *
     * Persist the actual segment base when available. For older saved state,
     * infer it safely: an active timer that has never been paused has the
     * same session and segment start; a resumed timer has different values.
     */
    const inferredBase =
      saved?.simpleBase != null
        ? Number(saved.simpleBase)
        : saved?.simpleSessionStartedAt &&
            saved?.simpleStartedAt &&
            Number(saved.simpleSessionStartedAt) !== Number(saved.simpleStartedAt)
          ? savedSeconds
          : 0;

    const extra = Math.max(
      0,
      Math.floor((Date.now() - Number(saved.simpleStartedAt)) / 1000)
    );

    const seconds = inferredBase + extra;

    return {
      seconds,
      running: true,
      base: inferredBase,
      startedAt: Number(saved.simpleStartedAt),
    };
  }

  return {
    seconds: savedSeconds,
    running: false,
    base: savedSeconds,
    startedAt: null,
  };
}

function computePomodoroHydration(saved, defaultStudySeconds) {
  const mode = saved?.pomodoroMode || "study";

  if (saved?.pomodoroRunning && saved?.pomodoroEndAt) {
    const remaining = Math.max(
      0,
      Math.ceil((saved.pomodoroEndAt - Date.now()) / 1000)
    );

    if (remaining > 0) {
      return {
        mode,
        seconds: remaining,
        running: true,
        endAt: Date.now() + remaining * 1000,
        completedImmediately: false,
      };
    }

    // The countdown fully elapsed while the tab was
    // closed/refreshed. Let the caller run completion
    // logic once, after mount.
    return {
      mode,
      seconds: 0,
      running: false,
      endAt: null,
      completedImmediately: true,
    };
  }

  const seconds =
    saved?.pomodoroSeconds != null
      ? Number(saved.pomodoroSeconds)
      : defaultStudySeconds;

  return {
    mode,
    seconds,
    running: false,
    endAt: null,
    completedImmediately: false,
  };
}

export function TimerProvider({ children }) {
  const { authFetch, isAuthenticated, user } = useAuth();
  const { addSession, pomodoroSettings, refreshFromServer } = useStudy();

  const userId = user?.id || null;
  const timerOwnerIdRef = useRef(getTimerOwnerId());
  const timerOwnerLabelRef = useRef(getTimerOwnerLabel());
  const notificationLaunchActionRef = useRef(null);
  if (!notificationLaunchActionRef.current) {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("timerAction");
    if (action === "pause" || action === "resume") {
      notificationLaunchActionRef.current = {
        action,
        ownerId: params.get("timerOwner"),
      };
    }
  }

  /*
   * Computed exactly once, on the first render, from
   * whatever is already in localStorage. Using a ref
   * (instead of re-deriving on every render) means a
   * later change to `userId` or `pomodoroSettings`
   * can't accidentally re-run this initial hydration.
   */
  const initRef = useRef(null);

  if (initRef.current === null) {
    const savedState = userId ? loadSavedTimer(userId, timerOwnerIdRef.current) : null;

    initRef.current = {
      saved: savedState,
      simple: computeSimpleHydration(savedState),
      pomodoro: computePomodoroHydration(
        savedState,
        pomodoroSettings.study * 60
      ),
    };
  }

  const init = initRef.current;

  const [timerMode, setTimerMode] = useState(
    init.saved?.timerMode || "simple"
  );
  const [selectedSubject, setSelectedSubject] = useState(
    init.saved?.selectedSubject || ""
  );
  const [selectedTopic, setSelectedTopic] = useState(
    init.saved?.selectedTopic || ""
  );

  const [simpleSeconds, setSimpleSeconds] = useState(
    init.simple.seconds
  );
  const [simpleRunning, setSimpleRunning] = useState(
    init.simple.running
  );
  const [simplePausedAt, setSimplePausedAt] = useState(() => {
    if (init.simple.running || !init.saved?.simpleSessionStartedAt) return null;
    return Number(init.saved.simplePausedAt) || Date.now();
  });

  const [pomodoroMode, setPomodoroMode] = useState(
    init.pomodoro.mode
  );
  const [pomodoroSeconds, setPomodoroSeconds] = useState(
    init.pomodoro.seconds
  );
  const [pomodoroRunning, setPomodoroRunning] = useState(
    init.pomodoro.running
  );
  const [pomodoroPausedAt, setPomodoroPausedAt] = useState(() => {
    if (init.pomodoro.running || !init.saved?.pomodoroSessionStartedAt) return null;
    return Number(init.saved.pomodoroPausedAt) || Date.now();
  });
  const [timerNotificationActive, setTimerNotificationActive] = useState(
    Boolean(
      init.simple.running || init.pomodoro.running ||
      init.saved?.simpleSessionStartedAt ||
      init.saved?.pomodoroSessionStartedAt ||
      init.saved?.simplePausedAt ||
      init.saved?.pomodoroPausedAt
    )
  );
  const [timerNotificationsAllowed, setTimerNotificationsAllowed] = useState(
    () => typeof Notification !== "undefined" && Notification.permission === "granted"
  );
  const [notificationActionSequence, setNotificationActionSequence] = useState(0);
  const timerNotificationActiveRef = useRef(timerNotificationActive);
  const [completedPomodoros, setCompletedPomodoros] = useState(
    init.saved?.completedPomodoros || 0
  );

  /*
   * `restoring` is now purely informational (a small
   * "syncing" note) - it never blocks the Start/Pause
   * buttons, since the state above is already correct
   * the moment the app mounts.
   */
  const [restoring, setRestoring] = useState(
    Boolean(userId)
  );
  const [timerConflict, setTimerConflict] = useState(null);

  const simpleBaseRef = useRef(init.simple.base);
  const simpleStartedAtRef = useRef(init.simple.startedAt);
  const simpleSessionStartedAtRef = useRef(
    init.saved?.simpleSessionStartedAt || init.simple.startedAt
  );

  const pomodoroEndAtRef = useRef(init.pomodoro.endAt);
  const pomodoroSessionStartedAtRef = useRef(
    init.saved?.pomodoroSessionStartedAt || null
  );
  const pomodoroModeRef = useRef(pomodoroMode);
  const pomodoroRunningRef = useRef(pomodoroRunning);
  const simpleRunningRef = useRef(simpleRunning);
  const simplePausedAtRef = useRef(simplePausedAt);
  const pomodoroPausedAtRef = useRef(pomodoroPausedAt);
  const completedPomodorosRef = useRef(completedPomodoros);
  const selectedSubjectRef = useRef(selectedSubject);
  const selectedTopicRef = useRef(selectedTopic);
  const timerModeRef = useRef(timerMode);
  const simpleSecondsRef = useRef(simpleSeconds);
  const pomodoroSecondsRef = useRef(pomodoroSeconds);
  const restoredRef = useRef(false);
  const simpleStartInFlightRef = useRef(false);
  const autoSaveInFlightRef = useRef(null);
  const timerChannelRef = useRef(null);

  pomodoroModeRef.current = pomodoroMode;
  pomodoroRunningRef.current = pomodoroRunning;
  simpleRunningRef.current = simpleRunning;
  simplePausedAtRef.current = simplePausedAt;
  pomodoroPausedAtRef.current = pomodoroPausedAt;
  completedPomodorosRef.current = completedPomodoros;
  selectedSubjectRef.current = selectedSubject;
  selectedTopicRef.current = selectedTopic;
  timerModeRef.current = timerMode;
  timerNotificationActiveRef.current = timerNotificationActive;
  simpleSecondsRef.current = simpleSeconds;
  pomodoroSecondsRef.current = pomodoroSeconds;

  const activeStudyRequest = useCallback(
    async (endpoint, body = {}, method = "POST") => {
      try {
        const requestOptions = {
          method,
        };

        if (method !== "GET") {
          requestOptions.body = JSON.stringify(body);
        }

        const response = await authFetch(
          endpoint,
          requestOptions
        );

        let data = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        return {
          ok: response.ok,
          status: response.status,
          response,
          data,
        };
      } catch (error) {
        console.warn(
          `Active study request error: ${endpoint}`,
          error
        );

        return {
          ok: false,
          status: null,
          response: null,
          data: null,
          error,
        };
      }
    },
    [authFetch]
  );

  const getSimpleElapsedSeconds = useCallback(() => {
    if (!simpleRunningRef.current || !simpleStartedAtRef.current) {
      return simpleBaseRef.current;
    }

    const elapsed = Math.floor(
      (Date.now() - simpleStartedAtRef.current) / 1000
    );

    return simpleBaseRef.current + Math.max(0, elapsed);
  }, []);

  const getPomodoroElapsedSeconds = useCallback(() => {
    if (pomodoroModeRef.current !== "study") {
      return 0;
    }

    const totalStudySeconds = pomodoroSettings.study * 60;
    const remaining =
      pomodoroRunningRef.current && pomodoroEndAtRef.current
        ? Math.max(
            0,
            Math.ceil(
              (pomodoroEndAtRef.current - Date.now()) / 1000
            )
          )
        : pomodoroSeconds;

    return Math.max(0, totalStudySeconds - remaining);
  }, [pomodoroSettings.study, pomodoroSeconds]);

  const startActiveSimpleStudy = useCallback(async () => {
    const result = await activeStudyRequest(
      "/sessions/active/start",
      {
        subject: selectedSubjectRef.current || "No subject",
        topic: selectedTopicRef.current || "No topic",
        type: "Regular Timer",
        accumulatedSeconds: simpleBaseRef.current,
        ownerId: timerOwnerIdRef.current,
        ownerLabel: timerOwnerLabelRef.current,
      }
    );

    if (!result.ok && result.status === 409 && result.data?.code === "TIMER_ALREADY_RUNNING") {
      setTimerConflict({ mode: "simple", activeStudy: result.data.activeStudy || null });
    }

    return result;
  }, [activeStudyRequest]);

  const startActivePomodoroStudy = useCallback(async () => {
    const result = await activeStudyRequest(
      "/sessions/active/start",
      {
        subject: selectedSubjectRef.current || "No subject",
        topic: selectedTopicRef.current || "No topic",
        type: "Pomodoro",
        accumulatedSeconds: getPomodoroElapsedSeconds(),
        ownerId: timerOwnerIdRef.current,
        ownerLabel: timerOwnerLabelRef.current,
      }
    );

    if (!result.ok && result.status === 409 && result.data?.code === "TIMER_ALREADY_RUNNING") {
      setTimerConflict({ mode: "pomodoro", activeStudy: result.data.activeStudy || null });
    }

    return result;
  }, [activeStudyRequest, getPomodoroElapsedSeconds]);

  const heartbeatActiveStudy = useCallback(async () => {
    // Do not heartbeat before the initial Start request has registered the timer.
    // Otherwise a slow first request can race the heartbeat and make a newly
    // started timer look missing/unauthorized, causing it to stop immediately.
    if (simpleStartInFlightRef.current) {
      return;
    }

    if (simpleRunningRef.current) {
      const result = await activeStudyRequest(
        "/sessions/active/heartbeat",
        {
          subject: selectedSubjectRef.current || "No subject",
          topic: selectedTopicRef.current || "No topic",
          type: "Regular Timer",
          accumulatedSeconds: getSimpleElapsedSeconds(),
          ownerId: timerOwnerIdRef.current,
          ownerLabel: timerOwnerLabelRef.current,
        }
      );

      /*
       * The server has no record of this timer (it may
       * have failed to register earlier, or been cleared
       * server-side). Recreate it so future refreshes and
       * the leaderboard stay accurate.
       */
      if (!result.ok && result.status === 409 && result.data?.code === "TIMER_OWNERSHIP_LOST") {
        setSimpleRunning(false);
        simpleStartedAtRef.current = null;
        simpleBaseRef.current = getSimpleElapsedSeconds();
        await refreshFromServer();
        try { timerChannelRef.current?.postMessage({ type: "TIMER_OWNERSHIP_LOST" }); } catch {}
        return;
      }
      if (!result.ok && result.status === 404) {
        setSimpleRunning(false);
        simpleStartedAtRef.current = null;
        simpleBaseRef.current = getSimpleElapsedSeconds();
        return;
      }

      return;
    }

    if (
      pomodoroRunningRef.current &&
      pomodoroModeRef.current === "study"
    ) {
      const result = await activeStudyRequest(
        "/sessions/active/heartbeat",
        {
          subject: selectedSubjectRef.current || "No subject",
          topic: selectedTopicRef.current || "No topic",
          type: "Pomodoro",
          accumulatedSeconds: getPomodoroElapsedSeconds(),
          ownerId: timerOwnerIdRef.current,
          ownerLabel: timerOwnerLabelRef.current,
        }
      );

      if (!result.ok && result.status === 409 && result.data?.code === "TIMER_OWNERSHIP_LOST") {
        setPomodoroRunning(false);
        pomodoroEndAtRef.current = null;
        await refreshFromServer();
        try { timerChannelRef.current?.postMessage({ type: "TIMER_OWNERSHIP_LOST" }); } catch {}
        return;
      }
      if (!result.ok && result.status === 404) {
        setPomodoroRunning(false);
        pomodoroEndAtRef.current = null;
        return;
      }
    }
  }, [
    activeStudyRequest,
    getPomodoroElapsedSeconds,
    getSimpleElapsedSeconds,
    refreshFromServer,
  ]);

  const pauseActiveStudy = useCallback(
    async (seconds) => {
      await activeStudyRequest("/sessions/active/pause", {
        accumulatedSeconds: seconds,
        ownerId: timerOwnerIdRef.current,
      });
    },
    [activeStudyRequest]
  );

  const stopActiveStudy = useCallback(async ({ save = false, duration = 0, type = "Regular Timer", startedAt = null } = {}) => {
    const clientId = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const subject = selectedSubjectRef.current || "No subject";
    const topic = selectedTopicRef.current || "No topic";
    const result = await activeStudyRequest("/sessions/active/stop", {
      ownerId: timerOwnerIdRef.current,
      saveSession: save,
      duration,
      type,
      subject,
      topic,
      startedAt,
      clientId,
    });

    // Preserve completed time locally when a transient stop failure prevents
    // the server from saving it. Reusing the request id makes retry safe.
    const blockedByAccessOrOwnership =
      !result.ok && [401, 403, 409].includes(result.status);
    const serverDidNotReturnSavedSession =
      result.ok && !result.data?.session;

    if (
      save && Number(duration) > 0 && !blockedByAccessOrOwnership &&
      (!result.ok || serverDidNotReturnSavedSession)
    ) {
      try {
        const localSession = await addSession(
          duration,
          type,
          subject,
          topic,
          startedAt,
          clientId
        );
        return { ...result, savedLocally: Boolean(localSession) };
      } catch (error) {
        console.error("Could not save the completed timer locally:", error);
      }
    }

    return result;
  }, [activeStudyRequest, addSession]);

  const startSimpleTimer = useCallback(async () => {
    if (autoSaveInFlightRef.current) {
      try {
        await autoSaveInFlightRef.current;
      } catch {
        // A save failure should not prevent the user from starting again.
      }
    }

    if (simpleRunningRef.current) {
      return;
    }

    if (pomodoroRunningRef.current) {
      return;
    }

    // This runs directly from the Start gesture so browsers can show the
    // notification permission prompt before the app is backgrounded.
    void requestTimerNotificationPermission().then((allowed) => {
      if (allowed) setTimerNotificationsAllowed(true);
    });

    /*
     * Start the local clock immediately. The API registration happens in
     * parallel so network latency is not visible as a delay after pressing
     * Start. If registration fails, roll the local start back.
     */
    const base = simpleBaseRef.current;
    const startedAt = Date.now();

    // Mark registration as in-flight so the one-time server reconciliation
    // cannot race this first Start click and interpret its own pending
    // registration as a failed timer.
    simpleStartInFlightRef.current = true;

    simpleBaseRef.current = base;
    simpleStartedAtRef.current = startedAt;
    setSimplePausedAt(null);
    if (!simpleSessionStartedAtRef.current) {
      simpleSessionStartedAtRef.current = startedAt;
    }
    setTimerMode("simple");
    setTimerNotificationActive(true);
    setSimpleRunning(true);

    try {
      let result = await startActiveSimpleStudy();

      /*
       * The very first request right after opening the app (waking a
       * sleepy connection, a token that just needed a silent refresh,
       * a brief network hiccup) is the one most likely to fail once.
       * A genuine conflict (409, someone/something else already owns
       * the timer) won't succeed on a second try, so only retry other,
       * transient failures - and only once - before rolling the
       * optimistic UI back. This avoids the timer flicking on and
       * immediately back off on that first attempt.
       */
      if (!result.ok && result.status !== 409) {
        await new Promise((resolve) => window.setTimeout(resolve, 800));
        if (simpleRunningRef.current) {
          result = await startActiveSimpleStudy();
        }
      }

      if (!result.ok) {
        const currentElapsed = Math.max(
          0,
          base + Math.floor((Date.now() - startedAt) / 1000)
        );
        simpleBaseRef.current = currentElapsed;
        simpleStartedAtRef.current = null;
        setSimpleSeconds(currentElapsed);
        setSimpleRunning(false);
        setTimerNotificationActive(false);
        void closeTimerNotification(timerOwnerIdRef.current);
        return false;
      }

      return true;
    } finally {
      simpleStartInFlightRef.current = false;
    }
  }, [startActiveSimpleStudy]);

  const pauseSimpleTimer = useCallback(() => {
    if (!simpleRunningRef.current) {
      return;
    }

    const elapsed = getSimpleElapsedSeconds();
    simpleBaseRef.current = elapsed;
    simpleStartedAtRef.current = null;

    setSimpleSeconds(elapsed);
    setSimpleRunning(false);
    setSimplePausedAt(Date.now());
    pauseActiveStudy(elapsed);
  }, [getSimpleElapsedSeconds, pauseActiveStudy]);

  const stopSimpleTimer = useCallback(async () => {
    if (!simpleRunningRef.current && !simpleSessionStartedAtRef.current) {
      return;
    }

    const finalSeconds = simpleRunningRef.current
      ? getSimpleElapsedSeconds()
      : simpleBaseRef.current;

    const sessionStartedAt = simpleSessionStartedAtRef.current;
    simpleSessionStartedAtRef.current = null;
    setSimplePausedAt(null);
    setTimerNotificationActive(false);
    void closeTimerNotification(timerOwnerIdRef.current);
    setSimpleRunning(false);
    simpleStartedAtRef.current = null;
    simpleBaseRef.current = 0;
    setSimpleSeconds(0);
    const stopResult = await stopActiveStudy({
      save: true,
      duration: finalSeconds,
      type: "Regular Timer",
      startedAt: sessionStartedAt
        ? new Date(sessionStartedAt).toISOString()
        : null,
    });
    if (stopResult?.ok) await refreshFromServer();
    return stopResult;
  }, [getSimpleElapsedSeconds, refreshFromServer, stopActiveStudy]);

  const resetSimpleTimer = useCallback(() => {
    setTimerNotificationActive(false);
    void closeTimerNotification(timerOwnerIdRef.current);
    setSimpleRunning(false);
    simpleStartedAtRef.current = null;
    simpleSessionStartedAtRef.current = null;
    setSimplePausedAt(null);
    simpleBaseRef.current = 0;
    setSimpleSeconds(0);
    stopActiveStudy({ save: false });
  }, [stopActiveStudy]);

  const startPomodoro = useCallback(async () => {
    if (autoSaveInFlightRef.current) {
      try {
        await autoSaveInFlightRef.current;
      } catch {
        // A save failure should not prevent the user from starting again.
      }
    }

    if (pomodoroRunningRef.current || simpleRunningRef.current) {
      return;
    }

    void requestTimerNotificationPermission().then((allowed) => {
      if (allowed) setTimerNotificationsAllowed(true);
    });

    if (pomodoroModeRef.current === "study") {
      const result = await startActivePomodoroStudy();
      if (!result.ok) return false;
    }

    pomodoroEndAtRef.current = Date.now() + pomodoroSecondsRef.current * 1000;

    if (pomodoroModeRef.current === "study" && !pomodoroSessionStartedAtRef.current) {
      pomodoroSessionStartedAtRef.current = Date.now();
    }

    setTimerMode("pomodoro");
    setPomodoroPausedAt(null);
    setTimerNotificationActive(true);
    setPomodoroRunning(true);
    return true;
  }, [startActivePomodoroStudy]);

  const pausePomodoro = useCallback(() => {
    if (!pomodoroRunningRef.current) {
      return;
    }

    const remaining = Math.max(
      0,
      Math.ceil(
        ((pomodoroEndAtRef.current || Date.now()) - Date.now()) /
          1000
      )
    );

    pomodoroEndAtRef.current = null;
    setPomodoroSeconds(remaining);
    setPomodoroRunning(false);
    setPomodoroPausedAt(Date.now());

    if (pomodoroModeRef.current === "study") {
      pauseActiveStudy(
        Math.max(0, pomodoroSettings.study * 60 - remaining)
      );
    }
  }, [pauseActiveStudy, pomodoroSettings.study]);

  const resetPomodoro = useCallback(() => {
    setTimerNotificationActive(false);
    void closeTimerNotification(timerOwnerIdRef.current);
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;
    pomodoroSessionStartedAtRef.current = null;
    setPomodoroPausedAt(null);
    setPomodoroMode("study");
    setPomodoroSeconds(pomodoroSettings.study * 60);
    stopActiveStudy({ save: false });
  }, [pomodoroSettings.study, stopActiveStudy]);

  const completePomodoro = useCallback(async () => {
    setTimerNotificationActive(false);
    setPomodoroPausedAt(null);
    void closeTimerNotification(timerOwnerIdRef.current);
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;
    const stopResult = await stopActiveStudy({
      save: pomodoroModeRef.current === "study",
      duration: pomodoroSettings.study * 60,
      type: "Pomodoro",
      startedAt: pomodoroSessionStartedAtRef.current
        ? new Date(pomodoroSessionStartedAtRef.current).toISOString()
        : null,
    });
    playNotificationSound();

    if (pomodoroModeRef.current === "study") {
      const newCount = completedPomodorosRef.current + 1;
      completedPomodorosRef.current = newCount;
      setCompletedPomodoros(newCount);
      if (stopResult?.ok) {
        await refreshFromServer();
      }
      pomodoroSessionStartedAtRef.current = null;

      if (
        newCount % pomodoroSettings.sessionsBeforeLongBreak === 0
      ) {
        setPomodoroMode("longBreak");
        setPomodoroSeconds(pomodoroSettings.longBreak * 60);
      } else {
        setPomodoroMode("shortBreak");
        setPomodoroSeconds(pomodoroSettings.shortBreak * 60);
      }
    } else {
      setPomodoroMode("study");
      setPomodoroSeconds(pomodoroSettings.study * 60);
    }
  }, [
    pomodoroSettings.longBreak,
    pomodoroSettings.sessionsBeforeLongBreak,
    pomodoroSettings.shortBreak,
    pomodoroSettings.study,
    refreshFromServer,
    stopActiveStudy,
  ]);

  const completePomodoroRef = useRef(completePomodoro);
  completePomodoroRef.current = completePomodoro;

  const skipPomodoro = useCallback(() => {
    setPomodoroRunning(false);
    pomodoroEndAtRef.current = null;

    if (pomodoroModeRef.current === "study") {
      stopActiveStudy();
      pomodoroSessionStartedAtRef.current = null;
      setPomodoroMode("shortBreak");
      setPomodoroSeconds(pomodoroSettings.shortBreak * 60);
    } else {
      setPomodoroMode("study");
      setPomodoroSeconds(pomodoroSettings.study * 60);
    }
  }, [pomodoroSettings.shortBreak, pomodoroSettings.study, stopActiveStudy]);

  // Auto-save a session only after it has remained paused for five minutes.
  // Resuming clears the pause timestamp and cancels the pending timeout.
  useEffect(() => {
    if (
      timerMode !== "simple" ||
      simpleRunning ||
      !simplePausedAt ||
      !simpleSessionStartedAtRef.current
    ) return undefined;

    const pauseStartedAt = simplePausedAt;
    const sessionStartedAt = simpleSessionStartedAtRef.current;
    const delay = Math.max(0, 5 * 60 * 1000 - (Date.now() - pauseStartedAt));
    const timeout = window.setTimeout(() => {
      if (
        simpleRunningRef.current ||
        simplePausedAtRef.current !== pauseStartedAt ||
        simpleSessionStartedAtRef.current !== sessionStartedAt ||
        autoSaveInFlightRef.current
      ) return;

      const savePromise = stopSimpleTimer();
      autoSaveInFlightRef.current = savePromise;
      void savePromise.then(
        () => { if (autoSaveInFlightRef.current === savePromise) autoSaveInFlightRef.current = null; },
        () => { if (autoSaveInFlightRef.current === savePromise) autoSaveInFlightRef.current = null; }
      );
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [simplePausedAt, simpleRunning, stopSimpleTimer, timerMode]);

  useEffect(() => {
    if (
      timerMode !== "pomodoro" ||
      pomodoroRunning ||
      !pomodoroPausedAt
    ) return undefined;

    const pauseStartedAt = pomodoroPausedAt;
    const delay = Math.max(0, 5 * 60 * 1000 - (Date.now() - pauseStartedAt));
    const timeout = window.setTimeout(() => {
      if (
        pomodoroRunningRef.current ||
        pomodoroPausedAtRef.current !== pauseStartedAt ||
        autoSaveInFlightRef.current
      ) return;

      const pausedMode = pomodoroModeRef.current;
      const remaining = pomodoroSecondsRef.current;
      const sessionStartedAt = pomodoroSessionStartedAtRef.current;
      const studiedSeconds = pausedMode === "study"
        ? Math.max(0, pomodoroSettings.study * 60 - remaining)
        : 0;

      setPomodoroPausedAt(null);
      setPomodoroRunning(false);
      pomodoroEndAtRef.current = null;
      pomodoroSessionStartedAtRef.current = null;
      setTimerNotificationActive(false);
      void closeTimerNotification(timerOwnerIdRef.current);
      setPomodoroMode("study");
      setPomodoroSeconds(pomodoroSettings.study * 60);

      const savePromise = Promise.resolve().then(async () => {
        if (pausedMode === "study" && studiedSeconds > 0) {
          const result = await stopActiveStudy({
            save: true,
            duration: studiedSeconds,
            type: "Pomodoro",
            startedAt: sessionStartedAt
              ? new Date(sessionStartedAt).toISOString()
              : null,
          });
          if (result?.ok) await refreshFromServer();
        }
      });
      autoSaveInFlightRef.current = savePromise;
      void savePromise.then(
        () => { if (autoSaveInFlightRef.current === savePromise) autoSaveInFlightRef.current = null; },
        () => { if (autoSaveInFlightRef.current === savePromise) autoSaveInFlightRef.current = null; }
      );
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [
    pomodoroPausedAt,
    pomodoroRunning,
    pomodoroSettings.study,
    refreshFromServer,
    stopActiveStudy,
    timerMode,
  ]);

  const handleSubjectChange = useCallback((subject) => {
    setSelectedSubject(subject);
    setSelectedTopic("");
  }, []);

  const changeTimerMode = useCallback(
    (mode) => {
      if (mode === timerModeRef.current) {
        return;
      }

      if (simpleRunningRef.current) {
        pauseSimpleTimer();
      }

      if (pomodoroRunningRef.current) {
        pausePomodoro();
      }

      setTimerMode(mode);
    },
    [pausePomodoro, pauseSimpleTimer]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;
    let channel = null;
    try {
      channel = "BroadcastChannel" in window ? new BroadcastChannel("gate-timer-ownership") : null;
      timerChannelRef.current = channel;
      channel?.addEventListener("message", async (event) => {
        if (event.data?.type !== "TIMER_TAKEN_OVER") return;
        setSimpleRunning(false);
        setPomodoroRunning(false);
        simpleStartedAtRef.current = null;
        pomodoroEndAtRef.current = null;
        await refreshFromServer();
      });
    } catch {}
    return () => {
      try { channel?.close(); } catch {}
      timerChannelRef.current = null;
    };
  }, [refreshFromServer, userId]);

  const takeOverTimer = useCallback(async (studiedSeconds) => {
    if (!timerConflict) return { ok: false };
    const mode = timerConflict.mode;
    const seconds = Math.max(0, Math.round(Number(studiedSeconds) || 0));
    const result = await activeStudyRequest("/sessions/active/takeover", {
      ownerId: timerOwnerIdRef.current,
      ownerLabel: timerOwnerLabelRef.current,
      clientId: crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      studiedSeconds: seconds,
      subject: selectedSubjectRef.current || "No subject",
      topic: selectedTopicRef.current || "No topic",
      type: mode === "pomodoro" ? "Pomodoro" : "Regular Timer",
    });
    if (!result.ok) return result;

    setTimerConflict(null);
    try { timerChannelRef.current?.postMessage({ type: "TIMER_TAKEN_OVER" }); } catch {}
    await refreshFromServer();

    if (mode === "simple") {
      simpleBaseRef.current = 0;
      simpleStartedAtRef.current = Date.now();
      simpleSessionStartedAtRef.current = simpleStartedAtRef.current;
      setTimerMode("simple");
      setSimpleSeconds(0);
      setSimpleRunning(true);
    } else {
      pomodoroEndAtRef.current = Date.now() + pomodoroSeconds * 1000;
      pomodoroSessionStartedAtRef.current = Date.now();
      setTimerMode("pomodoro");
      setPomodoroRunning(true);
    }
    return result;
  }, [activeStudyRequest, pomodoroSeconds, refreshFromServer, timerConflict]);

  const dismissTimerConflict = useCallback(() => setTimerConflict(null), []);

  /*
  ====================================================
  TICKING
  ====================================================
  */

  useEffect(() => {
    if (!simpleRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      setSimpleSeconds(getSimpleElapsedSeconds());
    }, 250);

    return () => window.clearInterval(interval);
  }, [getSimpleElapsedSeconds, simpleRunning]);

  useEffect(() => {
    if (!pomodoroRunning) {
      return;
    }

    const interval = window.setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil(
          ((pomodoroEndAtRef.current || Date.now()) - Date.now()) /
            1000
        )
      );

      setPomodoroSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(interval);
        completePomodoroRef.current();
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [pomodoroRunning]);

  // Keep one persistent notification visible while a timer is running or
  // paused. The timer itself is calculated from timestamps, so its display
  // remains accurate across background timer throttling whenever the browser
  // allows these notification refreshes to run.
  useEffect(() => {
    if (!timerNotificationActive || !timerNotificationsAllowed) {
      return undefined;
    }

    const publish = () => {
      if (!timerNotificationActiveRef.current) return;

      const isPomodoro = timerModeRef.current === "pomodoro";
      const running = isPomodoro
        ? pomodoroRunningRef.current
        : simpleRunningRef.current;
      const isPomodoroBreak = isPomodoro && pomodoroModeRef.current !== "study";
      const totalSeconds = isPomodoroBreak
        ? running && pomodoroEndAtRef.current
          ? Math.max(0, Math.ceil((pomodoroEndAtRef.current - Date.now()) / 1000))
          : pomodoroSecondsRef.current
        : isPomodoro
          ? getPomodoroElapsedSeconds()
          : running
            ? getSimpleElapsedSeconds()
            : simpleBaseRef.current;
      const subject = getNotificationLabel(selectedSubjectRef.current);
      const topic = getNotificationLabel(selectedTopicRef.current);
      const studyLabel = truncateNotificationLabel(
        [subject, topic].filter(Boolean).join(" · ")
      );
      const status = !running
        ? "Paused"
        : isPomodoro && pomodoroModeRef.current !== "study"
          ? "On break"
          : "Studying";
      const state = running ? "running" : "paused";
      const sessionStartedAt = isPomodoro
        ? pomodoroSessionStartedAtRef.current
        : simpleSessionStartedAtRef.current;

      void showTimerNotification({
        title: "GATE CSE Study Timer",
        body: `${status}${studyLabel ? ` · ${studyLabel}` : ""}\n${isPomodoroBreak ? "Remaining" : "Elapsed"} ${formatNotificationTime(totalSeconds)}`,
        state,
        ownerId: timerOwnerIdRef.current,
        timestamp: sessionStartedAt,
      });
    };

    publish();
    const isRunning = timerMode === "pomodoro" ? pomodoroRunning : simpleRunning;
    if (!isRunning) return undefined;

    const interval = window.setInterval(publish, 15000);
    return () => window.clearInterval(interval);
  }, [
    getSimpleElapsedSeconds,
    getPomodoroElapsedSeconds,
    pomodoroMode,
    pomodoroRunning,
    simpleRunning,
    selectedSubject,
    selectedTopic,
    timerMode,
    timerNotificationsAllowed,
    timerNotificationActive,
    notificationActionSequence,
  ]);

  useEffect(() => {
    const navigateToTimer = () => {
      if (window.location.pathname === "/timer") return;
      window.history.pushState({}, "", "/timer");
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    const applyNotificationAction = (action, ownerId) => {
      if (ownerId && ownerId !== timerOwnerIdRef.current) return;
      setNotificationActionSequence((sequence) => sequence + 1);
      navigateToTimer();

      if (action === "pause") {
        if (timerModeRef.current === "simple") pauseSimpleTimer();
        else pausePomodoro();
      } else if (action === "resume") {
        if (timerModeRef.current === "simple") void startSimpleTimer();
        else void startPomodoro();
      }
    };

    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type !== "GATE_TIMER_NOTIFICATION_ACTION") return;
      applyNotificationAction(event.data.action, event.data.ownerId);
    };

    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    const pendingLaunch = notificationLaunchActionRef.current;
    if (pendingLaunch && !restoring) {
      notificationLaunchActionRef.current = null;
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, "", cleanUrl);
      applyNotificationAction(pendingLaunch.action, pendingLaunch.ownerId);
    }

    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [
    pausePomodoro,
    pauseSimpleTimer,
    restoring,
    startPomodoro,
    startSimpleTimer,
    setNotificationActionSequence,
  ]);

  useEffect(() => {
    if (!simpleRunning && !pomodoroRunning) {
      return;
    }

    heartbeatActiveStudy();

    const heartbeatInterval = window.setInterval(() => {
      heartbeatActiveStudy();
    }, 8000);

    return () => window.clearInterval(heartbeatInterval);
  }, [heartbeatActiveStudy, pomodoroRunning, simpleRunning]);

  /*
  ====================================================
  PERSIST TO LOCAL STORAGE
  ====================================================

  Runs on every relevant state change (several times a
  second while a timer is running), so a hard refresh
  always has a fresh snapshot to hydrate from above.
  ====================================================
  */

  useEffect(() => {
    if (!userId) {
      return;
    }

    persistTimer({
      userId,
      ownerId: timerOwnerIdRef.current,
      timerMode,
      selectedSubject,
      selectedTopic,
      simpleSeconds,
      simpleRunning,
      pomodoroMode,
      pomodoroSeconds,
      pomodoroRunning,
      completedPomodoros,
      simpleBase: simpleBaseRef.current,
      simpleStartedAt: simpleStartedAtRef.current,
      simpleSessionStartedAt: simpleSessionStartedAtRef.current,
      simplePausedAt,
      pomodoroEndAt: pomodoroEndAtRef.current,
      pomodoroSessionStartedAt: pomodoroSessionStartedAtRef.current,
      pomodoroPausedAt,
    });
  }, [
    completedPomodoros,
    pomodoroMode,
    pomodoroRunning,
    pomodoroSeconds,
    selectedSubject,
    selectedTopic,
    simpleRunning,
    simplePausedAt,
    simpleSeconds,
    timerMode,
    userId,
    pomodoroPausedAt,
  ]);

  /*
  ====================================================
  RUN A PENDING POMODORO COMPLETION
  ====================================================

  If the pomodoro countdown fully elapsed while the
  tab was closed/refreshed, run the normal completion
  flow (sound, save session, advance to break) once,
  right after mount.
  ====================================================
  */

  useEffect(() => {
    if (init.pomodoro.completedImmediately) {
      completePomodoroRef.current();
    }
    // Intentionally only runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
  ====================================================
  KEEP THE DEFAULT POMODORO DURATION IN SYNC
  ====================================================

  Pomodoro settings can finish loading from local
  storage/IndexedDB slightly after this provider
  mounts. If the user doesn't have an in-progress or
  paused pomodoro saved (init.saved.pomodoroSeconds),
  keep the idle countdown matched to whatever the
  settings turn out to be, instead of freezing on
  whatever the default was at first render.
  ====================================================
  */

  useEffect(() => {
    if (pomodoroRunningRef.current) {
      return;
    }

    if (pomodoroModeRef.current !== "study") {
      return;
    }

    if (init.saved?.pomodoroSeconds != null) {
      return;
    }

    setPomodoroSeconds(pomodoroSettings.study * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pomodoroSettings.study]);

  /*
  ====================================================
  RECONCILE WITH THE SERVER (BACKGROUND)
  ====================================================

  The state above is already correct the instant the
  app mounts, computed from local storage. This effect
  only reconciles with the server afterwards - it never
  blocks or resets the UI, and any failure here just
  means we keep counting locally and retry via the
  heartbeat loop.
  ====================================================
  */

  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setRestoring(false);
      return;
    }

    if (restoredRef.current) {
      return;
    }

    restoredRef.current = true;

    async function reconcileWithServer() {
      try {
        const result = await activeStudyRequest(
          "/sessions/active",
          {},
          "GET"
        );

        if (!result.ok) {
          // Server unreachable right now (cold start,
          // briefly offline, etc). Trust what we already
          // restored locally and try to register it with
          // the server in the background.
          if (simpleRunningRef.current && !simpleStartInFlightRef.current) {
            const retry = await startActiveSimpleStudy();
            if (!retry.ok) setSimpleRunning(false);
          } else if (
            pomodoroRunningRef.current &&
            pomodoroModeRef.current === "study"
          ) {
            const retry = await startActivePomodoroStudy();
            if (!retry.ok) setPomodoroRunning(false);
          }

          return;
        }

        // A manual Start click may have registered locally while this
        // initial GET was in flight. Let that registration finish rather
        // than overwriting/stopping the freshly started timer.
        if (simpleStartInFlightRef.current) {
          return;
        }

        const activeStudy = result.data?.activeStudy;

        if (activeStudy && activeStudy.ownerId && activeStudy.ownerId !== timerOwnerIdRef.current) {
          const elapsed = Number(activeStudy.elapsedSeconds ?? activeStudy.accumulatedSeconds ?? 0) || 0;
          setTimerConflict({
            mode: activeStudy.type === "Pomodoro" ? "pomodoro" : "simple",
            activeStudy: { ...activeStudy, elapsedSeconds: elapsed },
          });
          setSimpleRunning(false);
          setPomodoroRunning(false);
          simpleStartedAtRef.current = null;
          pomodoroEndAtRef.current = null;
          setRestoring(false);
          return;
        }

        if (activeStudy) {
          const elapsed =
            Number(
              activeStudy.elapsedSeconds ??
                activeStudy.accumulatedSeconds ??
                0
            ) || 0;

          setSelectedSubject(
            activeStudy.subject === "No subject"
              ? ""
              : activeStudy.subject || ""
          );
          setSelectedTopic(
            activeStudy.topic === "No topic"
              ? ""
              : activeStudy.topic || ""
          );

          if (activeStudy.type === "Pomodoro") {
            setTimerMode("pomodoro");
            setPomodoroMode("study");

            const remaining = Math.max(
              0,
              pomodoroSettings.study * 60 - elapsed
            );

            setPomodoroSeconds(remaining);

            if (activeStudy.isRunning && remaining > 0) {
              pomodoroEndAtRef.current =
                Date.now() + remaining * 1000;
              setPomodoroRunning(true);
            } else {
              pomodoroEndAtRef.current = null;
              setPomodoroRunning(false);

              if (remaining <= 0) {
                completePomodoroRef.current();
              }
            }
          } else {
            setTimerMode("simple");
            simpleBaseRef.current = elapsed;
            setSimpleSeconds(elapsed);

            if (activeStudy.isRunning) {
              simpleStartedAtRef.current = Date.now();
              setSimpleRunning(true);
            } else {
              simpleStartedAtRef.current = null;
              setSimpleRunning(false);
            }
          }

          return;
        }

        // The server has no active session. If we
        // restored a running timer purely from local
        // storage, recreate it server-side now so it
        // isn't lost on the next refresh.
        if (simpleRunningRef.current && !simpleStartInFlightRef.current) {
          const retry = await startActiveSimpleStudy();
          if (!retry.ok) setSimpleRunning(false);
        } else if (
          pomodoroRunningRef.current &&
          pomodoroModeRef.current === "study"
        ) {
          const retry = await startActivePomodoroStudy();
          if (!retry.ok) setPomodoroRunning(false);
        }
      } finally {
        setRestoring(false);
      }
    }

    reconcileWithServer();
  }, [
    activeStudyRequest,
    isAuthenticated,
    pomodoroSettings.study,
    startActivePomodoroStudy,
    startActiveSimpleStudy,
    userId,
  ]);

  useEffect(() => {
    if (userId) {
      return;
    }

    restoredRef.current = false;
    setTimerNotificationActive(false);
    void closeTimerNotification(timerOwnerIdRef.current);
    setSimpleRunning(false);
    setSimplePausedAt(null);
    setPomodoroRunning(false);
    setPomodoroPausedAt(null);
    simpleStartedAtRef.current = null;
    simpleSessionStartedAtRef.current = null;
    pomodoroEndAtRef.current = null;
    pomodoroSessionStartedAtRef.current = null;
    simpleBaseRef.current = 0;
    setSimpleSeconds(0);
    setPomodoroMode("study");
    setPomodoroSeconds(pomodoroSettings.study * 60);
    setCompletedPomodoros(0);
  }, [pomodoroSettings.study, userId]);

  const displaySeconds =
    timerMode === "simple" ? simpleSeconds : pomodoroSeconds;

  const isRunning = simpleRunning || pomodoroRunning;

  const value = useMemo(
    () => ({
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
      displaySeconds,
    }),
    [
      changeTimerMode,
      completedPomodoros,
      displaySeconds,
      dismissTimerConflict,
      handleSubjectChange,
      isRunning,
      pausePomodoro,
      pauseSimpleTimer,
      pomodoroMode,
      pomodoroRunning,
      pomodoroSeconds,
      resetPomodoro,
      resetSimpleTimer,
      restoring,
      takeOverTimer,
      timerConflict,
      selectedSubject,
      selectedTopic,
      simpleRunning,
      simpleSeconds,
      skipPomodoro,
      startPomodoro,
      startSimpleTimer,
      stopSimpleTimer,
      timerMode,
    ]
  );

  return (
    <TimerContext.Provider value={value}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const context = useContext(TimerContext);

  if (!context) {
    throw new Error("useTimer must be used inside TimerProvider");
  }

  return context;
}
