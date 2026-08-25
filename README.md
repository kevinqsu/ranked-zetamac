# Ranked Zetamac

A 1v1 multiplayer version of [Zetamac](https://arithmetic.zetamac.com/) with a challenge lobby, adjustable match settings, and live spectating.

Inspired by [Sunny Guan's zetamac-multiplayer](https://github.com/sunnyguan/zetamac-multiplayer).

## Running locally

```
npm install
npm start
```

Then open http://localhost:3000 in two tabs to test a match.

The browser assets are served locally so the interface does not depend on
third-party CDNs. If Tailwind classes change, rebuild the checked-in stylesheet:

```
npx tailwindcss@2.2.19 -c tailwind.config.js -i styles/tailwind.css -o public/styles.css --minify
```
