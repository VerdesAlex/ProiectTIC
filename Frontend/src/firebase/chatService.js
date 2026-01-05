import { db } from './config';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc} from "firebase/firestore";

export const chatService = {
  async getUserConversations(uid) {
    const q = query(
      collection(db, "conversations"),
      where("ownerId", "==", uid),
      orderBy("createdAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },
  async getChatMessages(conversationId) {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  },
  async deleteConversation(id, token) {
    const response = await fetch(`http://localhost:3000/api/conversation/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return await response.json();
  }
};