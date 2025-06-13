
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { 
  getAuth, 
  type Auth,
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
import { getAnalytics, type Analytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

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
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firestore and Auth. 
// These are generally safe to call after initializeApp.
// Errors during operations (like getDoc) will be caught where those operations are performed.
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

// Initialize Analytics (conditionally and asynchronously)
let analytics: Analytics | undefined;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(error => {
    // Log error but don't let it break the app; analytics is non-critical.
    console.warn("Firebase Analytics could not be initialized:", (error instanceof Error ? error.message : String(error)));
  });
}

const googleProvider = new GoogleAuthProvider();

export { 
  app, 
  db, 
  auth, 
  googleProvider, 
  analytics,
  signInWithPopup, 
  firebaseSignOut, 
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser
};
