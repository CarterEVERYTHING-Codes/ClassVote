
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
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
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
// const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null; // Initialize analytics only on client

export { app, auth, db, googleProvider };
