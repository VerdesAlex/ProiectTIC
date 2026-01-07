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
        :isTyping="isGenerating"
        @send-message="onSendMessage"
        @stop-generation="onStopGeneration"
      />
    </main>
    
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { authService } from '@/firebase/authService';
import { auth, db } from '@/firebase/config';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// Componente
import Sidebar from '@/components/Sidebar.vue';
import MessageList from '@/components/MessageList.vue';
import ChatInput from '@/components/ChatInput.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();

const userInput = ref('');
const isDark = ref(localStorage.getItem('theme') === 'dark');
const userEmail = ref('');
const pendingSystemPrompt = ref(null);

let unsubscribeMessages = null;

// --- VUEX STATE MAPPING ---
const messages = computed(() => store.getters['chat/currentMessages']);
const history = computed(() => store.getters['chat/allSessions']);
const currentChatId = computed(() => store.getters['chat/activeChatId']);
const isGenerating = computed(() => store.getters['chat/isGenerating']);

// --- REAL-TIME SYNC ---
const subscribeToMessages = (chatId) => {
  if (unsubscribeMessages) {
    unsubscribeMessages();
    unsubscribeMessages = null;
  }

  if (!chatId) {
    store.commit('chat/SET_MESSAGES', []);
    return;
  }

  const q = query(
    collection(db, 'conversations', chatId, 'messages'),
    orderBy('timestamp', 'asc')
  );

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        role: data.role,
        content: data.content,
        // Formatare timp pentru UI (timestamp -> string HH:MM)
        time: data.timestamp && data.timestamp.seconds 
          ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
          : ''
      };
    });
    store.commit('chat/SET_MESSAGES', msgs); 
  }, (error) => {
    console.error("Snapshot Error:", error);
  });
};

// --- LIFECYCLE ---
onMounted(async () => {
  const token = await authService.getToken();
  if (!token) { router.push('/login'); return; }

  if (auth.currentUser) userEmail.value = auth.currentUser.email;

  await store.dispatch('chat/fetchSessions');
  
  if (route.params.id) {
    // FIX: Numele corect al mutației
    store.commit('chat/SET_CURRENT_CHAT_ID', route.params.id);
    subscribeToMessages(route.params.id);
  }
});

onUnmounted(() => {
  if (unsubscribeMessages) unsubscribeMessages();
});

watch(() => route.params.id, (newId) => {
  if (newId) {
    store.commit('chat/SET_CURRENT_CHAT_ID', newId);
    subscribeToMessages(newId);
  } else {
    store.dispatch('chat/startNewChat');
    subscribeToMessages(null);
  }
});

watch(currentChatId, (newId) => {
  if (newId && route.params.id !== newId) {
    router.replace(`/chat/${newId}`);
  }
});

// --- ACTIONS UI ---
const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const handleLogout = async () => {
  await authService.logout();
  store.commit('auth/SET_USER', null);
  store.commit('auth/SET_TOKEN', null);
  store.commit('chat/CLEAR_CHAT');
  router.push('/login');
};

const createNewChat = (systemPrompt) => {
  pendingSystemPrompt.value = systemPrompt;
  store.dispatch('chat/startNewChat');
  router.push('/chat');
};

const selectChat = (id) => {
  pendingSystemPrompt.value = null;
  router.push(`/chat/${id}`);
};

const handleDelete = async (id) => {
  if(!confirm("Delete this conversation?")) return;
  await store.dispatch('chat/deleteSession', id);
  if (currentChatId.value === id || currentChatId.value === null) {
    router.push('/chat');
  }
};

const onStopGeneration = () => {
  store.dispatch('chat/stopGeneration');
};

const onSendMessage = async () => {
  if (!userInput.value.trim() || isGenerating.value) return;
  
  const text = userInput.value;
  userInput.value = ''; 
  
  await store.dispatch('chat/sendMessage', { 
    message: text, 
    systemPrompt: pendingSystemPrompt.value 
  });

  if (pendingSystemPrompt.value) pendingSystemPrompt.value = null;
};
</script>

<style scoped>
.chat-container { display: flex; height: 100vh; background: #fff; color: #333; transition: background 0.3s, color 0.3s; }
.chat-container.dark-theme { background: #343541; color: #ececec; }
.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; background: #fff; }
.dark-theme .chat-main { background: #343541; }
</style>