# geoprix-moddable

Website for GeoPrix Moddable, served by GitHub Pages at
https://geoprix-moddable.github.io/

## Files

- `index.html`: home page
- `mods.html`: mods page (empty for now)
- `releases.html`: latest launcher release; the XAPK itself is a GitHub Release asset (not stored in the repo)
- `404.html`: page-not-found screen
- `assets/fonts/Hokjesgeest.otf`: heading font by Tup Wanders, CC BY (see `assets/fonts/LICENSE.txt`)
- `assets/images/`: logo (`icon.jpg` original, smaller copies for the site and favicon)
- `assets/style.css`: GeoPrix Classic-theme styles, green instead of red
- `assets/script.js`: current-page tab and footer year
- `.github/workflows/pages.yml`: deploys on every push to `main`
- `.nojekyll`: tells Pages to serve the files as they are

## Preview locally

```bash
python -m http.server 8000
```
Then open http://localhost:8000.

## Credits

- Heading font: [Hokjesgeest](http://www.tupwanders.nl) by Tup Wanders, licensed under
  [Creative Commons Attribution (CC BY)](https://creativecommons.org/licenses/by/4.0/).
  The credit is shown in every page footer, as the license requires.
- Body font: [Roboto Condensed](https://fonts.google.com/specimen/Roboto+Condensed), SIL Open Font License, loaded from Google Fonts.

## After changing the CSS or JS

Bump the `?v=` number on the `style.css` and `script.js` links in every `.html` file,
so browsers load the new files instead of a cached copy.
