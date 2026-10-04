/* ==========================================================================
   CarbonWise - Rooms
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store;
  var V = CW.views;

  var filter = "all";
  var query = "";
  var blockFilter = "all";
  var sortBy = "status";

  V.rooms = function (view, ctx) {
    var st = S.state;

    var blocks = [];
    st.rooms.forEach(function (r) { if (blocks.indexOf(r.block) < 0) blocks.push(r.block); });

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Rooms</h1>' +
          '<p class="page-head__sub">Every monitored room in ' +
            U.esc(st.onboarding.buildingName || "your building") + ".</p>" +
        "</div>" +
        '<div class="page-head__actions">' +
          '<button class="btn btn--sm" type="button" id="rmOffEmpty">' + U.icon("power", 15) + "Turn off empty rooms</button>" +
          '<button class="btn btn--sm" type="button" id="rmExport">' + U.icon("download", 15) + "Export</button>" +
        "</div>" +
      "</header>" +

      '<div class="filterbar">' +
        '<div class="input-group" style="max-width:280px;flex:1;min-width:190px">' +
          '<span class="input-group__icon">' + U.icon("search", 17) + "</span>" +
          '<input class="input" type="search" id="rmSearch" placeholder="Search room..." aria-label="Search rooms" value="' + U.esc(query) + '">' +
        "</div>" +
        '<div class="u-row u-gap-8 u-wrap" id="rmChips" role="group" aria-label="Filter by status"></div>' +
        '<span class="filterbar__spacer"></span>' +
        (blocks.length > 1 ?
          '<div class="select-wrap" style="width:130px"><select class="select" id="rmBlock" aria-label="Filter by block">' +
            '<option value="all">All blocks</option>' +
            blocks.map(function (b) { return '<option value="' + U.esc(b) + '">Block ' + U.esc(b) + "</option>"; }).join("") +
          "</select>" + chev() + "</div>" : "") +
        '<div class="select-wrap" style="width:160px"><select class="select" id="rmSort" aria-label="Sort rooms">' +
          '<option value="status">Sort: Status</option>' +
          '<option value="name">Sort: Room number</option>' +
          '<option value="usage">Sort: Usage today</option>' +
          '<option value="idle">Sort: Idle time</option>' +
        "</select>" + chev() + "</div>" +
      "</div>" +

      '<div id="rmSummary" class="u-sm u-dim u-mb-16"></div>' +
      '<div class="grid grid--rooms" id="rmGrid"></div>';

    var grid = U.qs("#rmGrid", view);
    var chips = U.qs("#rmChips", view);

    function counts() {
      var c = S.statusCounts();
      return {
        all: st.rooms.length,
        occupied: c.occupied,
        empty: st.rooms.filter(function (r) { return !r.occupied; }).length,
        alert: c.alert
      };
    }

    function paintChips() {
      var c = counts();
      chips.innerHTML = [
        ["all", "All", c.all],
        ["occupied", "Occupied", c.occupied],
        ["empty", "Empty", c.empty],
        ["alert", "Alert", c.alert]
      ].map(function (x) {
        return '<button class="chip" type="button" data-filter="' + x[0] + '" aria-pressed="' +
          (filter === x[0] ? "true" : "false") + '">' + x[1] +
          '<span class="chip__count">' + x[2] + "</span></button>";
      }).join("");
    }

    function matches(r) {
      if (blockFilter !== "all" && r.block !== blockFilter) return false;
      var status = S.roomStatus(r);
      if (filter === "occupied" && !r.occupied) return false;
      if (filter === "empty" && r.occupied) return false;
      if (filter === "alert" && status !== "alert") return false;
      if (query) {
        var q = query.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 &&
            r.id.toLowerCase().indexOf(q) < 0 &&
            ("block " + r.block).toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    }

    var ORDER = { alert: 0, occupied: 1, normal: 2 };
    function sorted(list) {
      return list.slice().sort(function (a, b) {
        if (sortBy === "name") return a.name.localeCompare(b.name, undefined, { numeric: true });
        if (sortBy === "usage") return b.kwhToday - a.kwhToday;
        if (sortBy === "idle") return a.lastMotion - b.lastMotion;
        var d = ORDER[S.roomStatus(a)] - ORDER[S.roomStatus(b)];
        return d !== 0 ? d : a.name.localeCompare(b.name, undefined, { numeric: true });
      });
    }

    function paint() {
      paintChips();
      var list = sorted(st.rooms.filter(matches));
      U.qs("#rmSummary", view).textContent =
        list.length === st.rooms.length
          ? "Showing all " + list.length + " rooms"
          : "Showing " + list.length + " of " + st.rooms.length + " rooms";

      grid.innerHTML = "";
      if (!list.length) {
        grid.style.display = "block";
        grid.appendChild(UI.emptyState("search", "No rooms match",
          "Try a different search term or clear the filters.", {
            label: "Clear filters",
            onClick: function () { filter = "all"; query = ""; blockFilter = "all"; U.qs("#rmSearch", view).value = ""; paint(); }
          }));
        return;
      }
      grid.style.display = "";
      list.forEach(function (r) { grid.appendChild(roomCard(r)); });
    }

    U.delegate(chips, "click", ".chip", function (e, btn) { filter = btn.dataset.filter; paint(); });

    U.qs("#rmSearch", view).addEventListener("input", U.debounce(function (e) {
      query = e.target.value.trim(); paint();
    }, 160));

    var blockSel = U.qs("#rmBlock", view);
    if (blockSel) blockSel.addEventListener("change", function (e) { blockFilter = e.target.value; paint(); });
    U.qs("#rmSort", view).value = sortBy;
    U.qs("#rmSort", view).addEventListener("change", function (e) { sortBy = e.target.value; paint(); });

    U.qs("#rmOffEmpty", view).addEventListener("click", function () {
      var targets = st.rooms.filter(function (r) { return !r.occupied && S.devicesOn(r).length; });
      if (!targets.length) { UI.toast({ type: "info", title: "Nothing to switch off", msg: "No empty room has devices running." }); return; }
      UI.confirm({
        title: "Switch off devices in " + targets.length + " empty " + (targets.length === 1 ? "room" : "rooms") + "?",
        msg: "This turns off every monitored device in rooms with no one present. Rooms under manual override are skipped.",
        confirmLabel: "Switch off"
      }).then(function (yes) {
        if (!yes) return;
        var n = 0;
        targets.forEach(function (r) {
          if (r.override && r.override.until > Date.now()) return;
          S.devicesOn(r).forEach(function (k) { r.devices[k].on = false; r.devices[k].since = Date.now(); n++; });
        });
        S.logEvent("ok", null, "Manager switched off " + n + " devices across empty rooms");
        S.commit("bulk-off");
        UI.toast({ type: "ok", title: n + " devices switched off" });
        paint();
      });
    });

    U.qs("#rmExport", view).addEventListener("click", function () {
      var rows = [["Room", "Block", "Floor", "Status", "Occupied", "Idle (min)", "AC", "Fan", "Light", "kWh today", "Wasted kWh"]];
      sorted(st.rooms.filter(matches)).forEach(function (r) {
        rows.push([
          r.name, r.block, r.floor, S.roomStatus(r), r.occupied ? "yes" : "no",
          Math.round(S.idleMinutes(r)),
          r.devices.ac.on ? "ON" : "OFF", r.devices.fan.on ? "ON" : "OFF", r.devices.light.on ? "ON" : "OFF",
          U.round(r.kwhToday, 2), U.round(r.wastedKwh, 2)
        ]);
      });
      U.downloadFile("carbonwise-rooms-" + U.isoDate(new Date()) + ".csv", U.toCsv(rows), "text/csv");
      UI.toast({ type: "ok", title: "Rooms exported", msg: "CSV downloaded." });
    });

    paint();

    /* deep link: #/rooms?room=RA102 */
    var m = window.location.hash.match(/room=([A-Za-z0-9]+)/);
    if (m) {
      var target = st.rooms.filter(function (r) { return r.id === m[1]; })[0];
      if (target) setTimeout(function () { openRoom(target, paint); }, 120);
    }

    U.delegate(grid, "click", "[data-room]", function (e, node) {
      if (e.target.closest("[data-dev]")) return;
      var r = st.rooms.filter(function (x) { return x.id === node.dataset.room; })[0];
      if (r) openRoom(r, paint);
    });

    U.delegate(grid, "click", "[data-dev]", function (e, btn) {
      e.preventDefault();
      e.stopPropagation();
      var card = btn.closest("[data-room]");
      var r = st.rooms.filter(function (x) { return x.id === card.dataset.room; })[0];
      if (!r) return;
      toggleDevice(r, btn.dataset.dev);
      paint();
    });

    ctx.setRefresher(paint);
  };

  function chev() { return '<span class="select-wrap__chev">' + U.icon("chevronDown", 16) + "</span>"; }

  /* ------------------------------------------------------------------ */
  function toggleDevice(room, key) {
    var on = !room.devices[key].on;
    room.devices[key].on = on;
    room.devices[key].since = Date.now();
    if (on && room.autoOff) room.autoOff = room.autoOff.filter(function (k) { return k !== key; });
    S.logEvent("info", room.id,
      "Manager switched " + S.DEVICES[key].short + " " + (on ? "ON" : "OFF") + " in " + room.name);
    S.commit("device-toggle");
    UI.toast({
      type: on ? "info" : "ok",
      title: S.DEVICES[key].short + " " + (on ? "switched on" : "switched off"),
      msg: room.name
    });
  }

  function roomCard(r) {
    var status = S.roomStatus(r);
    var meta = UI.statusMeta(status);
    var on = S.devicesOn(r);
    var idle = S.idleMinutes(r);
    var overridden = r.override && r.override.until > Date.now();

    var card = U.el("article", {
      class: "card card--link room room--" + meta.cls,
      dataset: { room: r.id }, tabindex: "0", role: "button",
      "aria-label": r.name + ", " + meta.label
    });

    var lines = "";
    if (status === "alert") {
      lines =
        '<div class="room__line">No motion detected for <b>' + U.durationText(idle) + "</b></div>" +
        '<div class="room__line" style="color:var(--crit-ink)">' + U.icon("zap", 14) +
          "Wasting <b style=\"color:var(--crit-ink)\">" + U.fmt(S.roomLoadKw(r), 2) + " kW</b> right now</div>";
    } else if (status === "occupied") {
      lines = '<div class="room__line">' + U.icon("motion", 14) + "Motion detected <b>just now</b></div>" +
        '<div class="room__line u-dim">' + U.fmt(r.temp, 1) + "&deg;C &middot; " + r.humidity + "% humidity</div>";
    } else {
      lines = '<div class="room__line">Last motion <b>' + U.durationText(idle) + "</b> ago</div>" +
        '<div class="room__line u-dim">' + (on.length ? on.length + " device" + (on.length > 1 ? "s" : "") + " on" : "All devices off") + "</div>";
    }

    card.innerHTML =
      '<div class="room__top">' +
        "<div><div class=\"room__name\">" + U.esc(r.name) + "</div>" +
        '<div class="room__meta">Block ' + U.esc(r.block) + " &middot; Level " + r.floor +
          (r.sensorOk ? "" : " &middot; sensor offline") + "</div></div>" +
        UI.statusBadge(status) +
      "</div>" +
      "<div>" + lines + "</div>" +
      '<div class="room__devices">' +
        S.DEVICE_KEYS.filter(function (k) { return S.state.onboarding.devices[k]; })
          .map(function (k) { return UI.deviceChip(k, r.devices[k].on, true); }).join("") +
      "</div>" +
      '<div class="room__foot">' +
        "<span>" + U.fmt(r.kwhToday, 1) + " kWh today</span>" +
        (overridden
          ? '<span class="badge badge--blue">' + U.icon("override", 12) + "Override</span>"
          : '<span class="u-row u-gap-4">Details' + U.icon("chevronRight", 13) + "</span>") +
      "</div>";

    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
    });
    return card;
  }

  /* ------------------------------------------------------------------
     Room detail drawer
     ------------------------------------------------------------------ */
  function openRoom(r, onChange) {
    var body = U.el("div");
    var d = null;

    function paint() {
      var status = S.roomStatus(r);
      var meta = UI.statusMeta(status);
      var idle = S.idleMinutes(r);
      var overridden = r.override && r.override.until > Date.now();
      body.innerHTML = "";

      var head = U.el("div", { class: "u-row u-gap-8 u-wrap u-mb-20" });
      head.innerHTML = UI.statusBadge(status, "lg") +
        '<span class="badge">' + U.icon("building", 12) + "Block " + U.esc(r.block) + "</span>" +
        '<span class="badge">Level ' + r.floor + "</span>" +
        (r.sensorOk ? "" : '<span class="badge badge--warn">' + U.icon("wifi", 12) + "Sensor offline</span>") +
        (overridden ? '<span class="badge badge--blue">' + U.icon("override", 12) + "Manual override</span>" : "");
      body.appendChild(head);

      if (status === "alert") {
        body.appendChild(U.el("div", { class: "callout callout--crit u-mb-20" }, [
          U.el("span", { class: "callout__icon", html: U.icon("alert", 18) }),
          U.el("span", {
            class: "callout__text",
            text: "No motion for " + U.durationText(idle) + " but " + S.devicesOn(r).length +
              " device(s) are still running. This room is drawing " + U.fmt(S.roomLoadKw(r), 2) +
              " kW on nobody."
          })
        ]));
      }

      var stats = U.el("div", { class: "grid grid--2 u-mb-20", style: "gap:12px" });
      stats.innerHTML =
        miniStat("Last motion", r.occupied ? "Now" : U.durationShort(idle) + " ago", "motion") +
        miniStat("Live load", U.fmt(S.roomLoadKw(r), 2) + " kW", "zap") +
        miniStat("Used today", U.fmt(r.kwhToday, 1) + " kWh", "activity") +
        miniStat("Wasted today", U.fmt(r.wastedKwh, 2) + " kWh", "trendDown");
      body.appendChild(stats);

      var devCard = U.el("div", { class: "card card--flat u-mb-20" });
      devCard.appendChild(U.el("div", { class: "card__head" }, [
        U.el("div", {}, [U.el("div", { class: "card__title", text: "Devices" }),
          U.el("div", { class: "card__sub", text: overridden ? "Automation paused by override" : "Automation active" })])
      ]));
      S.DEVICE_KEYS.forEach(function (k) {
        if (!S.state.onboarding.devices[k]) return;
        var dev = S.DEVICES[k];
        var row = U.el("div", { class: "devrow" });
        row.innerHTML =
          '<div class="u-row u-gap-12">' +
            '<span style="color:var(' + dev.series + ')">' + U.icon(dev.icon, 19) + "</span>" +
            "<span><span class=\"u-sm u-med\">" + U.esc(dev.label) + "</span><br>" +
            '<span class="u-xs u-dim">' + dev.watts + " W &middot; " +
              (r.devices[k].on ? "on since " + U.hhmm(r.devices[k].since) : "off since " + U.hhmm(r.devices[k].since)) +
            "</span></span></div>";
        var sw = U.el("label", { class: "switch", "aria-label": dev.label });
        sw.innerHTML = '<input type="checkbox"' + (r.devices[k].on ? " checked" : "") + '><span class="switch__track"></span>';
        U.qs("input", sw).addEventListener("change", function () {
          toggleDevice(r, k);
          paint();
          if (onChange) onChange();
        });
        var cell = U.el("div", { class: "devrow__toggles" }, [sw]);
        row.appendChild(cell);
        devCard.appendChild(row);
      });
      body.appendChild(devCard);

      var env = U.el("div", { class: "card card--flat u-mb-20" });
      env.innerHTML =
        '<div class="card__head"><div class="card__title">Conditions</div></div>' +
        '<div class="card__body" style="padding-top:8px">' +
          kv("Temperature", U.fmt(r.temp, 1) + " &deg;C") +
          kv("Humidity", r.humidity + " %") +
          kv("Occupancy", r.occupied ? "Occupied" : "Empty") +
          kv("Idle threshold", S.state.settings.idleThreshold + " minutes") +
          kv("Estimated cost today", U.fmtMoney(r.kwhToday * S.state.settings.tariff, S.state.settings.currency)) +
        "</div>";
      body.appendChild(env);

      var evs = S.state.events.filter(function (e) { return e.roomId === r.id; }).slice(0, 8);
      var hist = U.el("div", { class: "card card--flat" });
      hist.innerHTML = '<div class="card__head"><div class="card__title">Room activity</div></div>';
      var hb = U.el("div", { class: "card__body", style: "padding-top:14px" });
      if (!evs.length) {
        hb.appendChild(U.el("p", { class: "u-sm u-dim", text: "No events recorded for this room yet." }));
      } else {
        var tl = U.el("div", { class: "timeline" });
        evs.forEach(function (ev) {
          var tone = ev.severity === "crit" ? "crit" : ev.severity === "ok" ? "ok" : "blue";
          tl.appendChild(U.el("div", { class: "timeline__item", html:
            '<span class="timeline__dot timeline__dot--' + tone + '"></span>' +
            '<div class="timeline__time">' + U.hhmm(ev.ts) + " &middot; " + U.timeAgo(ev.ts) + "</div>" +
            '<div class="timeline__text">' + U.esc(ev.text) + "</div>"
          }));
        });
        hb.appendChild(tl);
      }
      hist.appendChild(hb);
      body.appendChild(hist);
    }

    paint();

    var foot = U.el("div", { class: "u-row u-gap-8 u-full" });
    var offBtn = U.el("button", { class: "btn btn--block", type: "button" }, "Turn off all");
    offBtn.addEventListener("click", function () {
      var on = S.devicesOn(r);
      if (!on.length) { UI.toast({ type: "info", title: "Already off", msg: "No devices are running in " + r.name }); return; }
      on.forEach(function (k) { r.devices[k].on = false; r.devices[k].since = Date.now(); });
      S.logEvent("ok", r.id, "Manager switched off all devices in " + r.name);
      S.commit("room-off");
      UI.toast({ type: "ok", title: "All devices off", msg: r.name });
      paint();
      if (onChange) onChange();
    });
    var ovBtn = U.el("button", { class: "btn btn--primary btn--block", type: "button" },
      r.override && r.override.until > Date.now() ? "Manage override" : "Set override");
    ovBtn.addEventListener("click", function () {
      V.openOverrideDialog(r, function () { paint(); if (onChange) onChange(); });
    });
    foot.appendChild(offBtn);
    foot.appendChild(ovBtn);

    d = UI.drawer({
      title: r.name,
      sub: "Block " + r.block + " · Level " + r.floor + " · " + r.id,
      body: body,
      foot: foot
    });
    return d;
  }

  function miniStat(label, value, icon) {
    return '<div class="card card--sunk" style="padding:13px">' +
      '<div class="u-row u-gap-6 u-xs u-dim">' + U.icon(icon, 13) + U.esc(label) + "</div>" +
      '<div class="u-semi u-tab u-mt-4" style="font-size:1.0625rem">' + value + "</div></div>";
  }

  function kv(k, v) {
    return '<div class="kv"><span class="kv__k">' + U.esc(k) + '</span><span class="kv__v">' + v + "</span></div>";
  }

  V.openRoomDrawer = openRoom;
  V.toggleDevice = toggleDevice;
})(window, document);
