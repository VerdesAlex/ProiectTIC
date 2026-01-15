import { auth, storage } from './config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updateProfile 
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";


export const authService = {

  async uploadProfilePicture(file) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    try {
      // 1. Creăm referința în Storage: profiles/{uid}/avatar
      // Folosim un timestamp sau numele fișierului pentru a evita problemele de cache, 
      // dar simplu 'avatar' e ok dacă suprascriem.
      const storageRef = ref(storage, `profiles/${user.uid}/avatar`);

      // 2. Încărcăm fișierul
      await uploadBytes(storageRef, file);

      // 3. Obținem URL-ul public
      const photoURL = await getDownloadURL(storageRef);

      // 4. Actualizăm profilul utilizatorului în Auth
      await updateProfile(user, { photoURL: photoURL });

      return photoURL;
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      throw error;
    }
  },
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