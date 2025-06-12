
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore"; // Import Firestore type
import { 
  getAuth, 
  Auth, // Import Auth type
  signInAnonymously, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser 
} from "firebase/auth";
import { getAnalytics, Analytics } from "firebase/analytics"; // Import Analytics type

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
let analytics: Analytics | undefined;
try {
  if (typeof window !== 'undefined') {
    analytics = getAnalytics(app);
  }
} catch (error) {
  console.warn("Firebase Analytics initialization error:", (error instanceof Error ? error.message : String(error)));
}

let db: Firestore;
let auth: Auth;

try {
  db = getFirestore(app);
  auth = getAuth(app);
} catch (error) {
  console.error("CRITICAL FIREBASE INITIALIZATION ERROR (during getFirestore/getAuth): ", (error instanceof Error ? error.message : String(error)));
  // Depending on how critical these are, you might want to throw the error
  // or ensure db and auth are handled as potentially undefined elsewhere.
  // For now, assuming they initialize for the purpose of this fix.
  // @ts-ignore if TS complains db/auth might not be assigned before export in strict mode
  if (!db) db = undefined as any; 
  // @ts-ignore
  if (!auth) auth = undefined as any;
}

const googleProvider = new GoogleAuthProvider();

export { 
  app, 
  db, 
  auth, 
  googleProvider, 
  analytics, // Export typed analytics
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser
};
