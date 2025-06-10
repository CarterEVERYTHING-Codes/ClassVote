
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut // Renamed to avoid conflict if 'signOut' is used elsewhere
} from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAI3WF7TY3yOoEaTEzysHx8Lrutu6Tlj3Q",
  authDomain: "votesessionclassroom.firebaseapp.com",
  projectId: "votesessionclassroom",
  storageBucket: "votesessionclassroom.firebasestorage.app",
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
  // Automatic anonymous sign-in is removed from here. 
  // Sign-in will be handled more explicitly by the UI/AuthContext.
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
  onAuthStateChanged 
};
