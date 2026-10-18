// 動くQR：一度開いたら、ページと部品を端末に保存してオフラインでも開けるようにする
const VERSION = "ugoku-qr-v11";
const CORE = [
  "./index.html", "./manifest.webmanifest",
  "./lib/qrcode.js", "./lib/jsQR.js", "./lib/lame.min.js",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"
];
const FONTS = "ugoku-qr-fonts";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 文字の形（Google Fonts）：使ったぶんだけ保存しておく
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // ページを開くとき：ネットがあれば最新を取る。3秒待っても来なければ（または圏外なら）保存したものを出す
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      const net = fetch(req).then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); }
        return r;
      });
      if (!cached) return net;
      return Promise.race([
        net.catch(() => cached),
        new Promise(ok => setTimeout(() => ok(cached), 3000))
      ]);
    })());
    return;
  }

  // 部品・アイコン：保存したものを優先
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }))
  );
});
