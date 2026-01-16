import { auth } from './config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";

export const authService = {
  // Create a new user
  async signUp(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
          const token = await user.getIdToken(); // Aceasta este valoarea de care are nevoie Backend-ul
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
      await setPersistence(auth, browserLocalPersistence);
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

  // Listen for auth state changes (is the user logged in or out?)
  onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
  }
};