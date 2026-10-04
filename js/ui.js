/* ==========================================================================
   CarbonWise - shared UI: toasts, modal, drawer, theme, small builders
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW || (window.CW = {});
  var U = CW.util;

  /* ------------------------------- theme ------------------------------- */
  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === "light" || theme === "dark") root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
  }

  function effectiveTheme() {
    var t = CW.store.state.settings.theme;
    if (t === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return t;
  }

  /* The single place a theme change happens, so every switcher in the app
     stays in step: persist it, apply it, then repaint. */
  function setTheme(value, opts) {
    opts = opts || {};
    CW.store.state.settings.theme = value;
    applyTheme(value);
    CW.store.commit("theme");
    if (CW.app && CW.app.render) CW.app.render(true);
    if (opts.toast !== false) {
      toast({
        type: "info",
        title: value === "system" ? "Following your system theme"
          : value === "dark" ? "Dark mode on" : "Light mode on"
      });
    }
  }

  var THEME_OPTIONS = [
    { value: "system", icon: "monitor", label: "System" },
    { value: "light", icon: "sun", label: "Light" },
    { value: "dark", icon: "moon", label: "Dark" }
  ];

  /* Two shapes of the same control:
       compact  - one button that flips light <-> dark, for tight bars
       segment  - System / Light / Dark, with optional text labels */
  function themeSwitcher(opts) {
    opts = opts || {};
    var current = CW.store.state.settings.theme;

    if (opts.compact) {
      var eff = effectiveTheme();
      var next = eff === "dark" ? "light" : "dark";
      var btn = U.el("button", {
        class: "btn btn--ghost btn--icon" + (opts.small ? " btn--sm" : ""),
        type: "button",
        title: "Switch to " + next + " mode",
        "aria-label": "Switch to " + next + " mode",
        html: U.icon(eff === "dark" ? "sun" : "moon", 18)
      });
      btn.addEventListener("click", function () { setTheme(next); });
      return btn;
    }

    var seg = U.el("div", {
      class: "seg seg--theme" + (opts.withLabels ? "" : " seg--icons"),
      role: "radiogroup", "aria-label": "Colour theme"
    });
    THEME_OPTIONS.forEach(function (o) {
      var on = current === o.value;
      var b = U.el("button", {
        class: "seg__btn" + (opts.withLabels ? "" : " seg__btn--icon"),
        type: "button", role: "radio",
        "aria-checked": on ? "true" : "false",
        title: o.label + " theme",
        "aria-label": o.label + " theme",
        html: U.icon(o.icon, 16) + (opts.withLabels ? "<span>" + o.label + "</span>" : "")
      });
      b.addEventListener("click", function () { if (!on) setTheme(o.value); });
      seg.appendChild(b);
    });
    return seg;
  }

  /* Fills every [data-theme-slot] marker under `root`. Called once after each
     render, so adding a switcher to a page is just adding the marker. */
  function mountThemeSwitchers(root) {
    U.qsa("[data-theme-slot]", root || document).forEach(function (slot) {
      if (slot.dataset.themeMounted) return;
      slot.dataset.themeMounted = "1";
      var kind = slot.getAttribute("data-theme-slot");
      slot.appendChild(themeSwitcher({
        compact: kind === "compact",
        small: slot.hasAttribute("data-theme-small"),
        withLabels: kind === "labels"
      }));
    });
  }

  /* ------------------------------- toasts ------------------------------- */
  var toastHost = null;
  function toasts() {
    if (!toastHost) {
      toastHost = U.el("div", { class: "cw-toasts", role: "region", "aria-label": "Notifications" });
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  var TOAST_ICON = { ok: "checkCircle", info: "info", warn: "alert", crit: "alert" };

  function toast(opts) {
    if (typeof opts === "string") opts = { title: opts };
    var type = opts.type || "ok";
    var node = U.el("div", { class: "toast toast--" + type, role: "status" });
    node.appendChild(U.el("span", { class: "toast__icon", html: U.icon(TOAST_ICON[type] || "info", 19) }));
    var body = U.el("div", { class: "u-grow" }, [U.el("div", { class: "toast__title", text: opts.title || "" })]);
    if (opts.msg) body.appendChild(U.el("div", { class: "toast__msg", text: opts.msg }));
    node.appendChild(body);
    var close = U.el("button", { class: "toast__close", type: "button", "aria-label": "Dismiss", html: U.icon("x", 15) });
    node.appendChild(close);
    toasts().appendChild(node);

    var timer = setTimeout(dismiss, opts.duration || 4200);
    function dismiss() {
      clearTimeout(timer);
      node.classList.add("is-out");
      setTimeout(function () { node.remove(); }, 220);
    }
    close.addEventListener("click", dismiss);
    return dismiss;
  }

  /* --------------------------- overlay plumbing --------------------------- */
  function openOverlay(contentNode, opts) {
    opts = opts || {};
    var overlay = U.el("div", { class: "cw-overlay" + (opts.drawer ? " cw-overlay--drawer" : "") });
    overlay.appendChild(contentNode);
    document.body.appendChild(overlay);
    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    var lastFocus = document.activeElement;

    function close() {
      overlay.remove();
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      if (opts.onClose) opts.onClose();
    }

    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab") return;
      var f = U.qsa('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', contentNode)
        .filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }

    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", onKey);

    setTimeout(function () {
      var target = U.qs("[data-autofocus]", contentNode) ||
        U.qs("input,select,textarea,button", contentNode);
      if (target) target.focus();
    }, 60);

    return close;
  }

  /* ------------------------------- modal ------------------------------- */
  function modal(opts) {
    var box = U.el("div", {
      class: "modal" + (opts.wide ? " modal--wide" : ""),
      role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Dialog"
    });

    var head = U.el("div", { class: "modal__head" });
    head.appendChild(U.el("div", { class: "modal__title", text: opts.title || "" }));
    if (opts.sub) head.appendChild(U.el("div", { class: "modal__sub", text: opts.sub }));
    box.appendChild(head);

    var body = U.el("div", { class: "modal__body" });
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    var foot = U.el("div", { class: "modal__foot" });
    var close;
    (opts.actions || []).forEach(function (a) {
      var b = U.el("button", { class: "btn " + (a.variant || ""), type: "button" }, a.label);
      b.addEventListener("click", function () {
        if (!a.onClick || a.onClick(body, b) !== false) close();
      });
      foot.appendChild(b);
    });
    if ((opts.actions || []).length) box.appendChild(foot);

    close = openOverlay(box, { onClose: opts.onClose });
    return { close: function () { close(); }, body: body };
  }

  function confirm(opts) {
    return new Promise(function (resolve) {
      var answered = false;
      modal({
        title: opts.title || "Are you sure?",
        sub: opts.msg,
        actions: [
          { label: opts.cancelLabel || "Cancel", variant: "", onClick: function () { answered = true; resolve(false); } },
          {
            label: opts.confirmLabel || "Confirm",
            variant: opts.danger ? "btn--danger" : "btn--primary",
            onClick: function () { answered = true; resolve(true); }
          }
        ],
        onClose: function () { if (!answered) resolve(false); }
      });
    });
  }

  /* ------------------------------- drawer ------------------------------- */
  function drawer(opts) {
    var box = U.el("div", {
      class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Panel"
    });
    var head = U.el("div", { class: "drawer__head" });
    var titleWrap = U.el("div");
    titleWrap.appendChild(U.el("div", { class: "modal__title", text: opts.title || "" }));
    if (opts.sub) titleWrap.appendChild(U.el("div", { class: "card__sub", text: opts.sub }));
    head.appendChild(titleWrap);
    var x = U.el("button", { class: "btn btn--ghost btn--icon btn--sm", type: "button", "aria-label": "Close", html: U.icon("x", 17) });
    head.appendChild(x);
    box.appendChild(head);

    var body = U.el("div", { class: "drawer__body" });
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    box.appendChild(body);

    if (opts.foot) {
      var foot = U.el("div", { class: "drawer__foot" });
      if (typeof opts.foot === "string") foot.innerHTML = opts.foot;
      else foot.appendChild(opts.foot);
      box.appendChild(foot);
    }

    var close = openOverlay(box, { drawer: true, onClose: opts.onClose });
    x.addEventListener("click", function () { close(); });
    return { close: close, body: body, root: box };
  }

  /* --------------------------- small builders --------------------------- */
  var STATUS = {
    normal:   { cls: "ok",   label: "Normal",   icon: "checkCircle" },
    occupied: { cls: "warn", label: "Occupied", icon: "users" },
    alert:    { cls: "crit", label: "Alert",    icon: "alert" }
  };

  /* Status always ships as icon + label, never colour alone. */
  function statusBadge(status, size) {
    var s = STATUS[status] || STATUS.normal;
    return '<span class="badge badge--' + s.cls + (size === "lg" ? " badge--lg" : "") + '">' +
      U.icon(s.icon, 12) + s.label + "</span>";
  }

  function statusMeta(status) { return STATUS[status] || STATUS.normal; }

  function deviceChip(key, on, asButton) {
    var D = CW.store.DEVICES[key];
    var tag = asButton ? "button" : "span";
    return "<" + tag + ' class="dev dev--' + key + (on ? " dev--on" : "") + '"' +
      (asButton ? ' type="button" data-dev="' + key + '"' : "") + ">" +
      U.icon(D.icon, 13) + D.short + " " + (on ? "ON" : "OFF") + "</" + tag + ">";
  }

  function statTile(opts) {
    var node = U.el("div", { class: "card stat stat--" + (opts.tone || "ink") + (opts.anim ? " anim-in" : "") });
    node.appendChild(U.el("div", { class: "stat__label", text: opts.label }));
    var val = U.el("div", { class: "stat__value" });
    val.appendChild(document.createTextNode(opts.value));
    if (opts.unit) val.appendChild(U.el("span", { class: "stat__unit", text: opts.unit }));
    node.appendChild(val);
    if (opts.icon) node.appendChild(U.el("div", { class: "stat__icon", html: U.icon(opts.icon, 17) }));

    if (opts.delta != null || opts.foot) {
      var foot = U.el("div", { class: "stat__foot" });
      if (opts.delta != null) {
        var dir = opts.delta > 0.05 ? "up" : opts.delta < -0.05 ? "down" : "flat";
        // "up is good" depends on the metric, so the caller declares it
        var good = opts.upIsGood ? dir === "up" : dir === "down";
        var cls = dir === "flat" ? "delta--flat" : good ? "delta--good" : "delta--bad";
        foot.appendChild(U.el("span", {
          class: "delta " + cls,
          html: (dir === "flat" ? "" : U.icon(dir === "up" ? "arrowUp" : "arrowDown", 13)) +
            '<span>' + (opts.delta > 0 ? "+" : "") + U.fmt(opts.delta, 1) + "%</span>"
        }));
      }
      if (opts.foot) foot.appendChild(U.el("span", { text: opts.foot }));
      node.appendChild(foot);
    }
    if (opts.spark) {
      var sp = U.el("div", { class: "stat__spark" });
      node.appendChild(sp);
      setTimeout(function () { CW.charts.sparkline(sp, opts.spark, opts.sparkColor || CW.charts.cssVar("--blue")); }, 0);
    }
    return node;
  }

  function emptyState(icon, title, msg, action) {
    var node = U.el("div", { class: "empty" });
    node.appendChild(U.el("div", { class: "empty__icon", html: U.icon(icon, 25) }));
    node.appendChild(U.el("div", { class: "empty__title", text: title }));
    if (msg) node.appendChild(U.el("div", { class: "empty__msg", text: msg }));
    if (action) {
      var b = U.el("button", { class: "btn btn--primary u-mt-16", type: "button" }, action.label);
      b.addEventListener("click", action.onClick);
      node.appendChild(b);
    }
    return node;
  }

  /* A labelled form field; returns the wrapper so callers can mark errors. */
  function field(opts) {
    var id = opts.id || U.uid("f");
    var wrap = U.el("div", { class: "field" });
    wrap.appendChild(U.el("label", { class: "field__label", for: id, text: opts.label }));

    var input;
    if (opts.type === "select") {
      var sw = U.el("div", { class: "select-wrap" });
      input = U.el("select", { class: "select", id: id, name: opts.name || id });
      (opts.options || []).forEach(function (o) {
        input.appendChild(U.el("option", { value: o.value, selected: o.value === opts.value }, o.label));
      });
      sw.appendChild(input);
      sw.appendChild(U.el("span", { class: "select-wrap__chev", html: U.icon("chevronDown", 16) }));
      wrap.appendChild(sw);
    } else if (opts.type === "textarea") {
      input = U.el("textarea", { class: "textarea", id: id, name: opts.name || id, placeholder: opts.placeholder || "" });
      if (opts.value) input.value = opts.value;
      wrap.appendChild(input);
    } else {
      var group = U.el("div", { class: "input-group" + (opts.toggle ? " input-group--btn" : "") });
      if (opts.icon) group.appendChild(U.el("span", { class: "input-group__icon", html: U.icon(opts.icon, 17) }));
      input = U.el("input", {
        class: "input", id: id, name: opts.name || id, type: opts.type || "text",
        placeholder: opts.placeholder || "", autocomplete: opts.autocomplete || "off",
        inputmode: opts.inputmode, min: opts.min, max: opts.max, value: opts.value == null ? "" : opts.value
      });
      if (!opts.icon) input.style.paddingLeft = "13px";
      group.appendChild(input);
      if (opts.toggle) {
        var tbtn = U.el("button", {
          class: "input-group__btn", type: "button", "aria-label": "Show password", html: U.icon("eye", 17)
        });
        tbtn.addEventListener("click", function () {
          var show = input.type === "password";
          input.type = show ? "text" : "password";
          tbtn.innerHTML = U.icon(show ? "eyeOff" : "eye", 17);
          tbtn.setAttribute("aria-label", show ? "Hide password" : "Show password");
        });
        group.appendChild(tbtn);
      }
      wrap.appendChild(group);
    }

    if (opts.hint) wrap.appendChild(U.el("div", { class: "field__hint", text: opts.hint }));
    wrap.appendChild(U.el("div", { class: "field__err", html: U.icon("alert", 12) + "<span></span>" }));
    wrap.input = input;
    return wrap;
  }

  function setError(fieldWrap, msg) {
    fieldWrap.classList.toggle("is-invalid", !!msg);
    var span = U.qs(".field__err span", fieldWrap);
    if (span) span.textContent = msg || "";
    if (fieldWrap.input) fieldWrap.input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  CW.ui = {
    applyTheme: applyTheme, effectiveTheme: effectiveTheme, setTheme: setTheme,
    themeSwitcher: themeSwitcher, mountThemeSwitchers: mountThemeSwitchers,
    toast: toast, modal: modal, confirm: confirm, drawer: drawer,
    statusBadge: statusBadge, statusMeta: statusMeta, deviceChip: deviceChip,
    statTile: statTile, emptyState: emptyState, field: field, setError: setError,
    STATUS: STATUS
  };
})(window, document);
