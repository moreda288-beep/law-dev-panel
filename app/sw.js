// نسخة الموبايل/المتصفح تفتح من غير نت:
// أول مرة بالنت بنحفظ ملفات البرنامج (الشاشات والتصميم) على الجهاز، وبعد كده لو مفيش نت بنفتح النسخة المحفوظة.
// بيانات المكتب نفسها متخزنة لوحدها على الجهاز (IndexedDB) — الملف ده للبرنامج بس، وعمره ما بيخزّن طلبات السيرفر.
const CACHE = 'law-app-v1';

// قايمة ملفات النسخة الحالية (بتتكتب وقت البناء في precache.json)
async function precache() {
  const r = await fetch('precache.json', { cache: 'no-store' });
  if (!r.ok) return;
  const files = await r.json();
  const c = await caches.open(CACHE);
  const have = new Set((await c.keys()).map((q) => new URL(q.url).pathname));
  const base = new URL('./', self.registration.scope).pathname;
  const want = ['./', ...files];
  for (const f of want) {
    const u = new URL(f, self.registration.scope);
    if (f !== './' && have.has(u.pathname)) continue;
    try { const res = await fetch(u, { cache: 'no-store' }); if (res.ok) await c.put(f === './' ? new URL(base, self.location.origin) : u, res); } catch { /* هيتحفظ المرة الجاية */ }
  }
  // نشيل ملفات النسخ القديمة
  const keep = new Set(want.map((f) => new URL(f, self.registration.scope).pathname));
  for (const q of await c.keys()) { if (!keep.has(new URL(q.url).pathname)) await c.delete(q); }
}

self.addEventListener('install', (e) => { e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('message', (e) => { if (e.data === 'refresh-cache') e.waitUntil(precache().catch(() => {})); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // السيرفر والمواقع التانية: زي ما هي
  if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/precache.json')) return;

  // الصفحة نفسها: من النت الأول (عشان التحديثات توصل على طول)، ولو مفيش نت أو بطيء أوي: المحفوظة
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const base = new URL('./', self.registration.scope);
      try {
        const net = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
        if (net.ok) { c.put(base, net.clone()); return net; }
        return (await c.match(base)) || net;
      } catch {
        return (await c.match(base)) || new Response('<h1 dir="rtl" style="font-family:sans-serif;text-align:center;margin-top:30vh">مفيش نت — افتح البرنامج مرة بالنت الأول</h1>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // باقي الملفات (أسماءها بتتغير مع كل نسخة): من المحفوظ الأول، ولو مش موجود من النت ونحفظه
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const net = await fetch(req);
    if (net.ok && net.type === 'basic') c.put(req, net.clone());
    return net;
  })());
});
