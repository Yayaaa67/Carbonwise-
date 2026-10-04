/* ==========================================================================
   CarbonWise - live simulation + series derivation
   Stands in for the motion sensors and smart plugs a real deployment would
   poll. Everything the charts read is derived here, so swapping this file
   for a real API client is the only change a live install needs.
   ========================================================================== */
(function (window) {
  "use strict";

  var CW = window.CW || (window.CW = {});
  var U = CW.util;
  var S = CW.store;
  var K = S.DEVICE_KEYS;
  var D = S.DEVICES;

  var TICK_MS = 3000;
  var timer = null;
  var lastTick = Date.now();

  /* ------------------------------------------------------------------
     One simulation step.
     ------------------------------------------------------------------ */
  function tick() {
    var st = S.state;
    if (!st.rooms.length) return;

    var now = Date.now();
    var dtH = Math.min((now - lastTick) / 3600000, 0.5);   // hours, clamped after a sleep
    lastTick = now;

    var today = st.history[st.history.length - 1];
    var hour = new Date().getHours();
    if (!today || today.date !== U.isoDate(new Date())) {
      today = rollToNewDay(st);
    }
    while (today.hours.length <= hour) {
      today.hours.push({ h: today.hours.length, ac: 0, fan: 0, light: 0 });
    }
    var bucket = today.hours[hour];

    var changed = false;

    st.rooms.forEach(function (room) {
      if (!room.sensorOk) {
        if (Math.random() < 0.004) { room.sensorOk = true; S.logEvent("ok", room.id, room.name + " motion sensor back online"); changed = true; }
        return;
      }
      if (Math.random() < 0.0004) {
        room.sensorOk = false;
        S.logEvent("warn", room.id, room.name + " motion sensor stopped reporting");
        changed = true;
      }

      /* --- occupancy --- */
      if (room.occupied) {
        room.lastMotion = now;                       // motion keeps registering
        if (Math.random() < 0.012) {
          room.occupied = false;
          changed = true;
        }
      } else if (Math.random() < 0.009) {
        room.occupied = true;
        room.lastMotion = now;
        room.autoOff = null;                         // a person is back: automation stands down
        // people switch things on when they walk in
        K.forEach(function (k) {
          if (!st.onboarding.devices[k]) return;
          var want = k === "ac" ? 0.72 : k === "fan" ? 0.6 : 0.8;
          if (!room.devices[k].on && Math.random() < want) {
            room.devices[k].on = true;
            room.devices[k].since = now;
          }
        });
        S.logEvent("info", room.id, "Motion detected in " + room.name);
        changed = true;
      }

      /* --- automatic shut-off --- */
      var idle = S.idleMinutes(room);
      var overridden = room.override && room.override.until > now;
      if (!room.occupied && idle >= st.settings.idleThreshold && !overridden) {
        K.forEach(function (k) {
          if (!st.onboarding.devices[k] || !st.settings.autoShutoff[k]) return;
          if (!room.devices[k].on) return;
          room.devices[k].on = false;
          room.devices[k].since = now;
          room.autoOff = (room.autoOff || []).concat([k]);
          st.totals.autoActions++;
          S.logEvent("ok", room.id,
            "Auto shut-off: " + D[k].short + " in " + room.name + " after " + U.durationShort(idle) + " without motion");
          changed = true;
        });
      }

      /* --- energy accounting --- */
      K.forEach(function (k) {
        if (!st.onboarding.devices[k]) return;
        if (room.devices[k].on) {
          var kwh = (D[k].watts / 1000) * dtH;
          bucket[k] += kwh;
          room.kwhToday += kwh;
          // energy burned in an empty room is waste - unless it is being
          // held on deliberately under an override
          if (!room.occupied && idle >= st.settings.idleThreshold && !overridden) room.wastedKwh += kwh;
        } else if (room.autoOff && room.autoOff.indexOf(k) > -1 && !room.occupied) {
          // avoided energy: this device would still be running without CarbonWise
          st.totals.savedKwh += (D[k].watts / 1000) * dtH;
        }
      });

      /* --- ambient drift, so the room detail panel feels live --- */
      if (Math.random() < 0.1) {
        room.temp = U.round(U.clamp(room.temp + (Math.random() - 0.5) * 0.4, 21, 33), 1);
        room.humidity = Math.round(U.clamp(room.humidity + (Math.random() - 0.5) * 2, 45, 88));
      }

      /* an expired override releases itself */
      if (room.override && room.override.until <= now) {
        S.logEvent("info", room.id, "Manual override expired for " + room.name);
        room.override = null;
        changed = true;
      }
    });

    K.forEach(function (k) { bucket[k] = U.round(bucket[k], 4); });
    st.totals.savedKwh = U.round(st.totals.savedKwh, 3);
    st.totals.savedCo2 = U.round(st.totals.savedKwh * st.settings.gridFactor, 2);

    S.save();
    S.emit(changed ? "tick-change" : "tick");
  }

  function rollToNewDay(st) {
    var day = { date: U.isoDate(new Date()), dow: new Date().getDay(), hours: [] };
    st.history.push(day);
    while (st.history.length > 60) st.history.shift();
    st.rooms.forEach(function (r) { r.kwhToday = 0; r.wastedKwh = 0; });
    S.logEvent("info", null, "New reporting day started");
    return day;
  }

  function start() {
    stop();
    lastTick = Date.now();
    if (!S.state.settings.simulation) return;
    timer = window.setInterval(tick, TICK_MS);
  }
  function stop() { if (timer) { window.clearInterval(timer); timer = null; } }
  function running() { return !!timer; }

  /* ==================================================================
     Series derivation
     Every chart in the app reads from here, so the numbers always agree.
     ================================================================== */

  function dayTotals(day) {
    var t = { ac: 0, fan: 0, light: 0 };
    day.hours.forEach(function (h) { t.ac += h.ac; t.fan += h.fan; t.light += h.light; });
    return t;
  }

  /* range: "today" | "week" | "month"
     Returns labels plus per-device arrays, the total, and the matching
     previous period on the SAME scale (never a second y-axis). */
  function series(range) {
    var st = S.state;
    var hist = st.history || [];
    var out = {
      range: range, labels: [], full: [], ac: [], fan: [], light: [], total: [], prev: [],
      prevLabel: "",
      // index of the point still in progress, so comparisons stay like-for-like
      partialIndex: -1
    };
    if (!hist.length) return out;

    function pushDay(day, arrTarget) {
      var t = dayTotals(day);
      arrTarget.push(U.round(t.ac + t.fan + t.light, 2));
      return t;
    }

    if (range === "today") {
      var today = hist[hist.length - 1];
      var yest = hist[hist.length - 2];
      var nowHour = new Date().getHours();
      out.prevLabel = "Yesterday";
      out.partialIndex = nowHour;
      for (var h = 0; h < 24; h++) {
        out.labels.push(U.pad2(h));
        out.full.push(U.pad2(h) + ":00");
        var cur = today.hours[h];
        out.ac.push(cur ? U.round(cur.ac, 2) : null);
        out.fan.push(cur ? U.round(cur.fan, 2) : null);
        out.light.push(cur ? U.round(cur.light, 2) : null);
        out.total.push(cur ? U.round(cur.ac + cur.fan + cur.light, 2) : null);
        // yesterday is cut at the same hour, so the two curves and the
        // headline percentage compare the same slice of the day
        var p = h <= nowHour && yest && yest.hours[h];
        out.prev.push(p ? U.round(p.ac + p.fan + p.light, 2) : null);
      }
      return out;
    }

    var span = range === "week" ? 7 : 30;
    var start = Math.max(0, hist.length - span);
    var cur = hist.slice(start);
    var prevStart = Math.max(0, start - span);
    var prev = hist.slice(prevStart, start);
    out.prevLabel = range === "week" ? "Previous 7 days" : "Previous 30 days";
    out.partialIndex = cur.length - 1;   // today is still accumulating

    cur.forEach(function (day, i) {
      var d = new Date(day.date + "T00:00:00");
      out.labels.push(range === "week" ? U.DAYS[d.getDay()] : String(d.getDate()));
      out.full.push(U.fullDate(d));
      var t = dayTotals(day);
      out.ac.push(U.round(t.ac, 2));
      out.fan.push(U.round(t.fan, 2));
      out.light.push(U.round(t.light, 2));
      out.total.push(U.round(t.ac + t.fan + t.light, 2));
      var pd = prev[prev.length - cur.length + i];
      out.prev.push(pd ? U.round(dayTotals(pd).ac + dayTotals(pd).fan + dayTotals(pd).light, 2) : null);
    });
    return out;
  }

  function sum(arr) { return arr.reduce(function (s, v) { return s + (v || 0); }, 0); }

  /* Headline figures for a range: energy, carbon, cost, and the signed
     change against the previous period.

     The comparison is deliberately like-for-like. "Today" is only part of a
     day, so for the hourly view yesterday is already truncated to the same
     hour; for the daily views the in-progress day is excluded from BOTH
     sides, otherwise every dashboard would report a crash in consumption
     every morning. `kwh` still reports everything consumed so far. */
  function summary(range) {
    var st = S.state;
    var s = series(range);
    var cur = sum(s.total);
    var prev = sum(s.prev);

    var curCmp = cur, prevCmp = prev;
    if (range !== "today" && s.partialIndex >= 0) {
      curCmp = sum(s.total.slice(0, s.partialIndex));
      prevCmp = sum(s.prev.slice(0, s.partialIndex));
    }
    var change = prevCmp > 0 ? ((curCmp - prevCmp) / prevCmp) * 100 : 0;

    return {
      kwh: U.round(cur, 1),
      prevKwh: U.round(prev, 1),
      cmpKwh: U.round(curCmp, 1),
      cmpPrevKwh: U.round(prevCmp, 1),
      comparable: prevCmp > 0,
      inProgress: s.partialIndex >= 0,
      change: U.round(change, 1),
      co2: U.round(cur * st.settings.gridFactor, 1),
      prevCo2: U.round(prev * st.settings.gridFactor, 1),
      cost: U.round(cur * st.settings.tariff, 2),
      byDevice: {
        ac: U.round(sum(s.ac), 1),
        fan: U.round(sum(s.fan), 1),
        light: U.round(sum(s.light), 1)
      },
      peak: s.total.reduce(function (m, v, i) {
        return v != null && v > m.v ? { v: v, i: i, label: s.full[i] } : m;
      }, { v: -1, i: 0, label: "" })
    };
  }

  /* 7 days x 24 hours of consumption, for the peak-hours heat-map. */
  function heatmap() {
    var hist = S.state.history || [];
    var days = hist.slice(-7);
    var max = 0;
    var rows = days.map(function (day) {
      var d = new Date(day.date + "T00:00:00");
      var cells = [];
      for (var h = 0; h < 24; h++) {
        var c = day.hours[h];
        var v = c ? c.ac + c.fan + c.light : null;
        if (v != null && v > max) max = v;
        cells.push(v == null ? null : U.round(v, 2));
      }
      return { label: U.DAYS[d.getDay()], date: U.fullDate(d), cells: cells };
    });
    return { rows: rows, max: max };
  }

  /* Rooms ranked by consumption, for the "top consumers" table. */
  function topRooms(n) {
    return S.state.rooms.slice()
      .sort(function (a, b) { return b.kwhToday - a.kwhToday; })
      .slice(0, n || 8);
  }

  CW.sim = {
    start: start, stop: stop, running: running, tick: tick,
    series: series, summary: summary, heatmap: heatmap, topRooms: topRooms,
    dayTotals: dayTotals, sum: sum, TICK_MS: TICK_MS
  };
})(window);
