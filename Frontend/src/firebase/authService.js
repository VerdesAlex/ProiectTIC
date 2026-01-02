import { auth } from './config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged 
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

  // Listen for auth state changes (is the user logged in or out?)
  onAuthChange(callback) {
    onAuthStateChanged(auth, callback);
  }
};