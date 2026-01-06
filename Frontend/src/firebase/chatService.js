import { db } from './config';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc} from "firebase/firestore";
const API_URL = import.meta.env.VITE_API_URL;
// Frontend/src/firebase/chatService.js
// Frontend/src/firebase/chatService.js
export const chatService = {
  async getUserConversations(token) {
    const response = await fetch(`${API_URL}/api/conversations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return await response.json();
  },

  async getChatMessages(conversationId, token) {
    const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return await response.json();
  },

  async deleteConversation(id, token) {
    // Sincronizăm cu ruta plurală de pe backend
    const response = await fetch(`${API_URL}/api/conversations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
  }
};

