/* fisier: Frontend/src/store/modules/chat.js */
import apiClient from '../../axios';
import { authService } from '@/firebase/authService';

const state = {
  sessions: [],
  messages: [],
  currentChatId: null,
  abortController: null // Controlerul pentru anularea cererii
};

const getters = {
  allSessions: (state) => state.sessions,
  currentMessages: (state) => state.messages,
  activeChatId: (state) => state.currentChatId,
  // Flag-ul isGenerating e true atâta timp cât avem un controller activ
  isGenerating: (state) => !!state.abortController
};

const mutations = {
  SET_SESSIONS(state, sessions) { state.sessions = sessions; },
  
  SET_MESSAGES(state, dbMessages) {
    if (state.abortController && state.messages.length > 0) {
      const lastLocalMsg = state.messages[state.messages.length - 1];
      
      // Dacă ultimul mesaj este local (assistant care scrie...)
      if (lastLocalMsg.isLocal) {
        // Verificăm dacă DB-ul a trimis deja acest mesaj (ultimul din DB e assistant?)
        const lastDbMsg = dbMessages.length > 0 ? dbMessages[dbMessages.length - 1] : null;
        
        // Dacă ultimul mesaj din DB este tot de la assistant și are conținut, 
        // înseamnă că DB-ul "a prins din urmă" stream-ul local.
        // În acest caz, NU mai adăugăm mesajul local, folosim doar ce vine din DB.
        if (lastDbMsg && lastDbMsg.role === 'assistant') {
           state.messages = dbMessages;
           return;
        }

        // Altfel, dacă DB-ul încă nu are răspunsul AI-ului, îl lipim pe cel local la final
        state.messages = [...dbMessages, lastLocalMsg];
        return;
      }
    }
    state.messages = dbMessages;
  },

  ADD_MESSAGE(state, message) { state.messages.push(message); },
  
  UPDATE_LAST_MESSAGE_CONTENT(state, contentChunk) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.content += contentChunk;
    }
  },
  
  SET_LAST_MESSAGE_ERROR(state, errorMessage) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg) lastMsg.content += errorMessage;
  },
  
  SET_CURRENT_CHAT_ID(state, id) { state.currentChatId = id; },
  REMOVE_SESSION(state, id) { state.sessions = state.sessions.filter(s => s.id !== id); },
  SET_ABORT_CONTROLLER(state, controller) { state.abortController = controller; },
  CLEAR_CHAT(state) { 
    state.messages = []; 
    state.currentChatId = null; 
  }
};

const actions = {
  async fetchSessions({ commit }, searchQuery = '') {
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      const response = await apiClient.get('/api/conversations', { params });
      commit('SET_SESSIONS', response.data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  },

  async fetchMessages({ commit }, chatId) {
    commit('SET_CURRENT_CHAT_ID', chatId);
    try {
      commit('SET_MESSAGES', []); 
      const response = await apiClient.get(`/api/conversations/${chatId}/messages`);
      
      const formattedMessages = response.data.map(m => ({
        role: m.role,
        content: m.content,
        // Conversie timestamp Firebase -> String lizibil
        time: m.timestamp && m.timestamp._seconds 
          ? new Date(m.timestamp._seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
          : ''
      }));
      
      commit('SET_MESSAGES', formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  },

  startNewChat({ commit }) { commit('CLEAR_CHAT'); },

  async deleteSession({ commit, state }, chatId) {
    try {
      await apiClient.delete(`/api/conversations/${chatId}`);
      commit('REMOVE_SESSION', chatId);
      if (state.currentChatId === chatId) commit('CLEAR_CHAT');
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Failed to delete chat.");
    }
  },

  async sendMessage({ commit, state, dispatch }, payload) {
    const messageText = typeof payload === 'string' ? payload : payload.message;
    const systemPrompt = typeof payload === 'object' ? payload.systemPrompt : null;
    const title = typeof payload === 'object' ? payload.title : null;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Adăugăm mesajul userului
    commit('ADD_MESSAGE', { role: 'user', content: messageText, time: now });

    // 2. Adăugăm mesajul "gol" pentru asistent (local)
    commit('ADD_MESSAGE', { 
      role: 'assistant', 
      content: '', 
      time: now, 
      isLocal: true 
    });

    // 3. Creăm Controller-ul pentru Stop Generation
    const controller = new AbortController();
    commit('SET_ABORT_CONTROLLER', controller);

    const token = await authService.getToken(); 
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: messageText, 
          conversationId: state.currentChatId,
          systemPrompt: systemPrompt,
          title: title
        }),
        signal: controller.signal // <--- AICI legăm butonul de Stop
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isNewChat = !state.currentChatId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;

            try {
              const data = JSON.parse(raw);
              
              if (data.content) {
                commit('UPDATE_LAST_MESSAGE_CONTENT', data.content);
              }
              
              // Actualizăm ID-ul conversației dacă e una nouă
              if (data.done && data.conversationId && isNewChat) {
                commit('SET_CURRENT_CHAT_ID', data.conversationId);
                dispatch('fetchSessions'); 
                isNewChat = false; 
              }
            } catch (e) {
              console.warn("JSON Parse error", e);
            }
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Chat generation stopped by user.");
        commit('SET_LAST_MESSAGE_ERROR', ' [Stopped]');
      } else {
        console.error("Stream Error:", err);
        commit('SET_LAST_MESSAGE_ERROR', '\n[Error communicating with server]');
      }
    } finally {
      commit('SET_ABORT_CONTROLLER', null);
      // Opțional: Dacă conversația a fost oprită, putem face un refresh la mesaje
      // pentru a fi siguri că suntem sincronizați cu DB-ul (în cazul în care DB-ul a salvat parțial).
    }
  },

  // Acțiunea apelată de butonul de Stop
  stopGeneration({ state, commit }) {
    if (state.abortController) {
      state.abortController.abort(); // Declanșează "AbortError" în fetch-ul de mai sus
      commit('SET_ABORT_CONTROLLER', null);
    }
  }
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations
};