
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// IMPORTANT: REPLACE THE PLACEHOLDER VALUES BELOW WITH THE ACTUAL CONFIGURATION
// VALUES FROM YOUR *NEW* FIREBASE PROJECT.
// You can find these in the Firebase console:
// Project settings > General > Your apps > (select your web app) > SDK setup and configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_AUTH_DOMAIN_HERE",
  projectId: "YOUR_PROJECT_ID_HERE",
  storageBucket: "YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "YOUR_APP_ID_HERE",
  measurementId: "YOUR_MEASUREMENT_ID_HERE" // Optional, but usually provided
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
          console.log("Anonymous sign-in successful or user already signed in.");
        })
        .catch((error) => {
          console.error("Error during anonymous sign-in: ", error.message);
          // This error is expected if Firebase config is still placeholder or incorrect
          if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
            console.warn("Firebase configuration appears to be using placeholder values. Anonymous sign-in will fail until these are updated with your actual project configuration from the Firebase console.");
          }
        });
    }
  });

} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth): ", (error instanceof Error ? error.message : String(error)));
  if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
    alert("CRITICAL FIREBASE CONFIGURATION ERROR: The Firebase configuration in src/lib/firebase.ts is using placeholder values. Please replace them with the actual values from your Firebase project console.");
  } else {
    alert("CRITICAL FIREBASE INITIALIZATION ERROR. Check console for details. This might be due to incorrect Firebase config values or services not being properly enabled in the Firebase console.");
  }
}

export { app, db, auth };
