import sys, pathlib, time

OUT = pathlib.Path(sys.argv[1])
V = time.strftime("%Y%m%d%H%M")

DL = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16l-5-5 1.4-1.45 2.6 2.6V4h2v8.15l2.6-2.6L17 11zm-6 4q-.825 0-1.412-.587T4 18v-3h2v3h12v-3h2v3q0 .825-.587 1.413T18 20z"/></svg>'

REL = dict(
    game="3.3",
    launcher="0.9.0a",
    file="GeoPrix_3.3_0.9.0a.xapk",
    url="https://github.com/geoprix-moddable/geoprix-moddable.github.io/releases/download/v0.9.0a-geoprix-3.3/GeoPrix_3.3_0.9.0a.xapk",
    page="https://github.com/geoprix-moddable/geoprix-moddable.github.io/releases/tag/v0.9.0a-geoprix-3.3",
    size="44.1 MB",
    android="Android 9 or newer",
    arch="arm64",
    sha256="60c09b66c3399d95629695a17f4b026529eb1955b9eb5e65fa872c320bb0d4d3",
)

PLAY = "https://play.google.com/store/apps/details?id=com.jm.geoprix"

WARNING_TEXT = f'''<p>This is a <strong>modified version</strong> of GeoPrix. The original game is made by its developer and is available on the <a href="{PLAY}">Google Play Store</a>.</p>
            <ul>
              <li>It must <strong>never</strong> be used to get around limits set by the developer.</li>
              <li>It must <strong>never</strong> be used to unlock features you would otherwise have to buy.</li>
              <li>All GeoPrix Moddable mods must be ethical.</li>
            </ul>
            <p>If you enjoy GeoPrix, support the developer by getting it on Google Play.</p>'''

CHEV ='<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.6 12 8 7.4 9.4 6l6 6-6 6L8 16.6z"/></svg>'

PAGES = [("index", "Home"), ("mods", "Mods"), ("releases", "Releases")]

def layout(title, desc, body, base=""):
    def href(p): return (base or "./") if p == "index" else f"{base}{p}.html"
    a = f"{base}assets/"
    tags = "\n".join(f'        <a class="tag" href="{href(p)}" data-page="{p}">{n}</a>' for p, n in PAGES)
    full = "GeoPrix Moddable" if title == "Home" else f"{title} · GeoPrix Moddable"
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{full}</title>
  <meta name="description" content="{desc}">
  <meta name="theme-color" content="#2a2a2a">
  <link rel="icon" type="image/png" href="{a}images/favicon.png">
  <link rel="apple-touch-icon" href="{a}images/logo-192.png">
  <meta property="og:title" content="{full}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="https://geoprix-moddable.github.io/assets/images/logo-512.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap">
  <link rel="stylesheet" href="{a}style.css?v={V}">
</head>
<body>
  <header class="top bar">
    <div class="top-inner">
      <a class="brand" href="{href("index")}">
        <img src="{a}images/logo-192.png" alt="" width="38" height="38">
        <span>GeoPrix Moddable</span>
      </a>
      <nav class="tags" aria-label="Main">
{tags}
      </nav>
    </div>
  </header>

  <main>
{body}
  </main>

  <footer class="footer bar">
    <div class="footer-inner">
      <span>© <span data-year></span> GeoPrix Moddable</span>
      <span>Heading font: <a href="http://www.tupwanders.nl">Hokjesgeest</a> by Tup Wanders, <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution (CC BY)</a></span>
    </div>
  </footer>

  <script src="{a}script.js?v={V}"></script>
