/* The Tavern — accounts.
   Username + password, no email. A recovery code replaces "forgot my password by email".

   How it works:
   - Each account has a long random secret (the "account key"). That key is the real
     Firebase password; nobody ever types it.
   - The account key is stored twice in logins/<username>, encrypted in the browser:
     once with the person's password, once with their recovery code.
     Firebase only ever sees the encrypted copies.
   - Signing in = decrypt the key with the password, then sign in to Firebase with it.
     Recovering = decrypt the key with the recovery code, then encrypt it again with a new password.
   - The tools already know how to sync with an account (they did it on claude.ai).
     This file gives them the same small interface (window.claude.use("db"/"user")), backed by Firebase.

   Load this file as a normal <script> in <head>, after firebase-config.js. */
(function () {
  "use strict";

  var SDK = "12.19.0";                          // Firebase web SDK version (www.gstatic.com/firebasejs/<version>/)
  var DOMAIN = "players.tavern.local";          // usernames become <username>@players.tavern.local inside Firebase; no email is ever sent
  var ITER = 310000;                            // PBKDF2 rounds: makes guessing passwords slow
  var CODE_ABC = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no I, L, O, U, 0 or 1, so codes are easy to copy by hand
  var LOCAL_PREFIXES = ["dnd-2024-sheet-v2", "dnd-2024-roster-v1", "dnd-2024-dm-v1"];
  var OWNER_KEY = "tavern-local-owner";
  // Every tool keeps its records in its own space: tools/<tool folder>/<user id>/<record>.
  // Add a new tool's folder name here so "Delete my account" also erases its data.
  var TOOL_IDS = ["character-sheet", "combat-tracker"];
  var m = location.pathname.match(/\/tools\/([a-z0-9-]+)\//);
  var TOOL = m ? m[1] : (/\/admin\/(index\.html)?$/.test(location.pathname) ? "admin" : "home");
  function toolPath(p) { return String(p).replace(/^data\/users\//, "tools/" + TOOL + "/"); }

  /* ---------- anonymous statistics: one counter document per day, nothing about who ---------- */
  // stats/<YYYY-MM-DD>: browsers (once per browser per day), members (once per signed-in browser per day),
  // signins, signups, feedback, v_<page> (once per browser per day and page). Keys must match firestore.rules.
  function today() { var d = new Date(), z = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()); }
  function bump(field, oncePerDay) {
    if (!B || !B.bump || TOOL === "admin") return;
    var day = today(), flag = "tavern-seen:" + day + ":" + field;
    try { if (oncePerDay) { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, "1"); } } catch (e) {}
    B.bump("stats/" + day, field).catch(function () { try { if (oncePerDay) localStorage.removeItem(flag); } catch (e) {} });
  }
  function pageVisit() { bump("browsers", true); bump("v_" + TOOL.replace(/-/g, "_"), true); }
  (function tidy() { try { var d = today(), del = []; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf("tavern-seen:") === 0 && k.indexOf("tavern-seen:" + d) !== 0) del.push(k); } del.forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {} })();

  var cfg = window.TAVERN_FIREBASE || null;
  var makeBackend = window.TAVERN_TEST_BACKEND || (cfg && cfg.apiKey ? function () { return firebaseBackend(cfg); } : null);

  /* ---------- Firebase, behind a small interface ---------- */
  function firebaseBackend(conf) {
    var base = "https://www.gstatic.com/firebasejs/" + SDK + "/";
    return Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")])
      .then(function (m) {
        var A = m[0], Au = m[1], F = m[2];
        var app = A.initializeApp(conf), auth = Au.getAuth(app), fs = F.getFirestore(app);
        function w(fn) {
          return function () {
            var a = arguments;
            return Promise.resolve().then(function () { return fn.apply(null, a); }).catch(function (e) {
              var er = new Error((e && e.message) || "error"); er.code = String((e && e.code) || "").replace(/^(auth|firestore)\//, ""); throw er;
            });
          };
        }
        return {
          onAuth: function (cb) { Au.onAuthStateChanged(auth, function (u) { cb(u ? { uid: u.uid, email: u.email } : null); }); },
          create: w(function (em, pw) { return Au.createUserWithEmailAndPassword(auth, em, pw).then(function (r) { return { uid: r.user.uid }; }); }),
          signIn: w(function (em, pw) { return Au.signInWithEmailAndPassword(auth, em, pw).then(function (r) { return { uid: r.user.uid }; }); }),
          signOut: w(function () { return Au.signOut(auth); }),
          reauth: w(function (em, pw) { return Au.reauthenticateWithCredential(auth.currentUser, Au.EmailAuthProvider.credential(em, pw)); }),
          deleteUser: w(function () { return Au.deleteUser(auth.currentUser); }),
          get: w(function (p) { return F.getDoc(F.doc(fs, p)).then(function (s) { return s.exists() ? s.data() : null; }); }),
          set: w(function (p, d) { return F.setDoc(F.doc(fs, p), d); }),
          del: w(function (p) { return F.deleteDoc(F.doc(fs, p)); }),
          list: w(function (p) { return F.getDocs(F.collection(fs, p)).then(function (q) { return q.docs.map(function (d) { return { id: d.id, data: d.data() }; }); }); }),
          count: w(function (p) { return F.getCountFromServer(F.collection(fs, p)).then(function (s) { return s.data().count; }); }),
          bump: w(function (p, field) { var o = {}; o[field] = F.increment(1); return F.setDoc(F.doc(fs, p), o, { merge: true }); }),
          update: w(function (p, d) { return F.updateDoc(F.doc(fs, p), d); })
        };
      });
  }

  /* ---------- small crypto helpers (Web Crypto, built into browsers) ---------- */
  var te = new TextEncoder(), td = new TextDecoder();
  function b64(buf) { var s = "", u = new Uint8Array(buf); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function rnd(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function kdf(secret, salt, iter) {
    return crypto.subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]).then(function (k) {
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    });
  }
  function seal(plain, secret) {
    var s = rnd(16), i = rnd(12);
    return kdf(secret, s, ITER).then(function (key) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: i }, key, te.encode(plain)); })
      .then(function (c) { return { s: b64(s), i: b64(i), c: b64(c), n: ITER }; });
  }
  function unseal(box, secret) {
    if (!box || !box.s) return Promise.resolve(null);
    return kdf(secret, unb64(box.s), box.n || ITER)
      .then(function (key) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.i) }, key, unb64(box.c)); })
      .then(function (p) { return td.decode(p); }, function () { return null; });
  }
  function newCode() {
    var out = "";
    while (out.length < 16) { var b = rnd(1)[0]; if (b < 240) out += CODE_ABC[b % 30]; }
    return out.match(/.{4}/g).join("-");
  }
  function normCode(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function normUser(u) { return String(u || "").trim().toLowerCase(); }
  function email(u) { return u + "@" + DOMAIN; }
  function fail(msg) { var e = new Error(msg); e.userMessage = msg; throw e; }
  function netMsg(e) {
    var c = (e && e.code) || "";
    if (c === "network-request-failed" || c === "unavailable") return "The tavern can't be reached. Check your internet connection and try again.";
    if (c === "too-many-requests") return "Too many tries in a row. Wait a few minutes, then try again.";
    return "Something went wrong (" + (c || "unknown error") + "). Try again.";
  }
  function friendly(e) { if (e && e.userMessage) throw e; fail(netMsg(e)); }

  /* ---------- local data of the tools in this browser ---------- */
  function clearLocal() {
    try {
      var del = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (LOCAL_PREFIXES.some(function (p) { return k === p || k.indexOf(p + ":") === 0; })) del.push(k);
      }
      del.forEach(function (k) { localStorage.removeItem(k); });
      localStorage.removeItem(OWNER_KEY);
    } catch (e) {}
  }
  // Characters left in this browser by someone else's account must not be uploaded to a new account.
  // Characters made without any account are kept: they move into the first account that signs in here.
  function claimLocal(uid) {
    try {
      var owner = localStorage.getItem(OWNER_KEY);
      if (owner && owner !== uid) clearLocal();
      localStorage.setItem(OWNER_KEY, uid);
    } catch (e) {}
  }

  /* ---------- state ---------- */
  var B = null, cur = null, listeners = [], readyResolve;
  var ready = new Promise(function (r) { readyResolve = r; });
  var available = !!makeBackend;

  function usernameOf(u) { return u && u.email ? u.email.split("@")[0] : ""; }
  function emit() {
    listeners.forEach(function (f) { try { f(api.user()); } catch (e) {} });
    var pill = document.getElementById("tavernHome");
    if (pill) pill.textContent = cur ? "⌂ The Tavern · " + usernameOf(cur) : "⌂ The Tavern";
  }

  var backendP = available ? Promise.resolve().then(makeBackend).then(function (b) {
    B = b;
    var first = true;
    B.onAuth(function (u) {
      cur = u; if (u) { claimLocal(u.uid); bump("members", true); }
      if (first) { first = false; readyResolve(); pageVisit(); }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", emit, { once: true }); else emit();
    });
    return b;
  }).catch(function (e) {
    available = false; readyResolve();
    if (window.console) console.warn("Tavern accounts unavailable:", e);
    return null;
  }) : Promise.resolve(null);
  if (!available) readyResolve();
  function need() { return backendP.then(function (b) { if (!b) fail("Accounts are not available right now. Your tools still save in this browser."); return b; }); }
  function getLogin(u) { return B.get("logins/" + u).catch(friendly); }

  /* ---------- public API used by the home page ---------- */
  var api = {
    get available() { return available; },
    ready: ready,
    user: function () { return cur ? { uid: cur.uid, username: usernameOf(cur) } : null; },
    onChange: function (f) { listeners.push(f); },
    rules: { userMin: 3, userMax: 20, passMin: 6 },

    signUp: function (user, pass) {
      var u = normUser(user), K, R, boxes;
      return need().then(function () {
        if (!/^[a-z0-9_-]{3,20}$/.test(u)) fail("Pick a username of 3 to 20 characters: letters, numbers, - or _.");
        if (String(pass || "").length < 6) fail("Your password needs at least 6 characters.");
        return getLogin(u);
      }).then(function (ex) {
        if (ex) fail("The username “" + u + "” is already taken. Try another one.");
        K = b64(rnd(32)); R = newCode();
        return Promise.all([seal(K, pass), seal(K, normCode(R))]);
      }).then(function (b) {
        boxes = b;
        return B.create(email(u), K).catch(function (e) {
          if (e.code === "email-already-in-use") fail("The username “" + u + "” is already taken. Try another one.");
          friendly(e);
        });
      }).then(function (r) {
        return B.set("logins/" + u, { uid: r.uid, v: 1, p: boxes[0], r: boxes[1], created: Date.now() }).catch(function () {
          return B.deleteUser().catch(function () {}).then(function () { return B.signOut().catch(function () {}); })
            .then(function () { fail("The account couldn't be finished. Try again."); });
        });
      }).then(function () { bump("signups"); return { username: u, code: R }; });
    },

    signIn: function (user, pass) {
      var u = normUser(user);
      return need().then(function () { if (!u || !pass) fail("Enter your username and your password."); return getLogin(u); })
        .then(function (L) { if (!L) fail("No account uses the username “" + u + "”."); return unseal(L.p, pass); })
        .then(function (K) { if (!K) fail("Wrong password. If you forgot it, use your recovery code."); return B.signIn(email(u), K).catch(friendly); })
        .then(function () { bump("signins"); return { username: u }; });
    },

    recover: function (user, code, newPass) {
      var u = normUser(user), L, K;
      return need().then(function () {
        if (!u || !normCode(code)) fail("Enter your username and your recovery code.");
        if (String(newPass || "").length < 6) fail("Your new password needs at least 6 characters.");
        return getLogin(u);
      }).then(function (l) { L = l; if (!L) fail("No account uses the username “" + u + "”."); return unseal(L.r, normCode(code)); })
        .then(function (k) { K = k; if (!K) fail("This recovery code doesn't match that username. Check each character."); return B.signIn(email(u), K).catch(friendly); })
        .then(function () { return seal(K, newPass); })
        .then(function (p) { L.p = p; return B.set("logins/" + u, L).catch(friendly); })
        .then(function () { bump("signins"); return { username: u }; });
    },

    changePassword: function (oldPass, newPass) {
      var u, L, K;
      return need().then(function () {
        if (!cur) fail("Sign in first.");
        if (String(newPass || "").length < 6) fail("Your new password needs at least 6 characters.");
        u = usernameOf(cur); return getLogin(u);
      }).then(function (l) { L = l; return unseal(L && L.p, oldPass); })
        .then(function (k) { K = k; if (!K) fail("Your current password is wrong."); return seal(K, newPass); })
        .then(function (p) { L.p = p; return B.set("logins/" + u, L).catch(friendly); });
    },

    newRecoveryCode: function (pass) {
      var u, L, R;
      return need().then(function () { if (!cur) fail("Sign in first."); u = usernameOf(cur); return getLogin(u); })
        .then(function (l) { L = l; return unseal(L && L.p, pass); })
        .then(function (K) { if (!K) fail("Wrong password."); R = newCode(); return seal(K, normCode(R)); })
        .then(function (r) { L.r = r; return B.set("logins/" + u, L).catch(friendly); })
        .then(function () { return { code: R }; });
    },

    signOut: function () {
      return need().then(function () { return B.signOut().catch(friendly); }).then(function () { clearLocal(); });
    },

    // Feedback works without an account. Only the site owner can read it (Firebase console → Firestore → feedback).
    sendFeedback: function (o) {
      o = o || {};
      var msg = String(o.message || "").trim().slice(0, 2000);
      return backendP.then(function (b) {
        if (!b) fail("Feedback can't be sent right now. Check your internet connection and try again later.");
        if (!msg) fail("Write a message first.");
        var d = {
          kind: ["idea", "problem", "other"].indexOf(o.kind) >= 0 ? o.kind : "other",
          message: msg,
          page: String(o.page || "home").slice(0, 40),
          version: String(o.version || "").slice(0, 20),
          created: Date.now()
        };
        if (o.withUser && cur) d.user = usernameOf(cur);
        var shot = typeof o.shot === "string" && o.shot.indexOf("data:image/") === 0 && o.shot.length <= 900000 ? o.shot : null;
        if (shot) d.shot = true;
        var id = Array.prototype.map.call(rnd(15), function (x) { return "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]; }).join("");
        return B.set("feedback/" + id, d).catch(friendly)
          .then(function () { return shot ? B.set("feedbackShots/" + id, { data: shot, created: d.created }).catch(function () { fail("Your message was sent, but the screenshot couldn't be. Try sending it again with a smaller image."); }) : null; })
          .then(function () { bump("feedback"); });
      });
    },

    deleteAccount: function (pass) {
      var u, uid, K;
      return need().then(function () { if (!cur) fail("Sign in first."); u = usernameOf(cur); uid = cur.uid; return getLogin(u); })
        .then(function (L) { return unseal(L && L.p, pass); })
        .then(function (k) { K = k; if (!K) fail("Wrong password."); return B.reauth(email(u), K).catch(friendly); })
        .then(function () {
          return Promise.all(TOOL_IDS.map(function (t) {
            var col = "tools/" + t + "/" + uid;
            return B.list(col).then(function (docs) { return Promise.all(docs.map(function (d) { return B.del(col + "/" + d.id); })); });
          })).catch(friendly);
        })
        .then(function () { return B.del("logins/" + u).catch(friendly); })
        .then(function () { return B.deleteUser().catch(friendly); })
        .then(function () { clearLocal(); });
    }
  };
  /* ---------- owner page (only works for usernames listed in the "admins" collection) ---------- */
  api.admin = {
    check: function () { return backendP.then(function (b) { if (!b || !cur) return false; return b.get("admins/" + usernameOf(cur)).then(function (d) { return !!d; }, function () { return false; }); }); },
    feedback: function () { return need().then(function () { return B.list("feedback").catch(friendly); }); },
    shot: function (id) { return need().then(function () { return B.get("feedbackShots/" + id).catch(friendly); }).then(function (d) { return d && d.data; }); },
    setStatus: function (id, s) { return need().then(function () { return B.update("feedback/" + id, { status: s }).catch(friendly); }); },
    remove: function (id, hasShot) {
      return need().then(function () { return hasShot ? B.del("feedbackShots/" + id).catch(function () {}) : null; })
        .then(function () { return B.del("feedback/" + id).catch(friendly); });
    },
    stats: function () { return need().then(function () { return B.list("stats").catch(friendly); }); },
    accounts: function () { return need().then(function () { return B.count("logins").catch(friendly); }); }
  };
  window.Tavern = api;

  /* ---------- the bridge the tools already understand ---------- */
  if (!available) return;
  function mapErr(e) {
    var c = (e && e.code) || "", er = new Error((e && e.message) || "error");
    er.code = c === "permission-denied" || c === "unauthenticated" ? "not_granted" : c === "resource-exhausted" ? "quota_exceeded" : "unavailable";
    return er;
  }
  // Firestore can't hold arrays inside arrays, which the tools use; each record is stored as one JSON text.
  function pack(o) { return { json: JSON.stringify(o), updated: o && typeof o.updated === "number" ? o.updated : Date.now(), v: 1 }; }
  function unpack(d) { if (d && typeof d.json === "string") { try { return JSON.parse(d.json); } catch (e) { return {}; } } return d; }
  function docApi(p) {
    p = toolPath(p);
    return {
      get: function () { return B.get(p).then(function (d) { return { exists: !!d, data: function () { return unpack(d); } }; }, function (e) { throw mapErr(e); }); },
      set: function (o) { return B.set(p, pack(o)).catch(function (e) { throw mapErr(e); }); }
    };
  }
  var DB = {
    doc: docApi,
    collection: function (p) {
      return {
        get: function () { return B.list(toolPath(p)).then(function (L) { return { docs: L.map(function (x) { return { id: x.id, data: function () { return unpack(x.data); } }; }) }; }, function (e) { throw mapErr(e); }); },
        doc: function (id) { return docApi(p + "/" + id); }
      };
    }
  };
  window.claude = {
    use: function (name) {
      if (name === "user") return ready.then(function () { return { id: function () { return Promise.resolve(cur ? cur.uid : null); } }; });
      if (name === "db") return ready.then(function () { return cur && B ? DB : null; });
      return Promise.resolve(null);
    }
  };
})();
