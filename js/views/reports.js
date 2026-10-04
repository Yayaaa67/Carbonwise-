/* ==========================================================================
   CarbonWise - Reports
   Reports are snapshots: the rows are computed when you generate one, so a
   saved report keeps saying what it said on the day it was produced.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store;
  var V = CW.views;

  var TYPES = {
    energy: { label: "Energy consumption", icon: "zap", tone: "blue",
      desc: "Consumption per period, split by device type, with cost." },
    carbon: { label: "Carbon emissions", icon: "leaf", tone: "green",
      desc: "Emissions per period and carbon avoided by automatic shut-off." },
    alerts: { label: "Alerts and waste", icon: "alert", tone: "crit",
      desc: "Rooms flagged for running devices with no motion detected." },
    rooms: { label: "Room summary", icon: "rooms", tone: "blue",
      desc: "Every room with its status, devices and consumption today." }
  };

  var RANGES = { today: "Today", week: "This week", month: "This month" };

  V.reports = function (view, ctx) {
    var st = S.state;

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Reports</h1>' +
          '<p class="page-head__sub">Generate and export records for ' +
            U.esc(st.onboarding.buildingName || "your building") + ".</p>" +
        "</div>" +
        '<div class="page-head__actions">' +
          '<button class="btn btn--primary" type="button" id="rpNew">' + U.icon("plus", 17) + "Generate report</button>" +
        "</div>" +
      "</header>" +

      '<div class="grid grid--stats" id="rpStats"></div>' +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Report types</h2>' +
            '<p class="section__sub">Pick a type to generate it for the period you need.</p>' +
          "</div>" +
        "</div>" +
        '<div class="grid grid--3" id="rpTypes"></div>' +
      "</section>" +

      '<section class="section">' +
        '<div class="section__head">' +
          "<div>" +
            '<h2 class="section__title">Generated reports</h2>' +
            '<p class="section__sub" id="rpCount"></p>' +
          "</div>" +
          '<button class="btn btn--sm btn--ghost" type="button" id="rpClear">' + U.icon("trash", 15) + "Clear all</button>" +
        "</div>" +
        '<article class="card"><div id="rpList"></div></article>' +
      "</section>";

    function paintStats() {
      var today = CW.sim.summary("today");
      var week = CW.sim.summary("week");
      var host = U.qs("#rpStats", view);
      host.innerHTML = "";
      host.appendChild(UI.statTile({
        label: "Today so far", value: U.fmtKwh(today.kwh), unit: "kWh", icon: "zap", tone: "blue",
        delta: today.change, upIsGood: false, foot: "vs yesterday"
      }));
      host.appendChild(UI.statTile({
        label: "This week", value: U.fmtKwh(week.kwh), unit: "kWh", icon: "calendar", tone: "ink",
        delta: week.change, upIsGood: false, foot: "vs previous 7 days"
      }));
      host.appendChild(UI.statTile({
        label: "Carbon this week", value: U.fmtCo2(week.co2), unit: "kg CO2", icon: "leaf", tone: "green",
        foot: "at " + st.settings.gridFactor + " kg/kWh"
      }));
      host.appendChild(UI.statTile({
        label: "Reports saved", value: U.fmt(st.reports.length), icon: "reports", tone: "ink",
        foot: st.reports.length ? "Last " + U.timeAgo(st.reports[0].createdAt) : "None yet"
      }));
    }

    function paintTypes() {
      var host = U.qs("#rpTypes", view);
      host.innerHTML = "";
      Object.keys(TYPES).forEach(function (k) {
        var t = TYPES[k];
        var card = U.el("article", { class: "card card--pad" });
        card.innerHTML =
          '<div class="feat__icon feat__icon--' + t.tone + '" style="width:34px;height:34px;margin-bottom:12px">' +
            U.icon(t.icon, 17) + "</div>" +
          '<div class="u-semi" style="font-size:.9375rem">' + U.esc(t.label) + "</div>" +
          '<p class="u-sm u-muted u-mt-4" style="min-height:42px">' + U.esc(t.desc) + "</p>";
        var b = U.el("button", { class: "btn btn--sm btn--quiet btn--block u-mt-8", type: "button" }, "Generate");
        b.addEventListener("click", function () { openGenerate(k); });
        card.appendChild(b);
        host.appendChild(card);
      });
    }

    function paintList() {
      var host = U.qs("#rpList", view);
      host.innerHTML = "";
      U.qs("#rpCount", view).textContent = st.reports.length
        ? st.reports.length + (st.reports.length === 1 ? " report" : " reports") + " saved in this browser"
        : "No reports generated yet";
      U.qs("#rpClear", view).style.display = st.reports.length ? "" : "none";

      if (!st.reports.length) {
        host.appendChild(UI.emptyState("reports", "No reports yet",
          "Generate your first report to export consumption, carbon or alert records.", {
            label: "Generate report", onClick: function () { openGenerate("energy"); }
          }));
        return;
      }

      st.reports.forEach(function (rep) {
        var t = TYPES[rep.type] || TYPES.energy;
        var row = U.el("div", { class: "alertrow" });
        row.innerHTML =
          '<span class="alertrow__icon" style="background:var(--surface-2);color:var(--ink-2)">' +
            U.icon(t.icon, 17) + "</span>" +
          '<span class="u-grow"><span class="alertrow__title">' + U.esc(rep.name) + "</span><br>" +
          '<span class="alertrow__sub">' + U.esc(rep.summary) + " &middot; " +
            (rep.rows.length - 1) + " rows &middot; " + U.timeAgo(rep.createdAt) + "</span></span>";

        var actions = U.el("div", { class: "u-row u-gap-6" });
        var viewBtn = U.el("button", { class: "btn btn--xs", type: "button" }, "View");
        viewBtn.addEventListener("click", function () { preview(rep); });
        var dl = U.el("button", { class: "btn btn--xs", type: "button", "aria-label": "Download " + rep.name, html: U.icon("download", 13) });
        dl.addEventListener("click", function () {
          U.downloadFile(rep.file, U.toCsv(rep.rows), "text/csv");
          UI.toast({ type: "ok", title: "Report downloaded", msg: rep.file });
        });
        var del = U.el("button", { class: "btn btn--xs", type: "button", "aria-label": "Delete " + rep.name, html: U.icon("trash", 13) });
        del.addEventListener("click", function () {
          UI.confirm({ title: "Delete this report?", msg: rep.name, confirmLabel: "Delete", danger: true })
            .then(function (yes) {
              if (!yes) return;
              st.reports = st.reports.filter(function (x) { return x.id !== rep.id; });
              S.commit("report-delete");
              paintList(); paintStats();
              UI.toast({ type: "info", title: "Report deleted" });
            });
        });
        actions.appendChild(viewBtn); actions.appendChild(dl); actions.appendChild(del);
        row.appendChild(actions);
        host.appendChild(row);
      });
    }

    U.qs("#rpNew", view).addEventListener("click", function () { openGenerate("energy"); });
    U.qs("#rpClear", view).addEventListener("click", function () {
      UI.confirm({ title: "Clear all reports?", msg: "This removes every saved report from this browser.", confirmLabel: "Clear all", danger: true })
        .then(function (yes) {
          if (!yes) return;
          st.reports = [];
          S.commit("reports-clear");
          paintList(); paintStats();
          UI.toast({ type: "info", title: "All reports cleared" });
        });
    });

    /* ------------------------- generate ------------------------- */
    function openGenerate(preselect) {
      var body = U.el("div", { style: "display:grid;gap:16px" });

      var fType = UI.field({
        label: "Report type", type: "select", value: preselect,
        options: Object.keys(TYPES).map(function (k) { return { value: k, label: TYPES[k].label }; })
      });
      fType.input.value = preselect;
      var fRange = UI.field({
        label: "Period", type: "select", value: "week",
        options: Object.keys(RANGES).map(function (k) { return { value: k, label: RANGES[k] }; })
      });
      var fNote = UI.field({ label: "Note (optional)", placeholder: "For the monthly facilities meeting" });

      body.appendChild(fType);
      body.appendChild(fRange);
      body.appendChild(fNote);
      var hint = U.el("div", { class: "callout" }, [
        U.el("span", { class: "callout__icon", html: U.icon("info", 18) }),
        U.el("span", { class: "callout__text", text: TYPES[preselect].desc })
      ]);
      body.appendChild(hint);
      fType.input.addEventListener("change", function () {
        U.qs(".callout__text", hint).textContent = TYPES[fType.input.value].desc;
      });

      UI.modal({
        title: "Generate report",
        sub: "The report is a snapshot of the data at the moment you generate it.",
        body: body,
        actions: [
          { label: "Cancel" },
          { label: "Generate", variant: "btn--primary", onClick: function () {
            var rep = build(fType.input.value, fRange.input.value, fNote.input.value.trim());
            st.reports.unshift(rep);
            if (st.reports.length > 40) st.reports.length = 40;
            S.commit("report");
            paintList(); paintStats();
            UI.toast({ type: "ok", title: "Report generated", msg: rep.name });
            preview(rep);
          } }
        ]
      });
    }

    function build(type, range, note) {
      var s = CW.sim.series(range);
      var sum = CW.sim.summary(range);
      var gf = st.settings.gridFactor, tariff = st.settings.tariff, cur = st.settings.currency;
      var rows = [];
      var summary = "";

      if (type === "energy") {
        rows.push(["Period", "AC (kWh)", "Fan (kWh)", "Light (kWh)", "Total (kWh)", "Cost (" + cur + ")"]);
        s.labels.forEach(function (lb, i) {
          if (s.total[i] == null) return;
          rows.push([s.full[i], s.ac[i], s.fan[i], s.light[i], s.total[i], U.round(s.total[i] * tariff, 2)]);
        });
        rows.push(["Total", sum.byDevice.ac, sum.byDevice.fan, sum.byDevice.light, sum.kwh, sum.cost]);
        summary = U.fmtKwh(sum.kwh) + " kWh, " + U.fmtMoney(sum.cost, cur);

      } else if (type === "carbon") {
        rows.push(["Period", "Energy (kWh)", "Emitted (kg CO2)", "Previous (kg CO2)"]);
        s.labels.forEach(function (lb, i) {
          if (s.total[i] == null) return;
          rows.push([s.full[i], s.total[i], U.round(s.total[i] * gf, 3),
            s.prev[i] == null ? "" : U.round(s.prev[i] * gf, 3)]);
        });
        rows.push(["Total", sum.kwh, sum.co2, sum.prevCo2]);
        rows.push(["Carbon avoided by automation (kg CO2)", "", st.totals.savedCo2, ""]);
        summary = U.fmtCo2(sum.co2) + " kg CO2 emitted, " + U.fmtCo2(st.totals.savedCo2) + " kg avoided";

      } else if (type === "alerts") {
        rows.push(["Room", "Block", "Level", "Idle (minutes)", "Devices on", "Load (kW)", "Wasted today (kWh)"]);
        var alerts = S.alertRooms();
        alerts.forEach(function (r) {
          rows.push([r.name, r.block, r.floor, Math.round(S.idleMinutes(r)),
            S.devicesOn(r).map(function (k) { return S.DEVICES[k].short; }).join(" + ") || "none",
            U.round(S.roomLoadKw(r), 2), U.round(r.wastedKwh, 2)]);
        });
        if (!alerts.length) rows.push(["No rooms in alert at the time of generation", "", "", "", "", "", ""]);
        summary = alerts.length + " " + (alerts.length === 1 ? "room" : "rooms") + " in alert, " +
          U.fmt(S.wastedNowKw(), 2) + " kW wasted";

      } else {
        rows.push(["Room", "Block", "Level", "Status", "AC", "Fan", "Light", "kWh today", "Wasted (kWh)", "Last motion"]);
        st.rooms.slice().sort(function (a, b) {
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        }).forEach(function (r) {
          rows.push([r.name, r.block, r.floor, UI.statusMeta(S.roomStatus(r)).label,
            r.devices.ac.on ? "ON" : "OFF", r.devices.fan.on ? "ON" : "OFF", r.devices.light.on ? "ON" : "OFF",
            U.round(r.kwhToday, 2), U.round(r.wastedKwh, 2),
            r.occupied ? "now" : U.durationShort(S.idleMinutes(r)) + " ago"]);
        });
        var c = S.statusCounts();
        summary = st.rooms.length + " rooms: " + c.normal + " normal, " + c.occupied + " occupied, " + c.alert + " alert";
      }

      var stamp = new Date();
      return {
        id: U.uid("rp"),
        type: type,
        range: range,
        name: TYPES[type].label + " - " + RANGES[range],
        file: "carbonwise-" + type + "-" + range + "-" + U.isoDate(stamp) + ".csv",
        note: note || "",
        createdAt: stamp.getTime(),
        building: st.onboarding.buildingName,
        summary: summary,
        rows: rows
      };
    }

    /* ------------------------- preview ------------------------- */
    function preview(rep) {
      var body = U.el("div");
      body.appendChild(U.el("div", { class: "u-row u-gap-8 u-wrap u-mb-16", html:
        '<span class="badge">' + U.icon("calendar", 12) + U.esc(RANGES[rep.range] || rep.range) + "</span>" +
        '<span class="badge">' + U.icon("building", 12) + U.esc(rep.building || "Building") + "</span>" +
        '<span class="badge">' + U.icon("clock", 12) + U.esc(U.fullDate(rep.createdAt) + ", " + U.hhmm(rep.createdAt)) + "</span>"
      }));
      if (rep.note) {
        body.appendChild(U.el("p", { class: "u-sm u-muted u-mb-16", text: rep.note }));
      }
      body.appendChild(U.el("div", { class: "callout u-mb-16" }, [
        U.el("span", { class: "callout__icon", html: U.icon("info", 18) }),
        U.el("span", { class: "callout__text", text: rep.summary })
      ]));

      var wrap = U.el("div", { class: "table-wrap", style: "max-height:46vh;border:1px solid var(--border);border-radius:var(--r-md)" });
      var table = U.el("table", { class: "table table--compact" });
      var head = U.el("thead"), hr = U.el("tr");
      rep.rows[0].forEach(function (h, i) {
        hr.appendChild(U.el("th", { class: i ? "num" : "", text: String(h) }));
      });
      head.appendChild(hr); table.appendChild(head);
      var tb = U.el("tbody");
      rep.rows.slice(1).forEach(function (r) {
        var tr = U.el("tr");
        r.forEach(function (c, i) { tr.appendChild(U.el("td", { class: i ? "num" : "", text: String(c) })); });
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      wrap.appendChild(table);
      body.appendChild(wrap);

      UI.modal({
        title: rep.name,
        wide: true,
        body: body,
        actions: [
          { label: "Close" },
          { label: "Print", onClick: function () { window.print(); return false; } },
          { label: "Download CSV", variant: "btn--primary", onClick: function () {
            U.downloadFile(rep.file, U.toCsv(rep.rows), "text/csv");
            UI.toast({ type: "ok", title: "Report downloaded", msg: rep.file });
          } }
        ]
      });
    }

    paintStats();
    paintTypes();
    paintList();
    ctx.setRefresher(paintStats);
  };
})(window, document);
