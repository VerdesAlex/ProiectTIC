import apiClient from '../../axios'; // Importăm instanța axios configurată
import { authService } from '@/firebase/authService'; // Pentru token în cazul fetch-ului manual

const state = {
  sessions: [],        // Lista conversațiilor (istoric)
  messages: [],        // Mesajele conversației curente
  currentChatId: null, // ID-ul conversației active
  isLoading: false,    // Loader general
  abortController: null // Pentru a opri generarea
};

const getters = {
  allSessions: (state) => state.sessions,
  currentMessages: (state) => state.messages,
  activeChatId: (state) => state.currentChatId,
  isGenerating: (state) => !!state.abortController
};

const mutations = {
  SET_SESSIONS(state, sessions) {
    state.sessions = sessions;
  },
  SET_MESSAGES(state, messages) {
    state.messages = messages;
  },
  ADD_MESSAGE(state, message) {
    state.messages.push(message);
  },
  UPDATE_LAST_MESSAGE_CONTENT(state, contentChunk) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.content += contentChunk;
    }
  },
  SET_LAST_MESSAGE_ERROR(state, errorMessage) {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg) {
       lastMsg.content += errorMessage;
    }
  },
  SET_CURRENT_CHAT_ID(state, id) {
    state.currentChatId = id;
  },
  REMOVE_SESSION(state, id) {
    state.sessions = state.sessions.filter(s => s.id !== id);
  },
  SET_ABORT_CONTROLLER(state, controller) {
    state.abortController = controller;
  },
  CLEAR_CHAT(state) {
    state.messages = [];
    state.currentChatId = null;
  }
};

const actions = {
  // 1. Obține lista de conversații
  async fetchSessions({ commit }) {
    try {
      const response = await apiClient.get('/api/conversations');
      commit('SET_SESSIONS', response.data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  },

  // 2. Obține mesajele unei conversații specifice
  async fetchMessages({ commit }, chatId) {
    commit('SET_CURRENT_CHAT_ID', chatId);
    try {
      // Curățăm mesajele vechi înainte de încărcare pentru UX
      commit('SET_MESSAGES', []); 
      
      const response = await apiClient.get(`/api/conversations/${chatId}/messages`);
      
      // Mapăm datele pentru a se potrivi cu structura UI
      const formattedMessages = response.data.map(m => ({
        role: m.role,
        content: m.content,
        time: m.timestamp && m.timestamp._seconds 
          ? new Date(m.timestamp._seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
          : ''
      }));
      
      commit('SET_MESSAGES', formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  },

  // 3. Inițializează un chat nou (doar UI momentan, se salvează la primul mesaj)
  startNewChat({ commit }) {
    commit('CLEAR_CHAT');
  },

  // 4. Șterge o conversație
  async deleteSession({ commit, state }, chatId) {
    try {
      await apiClient.delete(`/api/conversations/${chatId}`);
      commit('REMOVE_SESSION', chatId);
      
      // Dacă ștergem chat-ul curent, resetăm view-ul
      if (state.currentChatId === chatId) {
        commit('CLEAR_CHAT');
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Failed to delete chat.");
    }
  },

  // 5. Trimite mesaj și gestionează Streaming-ul
  async sendMessage({ commit, state, dispatch, rootState }, messageText) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // A. Adăugăm mesajul utilizatorului în UI (Optimistic update)
    commit('ADD_MESSAGE', { role: 'user', content: messageText, time: now });

    // B. Adăugăm placeholder pentru AI
    commit('ADD_MESSAGE', { role: 'assistant', content: '', time: now });

    // C. Configurare AbortController
    const controller = new AbortController();
    commit('SET_ABORT_CONTROLLER', controller);

    // D. Pregătire URL și Token
    // Notă: Folosim fetch nativ pentru streaming, deci trebuie să luăm tokenul manual
    // Presupunem că tokenul e în rootState.auth.token sau îl luăm fresh
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
          conversationId: state.currentChatId 
        }),
        signal: controller.signal
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let isNewChat = !state.currentChatId;

      // E. Citirea stream-ului
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
              
              // Cazul 1: Primim conținut text
              if (data.content) {
                commit('UPDATE_LAST_MESSAGE_CONTENT', data.content);
              }
              
              // Cazul 2: Backend-ul semnalează finalul și trimite ID-ul conversației (pentru chat-uri noi)
              if (data.done && data.conversationId) {
                if (isNewChat) {
                  commit('SET_CURRENT_CHAT_ID', data.conversationId);
                  // Reîmprospătăm lista din sidebar pentru a vedea titlul nou
                  dispatch('fetchSessions'); 
                }
              }
            } catch (e) {
              console.warn("JSON Parse error in stream", e);
            }
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        commit('SET_LAST_MESSAGE_ERROR', '\n[Stopped by user]');
      } else {
        console.error("Stream Error:", err);
        commit('SET_LAST_MESSAGE_ERROR', '\n[Error communicating with server]');
      }
    } finally {
      commit('SET_ABORT_CONTROLLER', null);
    }
  },

  // 6. Oprește generarea
  stopGeneration({ state, commit }) {
    if (state.abortController) {
      state.abortController.abort();
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