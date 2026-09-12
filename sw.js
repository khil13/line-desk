/* Line Desk service worker.
   The shell is cached so the app opens instantly and works with no signal.
   ESPN data is always tried from the network first — a stale score shown as
   though it were live would be worse than no score at all. */

const SHELL = "linedesk-shell-v1";
const DATA = "linedesk-data-v1";

const SHELL_URLS = [
  "./",
  "./index.html",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@400;500;600;700&display=swap",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) =>
      // addAll fails the whole install if any single URL 404s, so add
      // them individually and tolerate misses.
      Promise.all(SHELL_URLS.map((u) =>
        c.add(new Request(u, { mode: u.startsWith("http") ? "cors" : "same-origin" }))
          .catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the Anthropic API — responses are one-off and paid for.
  if (url.hostname.endsWith("api.anthropic.com")) return;

  // Navigations: serve the shell immediately, refresh it in the background.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // ESPN: network first, fall back to the last good copy when offline.
  if (url.hostname.endsWith("espn.com")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(DATA).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || Promise.reject(new Error("offline"))))
    );
    return;
  }

  // Everything else — scripts, fonts — is versioned, so cache first.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res && (res.status === 200 || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
