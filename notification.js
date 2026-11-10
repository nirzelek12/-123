/* ============================================================
   ניחושי הבלאנקוס — מנוע התראות
   התראות מערכת אמיתיות (כמו וואטסאפ) דרך Service Worker,
   עם מסך הגדרות ובחירה אילו התראות לקבל.
   ============================================================ */
(function () {
  "use strict";

  var ICON = "https://media.base44.com/images/public/6a91620bb63bd7c1b5a2d9e8/0a36110dd_717f280bed475230e0023ddf508c79d1_tplv-tiktokx-cropcenter_1080_1080-removebg-preview.png";
  var STORE = "blancosNotifySettings";
  var DEFAULTS = { goals: true, pre: true, start: true, end: true };
  var ROWS = [
    ["goals", "⚽", "גולים ותוצאה בזמן אמת"],
    ["pre", "⏰", "תזכורת 15 דקות לפני המשחק"],
    ["start", "▶️", "המשחק התחיל"],
    ["end", "🏁", "סיום משחק ותוצאה"]
  ];

  var settings = loadSettings();
  var reg = null;
  var lastTags = {};
  var deferredPrompt = null;

  function loadSettings() {
    try {
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}"));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem(STORE, JSON.stringify(settings));
    } catch (e) {}
  }

  function supported() {
    return "Notification" in window;
  }
  function permission() {
    return supported() ? Notification.permission : "unsupported";
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      (navigator.standalone === true);
  }

  function registerWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then(function (r) {
      reg = r;
      renderPanel();
    }).catch(function () {});
    navigator.serviceWorker.ready.then(function (r) { reg = r; }).catch(function () {});
  }

  /* הדף הראשי (מחוץ ל-iframe) מבקש הרשאה ומציג התראות — הדפדפן חוסם זאת מתוך iframe */
  function rootBridge() {
    try {
      if (window.self !== window.top && window.parent && window.parent.BlancosRootNotify) {
        return window.parent.BlancosRootNotify;
      }
    } catch (e) {}
    return null;
  }

  function requestPermission() {
    if (!supported()) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    var bridge = rootBridge();
    if (bridge && bridge.request) {
      return Promise.resolve(bridge.request()).then(function (p) {
        renderPanel();
        if (p === "granted") {
          show({
            kind: "goals",
            silent: true,
            tag: "welcome",
            title: "🔔 ההתראות הופעלו!",
            body: "תקבל התראה על כל גול, תחילת משחק וסיום משחק."
          });
        }
        return p;
      }).catch(function () {
        renderPanel();
        return "denied";
      });
    }
    return Notification.requestPermission().then(function (p) {
      renderPanel();
      if (p === "granted") {
        show({
          kind: "goals",
          silent: true,
          tag: "welcome",
          title: "🔔 ההתראות הופעלו!",
          body: "תקבל התראה על כל גול, תחילת משחק וסיום משחק."
        });
      }
      return p;
    }).catch(function () {
      renderPanel();
      return "denied";
    });
  }

  /* הודעת סטטוס קצרה בתחתית המסך */
  function toast(msg) {
    try {
      var el = document.getElementById("bnToast");
      if (!el) {
        el = document.createElement("div");
        el.id = "bnToast";
        el.className = "bn-toast";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(el._bnTimer);
      el._bnTimer = setTimeout(function () { el.classList.remove("show"); }, 5000);
    } catch (e) {}
  }

  /* מחזיר רישום Service Worker פעיל (עם המתנה אם עדיין לא מוכן) */
  function ensureRegistration() {
    if (reg && reg.showNotification) return Promise.resolve(reg);
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (r) { if (done) return; done = true; if (r) reg = r; resolve(r || null); };
      setTimeout(function () { finish(null); }, 6000);
      navigator.serviceWorker.register("/sw.js").then(function (r) {
        if (r && r.showNotification && r.active) finish(r);
        navigator.serviceWorker.ready.then(finish).catch(function () { finish(r || null); });
      }).catch(function () { finish(null); });
    });
  }

  /* שליחת התראה בפועל — force=true עוקף את מתגי ההגדרות (לבדיקה) */
  function show(opts, force) {
    if (!opts) return Promise.resolve(false);
    if (!force && settings[opts.kind || "goals"] === false) return Promise.resolve(false);
    if (permission() !== "granted") return Promise.resolve(false);

    var tag = opts.tag || "blancos";
    var now = Date.now();
    if (!force && lastTags[tag] && now - lastTags[tag] < 8000) return Promise.resolve(false);
    lastTags[tag] = now;

    var options = {
      body: opts.body || "",
      icon: ICON,
      badge: ICON,
      tag: tag,
      dir: "rtl",
      lang: "he",
      renotify: true,
      data: { url: location.origin + "/" }
    };
    if (!opts.silent) options.vibrate = [180, 90, 180];

    var bridge = rootBridge();
    if (bridge && bridge.show) {
      return Promise.resolve(bridge.show(opts.title, opts.body, tag)).catch(function () { return false; });
    }

    return ensureRegistration().then(function (r) {
      try {
        if (r) {
          r.showNotification(opts.title, options);
          return true;
        }
        var n = new Notification(opts.title, options);
        n.onclick = function () {
          try { window.focus(); } catch (e) {}
          n.close();
        };
        return true;
      } catch (e) {
        console.warn("[Blancos] notification failed:", e);
        return false;
      }
    }).catch(function (e) {
      console.warn("[Blancos] notification failed:", e);
      return false;
    });
  }

  /* ---------- מסך ההגדרות ---------- */
  function styles() {
    if (document.getElementById("bnStyles")) return;
    var css = [
      ".bn-bell{position:fixed;bottom:20px;left:14px;z-index:120;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.25rem;cursor:pointer;background:linear-gradient(135deg,var(--crest-blue,#1e3a8a),var(--crest-navy,#0b1e4b));border:1px solid var(--gold-accent,#d4a32e);box-shadow:0 8px 22px rgba(0,0,0,.5);color:#f4d47c;}",
      ".bn-bell:active{transform:scale(.95);}",
      ".bn-bell .bn-dot{position:absolute;top:-2px;right:-2px;width:12px;height:12px;border-radius:50%;background:#e2464a;border:2px solid #051613;}",
      ".bn-bell.bn-active .bn-dot{display:none;}",
      ".bn-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:none;}",
      ".bn-overlay.open{display:block;}",
      ".bn-panel{position:fixed;z-index:201;left:50%;top:50%;transform:translate(-50%,-50%) scale(.94);opacity:0;pointer-events:none;width:min(94vw,400px);max-height:86vh;overflow-y:auto;background:linear-gradient(165deg,#0b2d27,#051613);border:1px solid var(--gold-accent,#d4a32e);border-radius:20px;padding:18px;box-shadow:0 24px 70px rgba(0,0,0,.75);transition:opacity .18s,transform .18s;direction:rtl;text-align:right;font-family:var(--font-body,'Assistant',sans-serif);}",
      ".bn-panel.open{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto;}",
      ".bn-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;}",
      ".bn-title{font-family:var(--font-display,'Heebo',sans-serif);font-weight:900;font-size:1.05rem;color:#f4d47c;}",
      ".bn-x{background:none;border:none;color:#8fa89e;font-size:1.3rem;cursor:pointer;padding:0 4px;}",
      ".bn-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;font-size:.82rem;font-weight:700;margin-bottom:12px;}",
      ".bn-status.on{background:rgba(46,160,88,.15);border:1px solid rgba(72,199,116,.5);color:#8fe3ab;}",
      ".bn-status.off{background:rgba(226,70,74,.12);border:1px solid rgba(226,70,74,.45);color:#f0a6a8;}",
      ".bn-enable{width:100%;padding:12px;border-radius:12px;border:1px solid var(--gold-accent,#d4a32e);background:linear-gradient(135deg,#d4a32e,#f4d47c);color:#051613;font-weight:900;font-family:inherit;font-size:.9rem;cursor:pointer;margin-bottom:12px;}",
      ".bn-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 4px;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer;}",
      ".bn-row span{font-size:.84rem;color:#f0ede6;font-weight:600;}",
      ".bn-sw{width:42px;height:24px;border-radius:20px;background:#1d3a33;border:1px solid #2c4c44;position:relative;flex:0 0 auto;transition:background .15s;}",
      ".bn-sw i{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:#8fa89e;transition:transform .15s,background .15s;}",
      ".bn-row.on .bn-sw{background:rgba(212,163,46,.35);border-color:var(--gold-accent,#d4a32e);}",
      ".bn-row.on .bn-sw i{transform:translateX(-18px);background:#f4d47c;}",
      ".bn-actions{display:flex;gap:8px;margin-top:14px;}",
      ".bn-btn{flex:1;padding:10px;border-radius:10px;border:1px solid #2c4c44;background:rgba(255,255,255,.04);color:#f0ede6;font-family:inherit;font-size:.8rem;font-weight:800;cursor:pointer;}",
      ".bn-btn:hover{background:rgba(255,255,255,.08);}",
      ".bn-note{margin-top:12px;font-size:.72rem;line-height:1.5;color:#8fa89e;}",
      ".bn-note b{color:#d4c08a;}",
      ".bn-toast{position:fixed;bottom:78px;left:50%;transform:translateX(-50%) translateY(10px);z-index:260;max-width:88vw;padding:11px 16px;border-radius:12px;background:linear-gradient(160deg,#0b2d27,#051613);border:1px solid var(--gold-accent,#d4a32e);color:#f4d47c;font-family:var(--font-body,'Assistant',sans-serif);font-size:.82rem;font-weight:700;text-align:center;line-height:1.45;box-shadow:0 12px 34px rgba(0,0,0,.65);opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;direction:rtl;}",
      ".bn-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}"
    ].join("");
    var el = document.createElement("style");
    el.id = "bnStyles";
    el.textContent = css;
    document.head.appendChild(el);
  }

  function inject() {
    if (document.getElementById("bnBell")) return;
    styles();
    var bell = document.createElement("button");
    bell.id = "bnBell";
    bell.className = "bn-bell";
    bell.type = "button";
    bell.setAttribute("aria-label", "הגדרות התראות");
    bell.innerHTML = "🔔<span class='bn-dot'></span>";
    bell.addEventListener("click", openPanel);

    var overlay = document.createElement("div");
    overlay.className = "bn-overlay";
    overlay.id = "bnOverlay";
    overlay.addEventListener("click", closePanel);

    var panel = document.createElement("div");
    panel.className = "bn-panel";
    panel.id = "bnPanel";

    document.body.appendChild(bell);
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    renderPanel();
  }

  function renderPanel() {
    var panel = document.getElementById("bnPanel");
    if (!panel) return;
    var p = permission();
    var bell = document.getElementById("bnBell");
    if (bell) bell.classList.toggle("bn-active", p === "granted");

    var html = "";
    html += "<div class='bn-head'><div class='bn-title'>🔔 התראות</div><button class='bn-x' id='bnClose' aria-label='סגור'>✕</button></div>";

    if (!supported()) {
      html += "<div class='bn-status off'>⚠️ הדפדפן הזה לא תומך בהתראות</div>";
    } else if (p === "granted") {
      html += "<div class='bn-status on'>✅ התראות פעילות במכשיר הזה</div>";
    } else if (p === "denied") {
      html += "<div class='bn-status off'>🚫 ההתראות חסומות — יש לאשר אותן בהגדרות האתר בדפדפן (סמל המנעול ליד הכתובת)</div>";
    } else {
      html += "<button class='bn-enable' id='bnEnable'>הפעל התראות במכשיר</button>";
    }

    ROWS.forEach(function (row) {
      var on = settings[row[0]] !== false;
      html += "<div class='bn-row " + (on ? "on" : "") + "' data-key='" + row[0] + "'><span>" + row[1] + " " + row[2] + "</span><div class='bn-sw'><i></i></div></div>";
    });

    html += "<div class='bn-actions'><button class='bn-btn' id='bnTest'>בדוק התראה</button>";
    if (deferredPrompt) html += "<button class='bn-btn' id='bnInstall'>📲 הוסף למסך הבית</button>";
    html += "</div>";

    if (isIOS() && !isStandalone()) {
      html += "<div class='bn-note'>📱 <b>באייפון:</b> כדי לקבל התראות כמו אפליקציה — פתח את האתר ב-Safari, לחץ על כפתור השיתוף ואז ״הוסף למסך הבית״, ופתח משם את האפליקציה.</div>";
    }
    html += "<div class='bn-note'>ההתראות נשלחות כל עוד האפליקציה פתוחה (גם ברקע). לאייקון במסך הבית ההתראות מגיעות כמו אפליקציה רגילה.</div>";

    panel.innerHTML = html;

    var closeBtn = document.getElementById("bnClose");
    if (closeBtn) closeBtn.addEventListener("click", closePanel);

    var enableBtn = document.getElementById("bnEnable");
    if (enableBtn) enableBtn.addEventListener("click", requestPermission);

    panel.querySelectorAll(".bn-row").forEach(function (rowEl) {
      rowEl.addEventListener("click", function () {
        var key = rowEl.getAttribute("data-key");
        settings[key] = settings[key] === false;
        saveSettings();
        renderPanel();
      });
    });

    var testBtn = document.getElementById("bnTest");
    if (testBtn) testBtn.addEventListener("click", sendTest);

    var installBtn = document.getElementById("bnInstall");
    if (installBtn) {
      installBtn.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt = null;
        closePanel();
      });
    }
  }

  function openPanel() {
    var panel = document.getElementById("bnPanel");
    var overlay = document.getElementById("bnOverlay");
    if (!panel || !overlay) return;
    renderPanel();
    overlay.classList.add("open");
    panel.classList.add("open");
  }
  function closePanel() {
    var panel = document.getElementById("bnPanel");
    var overlay = document.getElementById("bnOverlay");
    if (panel) panel.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    renderPanel();
  });

  /* שליחת התראת דוגמה — כדי לבדוק שההתראות באמת מגיעות למכשיר */
  function sendTest() {
    if (!supported()) {
      toast("⚠️ הדפדפן לא תומך בהתראות — באייפון יש להוסיף את האתר למסך הבית");
      return;
    }
    if (permission() === "denied") {
      toast("🚫 ההתראות חסומות — אשר אותן בהגדרות האתר (סמל המנעול ליד הכתובת)");
      openPanel();
      return;
    }
    var ready = permission() === "granted" ? Promise.resolve("granted") : requestPermission();
    ready.then(function (res) {
      if (res !== "granted") {
        toast("🚫 ההתראות לא אושרו — לא ניתן לשלוח התראה");
        openPanel();
        return;
      }
      return fireTest();
    });
  }
  function fireTest() {
    lastTags["test"] = 0;
    return show({
      kind: "goals",
      tag: "test",
      title: "⚽ גול! ריאל מדריד 2 - 1",
      body: "כך תיראה התראה אמיתית במשחק חי"
    }, true).then(function (ok) {
      if (ok) {
        toast("✅ נשלחה התראת בדיקה — בדוק את מרכז ההתראות במכשיר");
      } else {
        toast("⚠️ שליחת ההתראה נכשלה. באייפון: הוסף את האתר למסך הבית; באנדרואיד: פתח את האפליקציה מהמסך הראשי");
      }
    });
  }

  window.BlancosNotify = {
    show: show,
    sendTest: sendTest,
    test: sendTest,
    request: requestPermission,
    permission: permission,
    settings: function () {
      return settings;
    },
    open: openPanel
  };

  registerWorker();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
