
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// !!! IMPORTANT: THE API KEY SHOWN IN THE FIREBASE CONSOLE SCREENSHOT
// ("AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM") IS A NON-FUNCTIONAL PLACEHOLDER.
// Firebase services WILL NOT WORK with this key.
// You MUST obtain a REAL API key for your project from the web app settings in the Firebase Console.
// The Service Account JSON (with a "private_key") is for SERVER-SIDE use, NOT for this client-side apiKey.
const FIREBASE_API_KEY = "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM"; // <-- THIS IS THE PLACEHOLDER. REPLACE IT.

if (FIREBASE_API_KEY === "AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM" || FIREBASE_API_KEY.includes("YOUR_API_KEY_PLACEHOLDER_TEXT")) {
  const errorMessage =
    "CRITICAL FIREBASE CONFIGURATION ERROR: The API key in src/lib/firebase.ts " +
    "is a known placeholder ('AIzaSyDNWdhzZ2mfqEvYwu0-A27Tw35OnEaTkzM'). " +
    "This key WILL NOT WORK for your client-side application. Firebase services (Auth, Firestore, etc.) will fail to initialize. " +
    "\n\nIMPORTANT: You MUST replace this placeholder with your actual Firebase project's CLIENT-SIDE API key. " +
    "You can find this key in the Firebase console under Project settings > General > Your apps > (select your web app) > SDK setup and configuration. " +
    "\n\nThe JSON data you might have that includes a `private_key` (a service account key) is for SERVER-SIDE use with the Firebase Admin SDK and should NEVER be exposed in client-side code. It is NOT a replacement for the client-side apiKey needed here." +
    "\n\nIf your Firebase console is genuinely showing this placeholder as your project's client-side apiKey, " +
    "this is an anomalous situation; please try creating a new web app configuration in your Firebase project or contact Firebase support.";
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
  storageBucket: "leaderboard-db5ff.appspot.com", // Corrected from firebasestorage.app
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
          console.log("Attempted anonymous sign-in. This will likely fail if the API key is a placeholder or incorrect.");
        })
        .catch((error) => {
          console.error("Error during anonymous sign-in (expected if API key is placeholder/incorrect or Auth is not fully set up): ", error.message);
          // Potentially alert user here too if critical, but the main config alert should suffice
        });
    }
  });

} catch (error) {
  const criticalInitError = "CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth): " + error.message + 
  "\nThis is very likely due to an incorrect Firebase configuration (API key '" + FIREBASE_API_KEY + "' might be a placeholder or invalid for this project) " +
  "or the Firebase services (Firestore, Auth) not being properly enabled for your project in the Firebase console. " +
  "Please verify your client-side API key in src/lib/firebase.ts and your project settings.";
  console.error(criticalInitError);
  if (typeof window !== 'undefined') {
    alert(criticalInitError);
  }
}

export { app, db, auth };
