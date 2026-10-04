/* ==========================================================================
   CarbonWise - Settings, Profile and Manual Override
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store;
  var V = CW.views;

  /* ======================================================================
     Settings
     ====================================================================== */
  V.settings = function (view) {
    var st = S.state;

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Settings</h1>' +
          '<p class="page-head__sub">Automation rules, tariffs and how CarbonWise behaves.</p>' +
        "</div>" +
      "</header>" +
      '<div class="grid" style="gap:16px;max-width:860px" id="setBody"></div>';

    var body = U.qs("#setBody", view);

    /* ---------------------------- building ---------------------------- */
    var building = card("Building", "What CarbonWise is monitoring.");
    var fName = UI.field({ label: "Building name", icon: "building", value: st.onboarding.buildingName });
    fName.style.maxWidth = "380px";
    fName.input.addEventListener("change", function () {
      var v = fName.input.value.trim();
      if (v.length < 2) { UI.setError(fName, "Give your building a name."); return; }
      UI.setError(fName, "");
      st.onboarding.buildingName = v;
      S.commit("settings");
      UI.toast({ type: "ok", title: "Building name updated" });
    });
    building.body.appendChild(fName);

    building.body.appendChild(row(
      "Rooms monitored",
      "Changing the room count rebuilds the room list and clears today's readings.",
      (function () {
        var b = U.el("button", { class: "btn btn--sm", type: "button" }, st.rooms.length + " rooms");
        b.addEventListener("click", changeRoomCount);
        return b;
      })()
    ));

    S.DEVICE_KEYS.forEach(function (k) {
      var d = S.DEVICES[k];
      building.body.appendChild(row(
        "Monitor " + d.label.toLowerCase(),
        "Around " + d.watts + " W per room. Switching this off hides the device everywhere.",
        toggle(st.onboarding.devices[k], function (on) {
          if (!on && !S.DEVICE_KEYS.some(function (x) { return x !== k && st.onboarding.devices[x]; })) {
            UI.toast({ type: "warn", title: "Keep at least one device", msg: "CarbonWise needs something to monitor." });
            return false;
          }
          st.onboarding.devices[k] = on;
          S.commit("settings");
          UI.toast({ type: "ok", title: d.label + (on ? " is now monitored" : " is no longer monitored") });
          return true;
        })
      ));
    });
    body.appendChild(building.card);

    /* ---------------------------- automation ---------------------------- */
    var auto = card("Automation", "When CarbonWise flags a room, and what it may switch off by itself.");

    var thrWrap = U.el("div", { class: "setrow" });
    var thrVal = U.el("span", { class: "u-semi u-tab", style: "min-width:76px;text-align:right",
      text: st.settings.idleThreshold + " min" });
    var slider = U.el("input", {
      class: "slider", type: "range", min: 5, max: 120, step: 5,
      value: st.settings.idleThreshold, "aria-label": "Idle threshold in minutes"
    });
    slider.addEventListener("input", function () { thrVal.textContent = slider.value + " min"; });
    slider.addEventListener("change", function () {
      st.settings.idleThreshold = parseInt(slider.value, 10);
      S.commit("settings");
      UI.toast({ type: "ok", title: "Idle threshold set to " + st.settings.idleThreshold + " minutes" });
    });
    thrWrap.innerHTML =
      '<div><div class="setrow__title">Idle threshold</div>' +
      '<div class="setrow__sub">How long a room may go without motion before its running devices ' +
        "count as waste and raise an alert.</div></div>";
    var thrCtl = U.el("div", { class: "setrow__control", style: "min-width:220px;gap:14px" });
    thrCtl.appendChild(slider);
    thrCtl.appendChild(thrVal);
    thrWrap.appendChild(thrCtl);
    auto.body.appendChild(thrWrap);

    S.DEVICE_KEYS.forEach(function (k) {
      var d = S.DEVICES[k];
      auto.body.appendChild(row(
        "Automatically switch off " + d.short,
        k === "light"
          ? "Lights are often left on deliberately for safety, so this starts switched off."
          : "CarbonWise turns the " + d.short + " off once the idle threshold passes in an empty room.",
        toggle(st.settings.autoShutoff[k], function (on) {
          st.settings.autoShutoff[k] = on;
          S.commit("settings");
          UI.toast({ type: on ? "ok" : "info", title: "Auto shut-off " + (on ? "enabled" : "disabled") + " for " + d.short });
          return true;
        }, !st.onboarding.devices[k])
      ));
    });
    body.appendChild(auto.card);

    /* ---------------------------- notifications ---------------------------- */
    var notif = card("Notifications", "What CarbonWise tells you about, and when.");
    notif.body.appendChild(row("Alert notifications",
      "Raise a notification the moment a room starts wasting energy.",
      toggle(st.settings.notifyAlerts, function (on) { st.settings.notifyAlerts = on; S.commit("settings"); return true; })));
    notif.body.appendChild(row("Daily summary",
      "A consumption and carbon summary at the end of each day.",
      toggle(st.settings.notifyDaily, function (on) { st.settings.notifyDaily = on; S.commit("settings"); return true; })));
    notif.body.appendChild(row("Weekly report",
      "A full report emailed every Monday morning.",
      toggle(st.settings.notifyWeekly, function (on) { st.settings.notifyWeekly = on; S.commit("settings"); return true; })));
    body.appendChild(notif.card);

    /* ---------------------------- tariff ---------------------------- */
    var energy = card("Energy and carbon", "Used to convert kilowatt-hours into cost and emissions.");
    var fGrid = UI.field({
      label: "Grid emission factor (kg CO2 per kWh)", type: "number", value: st.settings.gridFactor,
      hint: "Peninsular Malaysia is about 0.585. Check your supplier for the current figure."
    });
    fGrid.style.maxWidth = "380px";
    fGrid.input.step = "0.001";
    fGrid.input.addEventListener("change", function () {
      var v = parseFloat(fGrid.input.value);
      if (isNaN(v) || v <= 0 || v > 2) { UI.setError(fGrid, "Enter a value between 0 and 2."); return; }
      UI.setError(fGrid, "");
      st.settings.gridFactor = v;
      st.totals.savedCo2 = U.round(st.totals.savedKwh * v, 2);
      S.commit("settings");
      UI.toast({ type: "ok", title: "Emission factor updated" });
    });
    var fTariff = UI.field({
      label: "Electricity tariff per kWh", type: "number", value: st.settings.tariff,
      hint: "Used for the cost figures in reports."
    });
    fTariff.style.maxWidth = "380px";
    fTariff.input.step = "0.01";
    fTariff.input.addEventListener("change", function () {
      var v = parseFloat(fTariff.input.value);
      if (isNaN(v) || v < 0) { UI.setError(fTariff, "Enter a positive number."); return; }
      UI.setError(fTariff, "");
      st.settings.tariff = v;
      S.commit("settings");
      UI.toast({ type: "ok", title: "Tariff updated" });
    });
    var fCur = UI.field({
      label: "Currency", type: "select", value: st.settings.currency,
      options: [{ value: "RM", label: "RM - Malaysian ringgit" }, { value: "$", label: "$ - US dollar" },
                { value: "S$", label: "S$ - Singapore dollar" }, { value: "GBP", label: "GBP - Pound sterling" }]
    });
    fCur.style.maxWidth = "380px";
    fCur.input.addEventListener("change", function () {
      st.settings.currency = fCur.input.value;
      S.commit("settings");
      UI.toast({ type: "ok", title: "Currency updated" });
    });
    [fGrid, fTariff, fCur].forEach(function (f) {
      var w = U.el("div", { class: "setrow" });
      w.style.display = "block";
      w.appendChild(f);
      energy.body.appendChild(w);
    });
    body.appendChild(energy.card);

    /* ---------------------------- appearance ---------------------------- */
    var appear = card("Appearance", "How CarbonWise looks on this device.");
    appear.body.appendChild(row(
      "Theme",
      "System follows your device setting. Dark mode uses its own validated palette, not an inverted copy of the light one. " +
        "The same switcher sits in the sidebar and on every page.",
      UI.themeSwitcher({ withLabels: true })
    ));
    body.appendChild(appear.card);

    /* ---------------------------- data ---------------------------- */
    var data = card("Data", "This prototype keeps everything in your browser.");
    data.body.appendChild(row("Live simulation",
      "Drives motion events, automatic shut-off and energy accumulation. Pause it to freeze the building.",
      toggle(st.settings.simulation, function (on) {
        st.settings.simulation = on;
        S.commit("settings");
        if (on) CW.sim.start(); else CW.sim.stop();
        UI.toast({ type: "info", title: on ? "Simulation running" : "Simulation paused" });
        return true;
      })));

    data.body.appendChild(row("Export everything",
      "Download the full application state as JSON, including rooms, events and reports.",
      (function () {
        var b = U.el("button", { class: "btn btn--sm", type: "button", html: U.icon("download", 15) + "Export JSON" });
        b.addEventListener("click", function () {
          U.downloadFile("carbonwise-state-" + U.isoDate(new Date()) + ".json",
            JSON.stringify(st, null, 2), "application/json");
          UI.toast({ type: "ok", title: "State exported" });
        });
        return b;
      })()));

    data.body.appendChild(row("Rebuild building data",
      "Regenerates rooms and history from your current settings. Reports are kept.",
      (function () {
        var b = U.el("button", { class: "btn btn--sm", type: "button", html: U.icon("refresh", 15) + "Rebuild" });
        b.addEventListener("click", function () {
          UI.confirm({
            title: "Rebuild building data?",
            msg: "Rooms, readings and the event log are regenerated. Saved reports are kept.",
            confirmLabel: "Rebuild"
          }).then(function (yes) {
            if (!yes) return;
            S.seedBuilding();
            CW.sim.start();
            UI.toast({ type: "ok", title: "Building rebuilt" });
            CW.app.render();
          });
        });
        return b;
      })()));

    data.body.appendChild(row("Reset everything",
      "Deletes your account, building, reports and settings from this browser.",
      (function () {
        var b = U.el("button", { class: "btn btn--sm btn--danger", type: "button", html: U.icon("trash", 15) + "Reset" });
        b.addEventListener("click", function () {
          UI.confirm({
            title: "Reset CarbonWise?",
            msg: "Everything is deleted and you are returned to the landing page. This cannot be undone.",
            confirmLabel: "Delete everything", danger: true
          }).then(function (yes) {
            if (!yes) return;
            CW.sim.stop();
            V._resetOnboarding();
            S.reset();
            CW.app.go("/");
            UI.toast({ type: "info", title: "CarbonWise has been reset" });
          });
        });
        return b;
      })()));
    body.appendChild(data.card);
  };

  function changeRoomCount() {
    var st = S.state;
    var f = UI.field({
      label: "Number of rooms", type: "number", value: st.onboarding.roomCount,
      min: 1, max: 120, hint: "Between 1 and 120."
    });
    UI.modal({
      title: "Change room count",
      sub: "This rebuilds the room list and regenerates history. Saved reports are kept.",
      body: f,
      actions: [
        { label: "Cancel" },
        { label: "Rebuild rooms", variant: "btn--primary", onClick: function () {
          var n = parseInt(f.input.value, 10);
          if (!n || n < 1 || n > 120) { UI.setError(f, "Enter a number between 1 and 120."); return false; }
          st.onboarding.roomCount = n;
          S.seedBuilding();
          CW.sim.start();
          UI.toast({ type: "ok", title: "Now monitoring " + n + " rooms" });
          CW.app.render();
        } }
      ]
    });
  }

  function card(title, sub) {
    var c = U.el("article", { class: "card" });
    c.innerHTML = '<div class="card__head"><div><div class="card__title">' + U.esc(title) + "</div>" +
      '<div class="card__sub">' + U.esc(sub) + "</div></div></div>";
    var b = U.el("div", { class: "card__body", style: "padding-top:4px;padding-bottom:8px" });
    c.appendChild(b);
    return { card: c, body: b };
  }

  function row(title, sub, control) {
    var r = U.el("div", { class: "setrow" });
    r.innerHTML = '<div><div class="setrow__title">' + U.esc(title) + "</div>" +
      '<div class="setrow__sub">' + U.esc(sub) + "</div></div>";
    var c = U.el("div", { class: "setrow__control" });
    c.appendChild(control);
    r.appendChild(c);
    return r;
  }

  /* A switch whose handler may veto the change by returning false. */
  function toggle(on, onChange, disabled) {
    var sw = U.el("label", { class: "switch" });
    sw.innerHTML = '<input type="checkbox"' + (on ? " checked" : "") + (disabled ? " disabled" : "") +
      '><span class="switch__track"></span>';
    var input = U.qs("input", sw);
    input.addEventListener("change", function () {
      if (onChange(input.checked) === false) input.checked = !input.checked;
    });
    return sw;
  }

  /* ======================================================================
     Profile
     ====================================================================== */
  V.profile = function (view, ctx) {
    var st = S.state;
    var acc = st.account || {};

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Profile</h1>' +
          '<p class="page-head__sub">Your account and recent actions.</p>' +
        "</div>" +
      "</header>" +
      '<div class="grid grid--main" style="max-width:1040px">' +
        "<div style=\"display:grid;gap:16px\">" +
          '<article class="card card--pad">' +
            '<div class="u-row u-gap-16 u-wrap">' +
              '<span class="avatar avatar--lg">' + U.esc(U.initials(acc.name)) + "</span>" +
              "<div class=\"u-grow\">" +
                '<div class="u-semi" style="font-size:1.25rem">' + U.esc(acc.name || "Manager") + "</div>" +
                '<div class="u-sm u-muted">' + U.esc(acc.email || "") + "</div>" +
                '<div class="u-row u-gap-8 u-mt-8 u-wrap">' +
                  '<span class="badge badge--blue">' + U.icon("shield", 12) + U.esc(acc.role || "Building Manager") + "</span>" +
                  (acc.verified ? '<span class="badge badge--ok">' + U.icon("checkCircle", 12) + "Verified</span>"
                                : '<span class="badge badge--warn">' + U.icon("alert", 12) + "Unverified</span>") +
                "</div>" +
              "</div>" +
              '<button class="btn btn--sm" type="button" id="pfEdit">' + U.icon("user", 15) + "Edit profile</button>" +
            "</div>" +
            '<hr class="divider u-mt-20 u-mb-16">' +
            '<div class="grid grid--2" style="gap:12px">' +
              info("Building", st.onboarding.buildingName || "Not set") +
              info("Rooms managed", String(st.rooms.length)) +
              info("Member since", acc.createdAt ? U.fullDate(acc.createdAt) : "--") +
              info("Sign-in method", acc.via === "google" ? "Google" : "Email and password") +
            "</div>" +
          "</article>" +

          '<article class="card">' +
            '<div class="card__head"><div><div class="card__title">Security</div>' +
            '<div class="card__sub">Keep access to your building dashboard under control.</div></div></div>' +
            '<div class="card__body" style="padding-top:4px" id="pfSec"></div>' +
          "</article>" +

          '<article class="card">' +
            '<div class="card__head"><div><div class="card__title">Your recent actions</div>' +
            '<div class="card__sub">Manual switching and overrides you have made</div></div></div>' +
            '<div class="card__body" style="padding-top:14px"><div class="timeline" id="pfFeed"></div></div>' +
          "</article>" +
        "</div>" +

        "<div style=\"display:grid;gap:16px\">" +
          '<article class="card card--pad">' +
            '<div class="card__title u-mb-12">Impact so far</div>' +
            '<div id="pfImpact"></div>' +
          "</article>" +
          '<article class="card card--pad">' +
            '<div class="card__title u-mb-8">Need to step away?</div>' +
            '<p class="u-sm u-muted u-mb-16">Logging out keeps your building data saved in this browser.</p>' +
            '<button class="btn btn--block" type="button" id="pfOut">' + U.icon("logout", 17) + "Log out</button>" +
          "</article>" +
        "</div>" +
      "</div>";

    var sec = U.qs("#pfSec", view);
    sec.appendChild(row("Password", "Last changed when the account was created.",
      (function () {
        var b = U.el("button", { class: "btn btn--sm", type: "button", html: U.icon("key", 15) + "Change" });
        b.addEventListener("click", changePassword);
        return b;
      })()));
    sec.appendChild(row("Email address", acc.email || "",
      (function () {
        var b = U.el("button", { class: "btn btn--sm", type: "button" }, "Update");
        b.addEventListener("click", function () {
          var f = UI.field({ label: "Email address", type: "email", icon: "mail", value: acc.email });
          UI.modal({
            title: "Update email address", body: f,
            actions: [{ label: "Cancel" }, { label: "Save", variant: "btn--primary", onClick: function () {
              var v = f.input.value.trim().toLowerCase();
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { UI.setError(f, "Enter a valid email address."); return false; }
              st.account.email = v;
              S.commit("profile");
              UI.toast({ type: "ok", title: "Email updated" });
              CW.app.render(true);
            } }]
          });
        });
        return b;
      })()));

    function paintImpact() {
      var host = U.qs("#pfImpact", view);
      host.innerHTML =
        kv("Carbon saved", U.fmtCo2(st.totals.savedCo2) + " kg CO2") +
        kv("Energy avoided", U.fmtKwh(st.totals.savedKwh) + " kWh") +
        kv("Automatic shut-offs", U.fmt(st.totals.autoActions)) +
        kv("Cost avoided", U.fmtMoney(st.totals.savedKwh * st.settings.tariff, st.settings.currency)) +
        kv("Rooms in alert now", String(S.alertRooms().length));
    }

    function paintFeed() {
      var feed = U.qs("#pfFeed", view);
      var items = st.events.filter(function (e) { return /Manager/.test(e.text); }).slice(0, 10);
      feed.innerHTML = "";
      if (!items.length) {
        feed.innerHTML = '<p class="u-sm u-dim">No manual actions recorded yet.</p>';
        return;
      }
      items.forEach(function (ev) {
        feed.appendChild(U.el("div", { class: "timeline__item", html:
          '<span class="timeline__dot timeline__dot--blue"></span>' +
          '<div class="timeline__time">' + U.hhmm(ev.ts) + " &middot; " + U.timeAgo(ev.ts) + "</div>" +
          '<div class="timeline__text">' + U.esc(ev.text) + "</div>"
        }));
      });
    }

    U.qs("#pfEdit", view).addEventListener("click", function () {
      var fn = UI.field({ label: "Full name", icon: "user", value: acc.name });
      var fr = UI.field({
        label: "Role", type: "select", value: acc.role,
        options: ["Building Manager", "Facilities Supervisor", "Energy Officer", "Warden", "Administrator"]
          .map(function (r) { return { value: r, label: r }; })
      });
      UI.modal({
        title: "Edit profile",
        body: (function () { var d = U.el("div", { style: "display:grid;gap:16px" }); d.appendChild(fn); d.appendChild(fr); return d; })(),
        actions: [{ label: "Cancel" }, { label: "Save changes", variant: "btn--primary", onClick: function () {
          var v = fn.input.value.trim();
          if (v.length < 2) { UI.setError(fn, "Enter your full name."); return false; }
          st.account.name = v;
          st.account.role = fr.input.value;
          S.commit("profile");
          UI.toast({ type: "ok", title: "Profile updated" });
          CW.app.render(true);
        } }]
      });
    });

    U.qs("#pfOut", view).addEventListener("click", CW.app.logout);

    paintImpact();
    paintFeed();
    ctx.setRefresher(function () { paintImpact(); paintFeed(); });
  };

  function changePassword() {
    var f1 = UI.field({ label: "New password", type: "password", icon: "lock", toggle: true, placeholder: "At least 8 characters" });
    var f2 = UI.field({ label: "Confirm new password", type: "password", icon: "lock", toggle: true });
    var box = U.el("div", { style: "display:grid;gap:16px" });
    box.appendChild(f1); box.appendChild(f2);
    UI.modal({
      title: "Change password",
      sub: "This prototype stores credentials in your browser only.",
      body: box,
      actions: [{ label: "Cancel" }, { label: "Update password", variant: "btn--primary", onClick: function () {
        if (f1.input.value.length < 8) { UI.setError(f1, "Use at least 8 characters."); return false; }
        if (f1.input.value !== f2.input.value) { UI.setError(f2, "Passwords do not match."); return false; }
        var h = 5381, s = f1.input.value;
        for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
        S.state.account.pw = "h" + h.toString(36);
        S.commit("password");
        UI.toast({ type: "ok", title: "Password updated" });
      } }]
    });
  }

  function info(k, v) {
    return '<div class="card card--sunk" style="padding:12px 14px">' +
      '<div class="u-xs u-dim">' + U.esc(k) + "</div>" +
      '<div class="u-sm u-semi u-mt-4">' + U.esc(v) + "</div></div>";
  }
  function kv(k, v) {
    return '<div class="kv"><span class="kv__k">' + U.esc(k) + '</span><span class="kv__v">' + U.esc(v) + "</span></div>";
  }

  /* ======================================================================
     Manual Override
     ====================================================================== */
  var DURATIONS = [
    { value: 30, label: "30 minutes" }, { value: 60, label: "1 hour" },
    { value: 120, label: "2 hours" }, { value: 240, label: "4 hours" },
    { value: 480, label: "8 hours" }, { value: -1, label: "Until midnight" }
  ];

  function untilFrom(mins) {
    if (mins > 0) return Date.now() + mins * 60000;
    var d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }

  V.openOverrideDialog = function (room, onDone) {
    var active = room.override && room.override.until > Date.now();
    var fDur = UI.field({
      label: "Hold for", type: "select", value: "120",
      options: DURATIONS.map(function (d) { return { value: String(d.value), label: d.label }; })
    });
    var fWhy = UI.field({
      label: "Reason", type: "select", value: "Cleaning in progress",
      options: ["Cleaning in progress", "Maintenance work", "Room inspection", "Resident request",
        "Faulty motion sensor", "Event or function", "Other"].map(function (r) { return { value: r, label: r }; })
    });
    var box = U.el("div", { style: "display:grid;gap:16px" });
    box.appendChild(U.el("div", { class: "callout callout--info" }, [
      U.el("span", { class: "callout__icon", html: U.icon("override", 18) }),
      U.el("span", { class: "callout__text",
        text: "While an override is active, CarbonWise will not switch anything off in " + room.name +
          ". The room still reports motion and consumption, and still appears in reports." })
    ]));
    box.appendChild(fDur);
    box.appendChild(fWhy);

    var actions = [{ label: "Cancel" }];
    if (active) {
      actions.push({ label: "Release override", variant: "btn--danger", onClick: function () {
        room.override = null;
        S.logEvent("info", room.id, "Manager released manual override on " + room.name);
        S.commit("override");
        UI.toast({ type: "info", title: "Override released", msg: room.name });
        if (onDone) onDone();
      } });
    }
    actions.push({ label: active ? "Update override" : "Hold automation", variant: "btn--primary", onClick: function () {
      var mins = parseInt(fDur.input.value, 10);
      room.override = {
        until: untilFrom(mins),
        by: (S.state.account && S.state.account.name) || "Manager",
        note: fWhy.input.value
      };
      S.logEvent("warn", room.id,
        "Manager held automation on " + room.name + " (" + fWhy.input.value + ")");
      S.commit("override");
      UI.toast({ type: "info", title: "Automation held", msg: room.name + " until " + U.hhmm(room.override.until) });
      if (onDone) onDone();
    } });

    UI.modal({
      title: active ? "Manage override" : "Hold automation",
      sub: room.name + " · Block " + room.block + " · Level " + room.floor,
      body: box,
      actions: actions
    });
  };

  V.override = function (view, ctx) {
    var st = S.state;

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Manual Override</h1>' +
          '<p class="page-head__sub">Hold automation in rooms where devices must stay on.</p>' +
        "</div>" +
        '<div class="page-head__actions">' +
          '<button class="btn btn--primary" type="button" id="ovNew">' + U.icon("plus", 17) + "New override</button>" +
        "</div>" +
      "</header>" +

      '<div class="callout callout--warn u-mb-20">' +
        '<span class="callout__icon">' + U.icon("info", 18) + "</span>" +
        '<span class="callout__text"><strong>Overrides pause automatic shut-off only.</strong> ' +
          "A room under override still reports motion, still accumulates consumption and still appears in reports. " +
          "It will not raise an alert, because the devices are on deliberately.</span>" +
      "</div>" +

      '<div class="grid grid--stats" id="ovStats"></div>' +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Active overrides</h2>' +
            '<p class="section__sub" id="ovCount"></p>' +
          "</div>" +
          '<button class="btn btn--sm btn--ghost" type="button" id="ovClear">' + U.icon("refresh", 15) + "Release all</button>" +
        "</div>" +
        '<article class="card"><div id="ovList"></div></article>' +
      "</section>" +

      '<section class="section">' +
        '<div class="section__head"><div>' +
          '<h2 class="section__title">Override history</h2>' +
          '<p class="section__sub">Every hold and release, newest first.</p>' +
        "</div></div>" +
        '<article class="card"><div class="card__body"><div class="timeline" id="ovFeed"></div></div></article>' +
      "</section>";

    function paint() {
      var active = S.overriddenRooms();

      var stats = U.qs("#ovStats", view);
      stats.innerHTML = "";
      stats.appendChild(UI.statTile({
        label: "Active overrides", value: U.fmt(active.length), icon: "override", tone: active.length ? "warn" : "ink",
        foot: active.length ? "automation paused" : "automation fully in control"
      }));
      stats.appendChild(UI.statTile({
        label: "Load under override", value: U.fmt(active.reduce(function (s, r) { return s + S.roomLoadKw(r); }, 0), 2),
        unit: "kW", icon: "zap", tone: "blue", foot: "held on deliberately"
      }));
      stats.appendChild(UI.statTile({
        label: "Rooms in alert", value: U.fmt(S.alertRooms().length), icon: "alert",
        tone: S.alertRooms().length ? "crit" : "ink", foot: "not under override"
      }));
      stats.appendChild(UI.statTile({
        label: "Automatic shut-offs", value: U.fmt(st.totals.autoActions), icon: "shield", tone: "green",
        foot: "since monitoring began"
      }));

      U.qs("#ovCount", view).textContent = active.length
        ? active.length + (active.length === 1 ? " room is" : " rooms are") + " holding automation"
        : "No rooms are currently overridden";
      U.qs("#ovClear", view).style.display = active.length ? "" : "none";

      var host = U.qs("#ovList", view);
      host.innerHTML = "";
      if (!active.length) {
        host.appendChild(UI.emptyState("shield", "Automation is fully in control",
          "No room is overriding automatic shut-off right now.", {
            label: "Create an override", onClick: openPicker
          }));
      } else {
        active.forEach(function (r) {
          var mins = (r.override.until - Date.now()) / 60000;
          var row = U.el("div", { class: "alertrow" });
          row.innerHTML =
            '<span class="alertrow__icon" style="background:var(--blue-soft);color:var(--blue-ink)">' +
              U.icon("override", 17) + "</span>" +
            '<span class="u-grow"><span class="alertrow__title">' + U.esc(r.name) + " &middot; Block " + U.esc(r.block) + "</span><br>" +
            '<span class="alertrow__sub">' + U.esc(r.override.note) + " &middot; set by " + U.esc(r.override.by) +
              " &middot; " + S.devicesOn(r).length + " device(s) on &middot; " +
              U.fmt(S.roomLoadKw(r), 2) + " kW</span></span>" +
            '<span class="u-right u-nowrap"><span class="u-sm u-semi u-tab">' + U.durationShort(mins) + "</span><br>" +
            '<span class="u-xs u-dim">until ' + U.hhmm(r.override.until) + "</span></span>";
          var acts = U.el("div", { class: "u-row u-gap-6" });
          var edit = U.el("button", { class: "btn btn--xs", type: "button" }, "Edit");
          edit.addEventListener("click", function () { V.openOverrideDialog(r, paint); });
          var rel = U.el("button", { class: "btn btn--xs", type: "button" }, "Release");
          rel.addEventListener("click", function () {
            r.override = null;
            S.logEvent("info", r.id, "Manager released manual override on " + r.name);
            S.commit("override");
            UI.toast({ type: "info", title: "Override released", msg: r.name });
            paint();
          });
          acts.appendChild(edit); acts.appendChild(rel);
          row.appendChild(acts);
          host.appendChild(row);
        });
      }

      var feed = U.qs("#ovFeed", view);
      var items = st.events.filter(function (e) { return /override|held automation/i.test(e.text); }).slice(0, 12);
      feed.innerHTML = "";
      if (!items.length) {
        feed.innerHTML = '<p class="u-sm u-dim">No overrides have been set yet.</p>';
      } else {
        items.forEach(function (ev) {
          feed.appendChild(U.el("div", { class: "timeline__item", html:
            '<span class="timeline__dot timeline__dot--' + (ev.severity === "warn" ? "crit" : "blue") + '"></span>' +
            '<div class="timeline__time">' + U.hhmm(ev.ts) + " &middot; " + U.timeAgo(ev.ts) + "</div>" +
            '<div class="timeline__text">' + U.esc(ev.text) + "</div>"
          }));
        });
      }
    }

    function openPicker() {
      var box = U.el("div");
      var search = UI.field({ label: "Find a room", icon: "search", placeholder: "Room number or block" });
      box.appendChild(search);
      var list = U.el("div", {
        class: "u-mt-16",
        style: "max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:var(--r-md)"
      });
      box.appendChild(list);

      function paintList() {
        var q = search.input.value.trim().toLowerCase();
        var rooms = st.rooms.filter(function (r) {
          if (r.override && r.override.until > Date.now()) return false;
          return !q || r.name.toLowerCase().indexOf(q) > -1 || ("block " + r.block).toLowerCase().indexOf(q) > -1;
        }).slice(0, 60);
        list.innerHTML = "";
        if (!rooms.length) {
          list.appendChild(U.el("p", { class: "u-sm u-dim u-center", style: "padding:24px", text: "No matching rooms." }));
          return;
        }
        rooms.forEach(function (r) {
          var meta = UI.statusMeta(S.roomStatus(r));
          var b = U.el("button", { class: "devrow u-full", type: "button", style: "text-align:left;cursor:pointer" });
          b.innerHTML =
            '<span class="u-row u-gap-10"><span class="sdot sdot--' + meta.cls + '"></span>' +
            "<span><span class=\"u-sm u-med\">" + U.esc(r.name) + "</span>" +
            '<br><span class="u-xs u-dim">Block ' + U.esc(r.block) + " &middot; " + meta.label + "</span></span></span>" +
            '<span class="u-row u-gap-4 u-xs u-dim">Select' + U.icon("chevronRight", 13) + "</span>";
          b.addEventListener("click", function () {
            m.close();
            V.openOverrideDialog(r, paint);
          });
          list.appendChild(b);
        });
      }
      search.input.addEventListener("input", U.debounce(paintList, 140));
      paintList();

      var m = UI.modal({
        title: "New manual override",
        sub: "Pick the room whose automation you want to hold.",
        body: box,
        actions: [{ label: "Close" }]
      });
    }

    U.qs("#ovNew", view).addEventListener("click", openPicker);
    U.qs("#ovClear", view).addEventListener("click", function () {
      var active = S.overriddenRooms();
      UI.confirm({
        title: "Release all overrides?",
        msg: active.length + " " + (active.length === 1 ? "room returns" : "rooms return") + " to automatic control.",
        confirmLabel: "Release all"
      }).then(function (yes) {
        if (!yes) return;
        active.forEach(function (r) { r.override = null; });
        S.logEvent("info", null, "Manager released " + active.length + " manual overrides");
        S.commit("override");
        UI.toast({ type: "info", title: "All overrides released" });
        paint();
      });
    });

    paint();
    ctx.setRefresher(paint);
  };
})(window, document);
