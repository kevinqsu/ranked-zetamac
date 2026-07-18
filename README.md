# Ranked Zetamac

A 1v1 multiplayer version of [Zetamac](https://arithmetic.zetamac.com/) with a challenge lobby, adjustable match settings, and live spectating.

Created by Vel Kuppusamy, inspired by [Sunny Guan's zetamac-multiplayer](https://github.com/sunnyguan/zetamac-multiplayer).

## Features

- Challenge lobby: pressing Play posts an open challenge in the sidebar; anyone online can accept it to start the match
- Match settings chosen by the challenger: time (30s / 60s / 120s) and difficulty (Easy / Medium / Hard, with ranges modeled on [QuantQuestions Arithmetic Zetamac](https://quantquestions.io/games/arithmetic-zetamac))
- Live score graph with a hide/show toggle; the graph pops up automatically when the game ends
- Spectator mode for ongoing games
- Voice input via [annyang](https://github.com/TalAter/annyang)
- Server-side high score persisted to a local file
- Rematch (both players must accept), post-game main menu, and a stop-spectating button
- Anti-cheat: the server rejects reported scores above 500 and excludes them from wins and high scores

## Difficulty ranges

| Difficulty | Addition / Subtraction | Multiplication | Division |
|---|---|---|---|
| Easy | (2–60) | (2–12)×(2–20) | reverse multiplication |
| Medium | (2–100) | (2–12)×(2–100) | reverse multiplication |
| Hard | (2–300) | (2–20)×(2–200) | reverse multiplication |

## Running locally

```
npm install
npm start
```

Then open http://localhost:3000 in two tabs to test a match.

## Deploying on Director (TJHSST)

The included `run.sh` starts the server on the port and host Director provides. Use a Node.js Alpine Docker image with `git` added as a package, clone this repo into `/site`, run `npm install`, mark `run.sh` executable, and restart the site process.
