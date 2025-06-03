
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// !!! IMPORTANT: PLEASE REPLACE THE PLACEHOLDER API KEY BELOW !!!
// The apiKey "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM" is a common placeholder
// and will not work for a real Firebase project.
// You MUST replace it with the actual API key from your Firebase project settings.
// You can find your project's API key in the Firebase console:
// Project settings > General > Your apps > Web apps > SDK setup and configuration.
const FIREBASE_API_KEY = "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM"; // <-- !!! REPLACE THIS !!!

if (FIREBASE_API_KEY === "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM" || FIREBASE_API_KEY.includes("YOUR_API_KEY")) {
  console.warn(
    "IMPORTANT FIREBASE CONFIGURATION WARNING: The API key in src/lib/firebase.ts appears to be a placeholder. " +
    "Please replace it with your actual Firebase project's API key. " +
    "Firebase services will not function correctly until this is fixed."
  );
  // Optionally, you could throw an error here to halt execution during development:
  // throw new Error("Placeholder Firebase API Key detected. Update src/lib/firebase.ts");
}

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: "leaderboard-db5ff.firebaseapp.com",
  projectId: "leaderboard-db5ff",
  storageBucket: "leaderboard-db5ff.firebasestorage.app",
  messagingSenderId: "525185216052",
  appId: "1:525185216052:web:0f47943fdac6b48820e461",
  measurementId: "G-G8W7K7FEQZ"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let db;
let auth;

try {
  db = getFirestore(app);
  auth = getAuth(app);

  // Attempt anonymous sign-in if no user is signed in
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth)
        .then(() => {
          console.log("Signed in anonymously");
        })
        .catch((error) => {
          console.error("Error signing in anonymously: ", error);
          // This catch is important, especially if the config is still wrong.
        });
    }
  });

} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR:", error);
  console.error(
    "This might be due to an incorrect Firebase configuration (e.g., API key, projectId) " +
    "or the Firebase services (Firestore, Auth) not being properly enabled for your project in the Firebase console."
  );
  // To prevent the app from breaking entirely, provide dummy objects or handle appropriately.
  // For now, db and auth might be undefined, which will lead to errors downstream.
  // A more robust solution might involve a global error state or fallback.
}

export { app, db, auth };
