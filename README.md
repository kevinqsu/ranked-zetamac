# Ranked Zetamac

A 1v1 multiplayer version of [Zetamac](https://arithmetic.zetamac.com/) with a challenge lobby, adjustable match settings, and live spectating.

Inspired by [Sunny Guan's zetamac-multiplayer](https://github.com/sunnyguan/zetamac-multiplayer).

## Running locally

```
npm install
npm start
```

Then open http://localhost:3000 in two tabs to test a match.

## Deploying on Director (TJHSST)

The included `run.sh` starts the server on the port and host Director provides. Use a Node.js Alpine Docker image with `git` added as a package, clone this repo into `/site`, run `npm install`, mark `run.sh` executable, and restart the site process.
