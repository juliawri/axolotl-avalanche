# 🦎 Axolotl Avalanche

Ride your lilypad up the mountain, catch friendly axolotls, dodge rocks / snow / blizzard spirits, and survive all three stretches to reach **Axolotl Archipelago**!

A pure HTML + CSS + JavaScript game — no build step, no dependencies to install. Just open it or deploy it straight to GitHub Pages.

## 🎮 How to play

- **Move:** Arrow keys or A/D on desktop — or just move your mouse / drag with your finger on mobile. Both work at the same time.
- **Catch:** Steer your lilypad under falling axolotls to score points. The rare "reading" axolotl is worth a bonus!
- **Dodge:** Avoid rocks 🪨, snow ❄️, ice 🧊, snowmen ⛄, lightning ⚡, and blizzard spirits — getting hit costs a life.
- **Lives:** You start with 3. Lose all 3 and the avalanche gets you.
- **Climb:** Survive 3 timed stretches — each one faster and snowier than the last — to reach Axolotl Archipelago and win!

## 📁 Project structure

```
axolotl-avalanche/
├── index.html            Game markup / screens
├── style.css              Bright mountain-themed styling
├── game.js                 Game engine (movement, spawning, collisions, levels)
├── leaderboard.js           Leaderboard logic (Firebase-optional)
├── firebase-config.js        Your Firebase credentials go here
├── assets/                 Axolotl & lilypad artwork
└── .github/workflows/deploy.yml   Auto-deploy to GitHub Pages
```

## ▶️ Run it locally

Because the game uses ES modules, you need to serve it over `http://`, not open `index.html` directly with `file://`. From inside the project folder:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then visit `http://localhost:8000`.

## 🚀 Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder to it:

   ```bash
   cd axolotl-avalanche
   git init
   git add .
   git commit -m "Axolotl Avalanche 🦎🏔️"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. In your repo on GitHub, go to **Settings → Pages**, and under "Build and deployment", set **Source** to **GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) will automatically build and publish the site on every push to `main`.

3. After the first push, check the **Actions** tab for the "Deploy Axolotl Avalanche to GitHub Pages" run. Once it's green, your game will be live at:

   ```
   https://<your-username>.github.io/<your-repo>/
   ```

> Alternative: since this is a plain static site, you can skip Actions entirely and just set **Settings → Pages → Source → Deploy from a branch → main / (root)**. Either approach works.

## 🏆 Leaderboard & Firebase

By default, the leaderboard works **completely offline** — scores are saved to the browser's `localStorage`, no setup required.

To turn on a real shared online leaderboard, open **`firebase-config.js`** — it has full step-by-step instructions inside. In short:

1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore Database**.
3. Register a Web App and copy your config values into `firebaseConfig` in `firebase-config.js`.
4. Add the Firestore security rules included in that file (allows anyone to submit and read scores, but not edit/delete others').
5. Commit and push — the game automatically detects a real config and switches to "🌐 Online" mode. You'll see the leaderboard source labeled on the start screen and leaderboard modal.

No code changes needed anywhere else — `leaderboard.js` handles both modes transparently.

## 🎨 Customizing

- **Difficulty / level timing:** edit the `LEVELS` array at the top of `game.js` (duration, fall speed, spawn rate, hazard chance).
- **Odds of axolotls vs. hazards:** edit `AXOLOTL_TYPES` and `HAZARD_TYPES` weights in `game.js`.
- **Colors:** edit the CSS variables at the top of `style.css` and the `BG_THEMES` object in `game.js`.
- **Artwork:** swap any PNG in `assets/` — just keep the same filenames, or update `IMAGE_SOURCES` in `game.js`.

Enjoy the climb! 🦎🏔️🏝️
