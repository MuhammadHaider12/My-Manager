import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCaSkIKcyhhYHzXR3_0nnyRiMhImr0TTfc",
  authDomain: "daily-tasks-8c693.firebaseapp.com",
  projectId: "daily-tasks-8c693",
  storageBucket: "daily-tasks-8c693.firebasestorage.app",
  messagingSenderId: "828627362719",
  appId: "1:828627362719:web:3e36ae819885b16f15d3aa",
  databaseURL: "https://daily-tasks-8c693-default-rtdb.firebaseio.com/"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const fs = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

let messagingInstance = null;

async function getFirebaseMessaging() {
  if (messagingInstance) {
    return messagingInstance;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn("Firebase Messaging is not available in this environment:", err);
    return null;
  }
}

export { app, db, auth, fs, storage, googleProvider, getFirebaseMessaging };