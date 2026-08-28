// ============================================================
// FIREBASE SETUP — replace the object below with YOUR project's
// config. Get it from: Firebase Console → Project Settings →
// General → "Your apps" → SDK setup and configuration.
// See README.md for the full step-by-step.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXMEaWw3xxpSYMwsANFp8UMFnEXegsqj8",
  authDomain: "family-hub-94baf.firebaseapp.com",
  projectId: "family-hub-94baf",
  storageBucket: "family-hub-94baf.firebasestorage.app",
  messagingSenderId: "1049932297052",
  appId: "1:1049932297052:web:040c5f4ab034fad72d8799"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// Offline cache so the app still works (read-only, from last sync)
// with no connection — matches the PWA offline pattern.
enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Offline persistence not enabled:", err.code);
});
