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
import Sidebar from '@/components/Sidebar.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ChatInput from '@/components/ChatInput.vue'
import { authService } from '@/firebase/authService'
import { chatService } from '@/firebase/chatService'

export default {
  name: 'ChatView',
  components: { Sidebar, ChatWindow, ChatInput },
  data() {
    return {
      conversations: [],
      messages: []
    }
  },
  methods: {
    async initChat() {
      const token = await authService.getToken(); // Pasul CRITIC
      if (!token) return this.$router.push('/login');
      
      this.conversations = await chatService.getUserConversations(token);
      
      if (this.$route.params.id) {
        this.messages = await chatService.getChatMessages(this.$route.params.id, token);
      }
    },
    async handleDelete(id) {
      const token = await authService.getToken();
      await chatService.deleteConversation(id, token);
      await this.initChat();
      if (this.$route.params.id === id) this.$router.push('/chat');
    }
  },
  mounted() {
    this.initChat();
  },
  watch: {
    '$route.params.id': function() {
      this.initChat();
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