/* ==========================================================================
   CarbonWise - SVG charts
   Hand-rolled, no chart library. Specs held to deliberately:
     - 2px lines, >=8px end markers with a 2px surface ring
     - stacked segments separated by a 2px surface gap, 4px rounded data-end
       at the top of a stack and square at the baseline
     - solid hairline gridlines, never dashed; recessive axes
     - a legend whenever there are 2+ series, direct labels only at the
       endpoint/extreme, never a number on every point
     - one y-scale per plot, never a second axis
     - a crosshair tooltip AND a table view, so no value is hover-gated;
       keyboard focus shows exactly what hover shows
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW || (window.CW = {});
  var U = CW.util;
  var NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* Rounds a value up onto a progression of round numbers. The set is finer
     than the usual 1/2/5/10 so a 190 peak gets an axis of 240, not 400 -
     the ticks stay clean without wasting half the plot on headroom. */
  var STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  function niceStep(v) {
    if (!v || v <= 0) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    for (var i = 0; i < STEPS.length; i++) {
      if (f <= STEPS[i] + 1e-9) return STEPS[i] * exp;
    }
    return 10 * exp;
  }

  /* The axis maximum is derived from a clean TICK step, not the other way
     round, so every gridline lands on a round number (0 / 50 / 100 ...)
     instead of 0 / 63 / 125 / 188. */
  function axisScale(rawMax, ticks) {
    ticks = ticks || 4;
    var step = niceStep((rawMax || 0.001) / ticks);
    return { step: step, max: Number((step * ticks).toPrecision(12)), ticks: ticks };
  }


  function tickText(v) {
    if (v >= 1000) return U.fmt(v / 1000, v % 1000 === 0 ? 0 : 1) + "k";
    return U.fmt(v, v < 10 && v % 1 !== 0 ? 1 : 0);
  }

  /* A path with the top two corners rounded and the baseline square. */
  function stackTopPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return "M" + x + " " + (y + h) +
      "V" + (y + r) +
      "a" + r + " " + r + " 0 0 1 " + r + " " + -r +
      "h" + (w - 2 * r) +
      "a" + r + " " + r + " 0 0 1 " + r + " " + r +
      "V" + (y + h) + "Z";
  }

  /* ------------------------------------------------------------------
     Shared chrome: the tooltip element and the table-view twin.
     ------------------------------------------------------------------ */
  function makeTip(host) {
    var tip = U.el("div", { class: "chart-tip", role: "status", "aria-live": "polite" });
    host.appendChild(tip);
    return tip;
  }

  function placeTip(tip, host, px, py) {
    var hw = host.clientWidth;
    var tw = tip.offsetWidth || 150;
    var left = U.clamp(px - tw / 2, 4, Math.max(4, hw - tw - 4));
    tip.style.left = left + "px";
    tip.style.top = Math.max(2, py) + "px";
  }

  /* Values are set with textContent - labels are untrusted input. */
  function fillTip(tip, xLabel, rows, unit) {
    tip.innerHTML = "";
    tip.appendChild(U.el("div", { class: "chart-tip__x", text: xLabel }));
    rows.forEach(function (r) {
      if (r.value == null) return;
      var row = U.el("div", { class: "chart-tip__row" }, [
        U.el("span", { class: "chart-tip__key", style: "background:" + r.color }),
        U.el("span", { class: "chart-tip__val", text: U.fmt(r.value, r.value < 100 ? 1 : 0) + (unit ? " " + unit : "") }),
        U.el("span", { class: "chart-tip__lbl", text: r.label })
      ]);
      tip.appendChild(row);
    });
  }

  function buildTable(labels, series, unit, xHeader) {
    var wrap = U.el("div", { class: "chart-table table-wrap u-hidden" });
    var table = U.el("table", { class: "table table--compact" });
    var thead = U.el("thead");
    var hr = U.el("tr");
    hr.appendChild(U.el("th", { text: xHeader || "Period" }));
    series.forEach(function (s) { hr.appendChild(U.el("th", { class: "num", text: s.label + (unit ? " (" + unit + ")" : "") })); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tb = U.el("tbody");
    labels.forEach(function (lb, i) {
      var tr = U.el("tr");
      tr.appendChild(U.el("td", { text: lb }));
      series.forEach(function (s) {
        var v = s.values[i];
        tr.appendChild(U.el("td", { class: "num", text: v == null ? "--" : U.fmt(v, 2) }));
      });
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    wrap.appendChild(table);
    return wrap;
  }

  /* A "Chart / Table" switch. The table is the relief channel that makes
     the lighter series colours legal, so it ships on every chart. */
  function addViewToggle(host, plotEl, tableEl, onShow) {
    var bar = U.el("div", { class: "chart-tools no-print" });
    var seg = U.el("div", { class: "seg", role: "tablist", "aria-label": "Chart view" });
    var bChart = U.el("button", { class: "seg__btn", role: "tab", "aria-selected": "true", type: "button" }, "Chart");
    var bTable = U.el("button", { class: "seg__btn", role: "tab", "aria-selected": "false", type: "button" }, "Table");
    seg.appendChild(bChart); seg.appendChild(bTable);
    bar.appendChild(seg);
    function show(which) {
      var chart = which === "chart";
      plotEl.classList.toggle("u-hidden", !chart);
      tableEl.classList.toggle("u-hidden", chart);
      bChart.setAttribute("aria-selected", chart ? "true" : "false");
      bTable.setAttribute("aria-selected", chart ? "false" : "true");
      if (chart && onShow) onShow();
    }
    bChart.addEventListener("click", function () { show("chart"); });
    bTable.addEventListener("click", function () { show("table"); });
    return bar;
  }

  function legendRow(series) {
    var box = U.el("div", { class: "legend" });
    series.forEach(function (s) {
      box.appendChild(U.el("span", { class: "legend__item" }, [
        U.el("span", { class: s.kind === "bar" ? "legend__swatch" : "legend__line", style: "background:" + s.color }),
        U.el("span", { text: s.label })
      ]));
    });
    return box;
  }

  /* Re-renders on container resize so the chart is responsive without
     stretching its type. */
  function autoResize(host, draw) {
    var w = 0;
    function run() {
      var nw = host.clientWidth;
      if (nw && Math.abs(nw - w) > 2) { w = nw; draw(nw); }
    }
    run();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(run);
      ro.observe(host);
      host._cwRO = ro;
    } else {
      window.addEventListener("resize", U.debounce(run, 150));
    }
    return run;
  }

  /* ==================================================================
     Line / area chart with a crosshair
     ================================================================== */
  function lineChart(host, opts) {
    host.innerHTML = "";
    host.classList.add("chart");

    var series = opts.series.filter(function (s) { return s && s.values; });
    var labels = opts.labels;
    var unit = opts.unit || "kWh";
    var height = opts.height || 240;

    var plot = U.el("div", { class: "chart__plot" });
    var table = buildTable(opts.full || labels, series, unit, opts.xHeader);
    var tip = null;

    var head = U.el("div", { class: "chart-head" });
    if (series.length > 1) head.appendChild(legendRow(series));
    else head.appendChild(U.el("span"));
    var redraw;
    head.appendChild(addViewToggle(host, plot, table, function () { if (redraw) redraw(); }));

    host.appendChild(head);
    host.appendChild(plot);
    host.appendChild(table);
    tip = makeTip(host);

    var pts = [];     // [{x, idx}]

    function draw(W) {
      plot.innerHTML = "";
      var padL = 46, padR = 18, padT = 14, padB = 28;
      var w = Math.max(240, W);
      var h = height;
      var iw = w - padL - padR;
      var ih = h - padT - padB;

      var all = [];
      series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
      var scale = axisScale(Math.max.apply(null, all.concat([0.001])) * 1.08, 4);
      var max = scale.max;

      var svg = svgEl("svg", {
        class: "chart__svg", viewBox: "0 0 " + w + " " + h, width: "100%", height: h,
        role: "img", "aria-label": opts.ariaLabel || "Line chart"
      });

      var n = labels.length;
      function X(i) { return padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw); }
      function Y(v) { return padT + ih - (v / max) * ih; }

      /* gridlines + y ticks: solid hairlines, one step off the surface */
      var ticks = scale.ticks;
      for (var t = 0; t <= ticks; t++) {
        var val = scale.step * t;
        var y = Y(val);
        svg.appendChild(svgEl("line", {
          x1: padL, x2: w - padR, y1: y, y2: y,
          stroke: t === 0 ? cssVar("--axis") : cssVar("--grid"), "stroke-width": 1
        }));
        var lbl = svgEl("text", {
          x: padL - 9, y: y + 4, "text-anchor": "end",
          fill: cssVar("--axis-text"), "font-size": 11, "font-variant-numeric": "tabular-nums"
        });
        lbl.textContent = tickText(val);
        svg.appendChild(lbl);
      }

      /* x labels, thinned to fit */
      var every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 54))));
      labels.forEach(function (lb, i) {
        if (i % every !== 0 && i !== n - 1) return;
        var tx = svgEl("text", {
          x: X(i), y: h - 8, "text-anchor": "middle",
          fill: cssVar("--axis-text"), "font-size": 11, "font-variant-numeric": "tabular-nums"
        });
        tx.textContent = lb;
        svg.appendChild(tx);
      });

      /* series: comparison first so it sits behind the current period */
      var ordered = series.slice().sort(function (a, b) {
        return (a.kind === "compare" ? -1 : 0) - (b.kind === "compare" ? -1 : 0);
      });

      ordered.forEach(function (s) {
        var segs = [], cur = [];
        s.values.forEach(function (v, i) {
          if (v == null) { if (cur.length) { segs.push(cur); cur = []; } return; }
          cur.push([X(i), Y(v)]);
        });
        if (cur.length) segs.push(cur);

        segs.forEach(function (seg) {
          if (s.area && seg.length > 1) {
            var d = "M" + seg[0][0] + " " + (padT + ih);
            seg.forEach(function (p) { d += "L" + p[0] + " " + p[1]; });
            d += "L" + seg[seg.length - 1][0] + " " + (padT + ih) + "Z";
            svg.appendChild(svgEl("path", { d: d, fill: s.color, "fill-opacity": ".10" }));
          }
          if (seg.length === 1) {
            svg.appendChild(svgEl("circle", { cx: seg[0][0], cy: seg[0][1], r: 4, fill: s.color }));
          } else {
            var dl = seg.map(function (p, i) { return (i ? "L" : "M") + p[0] + " " + p[1]; }).join("");
            svg.appendChild(svgEl("path", {
              d: dl, fill: "none", stroke: s.color, "stroke-width": 2,
              "stroke-linejoin": "round", "stroke-linecap": "round",
              "stroke-opacity": s.kind === "compare" ? ".9" : "1"
            }));
          }
        });

        /* one direct label, at the endpoint of the primary series only */
        if (s.endLabel && segs.length) {
          var last = segs[segs.length - 1][segs[segs.length - 1].length - 1];
          svg.appendChild(svgEl("circle", {
            cx: last[0], cy: last[1], r: 4.5, fill: s.color,
            stroke: cssVar("--chart-surface"), "stroke-width": 2
          }));
          /* Flip the label inward near the right edge, then clamp it, so it
             is never clipped and never pushes past the plot. */
          var anchorEnd = last[0] > w - padR - 52;
          var lx = U.clamp(last[0] + (anchorEnd ? -10 : 10), padL + 2, w - padR - 2);
          var tl = svgEl("text", {
            x: lx, y: U.clamp(last[1] - 9, padT + 10, padT + ih),
            "text-anchor": anchorEnd ? "end" : "start",
            fill: cssVar("--ink"), "font-size": 11.5, "font-weight": 650
          });
          tl.textContent = U.fmt(s.values.filter(function (v) { return v != null; }).pop(), 1) + " " + unit;
          svg.appendChild(tl);
        }
      });

      /* crosshair layer */
      var cross = svgEl("line", {
        x1: 0, x2: 0, y1: padT, y2: padT + ih,
        stroke: cssVar("--axis"), "stroke-width": 1, opacity: 0
      });
      svg.appendChild(cross);
      var dots = svgEl("g", { opacity: 0 });
      series.forEach(function (s) {
        dots.appendChild(svgEl("circle", {
          r: 4.5, fill: s.color, stroke: cssVar("--chart-surface"), "stroke-width": 2
        }));
      });
      svg.appendChild(dots);

      var hit = svgEl("rect", {
        x: padL - (iw / Math.max(1, n - 1)) / 2, y: padT,
        width: iw + (iw / Math.max(1, n - 1)), height: ih,
        fill: "transparent", style: "cursor:crosshair"
      });
      svg.appendChild(hit);

      pts = labels.map(function (_, i) { return { x: X(i), i: i }; });

      function showAt(i) {
        if (i < 0 || i >= n) return;
        var x = X(i);
        cross.setAttribute("x1", x); cross.setAttribute("x2", x);
        cross.setAttribute("opacity", 1);
        dots.setAttribute("opacity", 1);
        var kids = dots.childNodes, topY = padT + ih;
        series.forEach(function (s, si) {
          var v = s.values[i];
          if (v == null) { kids[si].setAttribute("opacity", 0); return; }
          kids[si].setAttribute("opacity", 1);
          kids[si].setAttribute("cx", x);
          kids[si].setAttribute("cy", Y(v));
          topY = Math.min(topY, Y(v));
        });
        fillTip(tip, (opts.full || labels)[i], series.map(function (s) {
          return { label: s.label, value: s.values[i], color: s.color };
        }), unit);
        tip.classList.add("is-on");
        placeTip(tip, host, x, topY - tip.offsetHeight - 12 + plot.offsetTop);
      }
      function hide() {
        cross.setAttribute("opacity", 0);
        dots.setAttribute("opacity", 0);
        tip.classList.remove("is-on");
      }

      var active = 0;
      function nearest(clientX) {
        var box = svg.getBoundingClientRect();
        var rel = ((clientX - box.left) / box.width) * w;
        var best = 0, bd = Infinity;
        pts.forEach(function (p) {
          var d = Math.abs(p.x - rel);
          if (d < bd) { bd = d; best = p.i; }
        });
        return best;
      }
      svg.addEventListener("pointermove", function (e) { active = nearest(e.clientX); showAt(active); });
      svg.addEventListener("pointerleave", hide);

      /* keyboard parity with hover */
      plot.tabIndex = 0;
      plot.setAttribute("role", "application");
      plot.setAttribute("aria-label", (opts.ariaLabel || "Chart") + ". Use arrow keys to read values.");
      plot.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { active = Math.min(n - 1, active + 1); showAt(active); e.preventDefault(); }
        else if (e.key === "ArrowLeft") { active = Math.max(0, active - 1); showAt(active); e.preventDefault(); }
        else if (e.key === "Escape") hide();
      });
      plot.addEventListener("blur", hide);

      plot.appendChild(svg);
    }

    redraw = autoResize(plot, draw);
    return { redraw: redraw };
  }

  /* ==================================================================
     Column chart, optionally stacked
     ================================================================== */
  function columnChart(host, opts) {
    host.innerHTML = "";
    host.classList.add("chart");

    var stacks = opts.stacks;
    var labels = opts.labels;
    var unit = opts.unit || "kWh";
    var height = opts.height || 240;

    var plot = U.el("div", { class: "chart__plot" });
    var table = buildTable(opts.full || labels, stacks, unit, opts.xHeader);
    var head = U.el("div", { class: "chart-head" });
    if (stacks.length > 1) head.appendChild(legendRow(stacks.map(function (s) {
      return { label: s.label, color: s.color, kind: "bar" };
    })));
    else head.appendChild(U.el("span"));
    var redraw;
    head.appendChild(addViewToggle(host, plot, table, function () { if (redraw) redraw(); }));

    host.appendChild(head);
    host.appendChild(plot);
    host.appendChild(table);
    var tip = makeTip(host);

    function draw(W) {
      plot.innerHTML = "";
      var padL = 46, padR = 18, padT = 14, padB = 28;
      var w = Math.max(240, W), h = height;
      var iw = w - padL - padR, ih = h - padT - padB;
      var n = labels.length;

      var totals = labels.map(function (_, i) {
        return stacks.reduce(function (s, st) { return s + (st.values[i] || 0); }, 0);
      });
      var scale = axisScale(Math.max.apply(null, totals.concat([0.001])) * 1.08, 4);
      var max = scale.max;

      var svg = svgEl("svg", {
        class: "chart__svg", viewBox: "0 0 " + w + " " + h, width: "100%", height: h,
        role: "img", "aria-label": opts.ariaLabel || "Column chart"
      });

      function Y(v) { return padT + ih - (v / max) * ih; }
      var band = iw / n;
      var barW = Math.min(24, band * 0.6);

      for (var t = 0; t <= scale.ticks; t++) {
        var val = scale.step * t, y = Y(val);
        svg.appendChild(svgEl("line", {
          x1: padL, x2: w - padR, y1: y, y2: y,
          stroke: t === 0 ? cssVar("--axis") : cssVar("--grid"), "stroke-width": 1
        }));
        var lt = svgEl("text", {
          x: padL - 9, y: y + 4, "text-anchor": "end",
          fill: cssVar("--axis-text"), "font-size": 11, "font-variant-numeric": "tabular-nums"
        });
        lt.textContent = tickText(val);
        svg.appendChild(lt);
      }

      var every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 48))));
      labels.forEach(function (lb, i) {
        if (i % every !== 0 && i !== n - 1) return;
        var tx = svgEl("text", {
          x: padL + band * i + band / 2, y: h - 8, "text-anchor": "middle",
          fill: cssVar("--axis-text"), "font-size": 11
        });
        tx.textContent = lb;
        svg.appendChild(tx);
      });

      labels.forEach(function (lb, i) {
        var x = padL + band * i + (band - barW) / 2;
        var acc = 0;
        var baseline = padT + ih;
        var drawn = [];
        stacks.forEach(function (st, si) {
          var v = st.values[i] || 0;
          if (v <= 0) return;
          var yTop = Y(acc + v);
          var yBot = Y(acc);
          var segH = yBot - yTop;
          acc += v;
          drawn.push({ si: si, yTop: yTop, segH: segH });
        });
        drawn.forEach(function (d, di) {
          var isTop = di === drawn.length - 1;
          // a 2px surface gap separates touching segments - never a stroke
          var gap = isTop ? 0 : 2;
          var hgt = Math.max(1, d.segH - gap);
          var yy = d.yTop + (isTop ? 0 : gap);
          var node;
          if (isTop) {
            node = svgEl("path", { d: stackTopPath(x, d.yTop, barW, Math.max(1, d.segH), 4), fill: stacks[d.si].color });
          } else {
            node = svgEl("rect", { x: x, y: yy, width: barW, height: hgt, fill: stacks[d.si].color });
          }
          svg.appendChild(node);
        });

        /* hit target spans the whole band, comfortably bigger than the bar */
        var hit = svgEl("rect", {
          x: padL + band * i, y: padT, width: band, height: ih,
          fill: "transparent", style: "cursor:pointer"
        });
        hit.addEventListener("pointerenter", function () {
          fillTip(tip, (opts.full || labels)[i], stacks.map(function (s) {
            return { label: s.label, value: s.values[i], color: s.color };
          }).concat(stacks.length > 1 ? [{ label: "Total", value: U.round(totals[i], 2), color: cssVar("--ink-3") }] : []), unit);
          tip.classList.add("is-on");
          placeTip(tip, host, padL + band * i + band / 2, Y(totals[i]) - tip.offsetHeight - 10 + plot.offsetTop);
        });
        hit.addEventListener("pointerleave", function () { tip.classList.remove("is-on"); });
        svg.appendChild(hit);
      });

      plot.appendChild(svg);
    }

    redraw = autoResize(plot, draw);
    return { redraw: redraw };
  }

  /* ==================================================================
     Sparkline - a bare trend line for stat tiles (no axes, no tooltip)
     ================================================================== */
  function sparkline(host, values, color) {
    host.innerHTML = "";
    function draw(W) {
      host.innerHTML = "";
      var w = Math.max(60, W), h = host.clientHeight || 32;
      var vals = values.filter(function (v) { return v != null; });
      if (vals.length < 2) return;
      var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      var span = (max - min) || 1;
      var svg = svgEl("svg", { viewBox: "0 0 " + w + " " + h, width: "100%", height: h, "aria-hidden": "true" });
      var pad = 3;
      var d = vals.map(function (v, i) {
        var x = (i / (vals.length - 1)) * (w - 2) + 1;
        var y = pad + (1 - (v - min) / span) * (h - pad * 2);
        return (i ? "L" : "M") + U.round(x, 1) + " " + U.round(y, 1);
      }).join("");
      svg.appendChild(svgEl("path", {
        d: d + "L" + (w - 1) + " " + h + "L1 " + h + "Z", fill: color, "fill-opacity": ".10"
      }));
      svg.appendChild(svgEl("path", {
        d: d, fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round"
      }));
      var lastX = w - 1, lastY = pad + (1 - (vals[vals.length - 1] - min) / span) * (h - pad * 2);
      svg.appendChild(svgEl("circle", {
        cx: lastX - 1, cy: lastY, r: 3, fill: color,
        stroke: cssVar("--chart-surface"), "stroke-width": 2
      }));
      host.appendChild(svg);
    }
    autoResize(host, draw);
  }

  /* ==================================================================
     Share bar - part-to-whole on one row, with direct labels
     ================================================================== */
  function shareBar(host, segments, unit) {
    host.innerHTML = "";
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var bar = U.el("div", { class: "statusbar", style: "height:26px;border-radius:8px" });
    segments.forEach(function (s) {
      var pc = (s.value / total) * 100;
      var seg = U.el("div", {
        class: "statusbar__seg",
        style: "width:" + pc + "%;background:" + s.color,
        title: s.label + ": " + U.fmt(s.value, 1) + " " + (unit || "")
      });
      bar.appendChild(seg);
    });
    host.appendChild(bar);

    var list = U.el("div", { class: "u-mt-16", style: "display:grid;gap:10px" });
    segments.forEach(function (s) {
      var pc = (s.value / total) * 100;
      list.appendChild(U.el("div", { class: "u-row-sb" }, [
        U.el("span", { class: "legend__item" }, [
          U.el("span", { class: "legend__swatch", style: "background:" + s.color }),
          U.el("span", { text: s.label })
        ]),
        U.el("span", { class: "u-row u-gap-8" }, [
          U.el("span", { class: "u-sm u-semi u-tab", text: U.fmt(s.value, 1) + " " + (unit || "") }),
          U.el("span", { class: "u-xs u-dim u-tab", style: "min-width:38px;text-align:right", text: U.fmt(pc, 0) + "%" })
        ])
      ]));
    });
    host.appendChild(list);
  }

  /* ==================================================================
     Heat-map - ordinal 5-step blue ramp (validated), DOM grid
     ================================================================== */
  function heatmap(host, data) {
    host.innerHTML = "";
    var steps = ["--ramp-1", "--ramp-2", "--ramp-3", "--ramp-4", "--ramp-5"];
    var grid = U.el("div", { class: "heat" });

    data.rows.forEach(function (row) {
      var r = U.el("div", { class: "heat__row" });
      r.appendChild(U.el("span", { class: "heat__rowlbl", text: row.label }));
      row.cells.forEach(function (v, h) {
        var bg = "var(--ramp-0)";
        if (v != null && data.max > 0) {
          var idx = U.clamp(Math.floor((v / data.max) * steps.length), 0, steps.length - 1);
          bg = "var(" + steps[idx] + ")";
        }
        var label = row.date + ", " + U.pad2(h) + ":00 - " +
          (v == null ? "no data" : U.fmt(v, 1) + " kWh");
        r.appendChild(U.el("div", {
          class: "heat__cell", style: "background:" + bg,
          tabindex: "0", role: "img", "aria-label": label, title: label
        }));
      });
      grid.appendChild(r);
    });
    host.appendChild(grid);

    var axis = U.el("div", { class: "heat__axis" });
    axis.appendChild(U.el("span"));
    for (var h = 0; h < 24; h++) axis.appendChild(U.el("span", { text: h % 3 === 0 ? String(h) : "" }));
    host.appendChild(axis);

    var scale = U.el("div", { class: "heat__scale" }, [U.el("span", { text: "Lower" })]);
    var stepsEl = U.el("div", { class: "heat__scale-steps" });
    steps.forEach(function (s) { stepsEl.appendChild(U.el("span", { class: "heat__scale-step", style: "background:var(" + s + ")" })); });
    scale.appendChild(stepsEl);
    scale.appendChild(U.el("span", { text: "Higher consumption" }));
    host.appendChild(scale);
  }

  CW.charts = {
    lineChart: lineChart,
    columnChart: columnChart,
    sparkline: sparkline,
    shareBar: shareBar,
    heatmap: heatmap,
    cssVar: cssVar,
    axisScale: axisScale
  };
})(window, document);
