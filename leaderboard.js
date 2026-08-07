// =============================================================
//  Axolotl Avalanche — leaderboard module
//  Works fully offline (localStorage) out of the box.
//  Automatically upgrades to a shared Firestore leaderboard the
//  moment firebase-config.js contains real credentials.
// =============================================================

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const LOCAL_KEY = "axolotl-avalanche-leaderboard";
const FIREBASE_SDK_VERSION = "10.12.2";

let mode = "local";
let db = null;
let fs = null;

async function initFirebase() {
  if (!isFirebaseConfigured()) {
    mode = "local";
    return;
  }
  try {
    const { initializeApp } = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`
    );
    const firestoreMod = await import(
      `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`
    );
    const app = initializeApp(firebaseConfig);
    db = firestoreMod.getFirestore(app);
    fs = firestoreMod;
    mode = "online";
  } catch (err) {
    console.warn(
      "[Axolotl Avalanche] Firebase failed to initialize, falling back to local leaderboard.",
      err
    );
    mode = "local";
  }
}

const ready = initFirebase();

function getLocalScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveLocalScores(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

/** Resolves to "online" or "local" once init has settled. */
export async function getMode() {
  await ready;
  return mode;
}

/** Save a finished run's score. Always succeeds locally even if online submit fails. */
export async function submitScore(name, score, levelReached) {
  await ready;
  const cleanName = (name && String(name).trim().slice(0, 20)) || "Axolotl Fan";
  const cleanScore = Math.max(0, Math.floor(score) || 0);

  if (mode === "online" && db) {
    try {
      await fs.addDoc(fs.collection(db, "leaderboard"), {
        name: cleanName,
        score: cleanScore,
        levelReached: levelReached || 1,
        createdAt: fs.serverTimestamp(),
      });
      return { ok: true, mode: "online" };
    } catch (err) {
      console.warn(
        "[Axolotl Avalanche] Online score submit failed, saving locally instead.",
        err
      );
    }
  }

  const list = getLocalScores();
  list.push({
    name: cleanName,
    score: cleanScore,
    levelReached: levelReached || 1,
    createdAt: Date.now(),
  });
  list.sort((a, b) => b.score - a.score);
  saveLocalScores(list.slice(0, 50));
  return { ok: true, mode: "local" };
}

/** Fetch the top N scores, sorted descending. */
export async function getTopScores(max = 10) {
  await ready;

  if (mode === "online" && db) {
    try {
      const q = fs.query(
        fs.collection(db, "leaderboard"),
        fs.orderBy("score", "desc"),
        fs.limit(max)
      );
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (err) {
      console.warn(
        "[Axolotl Avalanche] Online leaderboard fetch failed, showing local scores instead.",
        err
      );
    }
  }

  return getLocalScores()
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}
