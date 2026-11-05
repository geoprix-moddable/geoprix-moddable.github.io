# geoprix-moddable

Website for GeoPrix Moddable, served by GitHub Pages at
https://geoprix-moddable.github.io/

## Files

- `index.html`: home page
- `mods.html`, `install.html`, `modding.html`: sub-pages
- `404.html`: page-not-found screen
- `assets/fonts/Hokjesgeest.otf`: heading font
- `assets/images/`: logo (`icon.jpg` original, smaller copies for the site and favicon)
- `assets/style.css`: styles (light and dark theme)
- `assets/script.js`: theme toggle and footer year
- `.github/workflows/pages.yml`: deploys on every push to `main`
- `.nojekyll`: tells Pages to serve the files as they are

## Preview locally

```bash
python -m http.server 8000
```
Then open http://localhost:8000.
