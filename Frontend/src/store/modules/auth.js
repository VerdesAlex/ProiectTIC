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
  async login({ commit }, { email, password }) {
    commit('CLEAR_ERROR');
    try {
      // 1. Login cu Firebase
      const user = await authService.login(email, password);
      // 2. Obține token-ul JWT pentru Backend
      const token = await authService.getToken();
      
      commit('SET_USER', user);
      commit('SET_TOKEN', token);
      return true; // Succes
    } catch (error) {
      commit('SET_ERROR', error);
      return false; // Eroare
    }
  },

  async signup({ commit }, { email, password }) {
    commit('CLEAR_ERROR');
    try {
      const user = await authService.signUp(email, password);
      const token = await authService.getToken();
      
      commit('SET_USER', user);
      commit('SET_TOKEN', token);
      return true;
    } catch (error) {
      commit('SET_ERROR', error);
      return false;
    }
  },

  async logout({ commit }) {
    await authService.logout();
    commit('RESET_AUTH');
  },

  async updateAvatar({ commit, state }, file) {
    try {
      // Apelăm serviciul
      const photoURL = await authService.uploadProfilePicture(file);
      
      // Actualizăm user-ul în state-ul Vuex
      // Facem spread operator (...) pentru a păstra restul datelor userului
      const updatedUser = { ...state.user, photoURL: photoURL };
      
      commit('SET_USER', updatedUser);
      return true;
    } catch (error) {
      console.error("Failed to update avatar in store:", error);
      return false;
    }
  },

  // Acțiune pentru a re-hidrata starea la refresh (opțional, dar recomandat)
  async fetchUser({ commit }, user) {
    if (user) {
      const token = await authService.getToken();
      commit('SET_USER', user);
      commit('SET_TOKEN', token);
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