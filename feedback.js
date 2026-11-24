/* The Tavern — "Feedback" button and window, on every page.
   Load after account.js. Messages go to the "feedback" collection of the site's Firebase;
   only the site owner reads them, in the Firebase console. */
(function () {
  "use strict";

  var CSS = [
    "#tavernDock{position:fixed!important;left:12px;bottom:12px;z-index:7!important;display:flex;gap:6px;align-items:center;font:700 13px/1.2 Georgia,'Times New Roman',serif}",
    "#tavernDock>a,#tavernDock>button{position:static!important;display:inline-flex;align-items:center;gap:6px;margin:0;padding:6px 12px;border-radius:999px;background:#2a1d14;color:#f0c46a;border:1px solid #a07c45;font:inherit;text-decoration:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);opacity:.92;white-space:nowrap}",
    "#tavernDock>a:hover,#tavernDock>button:hover{opacity:1;background:#3a2718}",
    "#tavernDock>a:focus-visible,#tavernDock>button:focus-visible{outline:2px solid #f0c46a;outline-offset:2px}",
    "#tvfb{width:min(30rem,calc(100% - 2rem));padding:0;border:1px solid #4a3322;border-radius:8px;background:#2a1d14;color:#efe4cc;box-shadow:0 24px 60px rgba(0,0,0,.7);font:17px/1.5 Alegreya,Georgia,'Times New Roman',serif}",
    "#tvfb::backdrop{background:rgba(10,6,3,.72)}",
    "#tvfb form{padding:1.3rem 1.4rem 1.4rem;display:flex;flex-direction:column;gap:.85rem;margin:0}",
    "#tvfb header{display:flex;justify-content:space-between;align-items:baseline;gap:1rem}",
    "#tvfb h2{margin:0;font:400 1.8rem/1.1 'Pirata One',Georgia,serif;color:#e0b25a}",
    "#tvfb p{margin:0;color:#b9a98b;font-size:.95rem}",
    "#tvfb .x{font:inherit;font-size:1.3rem;line-height:1;background:none;border:0;color:#b9a98b;cursor:pointer;padding:.2rem .4rem}",
    "#tvfb fieldset{border:0;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.5rem}",
    "#tvfb legend{padding:0;margin-bottom:.35rem;color:#b9a98b;font-size:.95rem}",
    "#tvfb .kind{position:relative}",
    "#tvfb .kind input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}",
    "#tvfb .kind span{display:inline-block;padding:.35rem .95rem;border-radius:999px;border:1px solid #6b5228;color:#efe4cc;font-size:.98rem}",
    "#tvfb .kind input:checked+span{background:#e0b25a;border-color:#e0b25a;color:#24170c;font-weight:700}",
    "#tvfb .kind input:focus-visible+span{outline:2px solid #e0b25a;outline-offset:2px}",
    "#tvfb label.t{display:flex;flex-direction:column;gap:.3rem;color:#b9a98b;font-size:.95rem}",
    "#tvfb textarea{font:inherit;font-size:1rem;color:#efe4cc;background:#1d140d;border:1px solid #4a3322;border-radius:6px;padding:.55rem .7rem;min-height:7.5rem;resize:vertical}",
    "#tvfb textarea:focus{outline:2px solid #e0b25a;outline-offset:1px}",
    "#tvfb .count{align-self:flex-end;font-size:.82rem;color:#8f8169;margin-top:-.5rem}",
    "#tvfb .check{display:flex;gap:.5rem;align-items:flex-start;color:#efe4cc;font-size:.95rem}",
    "#tvfb .check input{margin-top:.3rem;accent-color:#e0b25a}",
    "#tvfb .row{display:flex;flex-wrap:wrap;gap:.6rem;align-items:center}",
    "#tvfb .btn{font:inherit;font-size:1rem;cursor:pointer;padding:.45rem 1.15rem;border-radius:999px;border:1px solid #e0b25a;background:transparent;color:#e0b25a;font-weight:600}",
    "#tvfb .btn.main{background:#e0b25a;color:#24170c;font-weight:800}",
    "#tvfb .btn:disabled{opacity:.55;cursor:wait}",
    "#tvfb .err{padding:.5rem .75rem;border-radius:6px;background:rgba(156,58,47,.25);border:1px solid #9c3a2f;color:#f2c1b8;font-size:.95rem}",
    "#tvfb .done{font-size:1.05rem;color:#efe4cc}",
    "#tvfb .shot{display:flex;flex-direction:column;gap:.45rem;padding:.75rem;border:1px dashed #6b5228;border-radius:6px}",
    "#tvfb .shot.drag{border-color:#e0b25a;background:rgba(224,178,90,.08)}",
    "#tvfb .shot .row{gap:.4rem .8rem}",
    "#tvfb .small{font-size:.88rem;color:#b9a98b;margin:0}",
    "#tvfb .prev{display:flex;gap:.8rem;align-items:center}",
    "#tvfb .prev img{max-width:9rem;max-height:6rem;border-radius:4px;border:1px solid #6b5228;background:#fff}",
    "#tvfb .lnk{font:inherit;font-size:.92rem;background:none;border:0;padding:0;color:#e0b25a;text-decoration:underline;cursor:pointer}",
    "@media print{#tavernDock{display:none}}"
  ].join("\n");

  var HINT = {
    idea: "What would make the tools better for your table?",
    problem: "What did you do, what did you expect, and what happened instead?",
    other: "Tell us anything."
  };
  var MAX = 2000, WAIT_MS = 30000, LAST_KEY = "tavern-feedback-last";

  function pageInfo() {
    var m = location.pathname.match(/\/tools\/([a-z0-9-]+)\//);
    var v = document.querySelector('meta[name="version"]');
    return { page: m ? m[1] : "home", version: v ? v.getAttribute("content") : (window.SITE_VERSION || "") };
  }
  // Shrinks a picture to a JPEG small enough to store with the message (under ~850 KB of text).
  function compress(blob) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, 1600 / Math.max(w, h, 1)), q = 0.85;
        for (var i = 0; i < 12; i++) {
          var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
          var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
          var out = c.toDataURL("image/jpeg", q);
          if (out.length <= 850000) return res(out);
          if (q > 0.55) q -= 0.1; else s *= 0.8;
        }
        rej(new Error("too big"));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("not an image")); };
      img.src = url;
    });
  }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function init() {
    var T = window.Tavern;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    // The dock: the existing "The Tavern" link (in the tools) + the Feedback button.
    var dock = el('<div id="tavernDock" role="navigation" aria-label="The Tavern"></div>');
    var home = document.getElementById("tavernHome");
    if (home) dock.appendChild(home);
    var btn = el('<button type="button" id="tavernFeedback" aria-haspopup="dialog">✎ Feedback</button>');
    dock.appendChild(btn);
    document.body.appendChild(dock);

    var dlg = el('<dialog id="tvfb" aria-labelledby="tvfbTitle"><form method="dialog" novalidate></form></dialog>');
    document.body.appendChild(dlg);
    var form = dlg.querySelector("form");
    var shot = null;
    function showShot() {
      var p = form.querySelector(".prev"); if (!p) return;
      p.hidden = !shot; if (shot) p.querySelector("img").src = shot;
      form.querySelector("[data-pick]").textContent = shot ? "Choose another image" : "Add a screenshot";
    }
    function takeImage(file) {
      if (!file || !/^image\//.test(file.type || "")) { err("That file isn't a picture. Choose a PNG or JPEG image."); return; }
      err(""); var pk = form.querySelector("[data-pick]"); if (pk) pk.textContent = "Preparing\u2026";
      compress(file).then(function (d) { shot = d; showShot(); }, function () { showShot(); err("This picture couldn't be used. Try another one, or a smaller screenshot."); });
    }

    function render() {
      var u = T && T.user && T.user();
      form.innerHTML =
        '<header><h2 id="tvfbTitle">Send feedback</h2><button class="x" type="button" data-close aria-label="Close">✕</button></header>' +
        '<p>Ideas, problems, anything. Every message is read.</p>' +
        '<fieldset><legend>What is it about?</legend>' +
          '<label class="kind"><input type="radio" name="kind" value="idea" checked><span>An idea</span></label>' +
          '<label class="kind"><input type="radio" name="kind" value="problem"><span>A problem</span></label>' +
          '<label class="kind"><input type="radio" name="kind" value="other"><span>Something else</span></label>' +
        '</fieldset>' +
        '<label class="t">Your message<textarea name="msg" maxlength="' + MAX + '" placeholder="' + esc(HINT.idea) + '"></textarea></label>' +
        '<span class="count" aria-live="polite">0 / ' + MAX + '</span>' +
        '<div class="shot"><div class="row"><button class="btn" type="button" data-pick>Add a screenshot</button><span class="small">or paste one here with Ctrl+V</span></div>' +
          '<input type="file" name="shotfile" accept="image/*" hidden>' +
          '<div class="prev" hidden><img alt="Screenshot that will be sent"><button class="lnk" type="button" data-unshot>Remove the screenshot</button></div>' +
          '<p class="small">Optional. To capture your screen: Windows + Shift + S on Windows, Cmd + Shift + 4 on a Mac.</p></div>' +
        (u ? '<label class="check"><input type="checkbox" name="me">Add my username (' + esc(u.username) + ') so the site owner knows who wrote</label>' : "") +
        '<p>Sent without your name unless you add it. The page you\'re on and its version are included, to help fix problems.</p>' +
        '<p class="err" hidden></p>' +
        '<div class="row"><button class="btn main" type="submit">Send</button><button class="btn" type="button" data-close>Cancel</button></div>';
    }
    function err(m) { var e = form.querySelector(".err"); if (e) { e.textContent = m; e.hidden = !m; } }

    btn.addEventListener("click", function () {
      if (!form.querySelector("textarea")) { render(); showShot(); }
      dlg.showModal();
      var ta = form.querySelector("textarea"); if (ta) ta.focus(); else form.querySelector("[data-close]").focus();
    });
    form.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-close")) { dlg.close(); if (form.querySelector(".done")) form.innerHTML = ""; return; }
      if (b.hasAttribute("data-pick")) { form.elements.shotfile.click(); return; }
      if (b.hasAttribute("data-unshot")) { shot = null; showShot(); return; }
    });
    form.addEventListener("change", function (e) {
      if (e.target.name === "shotfile") { var f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) takeImage(f); return; }
      if (e.target.name === "kind") form.querySelector("textarea").placeholder = HINT[e.target.value];
    });
    form.addEventListener("input", function (e) {
      if (e.target.name === "msg") form.querySelector(".count").textContent = e.target.value.length + " / " + MAX;
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var sb = form.querySelector('button[type=submit]'); if (!sb) return;
      var msg = form.elements.msg.value.trim();
      if (!msg) { err("Write a message first."); form.elements.msg.focus(); return; }
      var last = 0; try { last = Number(localStorage.getItem(LAST_KEY)) || 0; } catch (x) {}
      if (Date.now() - last < WAIT_MS) { err("You just sent a message. Wait a few seconds before sending another one."); return; }
      if (!T || !T.sendFeedback) { err("Feedback can't be sent from this page right now. Try again later."); return; }
      var info = pageInfo();
      sb.disabled = true; sb.textContent = "Sending…"; err("");
      T.sendFeedback({
        kind: (form.querySelector('input[name=kind]:checked') || {}).value || "other",
        message: msg, page: info.page, version: info.version,
        withUser: !!(form.elements.me && form.elements.me.checked),
        shot: shot
      }).then(function () {
        shot = null;
        try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (x) {}
        form.innerHTML = '<header><h2 id="tvfbTitle">Thank you</h2><button class="x" type="button" data-close aria-label="Close">✕</button></header>' +
          '<p class="done">Your message was sent.</p><div class="row"><button class="btn main" type="button" data-close>Close</button></div>';
        form.querySelector(".btn.main").focus();
      }, function (x) {
        sb.disabled = false; sb.textContent = "Send";
        err((x && x.userMessage) || "The message couldn't be sent. Check your internet connection and try again.");
      });
    });
    dlg.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) { e.preventDefault(); takeImage(items[i].getAsFile()); return; }
    });
    dlg.addEventListener("dragover", function (e) { var s = form.querySelector(".shot"); if (s) { e.preventDefault(); s.classList.add("drag"); } });
    dlg.addEventListener("dragleave", function () { var s = form.querySelector(".shot"); if (s) s.classList.remove("drag"); });
    dlg.addEventListener("drop", function (e) { var s = form.querySelector(".shot"); if (!s) return; e.preventDefault(); s.classList.remove("drag"); var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) takeImage(f); });
    dlg.addEventListener("close", function () { if (form.querySelector(".done")) form.innerHTML = ""; });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
