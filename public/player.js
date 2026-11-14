(() => {
  "use strict";
  const stage = document.getElementById("stage");
  const params = new URLSearchParams(location.search);
  const [loc, , screenId = "default"] = location.pathname.split("/").filter(Boolean);
  const screen = params.get("screen") || screenId;
  const freezeId = params.get("slide"); // ?slide=<id> shows one slide, no rotation (previews)
  const bootedAt = Date.now();

  const esc = (s = "") => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- scale the 1920x1080 stage to the display ----------
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `scale(${s})`;
    stage.style.left = (innerWidth - 1920 * s) / 2 + "px";
    stage.style.top = (innerHeight - 1080 * s) / 2 + "px";
  }
  addEventListener("resize", fit); fit();

  // ---------- slide renderers ----------
  const FULL = `/img/${loc}-logo.png`;       // full logo with "seriously stuffed sopapillas"
  const MARK = `/img/${loc}-wordmark.png`;   // plain SOPA! wordmark (menu page headers)
  const footer = (cfg) => `<div class="foot"><b>${esc(cfg.footer?.line || "")}</b><small>${esc(cfg.footer?.legal || "")}</small></div>`;

  const item = (it) => `
    <div class="item">
      <div class="row"><span class="name">${esc(it.name)}</span>${it.badge ? `<span class="badge">${esc(it.badge)}</span>` : ""}${it.price ? `<span class="price">${esc(it.price)}</span>` : ""}</div>
      ${it.desc ? `<p class="desc">${esc(it.desc)}</p>` : ""}
    </div>`;

  const WAVE = `<svg viewBox="0 0 674 84" preserveAspectRatio="none"><path d="M6 58 C 90 8, 180 6, 270 38 S 450 74, 540 36 S 640 14, 668 26" fill="none" stroke="#5bb8dd" stroke-width="15" stroke-linecap="round"/></svg>`;

  const R = {
    // full logo centred on the patterned background
    logo: (s, cfg) => `
      <section class="slide pattern logoslide"><img src="${FULL}" alt=""></section>`,

    // menu page: wordmark + one or two blocks of items
    list: (s, cfg) => {
      const single = s.blocks.length === 1;
      const head = single
        ? `<div class="t"><h1>${esc(s.blocks[0].heading)}</h1>${s.blocks[0].note ? `<div class="note">${esc(s.blocks[0].note)}</div>` : ""}</div>`
        : `<div class="t"></div><div class="tag">${s.tagline || ""}</div>`;
      const body = s.blocks.map(b => `
        <div class="block">
          ${single ? "" : `<h2>${esc(b.heading)}</h2>${b.note ? `<div class="note">${esc(b.note)}</div>` : ""}`}
          ${b.items.map(item).join("")}
        </div>`).join("");
      return `
      <section class="slide list">
        <div class="head"><img src="${MARK}" alt="">${head}</div>
        <div class="body ${single ? "cols1" : "cols2"}">${body}</div>
        ${footer(cfg)}
      </section>`;
    },

    // full-bleed food photo with a name label bottom-right
    photo: (s, cfg) => `
      <section class="slide photo" style="background-image:url('${esc(s.image)}')">
        ${s.label ? `<div class="label">${esc(s.label)}</div>` : ""}
      </section>`,

    // "thanks for visiting" + rewards pitch
    rewards: (s, cfg) => `
      <section class="slide pattern rewards">
        <div class="t1">${esc(s.title || "thanks for visiting")}</div>
        <img class="mark" src="${MARK}" alt="">
        <div class="row">
          <div class="copy">${s.copy || ""}</div>
          <div class="partner">${s.partnerLogo
            ? `<img src="${esc(s.partnerLogo)}" alt="">`
            : `${WAVE}<div class="n1">PRIMERA AGUA</div><div class="n2">REWARDS</div>`}</div>
        </div>
      </section>`,
  };

  // ---------- scheduling: start/end dates, weekdays, time-of-day windows ----------
  function localNow(tz) {
    const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
    const p = Object.fromEntries(f.formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour === "24" ? "00" : p.hour}:${p.minute}`, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
  }
  function active(s, tz) {
    const n = localNow(tz);
    if (s.start && n.date < s.start) return false;
    if (s.end && n.date > s.end) return false;
    if (s.days && !s.days.includes(n.dow)) return false;
    if (s.hours && (n.hm < s.hours[0] || n.hm >= s.hours[1])) return false;
    return true;
  }

  // ---------- main loop ----------
  let cfg = null, cfgText = "", els = new Map(), timer = null, okPhotos = new Set();

  // A photo slide only joins the loop if its image actually loads.
  async function checkPhotos() {
    okPhotos = new Set();
    await Promise.all(Object.entries(cfg.slides).filter(([, s]) => s.type === "photo" && s.image).map(([id, s]) =>
      new Promise(res => { const i = new Image(); i.onload = () => { okPhotos.add(id); res(); }; i.onerror = res; i.src = s.image; })));
  }

  async function loadPlaylist() {
    const res = await fetch(`/${loc}/playlist.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error("playlist " + res.status);
    const text = await res.text();
    return { text, json: JSON.parse(text) };
  }

  function build() {
    stage.innerHTML = "";
    els = new Map();
    const ids = cfg.screens[screen] || cfg.screens.default || Object.keys(cfg.slides);
    for (const id of ids) {
      const s = cfg.slides[id];
      if (!s || !R[s.type]) continue;
      if (s.type === "photo" && !okPhotos.has(id)) continue; // photo missing or not uploaded yet: leave it out of the loop
      const tmp = document.createElement("div");
      tmp.innerHTML = R[s.type](s, cfg).trim();
      const el = tmp.firstElementChild;
      stage.appendChild(el);
      els.set(id, el);
    }
    return ids.filter(id => els.has(id));
  }

  function run() {
    clearTimeout(timer);
    const ids = build();
    if (freezeId && els.has(freezeId)) { els.get(freezeId).classList.add("on"); return; }
    let i = -1, current = null;
    const next = () => {
      const tz = cfg.timezone || "America/Denver";
      let pick = null;
      for (let k = 1; k <= ids.length; k++) {
        const id = ids[(i + k) % ids.length];
        if (active(cfg.slides[id], tz)) { pick = id; i = (i + k) % ids.length; break; }
      }
      if (!pick) { timer = setTimeout(next, 30000); return; } // nothing scheduled right now: stay on last slide
      if (current) current.classList.remove("on");
      current = els.get(pick);
      current.classList.add("on");
      timer = setTimeout(next, (cfg.slides[pick].duration || cfg.defaultDuration || 12) * 1000);
    };
    next();
  }

  async function boot() {
    try {
      const { text, json } = await loadPlaylist();
      cfg = json; cfgText = text;
      try { localStorage.setItem(`playlist:${loc}`, text); } catch {}
    } catch (e) {
      // Offline and the service worker has nothing: fall back to the last playlist we saw.
      try { cfg = JSON.parse(localStorage.getItem(`playlist:${loc}`)); cfgText = JSON.stringify(cfg); } catch {}
      if (!cfg) { stage.textContent = ""; setTimeout(boot, 15000); return; }
    }
    await checkPhotos();
    run();
  }

  // Pick up playlist edits within 5 minutes; fresh reload once the page has been up ~20h.
  setInterval(async () => {
    if (Date.now() - bootedAt > 20 * 3600e3) return location.reload();
    try {
      const { text } = await loadPlaylist();
      if (text !== cfgText) location.reload();
    } catch {}
  }, 5 * 60e3);

  if ("serviceWorker" in navigator && !freezeId) navigator.serviceWorker.register("/sw.js").catch(() => {});
  (document.fonts?.ready || Promise.resolve()).then(boot);
})();
