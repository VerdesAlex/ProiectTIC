import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBtNDF_6H7IdHO9SqdI2F5YAmaQDycHtA0",
  authDomain: "proiecttic-43787.firebaseapp.com",
  projectId: "proiecttic-43787",
  storageBucket: "proiecttic-43787.firebasestorage.app",
  messagingSenderId: "235718467712",
  appId: "1:235718467712:web:08b6103d7633076bcf0665",
  measurementId: "G-LZJE0H1JRQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };