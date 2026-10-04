/* ==========================================================================
   CarbonWise - Energy Usage
   One filter row at the top scopes every chart, stat and table below it,
   so the numbers on this page always agree with each other.
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store, C = CW.charts;
  var V = CW.views;

  var range = "week";

  V.energy = function (view, ctx) {
    var st = S.state;

    view.innerHTML =
      '<header class="page-head">' +
        "<div>" +
          '<h1 class="page-head__title">Energy Usage</h1>' +
          '<p class="page-head__sub">Consumption, carbon and cost across the building.</p>' +
        "</div>" +
      "</header>" +

      '<div class="filterbar">' +
        '<div class="seg" role="tablist" aria-label="Time range" id="enRange">' +
          segBtn("today", "Today") + segBtn("week", "This Week") + segBtn("month", "This Month") +
        "</div>" +
        '<span class="badge" id="enScope"></span>' +
        '<span class="filterbar__spacer"></span>' +
        '<button class="btn btn--sm" type="button" id="enExport">' + U.icon("download", 15) + "Export CSV</button>" +
      "</div>" +

      '<div class="grid grid--stats" id="enStats"></div>' +

      '<section class="section">' +
        '<article class="card">' +
          '<div class="card__head">' +
            "<div>" +
              '<div class="card__title">Consumption over time</div>' +
              '<div class="card__sub" id="enMainSub">&nbsp;</div>' +
            "</div>" +
          "</div>" +
          '<div class="card__body"><div id="enMainChart"></div></div>' +
        "</article>" +
      "</section>" +

      '<section class="section">' +
        '<div class="grid grid--half">' +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Carbon Emissions</div>' +
              '<div class="card__sub" id="enCarbonSub">&nbsp;</div></div>' +
            "</div>" +
            '<div class="card__body"><div id="enCarbonChart"></div></div>' +
          "</article>" +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Where the energy goes</div>' +
              '<div class="card__sub">Share of consumption by device type</div></div>' +
            "</div>" +
            '<div class="card__body"><div id="enShare"></div></div>' +
          "</article>" +
        "</div>" +
      "</section>" +

      '<section class="section">' +
        '<article class="card">' +
          '<div class="card__head">' +
            '<div><div class="card__title">Consumption by device</div>' +
            '<div class="card__sub">Stacked, so the bar height is the period total</div></div>' +
          "</div>" +
          '<div class="card__body"><div id="enDeviceChart"></div></div>' +
        "</article>" +
      "</section>" +

      '<section class="section">' +
        '<div class="grid grid--main">' +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Peak hours</div>' +
              '<div class="card__sub">Consumption by hour over the last seven days</div></div>' +
            "</div>" +
            '<div class="card__body"><div id="enHeat"></div></div>' +
          "</article>" +
          '<article class="card">' +
            '<div class="card__head">' +
              '<div><div class="card__title">Top consuming rooms</div>' +
              '<div class="card__sub">Today</div></div>' +
              '<a class="btn btn--sm btn--ghost" href="#/rooms">All rooms' + U.icon("chevronRight", 15) + "</a>" +
            "</div>" +
            '<div class="table-wrap"><table class="table table--compact" id="enTop"></table></div>' +
          "</article>" +
        "</div>" +
      "</section>";

    function paintStats() {
      var sum = CW.sim.summary(range);
      var s = CW.sim.series(range);
      var host = U.qs("#enStats", view);
      host.innerHTML = "";

      host.appendChild(UI.statTile({
        label: "Total consumption", value: U.fmtKwh(sum.kwh), unit: "kWh", icon: "zap", tone: "blue",
        delta: sum.comparable ? sum.change : null, upIsGood: false,
        foot: sum.comparable
          ? "vs " + s.prevLabel.toLowerCase() + (range === "today" ? ", same hour" : ", completed days")
          : "this period so far",
        spark: s.total, sparkColor: C.cssVar("--s-ac")
      }));
      host.appendChild(UI.statTile({
        label: "Carbon emitted", value: U.fmtCo2(sum.co2), unit: "kg CO2", icon: "leaf", tone: "green",
        foot: "at " + st.settings.gridFactor + " kg/kWh"
      }));
      host.appendChild(UI.statTile({
        label: "Estimated cost", value: U.fmt(sum.cost, 2), unit: st.settings.currency, icon: "activity", tone: "ink",
        foot: "at " + st.settings.tariff + " per kWh"
      }));
      host.appendChild(UI.statTile({
        label: "Carbon saved", value: U.fmtCo2(st.totals.savedCo2), unit: "kg CO2", icon: "shield", tone: "green",
        foot: "since monitoring began"
      }));
      host.appendChild(UI.statTile({
        label: "Peak period", value: sum.peak.v > 0 ? U.fmtKwh(sum.peak.v) : "0", unit: "kWh", icon: "trendUp", tone: "warn",
        foot: sum.peak.label || "No data yet"
      }));
    }

    function paintCharts() {
      var s = CW.sim.series(range);
      var sum = CW.sim.summary(range);
      var gf = st.settings.gridFactor;

      U.qs("#enScope", view).textContent =
        range === "today" ? "Hourly, since midnight"
          : range === "week" ? "Daily, last 7 days" : "Daily, last 30 days";

      /* The comparison excludes the day still in progress on both sides,
         and the subtitle says so rather than quietly reporting a crash. */
      U.qs("#enMainSub", view).textContent = sum.comparable
        ? U.fmtKwh(sum.kwh) + " kWh so far. Completed periods: " + U.fmtKwh(sum.cmpKwh) + " kWh against " +
          U.fmtKwh(sum.cmpPrevKwh) + " kWh in the " + s.prevLabel.toLowerCase() +
          " (" + (sum.change >= 0 ? "+" : "") + U.fmt(sum.change, 1) + "%)"
        : U.fmtKwh(sum.kwh) + " kWh this period";

      U.qs("#enCarbonSub", view).textContent =
        U.fmtCo2(sum.co2) + " kg CO2 emitted so far, at " + st.settings.gridFactor + " kg per kWh";

      C.lineChart(U.qs("#enMainChart", view), {
        labels: s.labels, full: s.full, unit: "kWh", height: 280,
        xHeader: range === "today" ? "Hour" : "Day",
        ariaLabel: "Energy consumption over time",
        series: [
          { key: "prev", label: s.prevLabel, values: s.prev, color: C.cssVar("--s-compare"), kind: "compare" },
          { key: "cur", label: "Current period", values: s.total, color: C.cssVar("--s-ac"), area: true, endLabel: true }
        ]
      });

      C.lineChart(U.qs("#enCarbonChart", view), {
        labels: s.labels, full: s.full, unit: "kg", height: 230,
        xHeader: range === "today" ? "Hour" : "Day",
        ariaLabel: "Carbon emissions over time",
        series: [
          { key: "prev", label: s.prevLabel, values: s.prev.map(function (v) { return v == null ? null : U.round(v * gf, 2); }),
            color: C.cssVar("--s-compare"), kind: "compare" },
          { key: "co2", label: "Emitted", values: s.total.map(function (v) { return v == null ? null : U.round(v * gf, 2); }),
            color: C.cssVar("--s-fan"), area: true, endLabel: true }
        ]
      });

      var segs = [];
      if (st.onboarding.devices.ac) segs.push({ label: "Air conditioning", value: sum.byDevice.ac, color: C.cssVar("--s-ac") });
      if (st.onboarding.devices.light) segs.push({ label: "Lights", value: sum.byDevice.light, color: C.cssVar("--s-light") });
      if (st.onboarding.devices.fan) segs.push({ label: "Fans", value: sum.byDevice.fan, color: C.cssVar("--s-fan") });
      var shareHost = U.qs("#enShare", view);
      C.shareBar(shareHost, segs, "kWh");

      /* Name the dominant load in words - the bar shows the split, this says
         what to do about it. */
      var top = segs.slice().sort(function (a, b) { return b.value - a.value; })[0];
      if (top && sum.kwh > 0) {
        var share = (top.value / sum.kwh) * 100;
        shareHost.appendChild(U.el("div", { class: "callout u-mt-20" }, [
          U.el("span", { class: "callout__icon", html: U.icon("info", 18) }),
          U.el("span", {
            class: "callout__text",
            text: top.label + " accounts for " + U.fmt(share, 0) + "% of consumption this period (" +
              U.fmtKwh(top.value) + " kWh, about " + U.fmtMoney(top.value * st.settings.tariff, st.settings.currency) +
              "). It is the load worth automating first."
          })
        ]));
      }

      var stacks = [];
      if (st.onboarding.devices.ac) stacks.push({ key: "ac", label: "AC", values: s.ac, color: C.cssVar("--s-ac") });
      if (st.onboarding.devices.fan) stacks.push({ key: "fan", label: "Fan", values: s.fan, color: C.cssVar("--s-fan") });
      if (st.onboarding.devices.light) stacks.push({ key: "light", label: "Light", values: s.light, color: C.cssVar("--s-light") });
      C.columnChart(U.qs("#enDeviceChart", view), {
        labels: s.labels, full: s.full, unit: "kWh", height: 260, stacks: stacks,
        xHeader: range === "today" ? "Hour" : "Day",
        ariaLabel: "Consumption by device type"
      });

      C.heatmap(U.qs("#enHeat", view), CW.sim.heatmap());
    }

    function paintTop() {
      var rooms = CW.sim.topRooms(8);
      var table = U.qs("#enTop", view);
      table.innerHTML =
        "<thead><tr><th>Room</th><th>Status</th><th class=\"num\">Today</th><th class=\"num\">Wasted</th></tr></thead>";
      var tb = U.el("tbody");
      rooms.forEach(function (r) {
        var status = S.roomStatus(r);
        var tr = U.el("tr");
        tr.innerHTML =
          "<td><a href=\"#/rooms?room=" + U.esc(r.id) + '">' + U.esc(r.name) + "</a>" +
            '<div class="u-xs u-dim">Block ' + U.esc(r.block) + "</div></td>" +
          "<td>" + UI.statusBadge(status) + "</td>" +
          '<td class="num">' + U.fmt(r.kwhToday, 1) + "</td>" +
          '<td class="num"' + (r.wastedKwh > 0.05 ? ' style="color:var(--crit-ink);font-weight:600"' : "") + ">" +
            U.fmt(r.wastedKwh, 2) + "</td>";
        tb.appendChild(tr);
      });
      table.appendChild(tb);
    }

    U.delegate(U.qs("#enRange", view), "click", ".seg__btn", function (e, btn) {
      range = btn.dataset.range;
      U.qsa(".seg__btn", U.qs("#enRange", view)).forEach(function (b) {
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      paintStats();
      paintCharts();
    });

    U.qs("#enExport", view).addEventListener("click", function () {
      var s = CW.sim.series(range);
      var gf = st.settings.gridFactor, tr = st.settings.tariff;
      var rows = [["Period", "AC kWh", "Fan kWh", "Light kWh", "Total kWh", "CO2 kg", "Cost " + st.settings.currency, s.prevLabel + " kWh"]];
      s.labels.forEach(function (lb, i) {
        if (s.total[i] == null) return;
        rows.push([
          s.full[i], s.ac[i], s.fan[i], s.light[i], s.total[i],
          U.round(s.total[i] * gf, 3), U.round(s.total[i] * tr, 2),
          s.prev[i] == null ? "" : s.prev[i]
        ]);
      });
      U.downloadFile("carbonwise-energy-" + range + "-" + U.isoDate(new Date()) + ".csv", U.toCsv(rows), "text/csv");
      UI.toast({ type: "ok", title: "Energy data exported" });
    });

    paintStats();
    paintCharts();
    paintTop();

    var clock = 0;
    ctx.setRefresher(function () {
      paintStats();
      paintTop();
      if (++clock % 12 === 0) paintCharts();
    });
  };

  function segBtn(key, label) {
    return '<button class="seg__btn" role="tab" type="button" data-range="' + key + '" aria-selected="' +
      (range === key ? "true" : "false") + '">' + label + "</button>";
  }
})(window, document);
