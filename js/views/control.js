/* ==========================================================================
   CarbonWise - Quick Device Control
   Bulk actions at the top, then a per-room switchboard.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store;
  var V = CW.views;

  var scope = "all";     // all | on | alert | occupied
  var query = "";
  var blockFilter = "all";

  V.control = function (view, ctx) {
    var st = S.state;
    var blocks = [];
    st.rooms.forEach(function (r) { if (blocks.indexOf(r.block) < 0) blocks.push(r.block); });
    var enabled = S.DEVICE_KEYS.filter(function (k) { return st.onboarding.devices[k]; });

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Quick Device Control</h1>' +
          '<p class="page-head__sub">Switch devices directly, by room or across the whole building.</p>' +
        "</div>" +
        '<div class="page-head__actions">' +
          '<span class="badge" id="qcLoad"></span>' +
        "</div>" +
      "</header>" +

      '<div class="callout callout--info u-mb-20">' +
        '<span class="callout__icon">' + U.icon("info", 18) + "</span>" +
        '<span class="callout__text">Manual switching here does not disable automation. ' +
          "If a room stays empty past the idle threshold, CarbonWise will switch its authorised devices off again. " +
          'To hold a device on, set a <a href="#/override">manual override</a>.</span>' +
      "</div>" +

      '<div class="grid grid--3" id="qcMasters"></div>' +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Bulk actions</h2>' +
            '<p class="section__sub">Each action skips rooms under an active manual override.</p>' +
          "</div>" +
        "</div>" +
        '<div class="grid grid--3" id="qcBulk"></div>' +
      "</section>" +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Room switchboard</h2>' +
            '<p class="section__sub" id="qcCount"></p>' +
          "</div>" +
        "</div>" +
        '<div class="filterbar">' +
          '<div class="input-group" style="max-width:260px;flex:1;min-width:180px">' +
            '<span class="input-group__icon">' + U.icon("search", 17) + "</span>" +
            '<input class="input" type="search" id="qcSearch" placeholder="Search room..." aria-label="Search rooms">' +
          "</div>" +
          '<div class="u-row u-gap-8 u-wrap" id="qcChips" role="group" aria-label="Filter rooms"></div>' +
          '<span class="filterbar__spacer"></span>' +
          (blocks.length > 1 ?
            '<div class="select-wrap" style="width:130px"><select class="select" id="qcBlock" aria-label="Filter by block">' +
              '<option value="all">All blocks</option>' +
              blocks.map(function (b) { return '<option value="' + U.esc(b) + '">Block ' + U.esc(b) + "</option>"; }).join("") +
            "</select><span class=\"select-wrap__chev\">" + U.icon("chevronDown", 16) + "</span></div>" : "") +
        "</div>" +
        '<article class="card"><div id="qcRooms"></div></article>' +
      "</section>";

    /* ------------------------- master switches ------------------------- */
    function paintMasters() {
      var counts = S.deviceCounts();
      var host = U.qs("#qcMasters", view);
      host.innerHTML = "";
      enabled.forEach(function (k) {
        var d = S.DEVICES[k];
        var n = counts[k];
        var total = st.rooms.length;
        var card = U.el("article", { class: "card card--pad" });
        card.innerHTML =
          '<div class="u-row-sb u-mb-12">' +
            '<span class="u-row u-gap-10">' +
              '<span style="color:var(' + d.series + ')">' + U.icon(d.icon, 20) + "</span>" +
              '<span class="u-semi">' + U.esc(d.label) + "</span>" +
            "</span>" +
            '<span class="badge' + (n ? " badge--blue" : "") + '">' + n + " / " + total + " ON</span>" +
          "</div>" +
          '<div class="meter"><div class="meter__fill" style="width:' + U.pct(n, total || 1) +
            "%;background:var(" + d.series + ')"></div></div>' +
          '<div class="u-xs u-dim u-mt-8">' + U.fmt((n * d.watts) / 1000, 2) + " kW drawn right now</div>";
        var row = U.el("div", { class: "u-row u-gap-8 u-mt-16" });
        var allOn = U.el("button", { class: "btn btn--sm u-grow", type: "button" }, "All on");
        var allOff = U.el("button", { class: "btn btn--sm u-grow", type: "button" }, "All off");
        allOn.addEventListener("click", function () { masterSet(k, true); });
        allOff.addEventListener("click", function () { masterSet(k, false); });
        row.appendChild(allOn);
        row.appendChild(allOff);
        card.appendChild(row);
        host.appendChild(card);
      });
    }

    function masterSet(key, on) {
      var d = S.DEVICES[key];
      UI.confirm({
        title: "Switch " + (on ? "on" : "off") + " every " + d.short + "?",
        msg: "This applies to all " + st.rooms.length + " rooms. Rooms under a manual override are skipped.",
        confirmLabel: on ? "Switch all on" : "Switch all off",
        danger: on
      }).then(function (yes) {
        if (!yes) return;
        var n = 0;
        st.rooms.forEach(function (r) {
          if (r.override && r.override.until > Date.now()) return;
          if (r.devices[key].on === on) return;
          r.devices[key].on = on;
          r.devices[key].since = Date.now();
          if (on && r.autoOff) r.autoOff = r.autoOff.filter(function (x) { return x !== key; });
          n++;
        });
        S.logEvent(on ? "warn" : "ok", null,
          "Manager switched " + (on ? "ON" : "OFF") + " " + d.short + " in " + n + " rooms");
        S.commit("master");
        UI.toast({ type: on ? "warn" : "ok", title: n + " " + d.short + " units switched " + (on ? "on" : "off") });
        paintAll();
      });
    }

    /* ------------------------- bulk actions ------------------------- */
    function paintBulk() {
      var host = U.qs("#qcBulk", view);
      host.innerHTML = "";
      var empties = st.rooms.filter(function (r) { return !r.occupied && S.devicesOn(r).length; });
      var alerts = S.alertRooms();
      var overridden = S.overriddenRooms();

      host.appendChild(bulkCard("power", "green",
        "Switch off empty rooms",
        empties.length + " empty " + (empties.length === 1 ? "room has" : "rooms have") + " devices running.",
        "Switch off", !empties.length, function () {
          var n = 0;
          empties.forEach(function (r) {
            if (r.override && r.override.until > Date.now()) return;
            S.devicesOn(r).forEach(function (k) { r.devices[k].on = false; r.devices[k].since = Date.now(); n++; });
          });
          S.logEvent("ok", null, "Manager switched off " + n + " devices in empty rooms");
          S.commit("bulk");
          UI.toast({ type: "ok", title: n + " devices switched off" });
          paintAll();
        }));

      host.appendChild(bulkCard("alert", "crit",
        "Resolve all alerts",
        alerts.length ? alerts.length + " " + (alerts.length === 1 ? "room is" : "rooms are") + " drawing " +
          U.fmt(S.wastedNowKw(), 2) + " kW on nobody." : "No rooms are currently in alert.",
        "Resolve " + (alerts.length || ""), !alerts.length, function () {
          var n = 0;
          alerts.forEach(function (r) {
            S.devicesOn(r).forEach(function (k) { r.devices[k].on = false; r.devices[k].since = Date.now(); n++; });
          });
          S.logEvent("ok", null, "Manager resolved " + alerts.length + " alerts, " + n + " devices off");
          S.commit("bulk-alert");
          UI.toast({ type: "ok", title: "Alerts resolved", msg: n + " devices switched off" });
          paintAll();
        }));

      host.appendChild(bulkCard("refresh", "blue",
        "Release all overrides",
        overridden.length ? overridden.length + " " + (overridden.length === 1 ? "room is" : "rooms are") +
          " held under manual override." : "No manual overrides are active.",
        "Release", !overridden.length, function () {
          overridden.forEach(function (r) { r.override = null; });
          S.logEvent("info", null, "Manager released " + overridden.length + " manual overrides");
          S.commit("bulk-override");
          UI.toast({ type: "info", title: "Overrides released", msg: "Automation is back in control." });
          paintAll();
        }));
    }

    function bulkCard(icon, tone, title, text, btnLabel, disabled, onClick) {
      var card = U.el("article", { class: "card card--pad" });
      card.innerHTML =
        '<div class="feat__icon feat__icon--' + tone + '" style="width:34px;height:34px;margin-bottom:12px">' +
          U.icon(icon, 17) + "</div>" +
        '<div class="u-semi" style="font-size:.9375rem">' + U.esc(title) + "</div>" +
        '<p class="u-sm u-muted u-mt-4" style="min-height:40px">' + U.esc(text) + "</p>";
      var b = U.el("button", {
        class: "btn btn--sm btn--block u-mt-8" + (disabled ? "" : " btn--quiet"),
        type: "button", disabled: disabled
      }, btnLabel);
      b.addEventListener("click", onClick);
      card.appendChild(b);
      return card;
    }

    /* ------------------------- switchboard ------------------------- */
    function paintChips() {
      var on = st.rooms.filter(function (r) { return S.devicesOn(r).length; }).length;
      U.qs("#qcChips", view).innerHTML = [
        ["all", "All rooms", st.rooms.length],
        ["on", "Devices on", on],
        ["occupied", "Occupied", S.statusCounts().occupied],
        ["alert", "Alert", S.alertRooms().length]
      ].map(function (x) {
        return '<button class="chip" type="button" data-scope="' + x[0] + '" aria-pressed="' +
          (scope === x[0] ? "true" : "false") + '">' + x[1] + '<span class="chip__count">' + x[2] + "</span></button>";
      }).join("");
    }

    function visible() {
      return st.rooms.filter(function (r) {
        if (blockFilter !== "all" && r.block !== blockFilter) return false;
        if (scope === "on" && !S.devicesOn(r).length) return false;
        if (scope === "occupied" && !r.occupied) return false;
        if (scope === "alert" && S.roomStatus(r) !== "alert") return false;
        if (query && r.name.toLowerCase().indexOf(query.toLowerCase()) < 0 &&
            r.id.toLowerCase().indexOf(query.toLowerCase()) < 0) return false;
        return true;
      }).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
    }

    function paintRooms() {
      paintChips();
      var list = visible();
      U.qs("#qcCount", view).textContent =
        list.length + " of " + st.rooms.length + " rooms shown";
      var host = U.qs("#qcRooms", view);
      host.innerHTML = "";

      if (!list.length) {
        host.appendChild(UI.emptyState("search", "No rooms match", "Adjust the filters to see rooms here."));
        return;
      }

      list.forEach(function (r) {
        var status = S.roomStatus(r);
        var meta = UI.statusMeta(status);
        var overridden = r.override && r.override.until > Date.now();
        var row = U.el("div", { class: "devrow" });

        var left = U.el("div", { class: "u-row u-gap-12" });
        left.innerHTML =
          '<span class="sdot sdot--' + meta.cls + '" title="' + meta.label + '"></span>' +
          "<span><a class=\"u-sm u-semi\" href=\"#/rooms?room=" + U.esc(r.id) + '" style="color:var(--ink)">' +
            U.esc(r.name) + "</a>" +
            (overridden ? ' <span class="badge badge--blue">' + U.icon("override", 12) + "Held</span>" : "") +
            '<br><span class="u-xs u-dim">Block ' + U.esc(r.block) + " &middot; " + meta.label +
            (r.occupied ? "" : " &middot; idle " + U.durationShort(S.idleMinutes(r))) +
            " &middot; " + U.fmt(S.roomLoadKw(r), 2) + " kW</span></span>";
        row.appendChild(left);

        var toggles = U.el("div", { class: "devrow__toggles" });
        enabled.forEach(function (k) {
          var d = S.DEVICES[k];
          var cell = U.el("div", { class: "devtoggle" });
          cell.appendChild(U.el("span", { class: "devtoggle__lbl", text: d.short }));
          var sw = U.el("label", { class: "switch switch--sm", "aria-label": d.label + " in " + r.name });
          sw.innerHTML = '<input type="checkbox"' + (r.devices[k].on ? " checked" : "") + '><span class="switch__track"></span>';
          U.qs("input", sw).addEventListener("change", function () {
            V.toggleDevice(r, k);
            paintAll();
          });
          cell.appendChild(sw);
          toggles.appendChild(cell);
        });

        var off = U.el("button", {
          class: "btn btn--xs", type: "button",
          disabled: !S.devicesOn(r).length
        }, "All off");
        off.addEventListener("click", function () {
          S.devicesOn(r).forEach(function (k) { r.devices[k].on = false; r.devices[k].since = Date.now(); });
          S.logEvent("ok", r.id, "Manager switched off all devices in " + r.name);
          S.commit("room-off");
          paintAll();
        });
        toggles.appendChild(off);

        row.appendChild(toggles);
        host.appendChild(row);
      });
    }

    function paintAll() {
      paintMasters();
      paintBulk();
      paintRooms();
      U.qs("#qcLoad", view).innerHTML =
        U.icon("zap", 12) + U.fmt(S.liveLoadKw(), 2) + " kW live load";
    }

    U.delegate(U.qs("#qcChips", view), "click", ".chip", function (e, btn) {
      scope = btn.dataset.scope;
      paintRooms();
    });
    U.qs("#qcSearch", view).addEventListener("input", U.debounce(function (e) {
      query = e.target.value.trim(); paintRooms();
    }, 160));
    var bf = U.qs("#qcBlock", view);
    if (bf) bf.addEventListener("change", function (e) { blockFilter = e.target.value; paintRooms(); });

    paintAll();
    ctx.setRefresher(paintAll);
  };
})(window, document);
