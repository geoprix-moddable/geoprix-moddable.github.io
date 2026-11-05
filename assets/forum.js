// GeoPrix Moddable forum (Supabase). All user text is inserted with textContent, never as HTML.
(() => {
  const root = document.getElementById("forum");
  if (!root) return;

  const cfg = window.FORUM_CONFIG || {};
  const CATEGORIES = [
    ["general", "General"],
    ["help", "Help"],
    ["ideas", "Ideas"],
    ["show", "Show and tell"],
    ["announcements", "Announcements"],
  ];
  const catName = (c) => (CATEGORIES.find(([k]) => k === c) || [c, c])[1];

  // ---------- tiny DOM helper ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const chev = () => {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", "chev");
    s.setAttribute("viewBox", "0 0 24 24");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12.6 12 8 7.4 9.4 6l6 6-6 6L8 16.6z");
    s.append(p);
    return s;
  };

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
    return m;
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
  let me = null; // { id, username, is_admin }
  const here = () => location.origin + location.pathname;

  async function loadMe() {
    const { data: { session } } = await sb.auth.getSession();
    me = null;
    if (session) {
      const { data } = await sb.from("profiles").select("id, username, is_admin, needs_username").eq("id", session.user.id).maybeSingle();
      me = data || { id: session.user.id, username: "?", is_admin: false };
    }
    renderAccount();
    if (me && me.needs_username) openPickUsername();
  }

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
      h("p", {}, "Welcome! Pick the name other people will see on the forum. You can only choose it once."),
      h("label", {}, h("span", { class: "caps" }, "Username"), user, h("small", {}, "3 to 20 letters, numbers or _")),
      err,
      h("div", { class: "actions" },
        h("button", { class: "pill grey", type: "button", onclick: () => dlg.close() }, "Later"),
        save));
    dlg.replaceChildren(h("div", { class: "card-bar caps" }, "Choose a username"), form);
    if (!dlg.open) dlg.showModal();
    user.select();
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
    return h("button", {
      class: "google-btn",
      type: "button",
      onclick: async () => {
        const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: here() } });
        if (error) alert(friendly(error));
      },
    }, g, "Continue with Google");
  }

  // ---------- account bar ----------
  const account = h("div", { class: "forum-account" });
  function renderAccount() {
    if (me) {
      account.replaceChildren(
        h("span", { class: "caps who" }, "Signed in as ", h("strong", {}, me.username), me.is_admin ? h("span", { class: "badge" }, "Admin") : null),
        h("button", { class: "pill grey small", onclick: () => sb.auth.signOut() }, "Sign out"));
    } else {
      account.replaceChildren(
        h("span", { class: "who" }, "Sign in to post and reply."),
        h("button", { class: "pill small", onclick: () => openAuth("in") }, "Sign in"));
    }
  }

  // ---------- auth dialog ----------
  const dlg = h("dialog", { class: "confirm card" });
  document.body.append(dlg);
  function openAuth(mode) {
    const err = h("div");
    const email = h("input", { type: "email", required: true, autocomplete: "email", maxlength: 200 });
    const pass = h("input", { type: "password", required: true, minlength: 8, autocomplete: mode === "up" ? "new-password" : "current-password" });
    const user = h("input", { type: "text", required: true, minlength: 3, maxlength: 20, pattern: "[A-Za-z0-9_]+", autocomplete: "username" });
    const submit = h("button", { class: "pill", type: "submit" }, mode === "up" ? "Create account" : "Sign in");

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

  // ---------- views ----------
  const view = h("div", { class: "forum-view" });

  function categoryTags(active) {
    return h("nav", { class: "forum-cats", "aria-label": "Categories" },
      h("a", { class: "tag", href: "#/", "aria-current": active ? null : "page" }, "All"),
      CATEGORIES.map(([k, n]) => h("a", { class: "tag", href: `#/c/${k}`, "aria-current": active === k ? "page" : null }, n)));
  }

  async function showList(category) {
    view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
    let q = sb.from("threads")
      .select("id, title, category, pinned, locked, reply_count, last_activity_at, author:profiles(username)")
      .order("pinned", { ascending: false })
      .order("last_activity_at", { ascending: false })
      .limit(50);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;

    const top = h("div", { class: "forum-top" },
      categoryTags(category),
      me ? h("a", { class: "pill", href: category ? `#/new/${category}` : "#/new" }, "New thread")
         : h("button", { class: "pill", onclick: () => openAuth("in") }, "New thread"));

    let list;
    if (error) list = card("Error", errorNote(friendly(error)), { warn: true });
    else if (!data.length) list = card(category ? catName(category) : "Threads",
      h("div", { class: "empty" }, h("h1", { class: "big" }, "No threads yet"), h("p", {}, "Be the first to start one.")), { off: true, bodyClass: "" });
    else list = h("div", { class: "rows" }, data.map((t) =>
      h("a", { class: "row thread-row", href: `#/t/${t.id}` },
        h("span", { class: "label" },
          h("span", { class: "thread-title" },
            t.pinned ? h("span", { class: "badge" }, "Pinned") : null,
            t.locked ? h("span", { class: "badge grey" }, "Locked") : null,
            t.title),
          h("small", {}, `${catName(t.category)} · ${t.author ? t.author.username : "deleted"} · ${t.reply_count} ${t.reply_count === 1 ? "reply" : "replies"} · ${ago(t.last_activity_at)}`)),
        chev())));

    view.replaceChildren(top, list);
  }

  function post(author, created, body, actions) {
    return h("article", { class: "post card" },
      h("div", { class: "post-bar" },
        h("span", { class: "caps author" }, author || "deleted"),
        h("span", { class: "time" }, ago(created)),
        h("span", { class: "post-actions" }, actions)),
      h("div", { class: "post-body" }, body));
  }

  async function showThread(id) {
    view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
    const [{ data: t, error }, { data: replies, error: rErr }] = await Promise.all([
      sb.from("threads").select("id, title, body, category, pinned, locked, created_at, author_id, author:profiles(username)").eq("id", id).maybeSingle(),
      sb.from("replies").select("id, body, created_at, author_id, author:profiles(username)").eq("thread_id", id).order("created_at"),
    ]);
    if (error || rErr || !t) {
      view.replaceChildren(card("Not found", h("p", {}, "This thread doesn't exist or was deleted. ", h("a", { href: "#/" }, "Back to the forum")), { off: true }));
      return;
    }
    const canMod = (authorId) => me && (me.id === authorId || me.is_admin);
    const del = (what, fn) => h("button", { class: "link-btn", onclick: async () => {
      if (!confirm(`Delete this ${what}? This can't be undone.`)) return;
      const { error: e } = await fn();
      if (e) alert(friendly(e)); else route();
    } }, "Delete");

    const threadActions = [];
    if (me && me.is_admin) {
      threadActions.push(
        h("button", { class: "link-btn", onclick: async () => { await sb.from("threads").update({ pinned: !t.pinned }).eq("id", t.id); route(); } }, t.pinned ? "Unpin" : "Pin"),
        h("button", { class: "link-btn", onclick: async () => { await sb.from("threads").update({ locked: !t.locked }).eq("id", t.id); route(); } }, t.locked ? "Unlock" : "Lock"));
    }
    if (canMod(t.author_id)) threadActions.push(del("thread", async () => {
      const r = await sb.from("threads").delete().eq("id", t.id);
      if (!r.error) location.hash = "#/";
      return r;
    }));

    const head = h("div", { class: "thread-head" },
      h("a", { class: "tag", href: `#/c/${t.category}` }, catName(t.category)),
      t.pinned ? h("span", { class: "badge" }, "Pinned") : null,
      t.locked ? h("span", { class: "badge grey" }, "Locked") : null);

    const parts = [
      h("p", { class: "back" }, h("a", { href: "#/" }, "‹ Back to the forum")),
      head,
      h("h1", { class: "thread-h1" }, t.title),
      post(t.author && t.author.username, t.created_at, t.body, threadActions),
      h("div", { class: "tag section-tag" }, `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`),
      ...replies.map((r) => post(r.author && r.author.username, r.created_at, r.body,
        canMod(r.author_id) ? del("reply", () => sb.from("replies").delete().eq("id", r.id)) : null)),
    ];

    if (t.locked && !(me && me.is_admin)) {
      parts.push(card("Locked", h("p", {}, "This thread is locked. No new replies."), { off: true }));
    } else if (!me) {
      parts.push(card("Reply", h("div", { class: "actions" }, h("button", { class: "pill", onclick: () => openAuth("in") }, "Sign in to reply"))));
    } else {
      const err = h("div");
      const body = h("textarea", { rows: 5, required: true, maxlength: 8000, placeholder: "Write a reply…" });
      const send = h("button", { class: "pill", type: "submit" }, "Post reply");
      parts.push(card("Reply", h("form", {
        class: "forum-form",
        onsubmit: async (e) => {
          e.preventDefault();
          send.disabled = true;
          const { error: e2 } = await sb.from("replies").insert({ thread_id: t.id, body: body.value.trim() });
          send.disabled = false;
          if (e2) err.replaceChildren(errorNote(friendly(e2)));
          else route();
        },
      }, body, err, h("div", { class: "actions" }, send))));
    }
    view.replaceChildren(...parts);
  }

  function showNew(category) {
    if (!me) { openAuth("in"); location.hash = "#/"; return; }
    const err = h("div");
    const cats = CATEGORIES.filter(([k]) => k !== "announcements" || me.is_admin);
    const sel = h("select", { required: true }, cats.map(([k, n]) => h("option", { value: k, selected: k === (category || "general") }, n)));
    const title = h("input", { type: "text", required: true, minlength: 3, maxlength: 120 });
    const body = h("textarea", { rows: 8, required: true, maxlength: 8000 });
    const send = h("button", { class: "pill", type: "submit" }, "Post thread");
    view.replaceChildren(
      h("p", { class: "back" }, h("a", { href: "#/" }, "‹ Back to the forum")),
      card("New thread", h("form", {
        class: "forum-form",
        onsubmit: async (e) => {
          e.preventDefault();
          send.disabled = true;
          const { data, error } = await sb.from("threads")
            .insert({ category: sel.value, title: title.value.trim(), body: body.value.trim() })
            .select("id").single();
          send.disabled = false;
          if (error) err.replaceChildren(errorNote(friendly(error)));
          else location.hash = `#/t/${data.id}`;
        },
      },
        h("label", {}, h("span", { class: "caps" }, "Category"), sel),
        h("label", {}, h("span", { class: "caps" }, "Title"), title),
        h("label", {}, h("span", { class: "caps" }, "Message"), body),
        h("p", { class: "rules" }, "Be kind. No cheats, no ways around paid features, no piracy."),
        err,
        h("div", { class: "actions" }, h("a", { class: "pill grey", href: "#/" }, "Cancel"), send))));
    title.focus();
  }

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "t" && /^\d+$/.test(parts[1])) return showThread(parts[1]);
    if (parts[0] === "new") return showNew(parts[1]);
    if (parts[0] === "c" && CATEGORIES.some(([k]) => k === parts[1])) return showList(parts[1]);
    return showList(null);
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
