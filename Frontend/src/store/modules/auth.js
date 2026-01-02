const state = {
  user: null,
  token: null,
  isAuthenticated: false
}

const getters = {
  currentUser: (state) => state.user,
  isAuthenticated: (state) => state.isAuthenticated
}

const actions = {
  // Placeholder for login action
  async login({ commit }, payload) {
    // TODO: Implement API call
    console.log('Logging in with', payload)
  },
  logout({ commit }) {
    commit('RESET_AUTH')
  }
}

const mutations = {
  SET_USER(state, user) {
    state.user = user
    state.isAuthenticated = !!user
  },
  SET_TOKEN(state, token) {
    state.token = token
  },
  RESET_AUTH(state) {
    state.user = null
    state.token = null
    state.isAuthenticated = false
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}
