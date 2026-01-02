const state = {
  sessions: [], // List of past chat sessions
  currentSession: null, // Active chat data
  messages: [] // Messages for the current view
}

const getters = {
  allSessions: (state) => state.sessions,
  currentMessages: (state) => state.messages
}

const actions = {
  // Placeholder for creating a new chat
  async createSession({ commit }) {
    // TODO: API call to create session
  },
  // Placeholder for sending a message
  async sendMessage({ commit }, message) {
    // TODO: API call to send message
    commit('ADD_MESSAGE', message)
  }
}

const mutations = {
  SET_SESSIONS(state, sessions) {
    state.sessions = sessions
  },
  SET_CURRENT_SESSION(state, session) {
    state.currentSession = session
  },
  ADD_MESSAGE(state, message) {
    state.messages.push(message)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
}