/* ==========================================================================
   CarbonWise - Dashboard
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store, C = CW.charts;
  var V = CW.views;

  var range = "today";

  V.dashboard = function (view, ctx) {
    var st = S.state;
    var acc = st.account || {};
    var first = (acc.name || "there").split(" ")[0];

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title display" style="font-size:1.875rem">' +
            U.greeting() + ", " + U.esc(first) + "." +
          "</h1>" +
          '<p class="page-head__sub">Here is your building&rsquo;s energy overview.</p>' +
        "</div>" +
        '<div class="page-head__actions">' +
          '<span class="badge badge--live" id="dbLive"><span class="badge__dot"></span>Live</span>' +
          '<span class="badge">' + U.icon("building", 12) + U.esc(st.onboarding.buildingName || "Building") + "</span>" +
          '<a class="btn btn--sm" href="#/reports">' + U.icon("reports", 15) + "Generate report</a>" +
        "</div>" +
      "</header>" +

      '<div class="grid grid--stats" id="dbStats"></div>' +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Energy overview</h2>' +
            '<p class="section__sub">Consumption and carbon for the selected period, against the period before it.</p>' +
          "</div>" +
          '<div class="seg" role="tablist" aria-label="Time range" id="dbRange">' +
            seg("today", "Today") + seg("week", "This Week") + seg("month", "This Month") +
          "</div>" +
        "</div>" +
        '<div class="grid grid--half">' +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Energy Usage</div>' +
              '<div class="card__sub" id="dbEnergySub">&nbsp;</div></div>' +
              '<div class="u-right"><div class="u-semi u-tab" style="font-size:1.25rem" id="dbEnergyTotal">0</div>' +
              '<div class="u-xs u-dim">kWh total</div></div>' +
            "</div>" +
            '<div class="card__body"><div id="dbEnergyChart"></div></div>' +
          "</article>" +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Carbon Emissions</div>' +
              '<div class="card__sub" id="dbCarbonSub">&nbsp;</div></div>' +
              '<div class="u-right"><div class="u-semi u-tab" style="font-size:1.25rem" id="dbCarbonTotal">0</div>' +
              '<div class="u-xs u-dim">kg CO2</div></div>' +
            "</div>" +
            '<div class="card__body"><div id="dbCarbonChart"></div></div>' +
          "</article>" +
        "</div>" +
      "</section>" +

      '<section class="section">' +
        '<div class="grid grid--main">' +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Room Status</div>' +
              '<div class="card__sub">Across ' + st.rooms.length + " monitored rooms</div></div>" +
              '<a class="btn btn--sm" href="#/rooms">View All Rooms' + U.icon("arrowRight", 15) + "</a>" +
            "</div>" +
            '<div class="card__body">' +
              '<div class="statusbar" id="dbStatusBar"></div>' +
              '<div class="grid grid--3up u-mt-20" id="dbStatusCounts" style="gap:12px"></div>' +
              '<div class="callout callout--crit u-mt-20">' +
                '<span class="callout__icon">' + U.icon("alert", 18) + "</span>" +
                '<span class="callout__text"><strong>What counts as an alert?</strong> ' +
                  "Devices are ON but no motion has been detected for an extended period " +
                  "(currently " + st.settings.idleThreshold + " minutes). " +
                  "These rooms are spending energy on nobody.</span>" +
              "</div>" +
            "</div>" +
            '<div class="card__head card__head--plain" style="padding-top:4px">' +
              '<div class="card__title" style="font-size:.875rem">Rooms needing attention</div>' +
              '<span class="u-xs u-dim" id="dbAlertCount"></span>' +
            "</div>" +
            '<div id="dbAlerts"></div>' +
          "</article>" +

          "<div style=\"display:grid;gap:16px\">" +
            '<article class="card">' +
              '<div class="card__head">' +
                '<div><div class="card__title">Device Activity</div>' +
                '<div class="card__sub">Devices currently switched on</div></div>' +
              "</div>" +
              '<div class="card__body" id="dbDevices"></div>' +
              '<div class="card__foot">' +
                '<a class="btn btn--sm btn--block" href="#/control">Open Quick Device Control' + U.icon("arrowRight", 15) + "</a>" +
              "</div>" +
            "</article>" +

            '<article class="card">' +
              '<div class="card__head">' +
                '<div><div class="card__title">Recent Activity</div>' +
                '<div class="card__sub">Automation and sensor events</div></div>' +
              "</div>" +
              '<div class="card__body" style="padding-top:14px"><div class="timeline" id="dbFeed"></div></div>' +
            "</article>" +
          "</div>" +
        "</div>" +
      "</section>";

    /* ---------------- stat tiles ---------------- */
    function paintStats() {
      var counts = S.statusCounts();
      var occupied = st.rooms.filter(function (r) { return r.occupied; }).length;
      var sum = CW.sim.summary("today");
      var s = CW.sim.series("today");

      var host = U.qs("#dbStats", view);
      host.innerHTML = "";
      host.appendChild(UI.statTile({
        label: "Total Rooms", value: U.fmt(st.rooms.length), icon: "rooms", tone: "ink",
        foot: st.onboarding.buildingName || "All blocks", anim: true
      }));
      host.appendChild(UI.statTile({
        label: "Occupied Rooms", value: U.fmt(occupied), icon: "users", tone: "warn",
        foot: U.fmt(U.pct(occupied, st.rooms.length), 0) + "% of the building", anim: true
      }));
      host.appendChild(UI.statTile({
        label: "Empty Rooms", value: U.fmt(st.rooms.length - occupied), icon: "monitor", tone: "ink",
        foot: counts.alert ? counts.alert + " still drawing power" : "None wasting energy", anim: true
      }));
      host.appendChild(UI.statTile({
        label: "Energy Usage", value: U.fmtKwh(sum.kwh), unit: "kWh", icon: "zap", tone: "blue",
        delta: sum.comparable ? sum.change : null, upIsGood: false,
        foot: sum.comparable ? "vs yesterday to this hour" : "today so far",
        spark: s.total, sparkColor: C.cssVar("--s-ac"), anim: true
      }));
      host.appendChild(UI.statTile({
        label: "Carbon Saved", value: U.fmtCo2(st.totals.savedCo2), unit: "kg CO2", icon: "leaf", tone: "green",
        foot: U.fmt(st.totals.autoActions) + " automatic shut-offs", anim: true
      }));
    }

    /* ---------------- charts ---------------- */
    var energyChart = null, carbonChart = null;

    function paintCharts() {
      var s = CW.sim.series(range);
      var sum = CW.sim.summary(range);
      var gf = st.settings.gridFactor;

      U.qs("#dbEnergyTotal", view).textContent = U.fmtKwh(sum.kwh);
      U.qs("#dbCarbonTotal", view).textContent = U.fmtCo2(sum.co2);

      /* Say exactly what the percentage compares, so a part-finished day is
         never presented as a drop in consumption. */
      var basis = range === "today" ? "yesterday to this hour" : "the " + s.prevLabel.toLowerCase() + ", completed days only";
      U.qs("#dbEnergySub", view).textContent = sum.comparable
        ? (sum.change >= 0 ? "Up " : "Down ") + U.fmt(Math.abs(sum.change), 1) + "% against " + basis
        : "No comparable period yet";
      U.qs("#dbCarbonSub", view).textContent =
        "At " + gf + " kg CO2 per kWh" + (sum.cost ? " · " + U.fmtMoney(sum.cost, st.settings.currency) : "");

      energyChart = C.lineChart(U.qs("#dbEnergyChart", view), {
        labels: s.labels, full: s.full, unit: "kWh", height: 220,
        xHeader: range === "today" ? "Hour" : "Day",
        ariaLabel: "Energy usage, " + range,
        series: [
          { key: "prev", label: s.prevLabel, values: s.prev, color: C.cssVar("--s-compare"), kind: "compare" },
          { key: "cur", label: "Current period", values: s.total, color: C.cssVar("--s-ac"), area: true, endLabel: true }
        ]
      });

      carbonChart = C.lineChart(U.qs("#dbCarbonChart", view), {
        labels: s.labels, full: s.full, unit: "kg", height: 220,
        xHeader: range === "today" ? "Hour" : "Day",
        ariaLabel: "Carbon emissions, " + range,
        series: [
          { key: "prevc", label: s.prevLabel, values: s.prev.map(function (v) { return v == null ? null : U.round(v * gf, 2); }),
            color: C.cssVar("--s-compare"), kind: "compare" },
          { key: "co2", label: "Emitted", values: s.total.map(function (v) { return v == null ? null : U.round(v * gf, 2); }),
            color: C.cssVar("--s-fan"), area: true, endLabel: true }
        ]
      });
    }

    U.delegate(U.qs("#dbRange", view), "click", ".seg__btn", function (e, btn) {
      range = btn.dataset.range;
      U.qsa(".seg__btn", U.qs("#dbRange", view)).forEach(function (b) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      paintCharts();
    });

    /* ---------------- room status ---------------- */
    function paintStatus() {
      var c = S.statusCounts();
      var total = st.rooms.length || 1;
      var bar = U.qs("#dbStatusBar", view);
      bar.innerHTML = "";
      [["normal", c.normal, "--ok"], ["occupied", c.occupied, "--warn"], ["alert", c.alert, "--crit"]]
        .forEach(function (x) {
          if (!x[1]) return;
          bar.appendChild(U.el("div", {
            class: "statusbar__seg",
            style: "width:" + (x[1] / total) * 100 + "%;background:var(" + x[2] + ")",
            title: x[1] + " " + x[0]
          }));
        });

      var counts = U.qs("#dbStatusCounts", view);
      counts.innerHTML =
        statusCount("normal", c.normal, "Normal", "Empty and behaving") +
        statusCount("occupied", c.occupied, "Occupied", "Motion detected") +
        statusCount("alert", c.alert, "Alerts", "Running on nobody");

      var alerts = S.alertRooms();
      U.qs("#dbAlertCount", view).textContent = alerts.length
        ? alerts.length + (alerts.length === 1 ? " room" : " rooms")
        : "";
      var box = U.qs("#dbAlerts", view);
      box.innerHTML = "";
      if (!alerts.length) {
        box.appendChild(UI.emptyState("checkCircle", "Nothing is being wasted",
          "Every empty room has its devices switched off. CarbonWise will flag any that change."));
      } else {
        alerts.slice(0, 5).forEach(function (r) {
          var on = S.devicesOn(r);
          var row = U.el("a", { class: "alertrow", href: "#/rooms?room=" + r.id });
          row.innerHTML =
            '<span class="alertrow__icon">' + U.icon("alert", 17) + "</span>" +
            '<span class="u-grow"><span class="alertrow__title">' + U.esc(r.name) + " &middot; Block " + U.esc(r.block) + "</span><br>" +
            '<span class="alertrow__sub">No motion for ' + U.durationText(S.idleMinutes(r)) +
              " &middot; " + on.map(function (k) { return S.DEVICES[k].short; }).join(", ") + " still on</span></span>" +
            '<span class="u-right"><span class="u-sm u-semi u-tab" style="color:var(--crit-ink)">' +
              U.fmt(S.roomLoadKw(r), 2) + " kW</span><br>" +
            '<span class="u-xs u-dim">wasting now</span></span>';
          box.appendChild(row);
        });
        if (alerts.length > 5) {
          box.appendChild(U.el("a", {
            class: "alertrow u-center", href: "#/rooms",
            style: "justify-content:center;color:var(--blue-ink);font-weight:550;font-size:.8125rem"
          }, "View all " + alerts.length + " alerts"));
        }
      }
    }

    /* ---------------- device activity ---------------- */
    function paintDevices() {
      var counts = S.deviceCounts();
      var box = U.qs("#dbDevices", view);
      box.innerHTML = "";
      var any = false;
      S.DEVICE_KEYS.forEach(function (k) {
        if (!st.onboarding.devices[k]) return;
        any = true;
        var d = S.DEVICES[k];
        var n = counts[k];
        var total = st.rooms.length || 1;
        var row = U.el("div", { class: "u-mb-16" });
        row.innerHTML =
          '<div class="u-row-sb u-mb-8">' +
            '<span class="u-row u-gap-8 u-sm u-med">' +
              '<span style="color:var(' + d.series + ')">' + U.icon(d.icon, 16) + "</span>" + U.esc(d.label) +
            "</span>" +
            '<span class="u-sm u-semi u-tab">' + n + " ON</span>" +
          "</div>" +
          '<div class="meter"><div class="meter__fill" style="width:' + U.pct(n, total) + "%;background:var(" + d.series + ')"></div></div>' +
          '<div class="u-xs u-dim u-mt-4">' + U.fmt((n * d.watts) / 1000, 2) + " kW drawn right now</div>";
        box.appendChild(row);
      });
      if (!any) box.appendChild(U.el("p", { class: "u-sm u-dim", text: "No devices are being monitored." }));

      box.appendChild(U.el("div", { class: "kv u-mt-8" }, [
        U.el("span", { class: "kv__k", text: "Total live load" }),
        U.el("span", { class: "kv__v", text: U.fmt(S.liveLoadKw(), 2) + " kW" })
      ]));
      box.appendChild(U.el("div", { class: "kv" }, [
        U.el("span", { class: "kv__k", text: "Wasted right now" }),
        U.el("span", {
          class: "kv__v", style: S.wastedNowKw() > 0 ? "color:var(--crit-ink)" : "",
          text: U.fmt(S.wastedNowKw(), 2) + " kW"
        })
      ]));
    }

    /* ---------------- activity feed ---------------- */
    function paintFeed() {
      var feed = U.qs("#dbFeed", view);
      feed.innerHTML = "";
      var items = st.events.slice(0, 7);
      if (!items.length) {
        feed.innerHTML = '<p class="u-sm u-dim">No events recorded yet.</p>';
        return;
      }
      items.forEach(function (ev) {
        var tone = ev.severity === "crit" ? "crit" : ev.severity === "ok" ? "ok" : "blue";
        var node = U.el("div", { class: "timeline__item" });
        node.innerHTML =
          '<span class="timeline__dot timeline__dot--' + tone + '"></span>' +
          '<div class="timeline__time">' + U.hhmm(ev.ts) + " &middot; " + U.timeAgo(ev.ts) + "</div>" +
          '<div class="timeline__text">' + U.esc(ev.text) + "</div>";
        feed.appendChild(node);
      });
    }

    paintStats();
    paintCharts();
    paintStatus();
    paintDevices();
    paintFeed();

    /* Volatile pieces refresh on the simulation tick; the charts are left
       in place so a hovered crosshair is never yanked away. */
    var chartClock = 0;
    ctx.setRefresher(function () {
      paintStats();
      paintStatus();
      paintDevices();
      paintFeed();
      if (++chartClock % 10 === 0) paintCharts();
    });
  };

  function seg(key, label) {
    return '<button class="seg__btn" role="tab" type="button" data-range="' + key + '" aria-selected="' +
      (range === key ? "true" : "false") + '">' + label + "</button>";
  }

  function statusCount(kind, n, label, sub) {
    var meta = UI.statusMeta(kind);
    return '<div class="card card--sunk" style="padding:14px">' +
      '<div class="u-row u-gap-8"><span class="sdot sdot--' + meta.cls + '"></span>' +
      '<span class="u-semi u-tab" style="font-size:1.375rem">' + n + "</span></div>" +
      '<div class="u-sm u-med u-mt-4">' + label + "</div>" +
      '<div class="u-xs u-dim">' + sub + "</div></div>";
  }
})(window, document);
