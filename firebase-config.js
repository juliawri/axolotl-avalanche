// =============================================================
//  🔥 FIREBASE CONFIG — Axolotl Avalanche leaderboard
// =============================================================
//
//  The game works perfectly fine WITHOUT Firebase — it will just
//  use a local leaderboard stored in your browser (localStorage).
//
//  To turn on a real, shared, online leaderboard:
//
//  1. Go to https://console.firebase.google.com and create a
//     free project (or reuse an existing one).
//  2. In your project, click "Build > Firestore Database" and
//     click "Create database" (start in "test mode" to begin,
//     then lock it down using the rules below).
//  3. Click the gear icon > "Project settings", scroll down to
//     "Your apps", click the web icon "</>" to register a web
//     app, and copy the firebaseConfig object it gives you.
//  4. Paste your values into the object below, replacing the
//     placeholder strings.
//  5. In Firestore "Rules", paste this (allows anyone to submit
//     a score and read the leaderboard, but not edit/delete
//     other people's scores):
//
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /leaderboard/{entryId} {
//           allow read: if true;
//           allow create: if request.resource.data.name is string
//                         && request.resource.data.name.size() <= 20
//                         && request.resource.data.score is int
//                         && request.resource.data.score >= 0
//                         && request.resource.data.score <= 999999;
//           allow update, delete: if false;
//         }
//       }
//     }
//
//  6. Save this file, commit, and redeploy to GitHub Pages.
//     The game will automatically detect a real config and
//     switch the leaderboard to "🌐 online" mode.
//
// =============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDT5FmS3PLNJfbQ2TkLkvhS00QpXRdeVvY",
  authDomain: "capy-kingdom-rush.firebaseapp.com",
  projectId: "capy-kingdom-rush",
  storageBucket: "capy-kingdom-rush.firebasestorage.app",
  messagingSenderId: "776419997791",
  appId: "1:776419997791:web:7ec20348118291083b83ea"
};

// Do not edit below this line — this just checks whether you've
// actually filled in real values above.
export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}
