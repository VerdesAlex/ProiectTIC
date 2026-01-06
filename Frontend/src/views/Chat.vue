<template>
  <div class="chat-view">
    <Sidebar />
    <div class="main-content">
      <ChatWindow>
        <div class="placeholder-message">
          <h3>Chat Interface</h3>
          <p>This is the Chat View component.</p>
        </div>
      </ChatWindow>
      <ChatInput />
    </div>
  </div>
</template>

<script>
// We need to import the components we created in Step 5
import Sidebar from '@/components/Sidebar.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ChatInput from '@/components/ChatInput.vue'
import { authService } from '@/firebase/authService'
import { chatService } from '@/firebase/chatService'

export default {
  components: { Sidebar, ChatWindow, ChatInput },
  data() {
    return {
      conversations: [],
      messages: []
    }
  },
  watch: {
    // Urmărim schimbarea ID-ului în URL pentru a încărca mesajele noi
    '$route.params.id': function(newId) {
      if (newId) {
        this.loadMessages(newId);
      } else {
        this.messages = [];
      }
    }
  },
  methods: {
  async loadConversations() {
      try {
        const token = await authService.getToken(); // Obține token-ul real
        if (!token) return this.$router.push('/login');
        
        this.conversations = await chatService.getUserConversations(token);
      } catch (error) {
        console.error("Eroare la încărcarea conversațiilor:", error);
      }
  },
  async loadMessages(convId) {
      try {
        const token = await authService.getToken();
        this.messages = await chatService.getChatMessages(convId, token);
      } catch (error) {
        console.error("Eroare la încărcarea mesajelor:", error);
      }
    },

    async handleDelete(id) {
      try {
        const token = await authService.getToken();
        await chatService.deleteConversation(id, token);
        await this.loadConversations();
        if (this.$route.params.id === id) this.$router.push('/chat');
      } catch (error) {
        console.error("Eroare la ștergere:", error);
      }
    }
  },
  mounted() {
    this.loadConversations();
    if (this.$route.params.id) this.loadMessages(this.$route.params.id);
  },
  watch: {
    '$route.params.id': function(newId) {
      if (newId) this.loadMessages(newId);
      else this.messages = [];
    }
  }
}
</script>



<style scoped>
.chat-view {
  display: flex;
  height: 100vh;
  width: 100vw;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}
.placeholder-message {
  padding: 2rem;
  text-align: center;
  color: #666;
}
</style>