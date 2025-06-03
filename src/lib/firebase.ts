
import { initializeApp, getApps, getApp } from "firebase/app";
// import { getAuth, GoogleAuthProvider } from "firebase/auth"; // No longer needed for admin panel
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics"; // Only if you need analytics

const firebaseConfig = {
  apiKey: "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM",
  authDomain: "leaderboard-db5ff.firebaseapp.com",
  projectId: "leaderboard-db5ff",
  storageBucket: "leaderboard-db5ff.firebasestorage.app",
  messagingSenderId: "525185216052",
  appId: "1:525185216052:web:0f47943fdac6b48820e461",
  measurementId: "G-G8W7K7FEQZ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// const auth = getAuth(app); // Auth instance might still be needed if other parts of app use it
const db = getFirestore(app);
// const googleProvider = new GoogleAuthProvider(); // No longer needed for admin panel
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null; // Initialize analytics only on client

export { app, db }; // Export auth and googleProvider if they are used elsewhere
// If auth and googleProvider are DEFINITELY not used anywhere else, 
// you can remove them from export and their imports above.
// For now, I'm commenting them out from this specific file's needs but leaving a note.
// If you confirm they aren't used, I can remove them fully.
// Re-adding auth for now in case it's used elsewhere, but AdminPanel won't use it.
import { getAuth } from "firebase/auth";
const auth = getAuth(app);
export { auth };
