/* ==========================================================================
   CarbonWise - landing, sign up, log in, verification, onboarding
   ========================================================================== */
(function (window, document) {
  "use strict";

  var CW = window.CW || (window.CW = {});
  var U = CW.util, UI = CW.ui, S = CW.store;
  var V = CW.views || (CW.views = {});

  function nav(path) { window.location.hash = path; }

  /* Not a security measure - this prototype has no server. It only keeps
     the typed password out of localStorage in plain text. */
  function hashPw(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return "h" + h.toString(36);
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  /* ======================================================================
     Landing
     ====================================================================== */
  V.landing = function (root) {
    root.innerHTML =
      '<div class="lp">' +
        '<header class="lp__nav" id="lpNav">' +
          '<a class="brand" href="#/" aria-label="CarbonWise home">' + U.logo(30) + "</a>" +
          '<nav class="lp__nav-links">' +
            '<a class="lp__nav-link" href="#features">Features</a>' +
            '<a class="lp__nav-link" href="#how">How it works</a>' +
            '<a class="lp__nav-link" href="#impact">Impact</a>' +
          "</nav>" +
          '<div class="lp__nav-actions">' +
            '<span data-theme-slot="compact"></span>' +
            '<a class="btn btn--ghost lp__nav-login" href="#/login">Log In</a>' +
            '<a class="btn btn--ink" href="#/signup">Get Started</a>' +
          "</div>" +
        "</header>" +

        '<section class="lp__hero">' +
          '<div class="lp__hero-bg" aria-hidden="true"></div>' +
          '<div class="lp__hero-inner">' +
            "<div>" +
              '<span class="lp__eyebrow">' +
                '<span class="badge__dot" style="background:var(--green)"></span>Motion-aware energy management' +
              "</span>" +
              '<h1 class="lp__h1 display">Track smarter.<br><em>Live greener.</em></h1>' +
              '<p class="lp__lede">Monitor room occupancy, reduce unnecessary energy usage, and lower carbon emissions automatically.</p>' +
              '<div class="lp__cta">' +
                '<a class="btn btn--primary btn--lg" href="#/signup">Get Started' + U.icon("arrowRight", 17) + "</a>" +
                '<a class="btn btn--lg" href="#/login">Log In</a>' +
              "</div>" +
              '<div class="lp__trust">' +
                '<span class="lp__trust-item">' + U.icon("check", 15) + "Live occupancy sensing</span>" +
                '<span class="lp__trust-item">' + U.icon("check", 15) + "Automatic shut-off</span>" +
                '<span class="lp__trust-item">' + U.icon("check", 15) + "Carbon reporting</span>" +
              "</div>" +
            "</div>" +
            '<div class="lp__visual" aria-hidden="true">' +
              '<div class="lp__visual-head">' +
                '<div><div class="u-semi" style="font-size:.875rem">Block A &middot; Level 1</div>' +
                '<div class="u-xs u-dim">Live room status</div></div>' +
                '<span class="badge badge--live"><span class="badge__dot"></span>Live</span>' +
              "</div>" +
              '<div class="lp__visual-grid" id="lpGrid"></div>' +
              '<div class="lp__visual-foot">' +
                '<span class="u-row u-gap-6"><span class="sdot sdot--ok"></span>Normal</span>' +
                '<span class="u-row u-gap-6"><span class="sdot sdot--warn"></span>Occupied</span>' +
                '<span class="u-row u-gap-6"><span class="sdot sdot--crit"></span>Alert</span>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</section>" +

        '<section class="lp__section lp__section--alt" id="features">' +
          '<div class="lp__section-inner">' +
            '<div class="lp__section-head">' +
              '<h2 class="lp__h2">Built for the people who run the building</h2>' +
              '<p class="lp__section-lede">CarbonWise watches every room so your team does not have to. ' +
                "When a room empties and the air-conditioning is still running, you know within minutes.</p>" +
            "</div>" +
            '<div class="grid grid--3">' +
              feat("blue", "motion", "Occupancy by motion",
                "Passive infrared sensors report motion per room. No cameras, no logins, nothing for residents to do.") +
              feat("crit", "alert", "Waste caught early",
                "A room with no motion past your idle threshold but devices still drawing power is flagged as an alert immediately.") +
              feat("green", "power", "Automatic shut-off",
                "Choose which devices CarbonWise may switch off on its own. Air-conditioning and fans are the usual candidates.") +
              feat("blue", "monitor", "One central dashboard",
                "Every block, floor and room on a single screen, with live load in kilowatts and today's consumption.") +
              feat("green", "leaf", "Carbon accounting",
                "Consumption converts to kilograms of CO2 using your grid emission factor, so savings are reportable.") +
              feat("blue", "reports", "Reports that export",
                "Generate consumption, carbon and alert reports for any period and export them as CSV.") +
            "</div>" +
          "</div>" +
        "</section>" +

        '<section class="lp__section" id="how">' +
          '<div class="lp__section-inner">' +
            '<div class="lp__section-head">' +
              '<h2 class="lp__h2">How it works</h2>' +
              '<p class="lp__section-lede">Four steps, running continuously in the background.</p>' +
            "</div>" +
            '<div class="steps">' +
              step(1, "Sense", "A motion sensor in each room reports whether anyone is present.") +
              step(2, "Wait", "If no motion is detected for your chosen threshold, the room is marked idle.") +
              step(3, "Flag", "Any device still drawing power in an idle room raises an alert on the dashboard.") +
              step(4, "Act", "CarbonWise switches off the devices you have authorised, or your team overrides it manually.") +
            "</div>" +
          "</div>" +
        "</section>" +

        '<section class="lp__section lp__section--alt" id="impact">' +
          '<div class="lp__section-inner">' +
            '<div class="grid grid--half" style="align-items:center;gap:40px">' +
              "<div>" +
                '<h2 class="lp__h2">Small rooms, large numbers</h2>' +
                '<p class="lp__section-lede">A single air-conditioner left running in an empty room for eight hours burns ' +
                  "roughly 9 kWh. Across a residential college that repeats hundreds of times a week.</p>" +
                '<div class="u-mt-24" style="display:grid;gap:14px;max-width:420px">' +
                  impactRow("1,150 W", "Typical hostel air-conditioner draw") +
                  impactRow("0.585 kg", "CO2 per kWh on the Peninsular Malaysia grid") +
                  impactRow("30 min", "Default idle threshold before a room is flagged") +
                "</div>" +
              "</div>" +
              '<div class="card card--pad">' +
                '<div class="u-row-sb u-mb-16">' +
                  '<div><div class="card__title">Where the energy goes</div>' +
                  '<div class="card__sub">Typical weekday split</div></div>' +
                "</div>" +
                '<div id="lpShare"></div>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</section>" +

        '<section class="lp__section">' +
          '<div class="lp__cta-band">' +
            '<h2 class="lp__h2">Start tracking your building today</h2>' +
            '<p class="lp__section-lede" style="margin-inline:auto;max-width:52ch">' +
              "Set up takes under a minute. Name your building, tell CarbonWise how many rooms you manage, " +
              "and pick the devices you want watched.</p>" +
            '<div class="lp__cta" style="justify-content:center">' +
              '<a class="btn btn--primary btn--lg" href="#/signup">Create your account' + U.icon("arrowRight", 17) + "</a>" +
              '<a class="btn btn--lg" href="#/login">I already have one</a>' +
            "</div>" +
          "</div>" +
        "</section>" +

        '<footer class="lp__foot">' +
          '<div class="u-row u-gap-12"><a class="brand" href="#/">' + U.logo(26) + "</a>" +
          '<span class="u-xs u-dim">Track smarter. Live greener.</span></div>' +
          "<span>Prototype build &middot; data is stored in your browser</span>" +
        "</footer>" +
      "</div>";

    /* a quietly animating status grid, so the hero shows the product idea */
    var grid = U.qs("#lpGrid", root);
    var cells = [];
    var kinds = ["normal", "normal", "occupied", "normal", "occupied", "normal", "normal", "alert",
                 "normal", "occupied", "normal", "normal", "occupied", "normal", "normal", "occupied",
                 "alert", "normal", "normal", "normal", "occupied", "normal", "normal", "occupied"];
    kinds.forEach(function (k) {
      var c = U.el("div", { class: "lp__cell lp__cell--" + k });
      cells.push(c);
      grid.appendChild(c);
    });
    var spin = setInterval(function () {
      if (!document.body.contains(grid)) { clearInterval(spin); return; }
      var i = Math.floor(Math.random() * cells.length);
      var next = U.pick(["normal", "occupied", "normal", "occupied", "alert"]);
      cells[i].className = "lp__cell lp__cell--" + next;
    }, 1400);

    CW.charts.shareBar(U.qs("#lpShare", root), [
      { label: "Air conditioning", value: 68.2, color: CW.charts.cssVar("--s-ac") },
      { label: "Lighting", value: 18.4, color: CW.charts.cssVar("--s-light") },
      { label: "Fans", value: 10.7, color: CW.charts.cssVar("--s-fan") }
    ], "kWh");

    var navEl = U.qs("#lpNav", root);
    var onScroll = function () { navEl.classList.toggle("is-stuck", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    U.qsa('a[href^="#"]:not([href^="#/"])', root).forEach(function (a) {
      a.addEventListener("click", function (e) {
        var target = U.qs(a.getAttribute("href"), root);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  function feat(tone, icon, title, text) {
    return '<article class="card feat">' +
      '<div class="feat__icon feat__icon--' + tone + '">' + U.icon(icon, 20) + "</div>" +
      '<h3 class="feat__title">' + U.esc(title) + "</h3>" +
      '<p class="feat__text">' + U.esc(text) + "</p></article>";
  }
  function step(n, title, text) {
    return '<article class="card step">' +
      '<div class="step__n">' + n + "</div>" +
      '<h3 class="step__title">' + U.esc(title) + "</h3>" +
      '<p class="step__text">' + U.esc(text) + "</p></article>";
  }
  function impactRow(big, small) {
    return '<div class="card card--pad u-row u-gap-16" style="padding:14px 16px">' +
      '<span class="u-semi" style="font-size:1.125rem;min-width:92px">' + U.esc(big) + "</span>" +
      '<span class="u-sm u-muted">' + U.esc(small) + "</span></div>";
  }

  /* ======================================================================
     Auth shell
     ====================================================================== */
  function authShell(inner, quote, by) {
    return '<div class="auth">' +
      '<div class="auth__main">' +
        '<div class="auth__top">' +
          '<a class="brand" href="#/" aria-label="CarbonWise home">' + U.logo(30) + "</a>" +
          '<div class="u-row u-gap-6">' +
            '<span data-theme-slot="compact" data-theme-small></span>' +
            '<a class="btn btn--ghost btn--sm" href="#/">' + U.icon("chevronLeft", 15) + "Back</a>" +
          "</div>" +
        "</div>" +
        '<div class="auth__card">' + inner + "</div>" +
        '<div class="auth__foot"><span>&copy; ' + new Date().getFullYear() + " CarbonWise</span>" +
          "<span>Prototype build</span></div>" +
      "</div>" +
      '<aside class="auth__aside">' +
        '<p class="auth__aside-quote display">' + U.esc(quote) + "</p>" +
        '<p class="auth__aside-by">' + U.esc(by) + "</p>" +
      "</aside>" +
    "</div>";
  }

  var GOOGLE_BTN = '<button class="btn btn--block" type="button" data-google>' +
    U.icon("google") + "Continue with Google</button>";

  /* ======================================================================
     Sign up
     ====================================================================== */
  V.signup = function (root) {
    root.innerHTML = authShell(
      '<h1 class="auth__title display">Create your CarbonWise account</h1>' +
      '<p class="auth__sub">Manage energy across every room in your building from one place.</p>' +
      '<div class="u-mt-24">' + GOOGLE_BTN + "</div>" +
      '<div class="divider--text u-mt-20 u-mb-20">or</div>' +
      '<form id="suForm" novalidate style="display:grid;gap:16px"></form>' +
      '<p class="u-sm u-muted u-mt-20 u-center">Already have an account? <a href="#/login">Log in</a></p>' +
      '<p class="u-xs u-dim u-mt-16 u-center">By continuing you agree to the CarbonWise acceptable use policy.</p>',
      "Energy you never meant to spend is the cheapest energy to save.",
      "Why CarbonWise exists"
    );

    var form = U.qs("#suForm", root);
    var fName = UI.field({ label: "Full name", icon: "user", placeholder: "Nur Yasmin binti Azlan", autocomplete: "name" });
    var fEmail = UI.field({ label: "Email", type: "email", icon: "mail", placeholder: "you@university.edu.my", autocomplete: "email" });
    var fPw = UI.field({ label: "Password", type: "password", icon: "lock", placeholder: "At least 8 characters", toggle: true, autocomplete: "new-password" });
    var fPw2 = UI.field({ label: "Confirm password", type: "password", icon: "lock", placeholder: "Re-enter your password", toggle: true, autocomplete: "new-password" });
    [fName, fEmail, fPw, fPw2].forEach(function (f) { form.appendChild(f); });

    var submit = U.el("button", { class: "btn btn--primary btn--lg btn--block u-mt-8", type: "submit" }, "Continue with Email");
    form.appendChild(submit);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var name = fName.input.value.trim();
      var email = fEmail.input.value.trim().toLowerCase();
      var pw = fPw.input.value;
      var pw2 = fPw2.input.value;

      UI.setError(fName, name.length < 2 ? "Enter your full name." : "");
      if (name.length < 2) ok = false;
      UI.setError(fEmail, !validEmail(email) ? "Enter a valid email address." : "");
      if (!validEmail(email)) ok = false;
      UI.setError(fPw, pw.length < 8 ? "Use at least 8 characters." : "");
      if (pw.length < 8) ok = false;
      UI.setError(fPw2, pw2 !== pw ? "Passwords do not match." : "");
      if (pw2 !== pw) ok = false;
      if (!ok) return;

      submit.classList.add("is-loading");
      setTimeout(function () {
        S.state.account = {
          name: name, email: email, pw: hashPw(pw),
          role: "Building Manager", verified: false, createdAt: Date.now()
        };
        S.state.session = { loggedIn: true, remember: true };
        S.commit("signup");
        UI.toast({ type: "ok", title: "Account created", msg: "Verify your email to continue." });
        nav("/verify");
      }, 650);
    });

    wireGoogle(root, "signup");
  };

  /* ======================================================================
     Log in
     ====================================================================== */
  V.login = function (root) {
    var known = S.state.account;
    root.innerHTML = authShell(
      '<h1 class="auth__title display">Welcome back</h1>' +
      '<p class="auth__sub">Log in to your building dashboard.</p>' +
      '<div class="u-mt-24">' + GOOGLE_BTN + "</div>" +
      '<div class="divider--text u-mt-20 u-mb-20">or</div>' +
      '<form id="liForm" novalidate style="display:grid;gap:16px"></form>' +
      '<p class="u-sm u-muted u-mt-20 u-center">Do not have an account? <a href="#/signup">Sign up</a></p>',
      "Twenty-four rooms, one screen, and nothing running in an empty room.",
      "CarbonWise for residential colleges"
    );

    var form = U.qs("#liForm", root);
    var fEmail = UI.field({
      label: "Email", type: "email", icon: "mail", placeholder: "you@university.edu.my",
      autocomplete: "username", value: known ? known.email : ""
    });
    var fPw = UI.field({ label: "Password", type: "password", icon: "lock", placeholder: "Your password", toggle: true, autocomplete: "current-password" });
    form.appendChild(fEmail);
    form.appendChild(fPw);

    var row = U.el("div", { class: "u-row-sb" });
    var remember = U.el("label", { class: "check" });
    remember.innerHTML = '<input type="checkbox" checked><span class="check__box">' + U.icon("check", 12) +
      '</span><span class="check__label">Remember me</span>';
    row.appendChild(remember);
    var forgot = U.el("button", { class: "u-sm", type: "button", style: "color:var(--blue-ink);font-weight:550" }, "Forgot password?");
    row.appendChild(forgot);
    form.appendChild(row);

    var submit = U.el("button", { class: "btn btn--primary btn--lg btn--block u-mt-8", type: "submit" }, "Log In");
    form.appendChild(submit);

    if (!known) {
      form.appendChild(U.el("div", { class: "callout callout--info u-mt-8" }, [
        U.el("span", { class: "callout__icon", html: U.icon("info", 18) }),
        U.el("span", { class: "callout__text", text: "No account exists in this browser yet. Sign up first, or use Continue with Google to create a demo account instantly." })
      ]));
    }

    forgot.addEventListener("click", function () {
      UI.modal({
        title: "Reset your password",
        sub: "We will email a reset link to the address on your account.",
        body: '<p class="u-sm u-muted">This prototype has no mail server attached, so no email is actually sent.</p>',
        actions: [
          { label: "Cancel" },
          { label: "Send reset link", variant: "btn--primary", onClick: function () {
            UI.toast({ type: "info", title: "Reset link sent", msg: "Check your inbox for instructions." });
          } }
        ]
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = fEmail.input.value.trim().toLowerCase();
      var pw = fPw.input.value;
      var ok = true;
      UI.setError(fEmail, !validEmail(email) ? "Enter a valid email address." : "");
      if (!validEmail(email)) ok = false;
      UI.setError(fPw, !pw ? "Enter your password." : "");
      if (!pw) ok = false;
      if (!ok) return;

      if (!known) { UI.setError(fEmail, "No account found for this email."); return; }
      if (known.email !== email || known.pw !== hashPw(pw)) {
        UI.setError(fPw, "Email or password is incorrect.");
        return;
      }

      submit.classList.add("is-loading");
      setTimeout(function () {
        S.state.session = { loggedIn: true, remember: U.qs("input", remember).checked };
        S.commit("login");
        UI.toast({ type: "ok", title: "Welcome back, " + known.name.split(" ")[0] });
        nav(known.verified ? (S.state.onboarding.complete ? "/dashboard" : "/onboarding") : "/verify");
      }, 600);
    });

    wireGoogle(root, "login");
  };

  /* A one-tap demo account, so the flow can be walked without typing. */
  function wireGoogle(root, mode) {
    var btn = U.qs("[data-google]", root);
    if (!btn) return;
    btn.addEventListener("click", function () {
      btn.classList.add("is-loading");
      setTimeout(function () {
        if (!S.state.account) {
          S.state.account = {
            name: "Yaya Rahman", email: "yaya.rahman@utp.edu.my", pw: hashPw("google-oauth"),
            role: "Building Manager", verified: true, createdAt: Date.now(), via: "google"
          };
        } else {
          S.state.account.verified = true;
        }
        S.state.session = { loggedIn: true, remember: true };
        S.commit(mode + "-google");
        UI.toast({ type: "ok", title: "Signed in with Google" });
        nav(S.state.onboarding.complete ? "/dashboard" : "/onboarding");
      }, 700);
    });
  }

  /* ======================================================================
     Email verification
     ====================================================================== */
  V.verify = function (root) {
    var acc = S.state.account || { email: "your email address" };
    root.innerHTML = authShell(
      '<div class="verify-icon">' + U.icon("mail", 32) + "</div>" +
      '<h1 class="auth__title display">Check your email</h1>' +
      '<p class="auth__sub">We have sent a verification link to <strong style="color:var(--ink)">' +
        U.esc(acc.email) + "</strong>.</p>" +
      '<div class="u-mt-24" style="display:grid;gap:10px">' +
        '<button class="btn btn--primary btn--lg btn--block" type="button" data-open>' + U.icon("external", 17) + "Open Email</button>" +
        '<button class="btn btn--block" type="button" data-resend>' + U.icon("refresh", 17) + "Resend Email</button>" +
        '<button class="btn btn--ghost btn--block" type="button" data-change>Change Email</button>' +
      "</div>" +
      '<div class="divider--text u-mt-24 u-mb-16">prototype</div>' +
      '<p class="u-xs u-dim u-center">No mail server is attached to this build. ' +
        '<button type="button" data-skip style="color:var(--blue-ink);font-weight:600">Mark as verified</button> to continue.</p>',
      "One click in the inbox, then the whole building is on screen.",
      "Verification keeps your account yours"
    );
    UI.mountThemeSwitchers(root);   // re-rendered directly after an email change

    U.qs("[data-open]", root).addEventListener("click", function () {
      var domain = String(acc.email).split("@")[1] || "";
      var url = /gmail|googlemail/.test(domain) ? "https://mail.google.com" :
                /outlook|hotmail|live/.test(domain) ? "https://outlook.live.com" :
                /yahoo/.test(domain) ? "https://mail.yahoo.com" : null;
      if (url) window.open(url, "_blank", "noopener");
      else UI.toast({ type: "info", title: "Open your mail app", msg: "We could not detect your provider automatically." });
    });

    U.qs("[data-resend]", root).addEventListener("click", function (e) {
      var b = e.currentTarget;
      b.classList.add("is-loading");
      setTimeout(function () {
        b.classList.remove("is-loading");
        UI.toast({ type: "ok", title: "Verification email resent", msg: "It can take a minute to arrive." });
      }, 700);
    });

    U.qs("[data-change]", root).addEventListener("click", function () {
      var f = UI.field({ label: "New email address", type: "email", icon: "mail", value: acc.email });
      var m = UI.modal({
        title: "Change email address",
        sub: "We will send a fresh verification link to the new address.",
        body: f,
        actions: [
          { label: "Cancel" },
          { label: "Save and resend", variant: "btn--primary", onClick: function () {
            var v = f.input.value.trim().toLowerCase();
            if (!validEmail(v)) { UI.setError(f, "Enter a valid email address."); return false; }
            S.state.account.email = v;
            S.commit("email-change");
            UI.toast({ type: "ok", title: "Email updated", msg: "Verification sent to " + v });
            V.verify(root);
          } }
        ]
      });
      void m;
    });

    U.qs("[data-skip]", root).addEventListener("click", function () {
      S.state.account.verified = true;
      S.commit("verified");
      UI.toast({ type: "ok", title: "Email verified" });
      nav(S.state.onboarding.complete ? "/dashboard" : "/onboarding");
    });
  };

  /* ======================================================================
     Onboarding
     ====================================================================== */
  var onbStep = 0;
  var onbDraft = null;

  V.onboarding = function (root) {
    if (!onbDraft) {
      onbDraft = {
        buildingName: S.state.onboarding.buildingName || "",
        roomCount: S.state.onboarding.roomCount || 24,
        devices: Object.assign({}, S.state.onboarding.devices)
      };
    }
    renderOnb(root);
  };

  function renderOnb(root) {
    var acc = S.state.account || {};
    var dots = [0, 1, 2, 3].map(function (i) {
      return '<span class="onb__dot ' + (i < onbStep ? "is-done" : i === onbStep ? "is-now" : "") + '"></span>';
    }).join("");

    root.innerHTML =
      '<div class="onb">' +
        '<div class="onb__top">' +
          '<a class="brand" href="#/dashboard" aria-label="CarbonWise">' + U.logo(28) + "</a>" +
          '<div class="u-row u-gap-10">' +
            '<span class="u-sm u-dim">Step ' + (onbStep + 1) + " of 4</span>" +
            '<span data-theme-slot="compact" data-theme-small></span>' +
          "</div>" +
        "</div>" +
        '<div class="onb__main">' +
          '<div class="onb__card">' +
            '<div class="onb__progress">' + dots + "</div>" +
            '<div class="card card--pad" style="padding:30px" id="onbBody"></div>' +
          "</div>" +
        "</div>" +
      "</div>";

    var body = U.qs("#onbBody", root);
    UI.mountThemeSwitchers(root);   // this screen re-renders outside the router

    if (onbStep === 0) {
      body.innerHTML =
        '<span class="onb__step">Welcome</span>' +
        '<h1 class="onb__title display">Welcome to CarbonWise' + (acc.name ? ", " + U.esc(acc.name.split(" ")[0]) : "") + "</h1>" +
        '<p class="onb__sub">Let us set up your building. You can change any of this later in Settings.</p>' +
        '<div class="u-mt-24" id="slot"></div>';
      var f1 = UI.field({
        label: "Building name", icon: "building",
        placeholder: "UTP Residential College", value: onbDraft.buildingName
      });
      U.qs("#slot", body).appendChild(f1);
      actions(body, "Continue", function () {
        var v = f1.input.value.trim();
        if (v.length < 2) { UI.setError(f1, "Give your building a name."); return; }
        onbDraft.buildingName = v;
        onbStep = 1; renderOnb(root);
      });
      f1.input.addEventListener("keydown", function (e) { if (e.key === "Enter") U.qs("[data-next]", body).click(); });

    } else if (onbStep === 1) {
      body.innerHTML =
        '<span class="onb__step">Rooms</span>' +
        '<h1 class="onb__title display">How many rooms are you managing?</h1>' +
        '<p class="onb__sub">CarbonWise will create a monitored room for each one. Most residential blocks run between 16 and 48.</p>' +
        '<div class="u-mt-24" id="slot"></div>';
      var f2 = UI.field({
        label: "Number of rooms", type: "number", icon: "rooms",
        value: onbDraft.roomCount, min: 1, max: 120, inputmode: "numeric",
        hint: "Between 1 and 120 rooms."
      });
      var slot = U.qs("#slot", body);
      slot.appendChild(f2);
      var quick = U.el("div", { class: "u-row u-gap-8 u-wrap u-mt-12" });
      [12, 24, 36, 48].forEach(function (n) {
        var b = U.el("button", { class: "chip", type: "button" }, String(n) + " rooms");
        b.addEventListener("click", function () { f2.input.value = n; UI.setError(f2, ""); });
        quick.appendChild(b);
      });
      slot.appendChild(quick);
      actions(body, "Continue", function () {
        var n = parseInt(f2.input.value, 10);
        if (!n || n < 1 || n > 120) { UI.setError(f2, "Enter a number between 1 and 120."); return; }
        onbDraft.roomCount = n;
        onbStep = 2; renderOnb(root);
      }, function () { onbStep = 0; renderOnb(root); });

    } else if (onbStep === 2) {
      body.innerHTML =
        '<span class="onb__step">Devices</span>' +
        '<h1 class="onb__title display">Which devices would you like to monitor?</h1>' +
        '<p class="onb__sub">Pick at least one. These appear on every room card and in your reports.</p>' +
        '<div class="u-mt-24" style="display:grid;gap:10px" id="slot"></div>';
      var slot2 = U.qs("#slot", body);
      S.DEVICE_KEYS.forEach(function (k) {
        var d = S.DEVICES[k];
        var btn = U.el("button", {
          class: "optcard" + (onbDraft.devices[k] ? " is-on" : ""),
          type: "button", role: "checkbox", "aria-checked": onbDraft.devices[k] ? "true" : "false"
        });
        btn.innerHTML =
          '<span class="optcard__icon">' + U.icon(d.icon, 19) + "</span>" +
          "<span><span class=\"optcard__title\">" + U.esc(d.label) + "</span><br>" +
          '<span class="optcard__sub">About ' + d.watts + " W per room</span></span>" +
          '<span class="optcard__tick">' + U.icon("checkCircle", 19) + "</span>";
        btn.addEventListener("click", function () {
          onbDraft.devices[k] = !onbDraft.devices[k];
          btn.classList.toggle("is-on", onbDraft.devices[k]);
          btn.setAttribute("aria-checked", onbDraft.devices[k] ? "true" : "false");
        });
        slot2.appendChild(btn);
      });
      actions(body, "Continue", function () {
        if (!S.DEVICE_KEYS.some(function (k) { return onbDraft.devices[k]; })) {
          UI.toast({ type: "warn", title: "Select at least one device" });
          return;
        }
        onbStep = 3; renderOnb(root);
      }, function () { onbStep = 1; renderOnb(root); });

    } else {
      var devList = S.DEVICE_KEYS.filter(function (k) { return onbDraft.devices[k]; })
        .map(function (k) { return S.DEVICES[k].short; }).join(", ");
      body.innerHTML =
        '<span class="onb__step">Ready</span>' +
        '<h1 class="onb__title display">You are all set</h1>' +
        '<p class="onb__sub">Here is what CarbonWise will start monitoring.</p>' +
        '<div class="u-mt-24">' +
          summaryRow("building", "Building", onbDraft.buildingName) +
          summaryRow("rooms", "Rooms", String(onbDraft.roomCount)) +
          summaryRow("power", "Devices", devList) +
        "</div>" +
        '<div class="callout callout--info u-mt-20">' +
          '<span class="callout__icon">' + U.icon("info", 18) + "</span>" +
          '<span class="callout__text">Automatic shut-off starts switched on for air-conditioners and fans, ' +
            "after 30 minutes without motion. You can change this in Settings at any time.</span>" +
        "</div>" +
        '<div class="onb__actions" id="slot"></div>';
      var slot3 = U.qs("#slot", body);
      var back = U.el("button", { class: "btn", type: "button" }, "Back");
      back.addEventListener("click", function () { onbStep = 2; renderOnb(root); });
      var go = U.el("button", { class: "btn btn--primary btn--lg u-grow", type: "button", "data-next": "" }, "Go to Dashboard");
      go.addEventListener("click", function () {
        go.classList.add("is-loading");
        setTimeout(function () {
          S.state.onboarding = {
            complete: true,
            buildingName: onbDraft.buildingName,
            roomCount: onbDraft.roomCount,
            devices: onbDraft.devices
          };
          S.seedBuilding();
          CW.sim.start();
          onbDraft = null; onbStep = 0;
          UI.toast({ type: "ok", title: "Building ready", msg: S.state.rooms.length + " rooms are now monitored." });
          nav("/dashboard");
        }, 800);
      });
      slot3.appendChild(back);
      slot3.appendChild(go);
    }
  }

  function summaryRow(icon, k, v) {
    return '<div class="summary-row">' +
      '<span class="summary-row__icon">' + U.icon(icon, 18) + "</span>" +
      '<span><span class="summary-row__k">' + U.esc(k) + "</span><br>" +
      '<span class="summary-row__v">' + U.esc(v) + "</span></span></div>";
  }

  function actions(body, nextLabel, onNext, onBack) {
    var row = U.el("div", { class: "onb__actions" });
    if (onBack) {
      var b = U.el("button", { class: "btn", type: "button" }, "Back");
      b.addEventListener("click", onBack);
      row.appendChild(b);
    }
    var n = U.el("button", { class: "btn btn--primary btn--lg u-grow", type: "button", "data-next": "" }, nextLabel);
    n.addEventListener("click", onNext);
    row.appendChild(n);
    body.appendChild(row);
  }

  V._resetOnboarding = function () { onbStep = 0; onbDraft = null; };
})(window, document);
