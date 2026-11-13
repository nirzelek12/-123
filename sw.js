/* Service Worker להתראות הבלאנקוס — לשים באותה תיקייה של index.html ב-GitHub */
var DEFAULT_ICON = "https://media.base44.com/images/public/6a91620bb63bd7c1b5a2d9e8/0a36110dd_717f280bed475230e0023ddf508c79d1_tplv-tiktokx-cropcenter_1080_1080-removebg-preview.png";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

/* מקבל Push מהשרת גם כשהאתר סגור ומציג התראה. חובה להציג התראה בכל push, אחרת הדפדפן מציג התראה גנרית. */
self.addEventListener("push", function (event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { try { data = { body: event.data.text() }; } catch (x) { data = {}; } }
  var title = data.title || "הבלאנקוס ⚽";
  var options = {
    body: data.body || "",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_ICON,
    tag: data.tag || "blancos",
    renotify: true,
    dir: "rtl",
    lang: "he",
    vibrate: [180, 90, 180],
    data: { url: data.url || self.registration.scope }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
