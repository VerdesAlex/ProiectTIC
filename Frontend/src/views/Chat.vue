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

export default {
  name: 'ChatView',
  components: {
    Sidebar,
    ChatWindow,
    ChatInput
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