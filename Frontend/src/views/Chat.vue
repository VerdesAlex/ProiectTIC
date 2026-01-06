<template>
  <div :class="['chat-container', { 'dark-theme': isDark }]">
    
    <Sidebar 
      :history="history"
      :currentChatId="currentChatId"
      :isDark="isDark"
      :userEmail="userEmail"
      @create-chat="createNewChat"
      @select-chat="selectChat"
      @delete-chat="handleDelete"
      @toggle-theme="toggleTheme"
      @logout="handleLogout"
    />

    <main class="chat-main">
      <MessageList 
        :messages="messages"
        :userEmail="userEmail"
      />

      <ChatInput 
        v-model="userInput"
        :isTyping="isTyping"
        @send-message="sendMessage"
        @stop-generation="stopGeneration"
      />
    </main>
    
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { chatService } from '@/firebase/chatService';
import { authService } from '@/firebase/authService';
import { auth } from '@/firebase/config';

// Importăm noile componente
import Sidebar from '@/components/Sidebar.vue';
import MessageList from '@/components/MessageList.vue';
import ChatInput from '@/components/ChatInput.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();

// State
const userInput = ref('');
const messages = ref([]);
const history = ref([]);
const currentChatId = ref(null);
const isTyping = ref(false);
const isDark = ref(localStorage.getItem('theme') === 'dark');
const userEmail = ref('');
const abortController = ref(null);

// --- INIT ---
onMounted(async () => {
  const token = await authService.getToken();
  if (!token) { router.push('/login'); return; }

  if (auth.currentUser) userEmail.value = auth.currentUser.email;
  try { history.value = await chatService.getUserConversations(token); } catch(e) {}
  
  if (route.params.id) await selectChat(route.params.id);
});

watch(() => route.params.id, async (newId) => {
  if (newId && newId !== currentChatId.value) await selectChat(newId);
  else if (!newId) { messages.value = []; currentChatId.value = null; }
});

// --- ACTIONS ---
const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const handleLogout = async () => {
  // 1. Delogare din Firebase
  await authService.logout();
  
  // 2. CURĂȚARE MANUALĂ STORE (Fix-ul pentru Race Condition)
  // Spunem explicit aplicației: "Nu mai suntem logați", înainte să schimbăm pagina
  store.commit('auth/SET_USER', null);
  store.commit('auth/SET_TOKEN', null);
  
  // 3. Acum Router-ul ne va lăsa să intrăm pe /login
  router.push('/login');
};

const createNewChat = () => {
  messages.value = [];
  currentChatId.value = null;
  router.push('/chat');
};

const selectChat = async (id) => {
  currentChatId.value = id;
  messages.value = [];
  if (route.params.id !== id) router.push(`/chat/${id}`);

  try {
    const token = await authService.getToken();
    const fetched = await chatService.getChatMessages(id, token);
    messages.value = fetched.map(m => ({
      role: m.role,
      content: m.content,
      time: m.timestamp && m.timestamp._seconds 
        ? new Date(m.timestamp._seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
        : ''
    }));
  } catch (e) { console.error(e); }
};

const handleDelete = async (id) => {
  if(!confirm("Delete this conversation?")) return;
  const token = await authService.getToken();
  await chatService.deleteConversation(id, token);
  history.value = history.value.filter(c => c.id !== id);
  if(currentChatId.value === id) createNewChat();
};

const stopGeneration = () => {
  if(abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isTyping.value = false;
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim() || isTyping.value) return;
  
  const text = userInput.value;
  userInput.value = '';
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  isTyping.value = true;
  const isNewChat = !currentChatId.value;

  messages.value.push({ role: 'user', content: text, time: now });
  const aiIndex = messages.value.push({ role: 'assistant', content: '', time: now }) - 1;

  abortController.value = new AbortController();
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  try {
    const token = await authService.getToken();
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, conversationId: currentChatId.value }),
      signal: abortController.value.signal
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

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
            if (data.content) messages.value[aiIndex].content += data.content;
            if (data.done) {
              currentChatId.value = data.conversationId;
              if (isNewChat) {
                const token = await authService.getToken();
                history.value = await chatService.getUserConversations(token);
                router.replace(`/chat/${data.conversationId}`);
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') messages.value[aiIndex].content += "\n[Error]";
    else messages.value[aiIndex].content += "\n[Stopped]";
  } finally {
    isTyping.value = false;
    abortController.value = null;
  }
};
</script>

<style scoped>
.chat-container { display: flex; height: 100vh; background: #fff; color: #333; transition: background 0.3s, color 0.3s; }
.chat-container.dark-theme { background: #343541; color: #ececec; }
.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; background: #fff; }
.dark-theme .chat-main { background: #343541; }
</style>