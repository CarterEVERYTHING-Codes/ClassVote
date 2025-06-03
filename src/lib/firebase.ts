
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// !!! IMPORTANT: THE API KEY SHOWN IN THE FIREBASE CONSOLE SCREENSHOT
// ("AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM") IS A NON-FUNCTIONAL PLACEHOLDER.
// Firebase services WILL NOT WORK with this key.
// You MUST obtain a REAL API key for your project.
// If your Firebase console is genuinely showing this placeholder for your project,
// this is highly unusual and might indicate an issue with your project setup
// or the console display. Consider contacting Firebase support or trying to
// create a new web app configuration within your project to see if a valid key is generated.
const FIREBASE_API_KEY = "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM"; // <-- THIS IS THE PLACEHOLDER FROM THE SCREENSHOT

if (FIREBASE_API_KEY === "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM" || FIREBASE_API_KEY.includes("YOUR_API_KEY_PLACEHOLDER_TEXT")) {
  const errorMessage =
    "CRITICAL FIREBASE CONFIGURATION ERROR: The API key in src/lib/firebase.ts " +
    "is a known placeholder ('AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM'). " +
    "This key WILL NOT WORK. Firebase services (Auth, Firestore, etc.) will fail to initialize. " +
    "Please obtain your actual Firebase project's API key from the Firebase console " +
    "and replace the placeholder in src/lib/firebase.ts. " +
    "If your console is genuinely showing this placeholder as your project's key, " +
    "this is an anomalous situation; please double-check your project or contact Firebase support.";
  console.error(errorMessage);
  // Show an alert in the browser to make this unmissable during development
  if (typeof window !== 'undefined') {
    alert(errorMessage);
  }
  // Note: Firebase functionality will be broken beyond this point.
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
          console.log("Attempted anonymous sign-in. This will likely fail if the API key is a placeholder.");
        })
        .catch((error) => {
          console.error("Error during anonymous sign-in (expected if API key is placeholder): ", error.message);
        });
    }
  });

} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth):", error.message);
  console.error(
    "This is very likely due to an incorrect Firebase configuration (API key '"+ FIREBASE_API_KEY +"' is a placeholder) " +
    "or the Firebase services (Firestore, Auth) not being properly enabled for your project."
  );
}

export { app, db, auth };

    