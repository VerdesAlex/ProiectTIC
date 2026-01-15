import { auth, db } from './config'; // [FIX] Am adăugat 'db'
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
} from "firebase/auth";
// [FIX] Am adăugat importurile lipsă pentru Firestore
import { doc, setDoc, getDoc } from "firebase/firestore"; 

export const authService = {
  // Create a new user
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Inițializăm profilul în Firestore (pentru a putea salva avatarul mai târziu)
      await this.saveUserProfile(userCredential.user.uid, { email });
      return userCredential.user;
    } catch (error) {
      throw error.message;
    }
  },

  async getToken() {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        unsubscribe();
        if (user) {
          const token = await user.getIdToken();
          resolve(token);
        } else {
          resolve(null);
        }
      });
    });
  },

  // Login existing user
  async login(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return userCredential.user;
    } catch (error) {
      throw error.message;
    }
  },

  // Logout
  async logout() {
    await signOut(auth);
  },

  // Listen for auth state changes
  onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
  },

  // [NOU] Salvează date extra (avatar) în Firestore
  async saveUserProfile(uid, data) {
    try {
      // Aveam nevoie de 'doc', 'db' și 'setDoc' importate sus
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, data, { merge: true });
    } catch (error) {
      console.error("Error saving user profile:", error);
      throw error;
    }
  },

  // [NOU] Citește datele extra din Firestore
  async getUserProfile(uid) {
    try {
      // Aveam nevoie de 'doc', 'db' și 'getDoc' importate sus
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        return userSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }
};