// GeoPrix Moddable forum (Supabase). All user text is inserted with textContent, never as HTML.
(() => {
  const root = document.getElementById("forum");
  if (!root) return;

  const cfg = window.FORUM_CONFIG || {};

  // ---------- boards ----------
  const BOARDS = [
    { key: "general", name: "General", section: "Forums", icon: "forum",
      desc: "Talk about anything GeoPrix Moddable. Anyone can post and reply." },
    { key: "mods", name: "Public Mods", section: "Forums", icon: "mod",
      desc: "Share your mods. Every mod has a Releases tab where its author uploads downloads." },
    { key: "announcements", name: "Announcements", section: "Information", icon: "news", adminOnly: true,
      desc: "News and updates from the GeoPrix Moddable team." },
  ];
  const SECTIONS = ["Forums", "Information"];
  const board = (k) => BOARDS.find((b) => b.key === k);
  const boardName = (k) => (board(k) || { name: k }).name;

  // Versions offered for mod releases. Add new ones here when they come out.
  const GAME_VERSIONS = ["3.3"];
  const LAUNCHER_VERSIONS = ["0.9.0a"];
  const MAX_FILE = 50 * 1024 * 1024;
  const MAX_ATTACH = 5;
  const MAX_RELEASES = 3;
  const BUCKET = "forum-files";

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Material Icons paths (Apache 2.0)
  const ICONS = {
    forum: "M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z",
    mod: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z",
    news: "M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z",
    clip: "M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z",
    download: "M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z",
    link: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
    warn: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    chev: "M12.6 12 8 7.4 9.4 6l6 6-6 6L8 16.6z",
  };
  function icon(name, cls = "icon") {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", cls);
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", ICONS[name]);
    s.append(p);
    return s;
  }
  const chev = () => icon("chev", "chev");

  function ago(iso) {
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    const steps = [[60, "s"], [60, "m"], [24, "h"], [7, "d"], [4.35, "w"], [12, "mo"]];
    let n = s;
    for (const [div, unit] of steps) {
      if (n < div) return `${Math.floor(n)}${unit} ago`;
      n /= div;
    }
    return `${Math.floor(n)}y ago`;
  }
  function fmtSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function card(title, body, opts = {}) {
    return h("div", { class: "card" },
      h("div", { class: `card-bar caps${opts.off ? " off" : ""}${opts.warn ? " warn" : ""}` }, title, opts.barExtra || null),
      h("div", { class: opts.bodyClass || "card-body" }, body));
  }
  function errorNote(msg) { return h("p", { class: "form-error" }, msg); }
  function friendly(err) {
    const m = (err && (err.message || err.error_description)) || String(err);
    if (/rate limit|Slow down/i.test(m)) return "Slow down: you can post 5 times a minute.";
    if (/row-level security/i.test(m)) return "You're not allowed to do that.";
    if (/Invalid login/i.test(m)) return "Wrong email or password.";
    if (/Email not confirmed/i.test(m)) return "Confirm your email first: check your inbox for the link.";
    if (/maximum allowed size|too large|Payload too large/i.test(m)) return "Files can be at most 50 MB.";
    if (/mime type|invalid_mime/i.test(m)) return "That file type isn't allowed.";
    return m;
  }

  // ---------- people: picture, name, badges ----------
  const PERSON = "num, username, is_admin, is_modder, avatar_url, name_color";
  const AUTHOR = `author:profiles(${PERSON})`;
  const isModderPlus = (p) => !!(p && (p.is_admin || p.is_modder));
  const okColor = (c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c);
  const okAvatar = (u) => typeof u === "string" && u.startsWith(`${cfg.url}/storage/v1/object/public/avatars/`);
  const profileHref = (p) => `#/u/${p.num != null ? p.num : encodeURIComponent(p.username)}`;
  function avatar(p, size = "sm") {
    if (p && isModderPlus(p) && okAvatar(p.avatar_url)) {
      return h("img", { class: `avatar ${size}`, src: p.avatar_url, alt: "", loading: "lazy" });
    }
    const letter = p && p.username ? p.username[0].toUpperCase() : "?";
    return h("span", { class: `avatar ${size} letter`, "aria-hidden": "true" }, letter);
  }
  function badges(p) {
    if (!p) return null;
    return [
      p.is_admin ? h("span", { class: "badge gold" }, "Admin") : null,
      p.is_modder ? h("span", { class: "badge" }, "Modder") : null,
    ];
  }
  function nameLink(p) {
    if (!p) return h("span", { class: "name" }, "deleted");
    const a = h("a", { class: "name", href: profileHref(p) }, p.username);
    if (isModderPlus(p) && okColor(p.name_color)) a.style.color = p.name_color;
    return a;
  }

  // ---------- not connected yet ----------
  if (!cfg.url || !cfg.anonKey || /YOUR_/.test(cfg.url + cfg.anonKey) || !window.supabase) {
    root.replaceChildren(card("Forum", [
      h("div", { class: "empty" },
        h("h1", { class: "big" }, "Opening soon"),
        h("p", {}, "The forum isn't connected yet."),
        h("span", { class: "note" }, "Check back soon")),
    ], { off: true, bodyClass: "" }));
    return;
  }

  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  let me = null; // { id, num, username, is_admin, is_modder, ... }
  const here = () => location.origin + location.pathname;

  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    me = null;
    if (session) {
      const { data } = await sb.from("profiles")
        .select("id, num, username, is_admin, is_modder, needs_username, avatar_url, name_color")
        .eq("id", session.user.id).maybeSingle();
      me = data || { id: session.user.id, username: "?", is_admin: false };
    }
    renderAccount();
    if (me && me.needs_username) openPickUsername();
  }

  // ---------- dialogs ----------
  const dlg = h("dialog", { class: "confirm card" });
  document.body.append(dlg);

  // First Google sign-in: choose a username (the database gave a temporary one).
  function openPickUsername() {
    const err = h("div");
    const user = h("input", { type: "text", required: true, minlength: 3, maxlength: 20, pattern: "[A-Za-z0-9_]+", autocomplete: "username", value: me.username });
    const save = h("button", { class: "pill", type: "submit" }, "Save username");
    const form = h("form", {
      class: "confirm-body forum-form",
      onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true;
        const { error } = await sb.rpc("set_username", { new_name: user.value.trim() });
        save.disabled = false;
        if (error) { err.replaceChildren(errorNote(friendly(error))); return; }
        dlg.close();
        await loadMe();
        route();
      },
    },
      h("p", {}, "Welcome! Pick the name other people will see on the forum. You can change it later on your profile."),
      h("label", {}, h("span", { class: "caps" }, "Username"), user, h("small", {}, "3 to 20 letters, numbers or _")),
      err,
      h("div", { class: "actions" },
        h("button", { class: "pill grey", type: "button", onclick: () => dlg.close() }, "Later"),
        save));
    dlg.replaceChildren(h("div", { class: "card-bar caps" }, "Choose a username"), form);
    if (!dlg.open) dlg.showModal();
    user.select();
  }

  // Change your username any time. Roles and badges belong to the account, so they stay.
  function openRename() {
    const err = h("div");
    const user = h("input", { type: "text", required: true, minlength: 3, maxlength: 20, pattern: "[A-Za-z0-9_]+", autocomplete: "username", value: me.username });
    const save = h("button", { class: "pill", type: "submit" }, "Save");
    const form = h("form", {
      class: "confirm-body forum-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const name = user.value.trim();
        if (name === me.username) { dlg.close(); return; }
        save.disabled = true;
        const { error } = await sb.rpc("rename_me", { new_name: name });
        save.disabled = false;
        if (error) { err.replaceChildren(errorNote(friendly(error))); return; }
        dlg.close();
        await loadMe();
        route();
      },
    },
      h("p", {}, "Your badges, posts and profile stay the same. Only the name changes."),
      h("label", {}, h("span", { class: "caps" }, "New username"), user, h("small", {}, "3 to 20 letters, numbers or _")),
      err,
      h("div", { class: "actions" },
        h("button", { class: "pill grey", type: "button", onclick: () => dlg.close() }, "Cancel"),
        save));
    dlg.replaceChildren(h("div", { class: "card-bar caps" }, "Change username"), form);
    if (!dlg.open) dlg.showModal();
    user.select();
  }

  // Warning before downloading a file someone shared on the forum.
  function openDownload(url, name, uploader, external) {
    const go = () => {
      if (external) window.open(url, "_blank", "noopener,noreferrer");
      else location.href = url;
    };
    if (uploader && uploader.is_admin) { go(); return; } // official: posted by an Admin
    const ok = h("button", { class: "pill", type: "button", disabled: true, onclick: () => { dlg.close(); go(); } },
      external ? "Open link" : "Download");
    const agree = h("input", { type: "checkbox", onchange: () => { ok.disabled = !agree.checked; } });
    dlg.replaceChildren(
      h("div", { class: "card-bar caps warn" }, "Before you download"),
      h("div", { class: "confirm-body forum-form" },
        h("p", { class: "dl-name" }, icon("warn"), h("strong", {}, name),
          uploader ? h("span", {}, " · shared by ", uploader.username) : null),
        h("p", {}, "Files and links on the forum are shared by users and may not be moderated. " +
          "They are not official GeoPrix Moddable releases unless they come from the Releases page or an Admin post. " +
          "Only download from people you trust, and be careful with what you open."),
        h("p", { class: "rules" }, "Mods must never bypass GeoPrix's limits or paid features."),
        h("label", { class: "check" }, agree, h("span", {}, "I understand, and I'll download it at my own risk")),
        h("div", { class: "actions" },
          h("button", { class: "pill grey", type: "button", onclick: () => dlg.close() }, "Cancel"),
          ok)));
    if (!dlg.open) dlg.showModal();
  }

  function googleButton() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    g.setAttribute("viewBox", "0 0 48 48");
    g.setAttribute("class", "g-logo");
    for (const [fill, d] of [
      ["#EA4335", "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"],
      ["#4285F4", "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"],
      ["#FBBC05", "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"],
      ["#34A853", "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"],
    ]) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("fill", fill);
      p.setAttribute("d", d);
      g.append(p);
    }
    // Fallback: redirect through Supabase (Google then shows the supabase.co address).
    const redirectBtn = h("button", {
      class: "google-btn",
      type: "button",
      onclick: async () => {
        const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here() } });
        if (error) alert(friendly(error));
      },
    }, g, "Continue with Google");

    // Preferred: Google's own button, which signs in on this site, so Google shows
    // "geoprix-moddable.github.io" instead of the Supabase address.
    const box = h("div", { class: "google-box" }, redirectBtn);
    const gis = window.google && window.google.accounts && window.google.accounts.id;
    if (!gis || !cfg.googleClientId) return box;

    (async () => {
      try {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const raw = btoa(String.fromCharCode(...bytes));
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
        const hashed = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        gis.initialize({
          client_id: cfg.googleClientId,
          nonce: hashed,
          use_fedcm_for_button: true,
          callback: async (resp) => {
            const { error } = await sb.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: raw });
            if (error) {
              const note = box.parentNode && box.parentNode.querySelector(".google-error");
              if (note) note.replaceChildren(errorNote(friendly(error)));
              else alert(friendly(error));
            } else if (dlg.open) {
              dlg.close();
            }
          },
        });
        const slot = h("div", { class: "gis-slot" });
        box.replaceChildren(slot, h("div", { class: "google-error" }));
        gis.renderButton(slot, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "center",
          locale: "en",
          width: Math.min(360, Math.max(220, (box.clientWidth || 300))),
        });
      } catch (e) {
        box.replaceChildren(redirectBtn); // keep the fallback if anything goes wrong
      }
    })();
    return box;
  }

  // ---------- account bar ----------
  const account = h("div", { class: "forum-account" });
  function renderAccount() {
    if (me) {
      account.className = "forum-account signed";
      account.replaceChildren(
        avatar(me, "md"),
        h("div", { class: "acct-id" },
          h("small", { class: "caps" }, "Signed in"),
          h("span", { class: "acct-name" }, nameLink(me), badges(me))),
        h("span", { class: "account-actions" },
          h("a", { class: "pill grey small", href: profileHref(me) }, "My profile"),
          h("button", { class: "pill grey small", onclick: () => sb.auth.signOut() }, "Sign out")));
    } else {
      account.className = "forum-account";
      account.replaceChildren(
        h("span", { class: "who" }, "Sign in to post and reply."),
        h("button", { class: "pill small", onclick: () => openAuth("in") }, "Sign in"));
    }
  }

  // ---------- auth dialog ----------
  function openAuth(mode) {
    const err = h("div");
    const email = h("input", { type: "email", required: true, autocomplete: "email", maxlength: 200 });
    const pass = h("input", { type: "password", required: true, minlength: 8, autocomplete: mode === "up" ? "new-password" : "current-password" });
    const user = h("input", { type: "text", required: true, minlength: 3, maxlength: 20, pattern: "[A-Za-z0-9_]+", autocomplete: "username" });
    const submit = h("button", { class: "pill", type: "submit" }, mode === "up" ? "Create account" : mode === "reset" ? "Send link" : "Sign in");

    const form = h("form", {
      class: "confirm-body forum-form",
      onsubmit: async (e) => {
        e.preventDefault();
        err.replaceChildren();
        submit.disabled = true;
        try {
          if (mode === "up") {
            const name = user.value.trim();
            const { data: taken } = await sb.from("profiles").select("id").ilike("username", name.replace(/[\\%_]/g, "\\$&")).limit(1);
            if (taken && taken.length) throw new Error("That username is taken.");
            const { data, error } = await sb.auth.signUp({
              email: email.value.trim(),
              password: pass.value,
              options: { data: { username: name }, emailRedirectTo: here() },
            });
            if (error) throw error;
            if (!data.session) {
              form.replaceChildren(
                h("p", {}, "Account created. Check your email and click the link to confirm it, then sign in."),
                h("div", { class: "actions" }, h("button", { class: "pill", type: "button", onclick: () => dlg.close() }, "OK")));
              return;
            }
          } else if (mode === "in") {
            const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
            if (error) throw error;
          } else if (mode === "reset") {
            const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: here() });
            if (error) throw error;
            form.replaceChildren(
              h("p", {}, "If that email has an account, a reset link is on its way."),
              h("div", { class: "actions" }, h("button", { class: "pill", type: "button", onclick: () => dlg.close() }, "OK")));
            return;
          }
          dlg.close();
        } catch (e2) {
          err.replaceChildren(errorNote(friendly(e2)));
        } finally {
          submit.disabled = false;
        }
      },
    },
      mode !== "reset" ? [googleButton(), h("div", { class: "or caps" }, "or use email")] : null,
      mode === "up" ? h("label", {}, h("span", { class: "caps" }, "Username"), user, h("small", {}, "3 to 20 letters, numbers or _")) : null,
      h("label", {}, h("span", { class: "caps" }, "Email"), email),
      mode !== "reset" ? h("label", {}, h("span", { class: "caps" }, "Password"), pass, mode === "up" ? h("small", {}, "At least 8 characters") : null) : null,
      err,
      h("div", { class: "actions" },
        h("button", { class: "pill grey", type: "button", onclick: () => dlg.close() }, "Cancel"),
        submit),
      h("p", { class: "switch" },
        mode === "in" ? [h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("up"); } }, "Create an account"), " · ",
                         h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("reset"); } }, "Forgot password?")]
                      : h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("in"); } }, "Back to sign in")));

    const title = mode === "up" ? "Create account" : mode === "reset" ? "Reset password" : "Sign in";
    dlg.replaceChildren(h("div", { class: "card-bar caps" }, title), form);
    if (!dlg.open) dlg.showModal();
    (mode === "up" ? user : email).focus();
  }

  function openNewPassword() {
    const err = h("div");
    const pass = h("input", { type: "password", required: true, minlength: 8, autocomplete: "new-password" });
    const form = h("form", {
      class: "confirm-body forum-form",
      onsubmit: async (e) => {
        e.preventDefault();
        const { error } = await sb.auth.updateUser({ password: pass.value });
        if (error) err.replaceChildren(errorNote(friendly(error)));
        else dlg.close();
      },
    },
      h("label", {}, h("span", { class: "caps" }, "New password"), pass, h("small", {}, "At least 8 characters")),
      err,
      h("div", { class: "actions" }, h("button", { class: "pill", type: "submit" }, "Save password")));
    dlg.replaceChildren(h("div", { class: "card-bar caps" }, "Set a new password"), form);
    if (!dlg.open) dlg.showModal();
  }

  // ---------- files ----------
  const ALLOWED_TYPES = new Set([
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "application/zip", "application/x-zip-compressed", "application/vnd.android.package-archive",
    "application/x-7z-compressed", "application/vnd.rar", "application/x-rar-compressed",
    "text/plain", "application/json",
  ]);
  const isImage = (m) => /^image\/(png|jpeg|webp|gif)$/.test(m || "");
  const fileUrl = (path) => sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const downloadUrl = (path, name) => `${fileUrl(path)}?download=${encodeURIComponent(name)}`;
  const safeName = (n) => (n.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[_.]+/, "") || "file").slice(-80);

  // Thread authors can always attach in their own thread; others need Modder+. Announcements: Admin only.
  const canAttach = (t) => !!me && (me.is_admin || (t.category !== "announcements" && (t.author_id === me.id || isModderPlus(me))));

  async function uploadFile(threadId, f) {
    if (f.size > MAX_FILE) throw new Error(`${f.name} is over 50 MB.`);
    const type = ALLOWED_TYPES.has(f.type) ? f.type : "application/octet-stream";
    const path = `${me.id}/${threadId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName(f.name)}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: type, cacheControl: "31536000" });
    if (error) throw error;
    return { path, name: f.name.slice(0, 120), size: f.size, mime: type };
  }
  async function removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (list.length) await sb.storage.from(BUCKET).remove(list);
  }
  async function attachFiles(threadId, replyId, files) {
    for (const f of files) {
      const meta = await uploadFile(threadId, f);
      const { error } = await sb.from("attachments").insert({ thread_id: threadId, reply_id: replyId, ...meta });
      if (error) { await removeFiles([meta.path]); throw error; }
    }
  }

  function filePicker(limit) {
    let files = [];
    const input = h("input", { type: "file", multiple: true });
    const list = h("ul", { class: "pick-list" });
    const draw = () => list.replaceChildren(...files.map((f, i) =>
      h("li", {}, icon("clip"), h("span", {}, f.name), h("small", {}, fmtSize(f.size)),
        h("button", { type: "button", class: "link-btn", onclick: () => { files.splice(i, 1); draw(); } }, "Remove"))));
    input.addEventListener("change", () => {
      files.push(...input.files);
      input.value = "";
      if (limit) files = files.slice(0, limit);
      draw();
    });
    const el = h("div", { class: "picker" },
      h("div", { class: "picker-row" },
        h("label", { class: "pill grey small file-pill" }, icon("clip"), "Attach files", input),
        h("small", {}, limit ? `Up to ${limit} files, 50 MB each` : "50 MB per file")),
      list);
    return {
      el,
      get files() { return files; },
      check() { for (const f of files) if (f.size > MAX_FILE) throw new Error(`${f.name} is over 50 MB.`); },
    };
  }

  function attachmentList(items) {
    if (!items || !items.length) return null;
    const imgs = items.filter((a) => isImage(a.mime));
    const files = items.filter((a) => !isImage(a.mime));
    return h("div", { class: "attachments" },
      imgs.length ? h("div", { class: "thumbs" }, imgs.map((a) =>
        h("a", { href: fileUrl(a.path), target: "_blank", rel: "noopener noreferrer", title: a.name },
          h("img", { src: fileUrl(a.path), alt: a.name, loading: "lazy" })))) : null,
      files.map((a) => h("button", {
        type: "button",
        class: "file-chip",
        onclick: () => openDownload(downloadUrl(a.path, a.name), a.name, a.author),
      }, icon("clip"), h("span", {}, a.name), h("small", {}, fmtSize(a.size)))));
  }

  // ---------- views ----------
  const view = h("div", { class: "forum-view" });
  const loading = () => view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
  const boardIcon = (b) => h("span", { class: `board-icon ${b.key}` }, icon(b.icon));

  async function showIndex() {
    loading();
    const stats = await Promise.all(BOARDS.map(async (b) => {
      const [c, l] = await Promise.all([
        sb.from("threads").select("id", { count: "exact", head: true }).eq("category", b.key),
        sb.from("threads").select("id, title, last_activity_at").eq("category", b.key)
          .order("last_activity_at", { ascending: false }).limit(1),
      ]);
      return { count: c.count || 0, latest: l.data && l.data[0] };
    }));
    view.replaceChildren(...SECTIONS.map((sec) => h("section", { class: "board-section" },
      h("div", { class: "tag section-tag" }, sec),
      h("div", { class: "rows" }, BOARDS.map((b, i) => (b.section !== sec ? null :
        h("a", { class: "row board-row", href: `#/c/${b.key}` },
          boardIcon(b),
          h("span", { class: "label" },
            h("span", { class: "board-name" }, b.name, b.adminOnly ? h("span", { class: "badge gold" }, "Admin only") : null),
            h("small", {}, b.desc),
            stats[i].latest ? h("small", { class: "latest" }, "Latest: ", h("strong", {}, stats[i].latest.title), ` · ${ago(stats[i].latest.last_activity_at)}`) : null),
          h("span", { class: "board-count" }, h("strong", {}, String(stats[i].count)), h("small", {}, stats[i].count === 1 ? "thread" : "threads")),
          chev())))))));
  }

  function versionSelect(current, onPick, versions = GAME_VERSIONS) {
    const sel = h("select", { class: "version-filter", "aria-label": "GeoPrix version" },
      h("option", { value: "" }, "All GeoPrix versions"),
      versions.map((v) => h("option", { value: v, selected: v === current }, `GeoPrix ${v}`)));
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }

  async function showBoard(key, ver) {
    const b = board(key);
    loading();
    const cols = `id, title, category, pinned, locked, reply_count, last_activity_at, ${AUTHOR}`;
    let q = key === "mods" && ver
      ? sb.from("threads").select(`${cols}, mod_releases!inner(game_version)`).eq("mod_releases.game_version", ver)
      : sb.from("threads").select(cols);
    q = q.eq("category", key)
      .order("pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(50);
    const { data, error } = await q;

    const canPost = !b.adminOnly || (me && me.is_admin);
    const newLabel = key === "mods" ? "Share a mod" : key === "announcements" ? "New announcement" : "New thread";
    const head = h("div", { class: "board-head" },
      boardIcon(b),
      h("div", {}, h("h1", { class: "board-title" }, b.name), h("p", {}, b.desc)));
    const tools = h("div", { class: "forum-top" },
      key === "mods" ? versionSelect(ver, (v) => { location.hash = v ? `#/c/mods/v/${v}` : "#/c/mods"; }) : h("span"),
      canPost ? (me ? h("a", { class: "pill", href: `#/new/${key}` }, newLabel)
                    : h("button", { class: "pill", onclick: () => openAuth("in") }, newLabel)) : null);

    let list;
    if (error) list = card("Error", errorNote(friendly(error)), { warn: true });
    else if (!data.length) list = card(b.name,
      h("div", { class: "empty" },
        h("h1", { class: "big" }, ver ? `No mods for GeoPrix ${ver} yet` : "Nothing here yet"),
        h("p", {}, canPost ? "Be the first to post." : "Check back soon.")), { off: true, bodyClass: "" });
    else list = h("div", { class: "rows" }, data.map((t) =>
      h("a", { class: "row thread-row", href: `#/t/${t.id}` },
        avatar(t.author, "sm"),
        h("span", { class: "label" },
          h("span", { class: "thread-title" },
            t.pinned ? h("span", { class: "badge" }, "Pinned") : null,
            t.locked && key !== "announcements" ? h("span", { class: "badge grey" }, "Locked") : null,
            t.title),
          h("small", {}, `${t.author ? t.author.username : "deleted"} · ${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"} · ${ago(t.last_activity_at)}`)),
        chev())));

    view.replaceChildren(h("p", { class: "back" }, h("a", { href: "#/" }, "‹ All forums")), head, tools, list);
  }

  function post(author, created, body, actions, files) {
    return h("article", { class: "post card" },
      h("div", { class: "post-bar" },
        avatar(author, "sm"),
        h("span", { class: "author" }, nameLink(author), badges(author)),
        h("span", { class: "time" }, ago(created)),
        h("span", { class: "post-actions" }, actions)),
      h("div", { class: "post-body" }, body),
      attachmentList(files));
  }

  async function showThread(id, tab, ver) {
    loading();
    const [{ data: t }, { data: replies }, { data: atts }, { count: relCount }] = await Promise.all([
      sb.from("threads").select(`id, title, body, category, pinned, locked, created_at, author_id, ${AUTHOR}`).eq("id", id).maybeSingle(),
      sb.from("replies").select(`id, body, created_at, author_id, ${AUTHOR}`).eq("thread_id", id).order("created_at"),
      sb.from("attachments").select("id, reply_id, path, name, size, mime, author:profiles(username, is_admin, is_modder)").eq("thread_id", id).order("id"),
      sb.from("mod_releases").select("id", { count: "exact", head: true }).eq("thread_id", id),
    ]);
    if (!t) {
      view.replaceChildren(card("Not found", h("p", {}, "This thread doesn't exist or was deleted. ", h("a", { href: "#/" }, "Back to the forum")), { off: true }));
      return;
    }
    const b = board(t.category) || BOARDS[0];
    const isMods = t.category === "mods";
    const isNews = t.category === "announcements";
    const files = atts || [];
    const reps = replies || [];

    const head = [
      h("p", { class: "back" }, h("a", { href: `#/c/${b.key}` }, `‹ ${b.name}`)),
      h("div", { class: "thread-head" },
        h("a", { class: "tag", href: `#/c/${b.key}` }, b.name),
        t.pinned ? h("span", { class: "badge" }, "Pinned") : null,
        t.locked && !isNews ? h("span", { class: "badge grey" }, "Locked") : null),
      h("h1", { class: "thread-h1" }, t.title),
    ];
    if (isMods) {
      const releasesTab = tab === "releases";
      head.push(h("nav", { class: "tabs" },
        h("a", { class: "tab", href: `#/t/${t.id}`, "aria-current": releasesTab ? null : "page" }, icon("forum"), "Discussion"),
        h("a", { class: "tab", href: `#/t/${t.id}/releases`, "aria-current": releasesTab ? "page" : null }, icon("download"), `Releases (${relCount || 0})`)));
      if (releasesTab) { await showReleases(t, ver, head); return; }
    }

    const canMod = (authorId) => me && (me.id === authorId || me.is_admin);
    const filesFor = (replyId) => files.filter((a) => (a.reply_id || null) === (replyId || null));

    const threadActions = [];
    if (me && me.is_admin) {
      threadActions.push(
        h("button", { class: "link-btn", onclick: async () => { await sb.from("threads").update({ pinned: !t.pinned }).eq("id", t.id); route(); } }, t.pinned ? "Unpin" : "Pin"),
        h("button", { class: "link-btn", onclick: async () => { await sb.from("threads").update({ locked: !t.locked }).eq("id", t.id); route(); } },
          isNews ? (t.locked ? "Allow replies" : "Turn off replies") : (t.locked ? "Unlock" : "Lock")));
    }
    if (canMod(t.author_id)) {
      threadActions.push(h("button", { class: "link-btn", onclick: async () => {
        if (!confirm("Delete this thread and everything in it? This can't be undone.")) return;
        const { data: rels } = await sb.from("mod_releases").select("file_path").eq("thread_id", t.id);
        const { error: e } = await sb.from("threads").delete().eq("id", t.id);
        if (e) { alert(friendly(e)); return; }
        await removeFiles([...files.map((a) => a.path), ...(rels || []).map((r) => r.file_path)]);
        location.hash = `#/c/${b.key}`;
      } }, "Delete"));
    }

    const parts = [...head, post(t.author, t.created_at, t.body, threadActions, filesFor(null))];
    if (reps.length || !(isNews && t.locked)) {
      parts.push(h("div", { class: "tag section-tag" }, `${reps.length} ${reps.length === 1 ? "reply" : "replies"}`));
    }
    parts.push(...reps.map((r) => post(r.author, r.created_at, r.body,
      canMod(r.author_id) ? h("button", { class: "link-btn", onclick: async () => {
        if (!confirm("Delete this reply? This can't be undone.")) return;
        const { error: e } = await sb.from("replies").delete().eq("id", r.id);
        if (e) { alert(friendly(e)); return; }
        await removeFiles(filesFor(r.id).map((a) => a.path));
        route();
      } }, "Delete") : null,
      filesFor(r.id))));

    if (t.locked && !(me && me.is_admin)) {
      parts.push(card(isNews ? "Replies off" : "Locked",
        h("p", {}, isNews ? "Replies are turned off for this announcement." : "This thread is locked. No new replies."), { off: true }));
    } else if (!me) {
      parts.push(card("Reply", h("div", { class: "actions" }, h("button", { class: "pill", onclick: () => openAuth("in") }, "Sign in to reply"))));
    } else {
      const err = h("div");
      const body = h("textarea", { rows: 5, required: true, maxlength: 8000, placeholder: "Write a reply…" });
      const picker = canAttach(t) ? filePicker(me.is_admin ? null : MAX_ATTACH) : null;
      const send = h("button", { class: "pill", type: "submit" }, "Post reply");
      parts.push(card("Reply", h("form", {
        class: "forum-form",
        onsubmit: async (e) => {
          e.preventDefault();
          err.replaceChildren();
          send.disabled = true;
          try {
            if (picker) picker.check();
            const { data: r, error: e2 } = await sb.from("replies").insert({ thread_id: t.id, body: body.value.trim() }).select("id").single();
            if (e2) throw e2;
            if (picker && picker.files.length) {
              try { await attachFiles(t.id, r.id, picker.files); }
              catch (e3) { alert(`Your reply was posted, but a file failed: ${friendly(e3)}`); }
            }
            route();
          } catch (e4) {
            err.replaceChildren(errorNote(friendly(e4)));
          } finally {
            send.disabled = false;
          }
        },
      }, body, picker ? picker.el : null, err, h("div", { class: "actions" }, send))));
    }
    view.replaceChildren(...parts);
  }

  async function showReleases(t, ver, head) {
    const { data, error } = await sb.from("mod_releases")
      .select("id, mod_version, game_version, launcher_version, notes, link, file_path, file_name, file_size, created_at, author_id, author:profiles(username, is_admin, is_modder)")
      .eq("thread_id", t.id).order("created_at", { ascending: false });
    const rels = data || [];
    const mine = me && me.id === t.author_id;
    const versions = [...new Set([...GAME_VERSIONS, ...rels.map((r) => r.game_version)])];
    const shown = ver ? rels.filter((r) => r.game_version === ver) : rels;

    const parts = [...head, h("div", { class: "forum-top" },
      versionSelect(ver, (v) => { location.hash = v ? `#/t/${t.id}/releases/v/${v}` : `#/t/${t.id}/releases`; }, versions),
      h("small", { class: "muted" }, `Only the ${MAX_RELEASES} newest releases are kept.`))];

    if (error) parts.push(card("Error", errorNote(friendly(error)), { warn: true }));
    else if (!shown.length) {
      parts.push(card("Releases", h("div", { class: "empty" },
        h("h1", { class: "big" }, ver ? `Nothing for GeoPrix ${ver}` : "No releases yet"),
        h("p", {}, mine ? "Add your first release below." : "The author hasn't uploaded a release yet.")), { off: true, bodyClass: "" }));
    } else {
      for (const r of shown) {
        const isLatest = rels[0].id === r.id;
        let host = r.link;
        if (r.link) { try { host = new URL(r.link).host; } catch (e) { /* keep raw */ } }
        const canDel = me && (me.id === r.author_id || me.is_admin);
        parts.push(h("div", { class: "card release-item" },
          h("div", { class: "card-bar caps" }, `Version ${r.mod_version}`, isLatest ? h("span", { class: "badge bar-badge" }, "Latest") : null),
          h("div", { class: "card-body release-body" },
            h("div", { class: "chips" },
              h("span", { class: "chip" }, `GeoPrix ${r.game_version}`),
              r.launcher_version ? h("span", { class: "chip" }, `Launcher ${r.launcher_version}`) : null,
              h("span", { class: "chip dim" }, ago(r.created_at))),
            r.notes ? h("p", { class: "release-notes" }, r.notes) : null,
            h("div", { class: "release-actions" },
              r.file_path ? h("button", { class: "pill small", onclick: () => openDownload(downloadUrl(r.file_path, r.file_name || "mod"), r.file_name || "mod", r.author) },
                icon("download"), `Download · ${fmtSize(r.file_size || 0)}`) : null,
              r.link ? h("button", { class: "pill grey small", onclick: () => openDownload(r.link, host, r.author, true) }, icon("link"), host) : null,
              canDel ? h("button", { class: "link-btn", onclick: async () => {
                if (!confirm(`Delete version ${r.mod_version}?`)) return;
                const { error: e } = await sb.from("mod_releases").delete().eq("id", r.id);
                if (e) { alert(friendly(e)); return; }
                await removeFiles([r.file_path]);
                route();
              } }, "Delete") : null))));
      }
    }

    if (mine) parts.push(releaseForm(t, rels));
    view.replaceChildren(...parts);
  }

  function releaseForm(t, rels) {
    const err = h("div");
    const modv = h("input", { type: "text", required: true, maxlength: 30, placeholder: "1.0" });
    const gv = h("select", { required: true }, GAME_VERSIONS.map((v) => h("option", { value: v }, `GeoPrix ${v}`)));
    const lv = h("select", {}, h("option", { value: "" }, "Any launcher"), LAUNCHER_VERSIONS.map((v) => h("option", { value: v }, v)));
    const notes = h("textarea", { rows: 4, maxlength: 2000, placeholder: "What's new in this version?" });
    const file = h("input", { type: "file" });
    const link = h("input", { type: "url", maxlength: 300, placeholder: "https://…", pattern: "https://.+" });
    const send = h("button", { class: "pill", type: "submit" }, "Publish release");
    const full = rels.length >= MAX_RELEASES;

    return card("Add a release", h("form", {
      class: "forum-form",
      onsubmit: async (e) => {
        e.preventDefault();
        err.replaceChildren();
        const f = file.files[0];
        const url = link.value.trim();
        if (!f && !url) { err.replaceChildren(errorNote("Add a file or a link.")); return; }
        if (f && f.size > MAX_FILE) { err.replaceChildren(errorNote("Files can be at most 50 MB.")); return; }
        if (full && !confirm(`Only ${MAX_RELEASES} releases are kept, so version ${rels[rels.length - 1].mod_version} will be deleted. Continue?`)) return;
        send.disabled = true;
        let meta = null;
        try {
          if (f) meta = await uploadFile(t.id, f);
          // The database keeps the 3 newest; these are the ones it will remove.
          const dropped = rels.slice(MAX_RELEASES - 1);
          const { error } = await sb.from("mod_releases").insert({
            thread_id: t.id,
            mod_version: modv.value.trim(),
            game_version: gv.value,
            launcher_version: lv.value || null,
            notes: notes.value.trim() || null,
            link: url || null,
            file_path: meta ? meta.path : null,
            file_name: meta ? meta.name : null,
            file_size: meta ? meta.size : null,
          });
          if (error) throw error;
          meta = null;
          await removeFiles(dropped.map((r) => r.file_path));
          if (location.hash === `#/t/${t.id}/releases`) route();
          else location.hash = `#/t/${t.id}/releases`;
        } catch (e2) {
          if (meta) await removeFiles([meta.path]);
          err.replaceChildren(errorNote(friendly(e2)));
        } finally {
          send.disabled = false;
        }
      },
    },
      h("div", { class: "form-grid" },
        h("label", {}, h("span", { class: "caps" }, "Mod version"), modv),
        h("label", {}, h("span", { class: "caps" }, "GeoPrix version"), gv),
        h("label", {}, h("span", { class: "caps" }, "Recommended launcher"), lv)),
      h("label", {}, h("span", { class: "caps" }, "Changes"), notes),
      h("label", {}, h("span", { class: "caps" }, "Mod file"), file, h("small", {}, "Up to 50 MB")),
      h("label", {}, h("span", { class: "caps" }, "Or a link"), link, h("small", {}, "For example your GitHub release page")),
      full ? h("p", { class: "rules" }, `You already have ${MAX_RELEASES} releases. Publishing deletes the oldest one.`) : null,
      h("p", { class: "rules" }, "Mods must never bypass GeoPrix's limits or paid features. No malware."),
      err,
      h("div", { class: "actions" }, send)));
  }

  function showNew(key) {
    if (!me) { openAuth("in"); location.hash = "#/"; return; }
    const allowed = BOARDS.filter((b) => !b.adminOnly || me.is_admin);
    const start = allowed.find((b) => b.key === key) || allowed[0];
    const err = h("div");
    const sel = h("select", { required: true }, allowed.map((b) => h("option", { value: b.key, selected: b.key === start.key }, b.name)));
    const titleLabel = h("span", { class: "caps" });
    const bodyLabel = h("span", { class: "caps" });
    const hint = h("p", { class: "muted hint" });
    const sync = () => {
      const isMods = sel.value === "mods";
      titleLabel.textContent = isMods ? "Mod name" : "Title";
      bodyLabel.textContent = isMods ? "About this mod" : "Message";
      hint.textContent = isMods ? "After posting, open the Releases tab to upload your mod file."
        : sel.value === "announcements" ? "Replies start turned off. You can allow them on the announcement." : "";
    };
    sel.addEventListener("change", sync);
    sync();
    const title = h("input", { type: "text", required: true, minlength: 3, maxlength: 120 });
    const body = h("textarea", { rows: 8, required: true, maxlength: 8000 });
    const picker = filePicker(me.is_admin ? null : MAX_ATTACH); // you're the author of your own thread
    const send = h("button", { class: "pill", type: "submit" }, "Post");
    view.replaceChildren(
      h("p", { class: "back" }, h("a", { href: `#/c/${start.key}` }, `‹ ${start.name}`)),
      card("New post", h("form", {
        class: "forum-form",
        onsubmit: async (e) => {
          e.preventDefault();
          err.replaceChildren();
          send.disabled = true;
          try {
            picker.check();
            const { data, error } = await sb.from("threads")
              .insert({ category: sel.value, title: title.value.trim(), body: body.value.trim() })
              .select("id").single();
            if (error) throw error;
            if (picker.files.length) {
              try { await attachFiles(data.id, null, picker.files); }
              catch (e3) { alert(`Your post is up, but a file failed: ${friendly(e3)}`); }
            }
            location.hash = sel.value === "mods" ? `#/t/${data.id}/releases` : `#/t/${data.id}`;
          } catch (e2) {
            err.replaceChildren(errorNote(friendly(e2)));
          } finally {
            send.disabled = false;
          }
        },
      },
        h("label", {}, h("span", { class: "caps" }, "Forum"), sel),
        h("label", {}, titleLabel, title),
        h("label", {}, bodyLabel, body),
        picker.el,
        hint,
        h("p", { class: "rules" }, "Rules: 13+ only. No illegal content, nothing that harms others, no Pro or paid-feature bypasses, no malware."),
        err,
        h("div", { class: "actions" }, h("a", { class: "pill grey", href: `#/c/${start.key}` }, "Cancel"), send))));
    title.focus();
  }

  // ---------- profiles ----------
  const PROFILE_COLS = "id, num, username, is_admin, is_modder, bio, avatar_url, name_color, link, created_at";

  async function showProfile(key) {
    loading();
    const byNum = /^\d+$/.test(key);
    const { data: p } = await sb.from("profiles").select(PROFILE_COLS).eq(byNum ? "num" : "username", key).maybeSingle();
    if (!p) {
      view.replaceChildren(card("Not found", h("p", {}, "No user with that name. ", h("a", { href: "#/" }, "Back to the forum")), { off: true }));
      return;
    }
    if (!byNum) history.replaceState(null, "", profileHref(p));
    const [tc, rc, recent] = await Promise.all([
      sb.from("threads").select("id", { count: "exact", head: true }).eq("author_id", p.id),
      sb.from("replies").select("id", { count: "exact", head: true }).eq("author_id", p.id),
      sb.from("threads").select("id, title, category, created_at").eq("author_id", p.id).order("created_at", { ascending: false }).limit(5),
    ]);
    const posts = (tc.count || 0) + (rc.count || 0);
    const mine = me && me.id === p.id;
    const custom = isModderPlus(p);
    const joined = new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    const info = [
      h("div", { class: "profile-head" },
        avatar(p, "lg"),
        h("div", { class: "profile-id" },
          h("h1", { class: "profile-name" }, nameLink(p)),
          h("div", { class: "profile-badges" }, badges(p)),
          h("small", {}, `User #${p.num} · Joined ${joined} · ${posts} ${posts === 1 ? "post" : "posts"}`))),
    ];
    if (custom && p.bio) info.push(h("p", { class: "profile-bio" }, p.bio));
    if (custom && p.link && /^https:\/\//.test(p.link)) {
      let host = p.link;
      try { host = new URL(p.link).host; } catch (e) { /* keep raw */ }
      info.push(h("p", { class: "profile-link" }, h("a", { href: p.link, target: "_blank", rel: "noopener noreferrer nofollow ugc" }, host)));
    }
    if (mine && !custom) info.push(h("p", { class: "rules" }, "Profile pictures, bios, colours and links are for Modders."));

    const actions = [];
    if (mine && custom) actions.push(h("a", { class: "pill small", href: "#/edit" }, "Edit profile"));
    if (mine) actions.push(h("button", { class: "pill grey small", onclick: openRename }, "Change username"));
    const err = h("div");
    if (me && me.is_admin) {
      const call = async (fn, args, ask) => {
        if (ask && !confirm(ask)) return;
        const { error } = await sb.rpc(fn, args);
        if (error) err.replaceChildren(errorNote(friendly(error)));
        else { if (mine) await loadMe(); route(); }
      };
      actions.push(
        h("button", { class: `pill small${p.is_modder ? " grey" : ""}`, onclick: () => call("set_modder", { target_username: p.username, make_modder: !p.is_modder }) },
          p.is_modder ? "Remove Modder" : "Give Modder"),
        h("button", { class: "pill grey small", onclick: () => call("admin_clear_profile", { target_username: p.username }, `Clear ${p.username}'s picture, bio, colour and link?`) },
          "Clear profile"));
    }
    if (actions.length) info.push(h("div", { class: "actions profile-actions" }, actions), err);

    const list = recent.data && recent.data.length
      ? h("div", { class: "rows" }, recent.data.map((t) =>
          h("a", { class: "row thread-row", href: `#/t/${t.id}` },
            h("span", { class: "label" }, h("span", { class: "thread-title" }, t.title), h("small", {}, `${boardName(t.category)} · ${ago(t.created_at)}`)),
            chev())))
      : h("p", { class: "loading" }, "No threads yet.");

    view.replaceChildren(
      h("p", { class: "back" }, h("a", { href: "#/" }, "‹ All forums")),
      card("Profile", h("div", { class: "profile" }, info)),
      h("div", { class: "tag section-tag" }, "Recent threads"),
      list);
  }

  async function showEdit() {
    if (!me) { openAuth("in"); location.hash = "#/"; return; }
    if (!isModderPlus(me)) { location.hash = profileHref(me); return; }
    loading();
    const { data: p } = await sb.from("profiles").select(PROFILE_COLS).eq("id", me.id).maybeSingle();
    if (!p) return;

    let avatarUrl = p.avatar_url || "";
    const preview = h("span", { class: "avatar-preview" });
    const showPreview = () => preview.replaceChildren(avatar({ ...p, avatar_url: avatarUrl }, "lg"));
    showPreview();

    const err = h("div");
    const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif" });
    const removePic = h("button", { class: "pill grey small", type: "button", onclick: () => { avatarUrl = ""; file.value = ""; showPreview(); } }, "Remove picture");
    file.addEventListener("change", () => {
      const f = file.files[0];
      err.replaceChildren();
      if (!f) return showPreview();
      if (f.size > 1024 * 1024) { err.replaceChildren(errorNote("Pictures can be at most 1 MB.")); file.value = ""; return showPreview(); }
      preview.replaceChildren(h("img", { class: "avatar lg", src: URL.createObjectURL(f), alt: "" }));
    });

    const bio = h("textarea", { rows: 4, maxlength: 300, placeholder: "A few words about you and your mods" });
    bio.value = p.bio || "";
    const useColor = h("input", { type: "checkbox", checked: okColor(p.name_color) });
    const color = h("input", { type: "color", value: okColor(p.name_color) ? p.name_color : "#3fe58c" });
    color.addEventListener("input", () => { useColor.checked = true; });
    const link = h("input", { type: "url", maxlength: 200, placeholder: "https://…", pattern: "https://.+" });
    link.value = p.link || "";
    const save = h("button", { class: "pill", type: "submit" }, "Save profile");
    const back = profileHref(me);

    view.replaceChildren(
      h("p", { class: "back" }, h("a", { href: back }, "‹ Back to your profile")),
      card("Edit profile", h("form", {
        class: "forum-form",
        onsubmit: async (e) => {
          e.preventDefault();
          err.replaceChildren();
          save.disabled = true;
          try {
            const f = file.files[0];
            if (f) {
              const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[f.type];
              if (!ext) throw new Error("Use a PNG, JPG, WebP or GIF picture.");
              const path = `${me.id}/avatar-${Date.now()}.${ext}`;
              const up = await sb.storage.from("avatars").upload(path, f, { contentType: f.type, cacheControl: "31536000" });
              if (up.error) throw up.error;
              avatarUrl = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
            }
            const { error } = await sb.rpc("update_my_profile", {
              new_bio: bio.value,
              new_avatar_url: avatarUrl,
              new_name_color: useColor.checked ? color.value : "",
              new_link: link.value.trim(),
            });
            if (error) throw error;
            // tidy up pictures that are no longer used
            const { data: old } = await sb.storage.from("avatars").list(me.id);
            const keep = avatarUrl ? avatarUrl.split("/").pop() : null;
            const stale = (old || []).filter((x) => x.name !== keep).map((x) => `${me.id}/${x.name}`);
            if (stale.length) await sb.storage.from("avatars").remove(stale);
            await loadMe();
            location.hash = back;
          } catch (e2) {
            err.replaceChildren(errorNote(friendly(e2)));
          } finally {
            save.disabled = false;
          }
        },
      },
        h("div", { class: "avatar-edit" }, preview,
          h("div", { class: "avatar-edit-controls" },
            h("label", {}, h("span", { class: "caps" }, "Profile picture"), file, h("small", {}, "PNG, JPG, WebP or GIF, up to 1 MB")),
            removePic)),
        h("label", {}, h("span", { class: "caps" }, "Bio"), bio, h("small", {}, "Up to 300 characters")),
        h("div", { class: "color-row" },
          h("label", { class: "check" }, useColor, h("span", {}, "Coloured name")),
          color),
        h("label", {}, h("span", { class: "caps" }, "Link"), link, h("small", {}, "One https:// link, like your GitHub or YouTube")),
        h("p", { class: "rules" }, "Same rules as posts: nothing illegal or harmful."),
        err,
        h("div", { class: "actions" }, h("a", { class: "pill grey", href: back }, "Cancel"), save))));
  }

  // ---------- router ----------
  const okVer = (v) => (v && /^[0-9.]{1,12}$/.test(v) ? v : null);
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return ""; } });
    if (parts[0] === "t" && /^\d+$/.test(parts[1])) {
      const rel = parts[2] === "releases";
      return showThread(parts[1], rel ? "releases" : null, rel && parts[3] === "v" ? okVer(parts[4]) : null);
    }
    if (parts[0] === "new") return showNew(parts[1]);
    if (parts[0] === "u" && parts[1] && (/^\d+$/.test(parts[1]) || /^[A-Za-z0-9_]{3,20}$/.test(parts[1]))) return showProfile(parts[1]);
    if (parts[0] === "edit") return showEdit();
    if (parts[0] === "c" && board(parts[1])) return showBoard(parts[1], parts[2] === "v" ? okVer(parts[3]) : null);
    return showIndex();
  }

  root.replaceChildren(account, view);
  addEventListener("hashchange", () => { route(); scrollTo(0, 0); });
  sb.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") openNewPassword();
    // run outside the auth callback (supabase-js recommends not awaiting inside it)
    setTimeout(async () => { await loadMe(); if (event === "SIGNED_IN" || event === "SIGNED_OUT") route(); }, 0);
  });
  loadMe().then(route);
})();
