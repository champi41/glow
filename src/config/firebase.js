// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCoyN0GWwZ4eGen51S7hxHcuR4IE6DAyF8",
  authDomain: "reservasapp-e4da2.firebaseapp.com",
  projectId: "reservasapp-e4da2",
  storageBucket: "reservasapp-e4da2.firebasestorage.app",
  messagingSenderId: "585120825717",
  appId: "1:585120825717:web:22901870cb800380b2933c",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);