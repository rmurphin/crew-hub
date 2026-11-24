# MPNW Crew Hub

Phone app for the MP Northwest crew: where to be, when, and what goes on the wall. It runs in the browser on iPhone and Android and can be added to the home screen.

- **`docs/`** is the live app, served by GitHub Pages at https://rmurphin.github.io/crew-hub/
- **`gas/Code.gs`** is the script inside the MPNW Crew Hub Google Sheet. The app calls it with a person's link code and gets back that sheet's schedule and job info. Nothing about the schedule, jobs, names or codes is stored in this repo.
- **`src/`**, **`www/`** and **`tools/`** are the source. To rebuild: `npm install`, `python3 tools/topo.py` (draws the header map), then `node tools/dist.mjs <sheet script /exec URL>`. That rewrites `docs/app.js`, `docs/sw.js` and `docs/index.html`.