</body>
</html>
'''

home = f'''    <section class="hero card">
      <div class="card-bar caps">Welcome</div>
      <div class="hero-body">
        <img class="hero-logo" src="assets/images/logo-512.jpg" alt="GeoPrix Moddable logo" width="168" height="168">
        <div>
          <h1>GeoPrix <span class="accent">Moddable</span></h1>
          <p>GeoPrix with a built-in mod loader. Drop in a .gpmod file and add new features to the game.</p>
          <div class="actions">
            <a class="pill" href="releases.html">{DL}Download v{REL["launcher"]}</a>
            <a class="pill grey" href="mods.html">Browse mods</a>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="tag section-tag">Links</div>
      <div class="rows">
        <a class="row caps" href="releases.html"><span class="label">Latest release</span><span class="value">v{REL["launcher"]} · GeoPrix {REL["game"]}</span>{CHEV}</a>
        <a class="row caps" href="mods.html"><span class="label">Mods</span><span class="value">Coming soon</span>{CHEV}</a>
      </div>
    </section>'''

mods = '''    <section>
      <div class="tag section-tag">Mods</div>
      <div class="card">
        <div class="card-bar caps off">Installed</div>
        <div class="empty">
          <h1 class="big">No mods yet</h1>
          <p>Mods for GeoPrix Moddable will be listed here.</p>
          <span class="note">First mods coming soon</span>
        </div>
      </div>
    </section>'''

releases = f'''    <section>
      <div class="tag section-tag">Latest release</div>
      <div class="card">
        <div class="card-bar caps">GeoPrix {REL["game"]}</div>
        <div class="release">
          <div class="release-head">
            <img src="assets/images/logo-192.png" alt="" width="72" height="72">
            <div>
              <h1 class="release-title">Launcher v{REL["launcher"]}</h1>
              <p>The latest GeoPrix Moddable launcher for GeoPrix {REL["game"]}.</p>
            </div>
          </div>
          <dl class="spec">
            <div><dt>Game version</dt><dd>GeoPrix {REL["game"]}</dd></div>
            <div><dt>Launcher version</dt><dd>v{REL["launcher"]}</dd></div>
            <div><dt>File</dt><dd>{REL["file"]}</dd></div>
            <div><dt>Size</dt><dd>{REL["size"]}</dd></div>
            <div><dt>Needs</dt><dd>{REL["android"]}, {REL["arch"]}</dd></div>
          </dl>
          <div class="warning">
            <div class="warning-title caps">Read before downloading</div>
            {WARNING_TEXT}
          </div>
          <a class="pill" href="{REL["url"]}" data-confirm-download>{DL}Download XAPK</a>
          <p class="hash">SHA-256: <code>{REL["sha256"]}</code></p>
        </div>
      </div>
    </section>

    <dialog class="confirm card" id="download-confirm" aria-labelledby="confirm-title">
      <div class="card-bar caps warn" id="confirm-title">Before you download</div>
      <form method="dialog" class="confirm-body">
        {WARNING_TEXT}
        <label class="agree"><input type="checkbox" id="confirm-agree"> I understand and agree to these rules</label>
        <div class="actions">
          <button class="pill grey" value="cancel">Cancel</button>
          <button class="pill" value="ok" id="confirm-ok" disabled>{DL}Download</button>
        </div>
      </form>
    </dialog>

    <section>
      <div class="tag section-tag">Changes</div>
      <div class="card">
        <div class="card-bar caps off">v{REL["launcher"]}</div>
        <div class="empty">
          <p>No changes listed yet.</p>
        </div>
      </div>
    </section>'''

notfound = '''    <section class="card">
      <div class="card-bar caps off">Error</div>
      <div class="empty">
        <h1 class="big">404</h1>
        <p>This page took a wrong turn.</p>
        <a class="pill" href="/">Back to home</a>
      </div>
    </section>'''

files = {
 "index.html": layout("Home", "GeoPrix with a built-in mod loader. Drop in a .gpmod file and add new features to the game.", home),
 "mods.html": layout("Mods", "Mods for GeoPrix Moddable.", mods),
 "releases.html": layout("Releases", f"Download GeoPrix Moddable launcher v{REL['launcher']} for GeoPrix {REL['game']}.", releases),
 "404.html": layout("Page not found", "Page not found.", notfound, base="/"),
}
for name, html in files.items():
    (OUT / name).write_text(html, encoding="utf-8", newline="\n")
    print("wrote", name)
