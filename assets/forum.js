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

  // ---------- people: picture, name, badges ----------
  const AUTHOR = "author:profiles(username, is_admin, is_modder, avatar_url, name_color)";
  const isModderPlus = (p) => !!(p && (p.is_admin || p.is_modder));
  const okColor = (c) => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c);
  const okAvatar = (u) => typeof u === "string" && u.startsWith(`${cfg.url}/storage/v1/object/public/avatars/`);
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
    const a = h("a", { class: "name", href: `#/u/${encodeURIComponent(p.username)}` }, p.username);
    if (isModderPlus(p) && okColor(p.name_color)) a.style.color = p.name_color;
    return a;
  }
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
      const { data } = await sb.from("profiles").select("id, username, is_admin, is_modder, needs_username, avatar_url, name_color").eq("id", session.user.id).maybeSingle();
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
      account.replaceChildren(
        h("span", { class: "caps who" }, avatar(me, "xs"), "Signed in as ", h("strong", {}, nameLink(me)), badges(me)),
        h("span", { class: "account-actions" },
          h("a", { class: "pill grey small", href: `#/u/${encodeURIComponent(me.username)}` }, "My profile"),
          h("button", { class: "pill grey small", onclick: () => sb.auth.signOut() }, "Sign out")));
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
        avatar(author, "sm"),
        h("span", { class: "author" }, nameLink(author), badges(author)),
        h("span", { class: "time" }, ago(created)),
        h("span", { class: "post-actions" }, actions)),
      h("div", { class: "post-body" }, body));
  }

  async function showThread(id) {
    view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
    const [{ data: t, error }, { data: replies, error: rErr }] = await Promise.all([
      sb.from("threads").select(`id, title, body, category, pinned, locked, created_at, author_id, ${AUTHOR}`).eq("id", id).maybeSingle(),
      sb.from("replies").select(`id, body, created_at, author_id, ${AUTHOR}`).eq("thread_id", id).order("created_at"),
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
      post(t.author, t.created_at, t.body, threadActions),
      h("div", { class: "tag section-tag" }, `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`),
      ...replies.map((r) => post(r.author, r.created_at, r.body,
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
        h("p", { class: "rules" }, "Rules: 13+ only. No illegal content, nothing that harms others, no Pro or paid-feature bypasses, no malware."),
        err,
        h("div", { class: "actions" }, h("a", { class: "pill grey", href: "#/" }, "Cancel"), send))));
    title.focus();
  }

  // ---------- profiles ----------
  const PROFILE_COLS = "id, username, is_admin, is_modder, bio, avatar_url, name_color, link, created_at";
  const profileHref = (name) => `#/u/${encodeURIComponent(name)}`;

  async function showProfile(username) {
    view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
    const { data: p } = await sb.from("profiles").select(PROFILE_COLS).eq("username", username).maybeSingle();
    if (!p) {
      view.replaceChildren(card("Not found", h("p", {}, "No user with that name. ", h("a", { href: "#/" }, "Back to the forum")), { off: true }));
      return;
    }
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
          h("small", {}, `Joined ${joined} · ${posts} ${posts === 1 ? "post" : "posts"}`))),
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
            h("span", { class: "label" }, h("span", { class: "thread-title" }, t.title), h("small", {}, `${catName(t.category)} · ${ago(t.created_at)}`)),
            chev())))
      : h("p", { class: "loading" }, "No threads yet.");

    view.replaceChildren(
      h("p", { class: "back" }, h("a", { href: "#/" }, "‹ Back to the forum")),
      card("Profile", h("div", { class: "profile" }, info)),
      h("div", { class: "tag section-tag" }, "Recent threads"),
      list);
  }

  async function showEdit() {
    if (!me) { openAuth("in"); location.hash = "#/"; return; }
    if (!isModderPlus(me)) { location.hash = profileHref(me.username); return; }
    view.replaceChildren(h("p", { class: "loading caps" }, "Loading…"));
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
    const back = profileHref(me.username);

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
            const { data: files } = await sb.storage.from("avatars").list(me.id);
            const keep = avatarUrl ? avatarUrl.split("/").pop() : null;
            const old = (files || []).filter((x) => x.name !== keep).map((x) => `${me.id}/${x.name}`);
            if (old.length) await sb.storage.from("avatars").remove(old);
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

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    if (parts[0] === "t" && /^\d+$/.test(parts[1])) return showThread(parts[1]);
    if (parts[0] === "new") return showNew(parts[1]);
    if (parts[0] === "u" && parts[1]) {
      const name = decodeURIComponent(parts[1]);
      if (/^[A-Za-z0-9_]{3,20}$/.test(name)) return showProfile(name);
    }
    if (parts[0] === "edit") return showEdit();
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
