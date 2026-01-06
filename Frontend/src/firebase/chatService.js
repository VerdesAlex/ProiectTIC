import { db } from './config';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc} from "firebase/firestore";

export const chatService = {
  async getUserConversations(token) {
    const response = await fetch('http://localhost:3000/api/conversations', {
      headers: { 
        'Authorization': `Bearer ${token}` // TOKEN-UL TREBUIE SĂ FIE STRING-UL JWT
      }
    });
    if (!response.ok) throw new Error('Unauthorized');
    return await response.json();
  },
    async getChatMessages(conversationId, token) {
      const response = await fetch(`http://localhost:3000/api/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await response.json();
    },
  async deleteConversation(id, token) {
      // Schimbat în /api/conversations/ pentru a se potrivi cu serverul
      const response = await fetch(`http://localhost:3000/api/conversations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete');
      return await response.json();
    }
};