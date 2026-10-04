/* ==========================================================================
   CarbonWise - utilities, formatters and the icon set
   Classic script (no modules) so the app also runs straight off file://
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW || (window.CW = {});

  /* ----------------------------- DOM ----------------------------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (k === "dataset") Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? "" : v);
      });
    }
    (Array.isArray(children) ? children : children == null ? [] : [children]).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* Event delegation scoped to a root element. */
  function delegate(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, e, t);
    });
  }

  /* Escapes untrusted text before it reaches an innerHTML template.
     Series/room names originate from user input, so they always go
     through here (or textContent) - never raw into a template. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ----------------------------- numbers ----------------------------- */
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function round(n, dp) { var f = Math.pow(10, dp || 0); return Math.round(n * f) / f; }

  function fmt(n, dp) {
    if (n == null || isNaN(n)) return "0";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: dp == null ? 0 : dp,
      maximumFractionDigits: dp == null ? 0 : dp
    });
  }

  /* Auto-compact for stat tiles: 1,284 / 12.9K / 4.2M */
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 1e6) return round(n / 1e6, 1) + "M";
    if (a >= 1e4) return round(n / 1e3, 1) + "K";
    return fmt(n, a < 100 && a % 1 !== 0 ? 1 : 0);
  }

  function fmtKwh(n) { return fmt(n, Math.abs(n) < 100 ? 1 : 0); }
  function fmtCo2(n) { return fmt(n, Math.abs(n) < 100 ? 1 : 0); }
  function fmtMoney(n, cur) { return (cur || "RM") + " " + fmt(n, 2); }
  function pct(a, b) { return b ? (a / b) * 100 : 0; }

  /* ----------------------------- time ----------------------------- */
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function hhmm(d) { d = new Date(d); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function dayMon(d) { d = new Date(d); return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function fullDate(d) {
    d = new Date(d);
    return DAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function isoDate(d) {
    d = new Date(d);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /* "43 minutes", "2h 05m", "3 days" - used for idle timers */
  function durationText(mins) {
    mins = Math.max(0, Math.round(mins));
    if (mins < 1) return "less than a minute";
    if (mins < 60) return mins + (mins === 1 ? " minute" : " minutes");
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + "h " + pad2(m) + "m";
    var d = Math.floor(h / 24);
    return d + (d === 1 ? " day" : " days");
  }

  function durationShort(mins) {
    mins = Math.max(0, Math.round(mins));
    if (mins < 60) return mins + "m";
    var h = Math.floor(mins / 60), m = mins % 60;
    if (h < 24) return h + "h " + pad2(m) + "m";
    return Math.floor(h / 24) + "d";
  }

  function timeAgo(ts) {
    var s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return Math.round(s / 60) + "m ago";
    if (s < 86400) return Math.round(s / 3600) + "h ago";
    return Math.round(s / 86400) + "d ago";
  }

  function greeting(d) {
    var h = (d || new Date()).getHours();
    if (h < 5) return "Good evening";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  /* ----------------------------- misc ----------------------------- */
  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Math.random().toString(36).slice(2, 9);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 180);
    };
  }

  /* Deterministic PRNG so a seeded building looks the same on reload. */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function pick(arr, r) { return arr[Math.floor((r || Math.random)() * arr.length)]; }

  function downloadFile(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = el("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? "" : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\n");
  }

  /* ----------------------------- icons ----------------------------- */
  /* 24x24 stroke icons. Inline so the app has zero network dependencies. */
  var P = {
    dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
    rooms: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M16 10h3a2 2 0 0 1 2 2v9"/><path d="M9 7h3M9 11h3M9 15h3"/>',
    energy: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
    reports: '<path d="M14.5 2.5H7A2 2 0 0 0 5 4.5v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-4.5-4.5Z"/><path d="M14 2.5V7h5"/><path d="M9 13h6M9 17h4"/>',
    control: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    override: '<path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 18l6-6-6-6"/>',
    chevronLeft: '<path d="M15 18l-6-6 6-6"/>',
    chevronUpDown: '<path d="M7 15l5 5 5-5M7 9l5-5 5 5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5M12 17.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5M12 8h.01"/>',
    ac: '<path d="M12 2v20M12 7 8.5 4.5M12 7l3.5-2.5M12 17l-3.5 2.5M12 17l3.5 2.5"/><path d="m3.4 7 17.2 10M6.9 7.9 6 4.1l3.8-.9M17.1 16.1l.9 3.8-3.8.9"/><path d="M20.6 7 3.4 17M17.1 7.9l.9-3.8-3.8-.9M6.9 16.1 6 19.9l3.8.9"/>',
    fan: '<path d="M12 12c0-4 1-7 3.5-7S19 7.2 19 9c0 2.2-2.6 3-7 3Z"/><path d="M12 12c4 0 7 1 7 3.5S16.8 19 15 19c-2.2 0-3-2.6-3-7Z"/><path d="M12 12c0 4-1 7-3.5 7S5 16.8 5 15c0-2.2 2.6-3 7-3Z"/><path d="M12 12c-4 0-7-1-7-3.5S7.2 5 9 5c2.2 0 3 2.6 3 7Z"/><circle cx="12" cy="12" r="1.2"/>',
    light: '<path d="M9 18h6M10 21.5h4"/><path d="M12 2a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.3 1 2.1V17h6v-1.3c0-.8.4-1.6 1-2.1A6.5 6.5 0 0 0 12 2Z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.7 4.5-7.5C9 11.8 13 10 16 7"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2.5 6.5 8.4 5.9a2 2 0 0 0 2.2 0l8.4-5.9"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    refresh: '<path d="M3 11a9 9 0 0 1 15.3-5.6L21 8"/><path d="M21 3v5h-5"/><path d="M21 13a9 9 0 0 1-15.3 5.6L3 16"/><path d="M3 21v-5h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.7 3.9M6.6 6.6A18.3 18.3 0 0 0 2 12s3.6 7 10 7a10.7 10.7 0 0 0 5.4-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="m2 2 20 20"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    power: '<path d="M12 3v9"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    zap: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
    trendUp: '<path d="M22 7 13.5 15.5l-4-4L2 19"/><path d="M16 7h6v6"/>',
    trendDown: '<path d="M22 17 13.5 8.5l-4 4L2 5"/><path d="M16 17h6v-6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    building: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    filter: '<path d="M22 3H2l8 9.5V20l4 2v-9.5L22 3Z"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    printer: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 15h12v6H6z"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    wifi: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M2 9a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    motion: '<circle cx="12" cy="4" r="2"/><path d="m15.5 22-1.5-6 2-2-2.5-5-4 2-2 3"/><path d="m8 22 2-5.5"/><path d="m18 10-2.5-1.5"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3.5 2"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3"/><path d="M1 14h6M9 8h6M17 16h6"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="M6 4.5 19 12 6 19.5v-15Z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.8 12.2 8-8M17 6l2.5 2.5M14.5 8.5 17 11"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>'
  };

  /* Brand glyphs that need fills rather than strokes. */
  var FILLED = {
    google: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.8h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-9Z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z"/></svg>'
  };

  function icon(name, size) {
    if (FILLED[name]) return FILLED[name];
    var d = P[name];
    if (!d) return "";
    var s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      d + "</svg>";
  }

  /* The CarbonWise mark, inlined so it inherits theme tokens. */
  function logoMark(size) {
    var s = size || 30;
    return '<svg class="brand__mark" viewBox="0 0 64 64" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' +
      '<circle cx="32" cy="34" r="22" fill="none" stroke="var(--logo-ring)" stroke-width="5.5" stroke-linecap="round" ' +
      'stroke-dasharray="0 15.35 107.53 15.35" transform="rotate(-90 32 34)"/>' +
      '<path d="M32 12.5C42.4 22.8 43.8 37 32 52.5 20.2 37 21.6 22.8 32 12.5Z" fill="var(--logo-leaf)"/>' +
      '<path d="M32 20.5V46.5" stroke="var(--logo-rib)" stroke-width="2.1" stroke-linecap="round" opacity=".92"/>' +
      "</svg>";
  }

  function logo(size, withText) {
    var html = logoMark(size);
    if (withText !== false) html += '<span class="brand__text">Carbon<b>Wise</b></span>';
    return html;
  }

  CW.util = {
    qs: qs, qsa: qsa, el: el, delegate: delegate, esc: esc,
    clamp: clamp, round: round, fmt: fmt, compact: compact,
    fmtKwh: fmtKwh, fmtCo2: fmtCo2, fmtMoney: fmtMoney, pct: pct,
    pad2: pad2, hhmm: hhmm, dayMon: dayMon, fullDate: fullDate, isoDate: isoDate,
    durationText: durationText, durationShort: durationShort, timeAgo: timeAgo, greeting: greeting,
    initials: initials, uid: uid, debounce: debounce, rng: rng, pick: pick,
    downloadFile: downloadFile, toCsv: toCsv,
    icon: icon, logo: logo, logoMark: logoMark,
    DAYS: DAYS, MONTHS: MONTHS
  };
})(window, document);
