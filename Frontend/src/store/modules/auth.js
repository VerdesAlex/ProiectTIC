import { authService } from '../../firebase/authService';

const state = {
  user: null,
  token: null,
  isAuthenticated: false,
  error: null
}

const getters = {
  currentUser: (state) => state.user,
  isAuthenticated: (state) => state.isAuthenticated,
  authError: (state) => state.error
}

const actions = {
  // --- LOGIN ---
  async login({ commit }, { email, password }) {
    commit('CLEAR_ERROR');
    try {
      // 1. Login Firebase
      const firebaseUser = await authService.login(email, password);
      
      // 2. Token Backend
      const token = await firebaseUser.getIdToken(); 

      // 3. Citim Avatarul din Firestore
      const userProfile = await authService.getUserProfile(firebaseUser.uid);

      // 4. Combinăm datele (User Auth + Avatar Firestore)
      const fullUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        emailVerified: firebaseUser.emailVerified,
        photoURL: userProfile?.avatar || null, // Aici e cheia
        ...userProfile
      };
      
      commit('SET_USER', fullUser);
      commit('SET_TOKEN', token);
      return true;
    } catch (error) {
      commit('SET_ERROR', error);
      return false;
    }
  },

  // --- SIGNUP ---
  async signup({ commit }, { email, password }) {
    commit('CLEAR_ERROR');
    try {
      const firebaseUser = await authService.signUp(email, password);
      const token = await firebaseUser.getIdToken();
      
      // La signup nu avem încă avatar, dar setăm structura
      const fullUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        photoURL: null
      };
      
      commit('SET_USER', fullUser);
      commit('SET_TOKEN', token);
      return true;
    } catch (error) {
      commit('SET_ERROR', error);
      return false;
    }
  },

  // --- LOGOUT ---
  async logout({ commit }) {
    await authService.logout();
    commit('RESET_AUTH');
  },

  // --- UPDATE AVATAR (fără refresh) ---
  async updateAvatar({ commit, state }, base64Image) {
    if (!state.user) return;
    
    try {
      // Salvăm în Firestore
      await authService.saveUserProfile(state.user.uid, { avatar: base64Image });
      
      // Actualizăm starea locală
      const updatedUser = { 
        ...state.user, 
        photoURL: base64Image 
      };
      
      commit('SET_USER', updatedUser);
      return true;
    } catch (error) {
      console.error("Failed to update avatar in store:", error);
      return false;
    }
  },

  // --- FETCH USER (LA REFRESH PAGINĂ) ---
  // [MODIFICAT] Acum citește și din Firestore, nu doar Auth
  async fetchUser({ commit }, firebaseUser) {
    if (firebaseUser) {
      try {
        const token = await firebaseUser.getIdToken();

        // 1. IMPORTANT: Citim din nou profilul din Firestore
        const userProfile = await authService.getUserProfile(firebaseUser.uid);

        // 2. Reconstruim obiectul complet
        const fullUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          // Dacă există avatar în Firestore, îl folosim
          photoURL: userProfile?.avatar || null, 
          ...userProfile
        };

        commit('SET_USER', fullUser);
        commit('SET_TOKEN', token);
      } catch (e) {
        console.error("Error hydrating user:", e);
        // Fallback: logăm userul de bază dacă Firestore eșuează
        commit('SET_USER', firebaseUser);
      }
    } else {
      commit('RESET_AUTH');
    }
  }
}

const mutations = {
  SET_USER(state, user) {
    state.user = user;
    state.isAuthenticated = !!user;
  },
  SET_TOKEN(state, token) {
    state.token = token;
  },
  SET_ERROR(state, error) {
    state.error = error;
  },
  CLEAR_ERROR(state) {
    state.error = null;
  },
  RESET_AUTH(state) {
    state.user = null;
    state.token = null;
    state.isAuthenticated = false;
    state.error = null;
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}