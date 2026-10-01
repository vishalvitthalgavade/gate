function getTimerNotificationTag(ownerId) {
  return `gate-study-timer-${ownerId || "default"}`;
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

export async function showTimerNotification({ title, body, state, ownerId }) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }

  const registration = await getServiceWorkerRegistration();
  const tag = getTimerNotificationTag(ownerId);
  const options = {
    body,
    tag,
    icon: "/gate-192.png",
    badge: "/gate-192.png",
    renotify: false,
    requireInteraction: true,
    silent: true,
    timestamp: Date.now(),
    data: { url: "/timer", state },
  };

  try {
    if (registration?.showNotification) {
      const existing = registration.getNotifications
        ? await registration.getNotifications({ tag })
        : [];
      existing.forEach((notification) => notification.close());
      await registration.showNotification(title, options);
      return;
    }

    // Some desktop browsers expose notifications without a service worker.
    if (typeof window !== "undefined" && !/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.__gateTimerNotifications ||= {};
      const previous = window.__gateTimerNotifications[ownerId || "default"];
      previous?.close();
      window.__gateTimerNotifications[ownerId || "default"] = new Notification(title, options);
    }
  } catch {
    // Notification support varies by browser and installed-app mode.
  }
}

export async function closeTimerNotification(ownerId) {
  const registration = await getServiceWorkerRegistration();
  const tag = getTimerNotificationTag(ownerId);
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
