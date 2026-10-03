/* Runs inside the generated Workbox service worker. */
self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const { url = "/timer", ownerId = null } = notification.data || {};
  const action = event.action;
  notification.close();

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    const existingClients = clients.filter((client) => "focus" in client);
    if (existingClients.length) {
      existingClients.forEach((client) => client.postMessage({
        type: "GATE_TIMER_NOTIFICATION_ACTION",
        action,
        ownerId,
      }));
      const targetClient = existingClients.find((client) => client.visibilityState === "visible") || existingClients[0];
      await targetClient.focus();
      return;
    }

    const target = new URL(url, self.location.origin);
    if (action === "pause" || action === "resume") {
      target.searchParams.set("timerAction", action);
      if (ownerId) target.searchParams.set("timerOwner", ownerId);
    }
    await self.clients.openWindow(target.href);
  })());
});
