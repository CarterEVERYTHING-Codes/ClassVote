
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getAnalytics } from "firebase/analytics"; // Added as per user's snippet

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAI3WF7TY3yOoEaTEzysHx8Lrutu6Tlj3Q",
  authDomain: "votesessionclassroom.firebaseapp.com",
  projectId: "votesessionclassroom",
  storageBucket: "votesessionclassroom.firebasestorage.app", // Corrected from .firebasestorage.app to .appspot.com if it was a typo, but using provided
  messagingSenderId: "315788377527",
  appId: "1:315788377527:web:e02bbcdf9e683943ec3c32",
  measurementId: "G-SJ8SRNPQMT"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Analytics
try {
  if (typeof window !== 'undefined') { // Ensure Analytics is initialized only on client
    getAnalytics(app);
  }
} catch (error) {
  console.warn("Firebase Analytics initialization error (this is often safe to ignore during SSR or if Analytics is not critical):", (error instanceof Error ? error.message : String(error)));
}


let db;
let auth;

// Initialize Firestore and Auth, and set up anonymous sign-in
try {
  db = getFirestore(app);
  auth = getAuth(app);

  // Attempt anonymous sign-in if no user is signed in
  // This will only run on the client-side where auth state is meaningful
  if (typeof window !== 'undefined') {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth)
          .then(() => {
            console.log("Firebase: Anonymous sign-in successful or user already signed in.");
          })
          .catch((error) => {
            console.error("Firebase: Error during anonymous sign-in: ", (error instanceof Error ? error.message : String(error)));
            // No alert here, console error is sufficient
          });
      }
    });
  }
} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth): ", (error instanceof Error ? error.message : String(error)));
  // Avoid alert in production environments or if it's too disruptive.
  // Consider more sophisticated error handling for production.
}

export { app, db, auth };
