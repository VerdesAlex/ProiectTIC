import { db } from './config';
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";

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
  }
};