
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut, // Renamed to avoid conflict if 'signOut' is used elsewhere
  createUserWithEmailAndPassword, // Added for email/password auth
  signInWithEmailAndPassword // Added for email/password auth
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
// PLEASE DOUBLE-CHECK these values against your Firebase project settings:
// Firebase Console > Project settings (gear icon) > General tab > Your apps > Web app
const firebaseConfig = {
  apiKey: "AIzaSyAI3WF7TY3yOoEaTEzysHx8Lrutu6Tlj3Q", // You confirmed this key
  authDomain: "votesessionclassroom.firebaseapp.com", // Based on your project ID
  projectId: "votesessionclassroom", // Based on your project ID
  storageBucket: "votesessionclassroom.firebasestorage.app", // From your existing file
  messagingSenderId: "315788377527", // From your existing file
  appId: "1:315788377527:web:e02bbcdf9e683943ec3c32", // From your existing file
  measurementId: "G-SJ8SRNPQMT" // From your existing file
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
  if (typeof window !== 'undefined') {
    getAnalytics(app);
  }
} catch (error) {
  console.warn("Firebase Analytics initialization error:", (error instanceof Error ? error.message : String(error)));
}

let db;
let auth;

try {
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth): ", (error instanceof Error ? error.message : String(error)));
}

const googleProvider = new GoogleAuthProvider();

export { 
  app, 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword, // Exported
  signInWithEmailAndPassword // Exported
};
