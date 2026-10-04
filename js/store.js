/* ==========================================================================
   CarbonWise - application state
   Persisted to localStorage, with an in-memory fallback so the app still
   works when storage is blocked (private windows, file:// in some browsers).
   ========================================================================== */
(function (window) {
  "use strict";

  var CW = window.CW || (window.CW = {});
  var U = CW.util;

  var KEY = "carbonwise.v1";
  var memory = null;           // fallback when localStorage throws
  var listeners = [];

  /* ------------------------------------------------------------------
     Device catalogue. Watt ratings are per room and deliberately
     realistic for a Malaysian hostel block.
     ------------------------------------------------------------------ */
  var DEVICES = {
    ac:    { key: "ac",    label: "Air Conditioner", short: "AC",    icon: "ac",    watts: 1150, series: "--s-ac" },
    fan:   { key: "fan",   label: "Ceiling Fan",     short: "Fan",   icon: "fan",   watts: 58,   series: "--s-fan" },
    light: { key: "light", label: "Lights",          short: "Light", icon: "light", watts: 42,   series: "--s-light" }
  };
  var DEVICE_KEYS = ["ac", "fan", "light"];

  function defaults() {
    return {
      version: 1,
      account: null,          // { name, email, password, verified, role, createdAt }
      session: { loggedIn: false, remember: false },
      onboarding: {
        complete: false,
        buildingName: "",
        roomCount: 24,
        devices: { ac: true, fan: true, light: true }
      },
      settings: {
        theme: "system",            // system | light | dark
        idleThreshold: 30,          // minutes of no motion before a room is flagged
        autoShutoff: { ac: true, fan: true, light: false },
        alertSound: false,
        notifyAlerts: true,
        notifyDaily: true,
        notifyWeekly: false,
        simulation: true,
        gridFactor: 0.585,          // kg CO2 per kWh (Peninsular Malaysia grid)
        tariff: 0.52,               // RM per kWh
        currency: "RM"
      },
      rooms: [],
      events: [],
      reports: [],
      totals: { savedKwh: 0, savedCo2: 0, autoActions: 0 },
      seededAt: 0
    };
  }

  var state = defaults();

  /* ------------------------------ persistence ------------------------------ */
  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return memory;
    }
  }

  function write(data) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      memory = data;          // storage blocked or full - keep going in memory
    }
  }

  /* Shallow-merge persisted state over the defaults so a new field added in
     a later version does not break an existing saved building. */
  function hydrate() {
    var saved = read();
    if (!saved) return;
    var base = defaults();
    Object.keys(base).forEach(function (k) {
      if (saved[k] == null) return;
      if (k === "settings" || k === "onboarding" || k === "session" || k === "totals") {
        state[k] = Object.assign({}, base[k], saved[k]);
        if (k === "settings" && saved.settings && saved.settings.autoShutoff) {
          state.settings.autoShutoff = Object.assign({}, base.settings.autoShutoff, saved.settings.autoShutoff);
        }
        if (k === "onboarding" && saved.onboarding && saved.onboarding.devices) {
          state.onboarding.devices = Object.assign({}, base.onboarding.devices, saved.onboarding.devices);
        }
      } else {
        state[k] = saved[k];
      }
    });
  }

  function save() { write(state); }

  function reset() {
    try { window.localStorage.removeItem(KEY); } catch (e) { memory = null; }
    state = defaults();
    emit("reset");
  }

  /* ------------------------------ pub / sub ------------------------------ */
  function on(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* a bad listener must not stall the app */ }
    });
  }

  function commit(reason) { save(); emit(reason || "change"); }

  /* ------------------------------ seeding ------------------------------ */
  var BLOCKS = ["A", "B", "C", "D"];

  /* Builds the room list for the configured room count. Rooms are laid out
     8 per floor, 4 floors per block, numbered like a real hostel (A-102). */
  function seedRooms(count, enabled) {
    var rand = U.rng(count * 7919 + 13);
    var rooms = [];
    var perFloor = 8;
    var floorsPerBlock = 4;

    for (var i = 0; i < count; i++) {
      var blockIdx = Math.floor(i / (perFloor * floorsPerBlock));
      var within = i % (perFloor * floorsPerBlock);
      var floor = Math.floor(within / perFloor) + 1;
      var num = (within % perFloor) + 1;
      var block = BLOCKS[blockIdx % BLOCKS.length];
      var label = String(floor) + U.pad2(num);

      var occupied = rand() < 0.34;
      // minutes since last motion: occupied rooms are recent by definition
      var idle = occupied ? Math.floor(rand() * 3) : Math.floor(rand() * 180);

      var devices = {};
      DEVICE_KEYS.forEach(function (k) {
        var on = false;
        if (enabled[k]) {
          // occupied rooms mostly have things on; empty rooms sometimes do -
          // that is exactly the waste CarbonWise is built to catch.
          on = occupied ? rand() < (k === "ac" ? 0.78 : k === "fan" ? 0.7 : 0.82)
                        : rand() < (k === "ac" ? 0.2 : k === "fan" ? 0.16 : 0.24);
        }
        devices[k] = { on: on, since: Date.now() - Math.floor(rand() * 7200000) };
      });

      rooms.push({
        id: "R" + block + label,
        name: "Room " + label,
        block: block,
        floor: floor,
        occupied: occupied,
        lastMotion: Date.now() - idle * 60000,
        devices: devices,
        override: null,          // { until, by, note }
        kwhToday: U.round(1.2 + rand() * 7.5, 2),
        wastedKwh: 0,
        temp: U.round(23 + rand() * 6, 1),
        humidity: Math.round(55 + rand() * 20),
        sensorOk: rand() > 0.03,
        history: []
      });
    }
    return rooms;
  }

  /* Seeds a plausible 30 days of history so charts are never empty.
     Values are generated from a fixed seed, so a reload shows the same past. */
  function seedHistory(rooms, enabled) {
    var rand = U.rng(rooms.length * 104729 + 7);
    var now = new Date();

    function dayShape(hour, weekday) {
      // Hostel load: low overnight, a morning bump, a long evening peak.
      var base = 0.26;
      if (hour >= 7 && hour <= 9) base = 0.62;
      else if (hour >= 10 && hour <= 16) base = weekday ? 0.34 : 0.52;
      else if (hour >= 17 && hour <= 23) base = 0.92;
      else if (hour >= 0 && hour <= 2) base = 0.58;
      return base;
    }

    var perRoomKw = 0;
    DEVICE_KEYS.forEach(function (k) { if (enabled[k]) perRoomKw += DEVICES[k].watts / 1000; });
    var scale = rooms.length * perRoomKw;

    function buildDay(date, hoursLimit) {
      var weekday = date.getDay() > 0 && date.getDay() < 6;
      var hours = [];
      var limit = hoursLimit == null ? 24 : hoursLimit;
      for (var h = 0; h < limit; h++) {
        var shape = dayShape(h, weekday) * (0.86 + rand() * 0.28);
        var total = scale * shape * 0.42;
        var acShare = enabled.ac ? 0.7 : 0;
        var fanShare = enabled.fan ? 0.11 : 0;
        var lightShare = enabled.light ? 0.19 : 0;
        var sum = acShare + fanShare + lightShare || 1;
        hours.push({
          h: h,
          ac: U.round(total * (acShare / sum), 2),
          fan: U.round(total * (fanShare / sum), 2),
          light: U.round(total * (lightShare / sum), 2)
        });
      }
      return hours;
    }

    // 60 days, so "this month" still has a full previous month to compare with
    var days = [];
    for (var d = 59; d >= 0; d--) {
      var date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d);
      var isToday = d === 0;
      var hours = buildDay(date, isToday ? now.getHours() + 1 : 24);
      days.push({ date: U.isoDate(date), dow: date.getDay(), hours: hours });
    }
    return days;
  }

  function seedBuilding() {
    var ob = state.onboarding;
    state.rooms = seedRooms(U.clamp(ob.roomCount || 24, 1, 120), ob.devices);
    state.history = seedHistory(state.rooms, ob.devices);
    state.events = [];
    state.totals = { savedKwh: U.round(8 + Math.random() * 6, 2), savedCo2: 0, autoActions: Math.floor(10 + Math.random() * 14) };
    state.totals.savedCo2 = U.round(state.totals.savedKwh * state.settings.gridFactor, 2);
    state.seededAt = Date.now();
    logEvent("info", null, "Building initialised with " + state.rooms.length + " rooms");
    commit("seed");
  }

  /* ------------------------------ events log ------------------------------ */
  function logEvent(severity, roomId, text) {
    state.events.unshift({
      id: U.uid("ev"),
      ts: Date.now(),
      severity: severity,     // ok | info | warn | crit
      roomId: roomId,
      text: text
    });
    if (state.events.length > 300) state.events.length = 300;
  }

  /* ------------------------------ selectors ------------------------------ */
  function idleMinutes(room) { return (Date.now() - room.lastMotion) / 60000; }

  function devicesOn(room) {
    return DEVICE_KEYS.filter(function (k) {
      return state.onboarding.devices[k] && room.devices[k] && room.devices[k].on;
    });
  }

  function roomLoadKw(room) {
    var kw = 0;
    devicesOn(room).forEach(function (k) { kw += DEVICES[k].watts / 1000; });
    return kw;
  }

  function isOverridden(room) {
    return !!(room.override && room.override.until > Date.now());
  }

  /* Three states, exactly as the dashboard presents them:
       occupied - motion seen recently
       alert    - devices running with no motion past the threshold
       normal   - everything else (empty and behaving)

     A room under manual override never raises an alert: its devices are on
     deliberately, which is the whole point of the override. The card still
     carries an "Override" badge so the reason is visible. */
  function roomStatus(room) {
    if (room.occupied) return "occupied";
    var on = devicesOn(room);
    if (on.length && idleMinutes(room) >= state.settings.idleThreshold && !isOverridden(room)) return "alert";
    return "normal";
  }

  function statusCounts() {
    var c = { normal: 0, occupied: 0, alert: 0 };
    state.rooms.forEach(function (r) { c[roomStatus(r)]++; });
    return c;
  }

  function deviceCounts() {
    var c = { ac: 0, fan: 0, light: 0 };
    state.rooms.forEach(function (r) {
      DEVICE_KEYS.forEach(function (k) {
        if (state.onboarding.devices[k] && r.devices[k] && r.devices[k].on) c[k]++;
      });
    });
    return c;
  }

  function alertRooms() {
    return state.rooms.filter(function (r) { return roomStatus(r) === "alert"; })
      .sort(function (a, b) { return a.lastMotion - b.lastMotion; });
  }

  function overriddenRooms() { return state.rooms.filter(isOverridden); }

  /* Live building load in kW, used by the dashboard hero. */
  function liveLoadKw() {
    return state.rooms.reduce(function (sum, r) { return sum + roomLoadKw(r); }, 0);
  }

  function todayKwh() {
    var today = state.history[state.history.length - 1];
    if (!today) return 0;
    return today.hours.reduce(function (s, h) { return s + h.ac + h.fan + h.light; }, 0);
  }

  function wastedNowKw() {
    return alertRooms().reduce(function (s, r) { return s + roomLoadKw(r); }, 0);
  }

  CW.store = {
    DEVICES: DEVICES,
    DEVICE_KEYS: DEVICE_KEYS,
    BLOCKS: BLOCKS,
    get state() { return state; },
    hydrate: hydrate,
    save: save,
    commit: commit,
    reset: reset,
    on: on,
    emit: emit,
    seedBuilding: seedBuilding,
    logEvent: logEvent,
    idleMinutes: idleMinutes,
    isOverridden: isOverridden,
    devicesOn: devicesOn,
    roomLoadKw: roomLoadKw,
    roomStatus: roomStatus,
    statusCounts: statusCounts,
    deviceCounts: deviceCounts,
    alertRooms: alertRooms,
    overriddenRooms: overriddenRooms,
    liveLoadKw: liveLoadKw,
    todayKwh: todayKwh,
    wastedNowKw: wastedNowKw
  };
})(window);
