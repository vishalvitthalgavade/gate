function getTimerNotificationTag(ownerId) {
  return `gate-study-timer-${ownerId || "default"}`;
}

const notificationVersions = new Map();

function nextNotificationVersion(tag) {
  const next = (notificationVersions.get(tag) || 0) + 1;
  notificationVersions.set(tag, next);
  return next;
}

export async function requestTimerNotificationPermission() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "default") return false;

  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

async function getServiceWorkerRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function showTimerNotification({
  title,
  body,
  state,
  ownerId,
  timestamp,
}) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const registration = await getServiceWorkerRegistration();
  const tag = getTimerNotificationTag(ownerId);
  const version = nextNotificationVersion(tag);
  const options = {
    body,
    tag,
    icon: "/gate-192.png",
    badge: "/gate-192.png",
    actions: [
      state === "running"
        ? { action: "pause", title: "Pause" }
        : { action: "resume", title: "Resume" },
    ],
    renotify: false,
    requireInteraction: true,
    silent: true,
    timestamp: Number(timestamp) || Date.now(),
    data: { url: "/timer", state, ownerId },
  };

  try {
    if (registration?.showNotification) {
      // Reuse a stable tag so pause/resume and timer refreshes replace the
      // existing card instead of producing another notification.
      if (notificationVersions.get(tag) !== version) return;
      try {
        await registration.showNotification(title, options);
      } catch {
        // Keep the notification usable on platforms that do not expose
        // notification action buttons.
        const basicOptions = { ...options };
        delete basicOptions.actions;
        await registration.showNotification(title, basicOptions);
      }
      return;
    }

    // Some desktop browsers expose notifications without a service worker.
    if (typeof window !== "undefined" && !/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      if (notificationVersions.get(tag) !== version) return;
      window.__gateTimerNotifications ||= {};
      const previous = window.__gateTimerNotifications[ownerId || "default"];
      previous?.close();
      const windowOptions = { ...options };
      delete windowOptions.actions;
      window.__gateTimerNotifications[ownerId || "default"] = new Notification(title, windowOptions);
    }
  } catch {
    // Notification support varies by browser and installed-app mode.
  }
}

export async function closeTimerNotification(ownerId) {
  const tag = getTimerNotificationTag(ownerId);
  nextNotificationVersion(tag);
  const registration = await getServiceWorkerRegistration();
  try {
    const notifications = registration?.getNotifications
      ? await registration.getNotifications({ tag })
      : [];
    notifications?.forEach((notification) => notification.close());
    if (typeof window !== "undefined") {
      const key = ownerId || "default";
      window.__gateTimerNotifications?.[key]?.close();
      if (window.__gateTimerNotifications) {
        delete window.__gateTimerNotifications[key];
      }
    }
  } catch {
    // Closing a notification is best-effort on unsupported browsers.
  }
}
