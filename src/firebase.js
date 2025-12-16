// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD7_5NSf8z-8b4RadHrBKBEWKFFWNYCJYw",
  authDomain: "trading-journal-df775.firebaseapp.com",
  projectId: "trading-journal-df775",
  storageBucket: "trading-journal-df775.firebasestorage.app",
  messagingSenderId: "518229764178",
  appId: "1:518229764178:web:8a50325a77329312bc978b",
  measurementId: "G-L455B2R0E6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const analytics = getAnalytics(app);

export { db, auth, analytics };