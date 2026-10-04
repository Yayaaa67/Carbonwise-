/* ==========================================================================
   CarbonWise - shell, router and live refresh plumbing
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW;
  var U = CW.util, UI = CW.ui, S = CW.store, V = CW.views;

  var NAV = [
    { group: "Main", items: [
      { path: "/dashboard", label: "Dashboard",           icon: "dashboard" },
      { path: "/rooms",     label: "Rooms",               icon: "rooms" },
      { path: "/energy",    label: "Energy Usage",        icon: "energy" },
      { path: "/reports",   label: "Reports",             icon: "reports" },
      { path: "/control",   label: "Quick Device Control", icon: "control" }
    ] },
    { group: "Management", items: [
      { path: "/settings",  label: "Settings",        icon: "settings" },
      { path: "/profile",   label: "Profile",         icon: "user" },
      { path: "/override",  label: "Manual Override", icon: "override" }
    ] }
  ];

  var PUBLIC = { "/": "landing", "/login": "login", "/signup": "signup" };
  var APP = {
    "/dashboard": "dashboard", "/rooms": "rooms", "/energy": "energy",
    "/reports": "reports", "/control": "control",
    "/settings": "settings", "/profile": "profile", "/override": "override"
  };

  var root = null;
  var refresher = null;
  var lastRefresh = 0;
  var currentPath = "";

  /* The hash can carry a query (#/rooms?room=RA102); routing ignores it. */
  function path() {
    var h = window.location.hash.replace(/^#/, "").split("?")[0];
    return h || "/";
  }

  function go(p) { window.location.hash = p; }

  /* ------------------------------------------------------------------
     Route guard: an account that is not verified, or a building that is
     not set up, can only be in one place.
     ------------------------------------------------------------------ */
  function resolve(p) {
    var st = S.state;
    var authed = st.account && st.session.loggedIn;

    if (!authed) return PUBLIC[p] ? p : "/";
    if (!st.account.verified) return "/verify";
    if (!st.onboarding.complete) return "/onboarding";
    if (p === "/verify" || p === "/onboarding") return "/dashboard";
    if (APP[p]) return p;
    if (PUBLIC[p] && p !== "/") return "/dashboard";
    return p === "/" ? "/dashboard" : "/dashboard";
  }

  /* ------------------------------ shell ------------------------------ */
  function sidebarHtml(active) {
    var acc = S.state.account || {};
    var alerts = S.alertRooms().length;
    var overrides = S.overriddenRooms().length;

    var groups = NAV.map(function (g) {
      var items = g.items.map(function (it) {
        var badge = "";
        if (it.path === "/rooms" && alerts) badge = '<span class="navlink__badge">' + alerts + "</span>";
        if (it.path === "/override" && overrides) badge = '<span class="navlink__badge navlink__badge--quiet">' + overrides + "</span>";
        return '<a class="navlink" href="#' + it.path + '"' +
          (active === it.path ? ' aria-current="page"' : "") + ">" +
          U.icon(it.icon, 18) + "<span>" + it.label + "</span>" + badge + "</a>";
      }).join("");
      return '<div class="cw-sidebar__group">' +
        '<div class="cw-sidebar__legend">' + g.group + "</div>" + items + "</div>";
    }).join("");

    return '<aside class="cw-sidebar" id="cwSidebar">' +
      '<div class="cw-sidebar__top">' +
        '<a class="brand" href="#/dashboard" aria-label="CarbonWise dashboard">' + U.logo(30) + "</a>" +
      "</div>" +
      '<nav class="cw-sidebar__nav" aria-label="Main">' + groups + "</nav>" +
      '<div class="cw-sidebar__foot" style="position:relative">' +
        '<div class="cw-sidebar__theme">' +
          '<span class="cw-sidebar__theme-lbl">Theme</span>' +
          '<span data-theme-slot="seg"></span>' +
        "</div>" +
        '<button class="cw-user" type="button" id="cwUserBtn" aria-haspopup="true" aria-expanded="false">' +
          '<span class="avatar">' + U.esc(U.initials(acc.name)) + "</span>" +
          '<span class="u-grow"><span class="cw-user__name">' + U.esc(acc.name || "Manager") + "</span><br>" +
          '<span class="cw-user__role">' + U.esc(acc.role || "Building Manager") + "</span></span>" +
          '<span class="cw-user__chev">' + U.icon("chevronUpDown", 15) + "</span>" +
        "</button>" +
      "</div>" +
    "</aside>";
  }

  function renderShell(active) {
    root.innerHTML =
      '<a class="skip-link" href="#cwView">Skip to content</a>' +
      '<div class="cw-app">' +
        sidebarHtml(active) +
        '<div class="cw-main">' +
          '<div class="cw-mobilebar">' +
            '<button class="btn btn--ghost btn--icon" type="button" id="cwMenu" aria-label="Open navigation" aria-expanded="false">' +
              U.icon("menu", 20) + "</button>" +
            '<a class="brand" href="#/dashboard">' + U.logo(26) + "</a>" +
            '<span class="u-grow"></span>' +
            '<span data-theme-slot="compact"></span>' +
          "</div>" +
          '<main class="cw-page" id="cwView" tabindex="-1"></main>' +
        "</div>" +
      "</div>";

    wireShell();
  }

  function wireShell() {
    var sidebar = U.qs("#cwSidebar");
    var menu = U.qs("#cwMenu");
    var scrim = null;

    function closeNav() {
      sidebar.classList.remove("is-open");
      menu.setAttribute("aria-expanded", "false");
      if (scrim) { scrim.remove(); scrim = null; }
    }
    function openNav() {
      sidebar.classList.add("is-open");
      menu.setAttribute("aria-expanded", "true");
      scrim = U.el("div", { class: "cw-scrim" });
      scrim.addEventListener("click", closeNav);
      document.body.appendChild(scrim);
    }
    menu.addEventListener("click", function () {
      sidebar.classList.contains("is-open") ? closeNav() : openNav();
    });
    U.qsa(".navlink", sidebar).forEach(function (a) { a.addEventListener("click", closeNav); });

    /* user menu */
    var btn = U.qs("#cwUserBtn");
    var open = false, menuEl = null;
    function closeMenu() {
      if (menuEl) { menuEl.remove(); menuEl = null; }
      open = false;
      btn.setAttribute("aria-expanded", "false");
      document.removeEventListener("click", outside, true);
    }
    function outside(e) { if (menuEl && !menuEl.contains(e.target) && !btn.contains(e.target)) closeMenu(); }
    btn.addEventListener("click", function () {
      if (open) return closeMenu();
      open = true;
      btn.setAttribute("aria-expanded", "true");
      menuEl = U.el("div", { class: "cw-usermenu", role: "menu" });
      menuEl.innerHTML =
        '<a class="cw-usermenu__item" href="#/profile" role="menuitem">' + U.icon("user", 16) + "Profile</a>" +
        '<a class="cw-usermenu__item" href="#/settings" role="menuitem">' + U.icon("settings", 16) + "Settings</a>" +
        '<hr class="divider" style="margin:6px 4px">' +
        '<button class="cw-usermenu__item cw-usermenu__item--danger" type="button" role="menuitem" data-logout>' +
          U.icon("logout", 16) + "Log out</button>";
      btn.parentNode.appendChild(menuEl);
      U.qs("[data-logout]", menuEl).addEventListener("click", function () { closeMenu(); logout(); });
      U.qsa("a", menuEl).forEach(function (a) { a.addEventListener("click", closeMenu); });
      setTimeout(function () { document.addEventListener("click", outside, true); }, 0);
    });
  }

  function toggleTheme() {
    UI.setTheme(UI.effectiveTheme() === "dark" ? "light" : "dark");
  }

  function logout() {
    UI.confirm({
      title: "Log out of CarbonWise?",
      msg: "Your building data stays saved in this browser.",
      confirmLabel: "Log out"
    }).then(function (yes) {
      if (!yes) return;
      S.state.session = { loggedIn: false, remember: false };
      S.commit("logout");
      CW.sim.stop();
      go("/");
      UI.toast({ type: "info", title: "Logged out" });
    });
  }

  /* ------------------------------ render ------------------------------ */
  function render(keepScroll) {
    var want = resolve(path());
    if (want !== path()) { go(want); return; }

    var y = keepScroll ? window.scrollY : 0;
    currentPath = want;
    refresher = null;

    if (PUBLIC[want] || want === "/verify" || want === "/onboarding") {
      root.innerHTML = "";
      var name = PUBLIC[want] || want.slice(1);
      V[name](root);
      UI.mountThemeSwitchers(root);
      document.title = titleFor(want);
      window.scrollTo(0, y);
      return;
    }

    renderShell(want);
    var view = U.qs("#cwView");
    V[APP[want]](view, { setRefresher: function (fn) { refresher = fn; } });
    /* fills every [data-theme-slot] on the shell and the page in one pass */
    UI.mountThemeSwitchers(root);
    document.title = titleFor(want);
    window.scrollTo(0, y);
  }

  function titleFor(p) {
    var b = S.state.onboarding.buildingName;
    var found = null;
    NAV.forEach(function (g) { g.items.forEach(function (i) { if (i.path === p) found = i.label; }); });
    if (found) return found + (b ? " - " + b : "") + " | CarbonWise";
    return "CarbonWise - Track smarter. Live greener.";
  }

  /* Live refresh: volatile numbers update in place, charts are left alone
     so they never flash or lose a hovered position. */
  function onStore(reason) {
    if (reason === "tick" || reason === "tick-change") {
      var now = Date.now();
      if (now - lastRefresh < 1100) return;
      lastRefresh = now;
      updateSidebarBadges();
      if (refresher) { try { refresher(); } catch (e) { /* keep ticking */ } }
      return;
    }
    if (reason === "reset") render();
  }

  function updateSidebarBadges() {
    var sb = U.qs("#cwSidebar");
    if (!sb) return;
    var alerts = S.alertRooms().length;
    var link = U.qs('.navlink[href="#/rooms"]', sb);
    if (link) {
      var b = U.qs(".navlink__badge", link);
      if (alerts && !b) link.insertAdjacentHTML("beforeend", '<span class="navlink__badge">' + alerts + "</span>");
      else if (alerts && b) b.textContent = alerts;
      else if (!alerts && b) b.remove();
    }
    var ov = S.overriddenRooms().length;
    var olink = U.qs('.navlink[href="#/override"]', sb);
    if (olink) {
      var ob = U.qs(".navlink__badge", olink);
      if (ov && !ob) olink.insertAdjacentHTML("beforeend", '<span class="navlink__badge navlink__badge--quiet">' + ov + "</span>");
      else if (ov && ob) ob.textContent = ov;
      else if (!ov && ob) ob.remove();
    }
  }

  /* ------------------------------ boot ------------------------------ */
  function boot() {
    root = U.qs("#app");
    S.hydrate();
    UI.applyTheme(S.state.settings.theme);

    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onScheme = function () { if (S.state.settings.theme === "system") render(true); };
      if (mq.addEventListener) mq.addEventListener("change", onScheme);
      else if (mq.addListener) mq.addListener(onScheme);
    }

    S.on(onStore);
    window.addEventListener("hashchange", function () { render(); });

    if (S.state.onboarding.complete && S.state.rooms.length) CW.sim.start();
    render();
  }

  CW.app = {
    go: go, render: render, boot: boot, logout: logout, toggleTheme: toggleTheme,
    NAV: NAV,
    get path() { return currentPath; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(window, document);
