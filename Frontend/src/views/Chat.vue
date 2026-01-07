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
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { authService } from '@/firebase/authService';
import { auth } from '@/firebase/config';

// Componente
import Sidebar from '@/components/Sidebar.vue';
import MessageList from '@/components/MessageList.vue';
import ChatInput from '@/components/ChatInput.vue';

const route = useRoute();
const router = useRouter();
const store = useStore();

// UI State local (doar ce ține de input/temă)
const userInput = ref('');
const isDark = ref(localStorage.getItem('theme') === 'dark');
const userEmail = ref('');

// --- VUEX STATE MAPPING ---
// Folosim computed pentru a fi mereu sincronizați cu Store-ul
const messages = computed(() => store.getters['chat/currentMessages']);
const history = computed(() => store.getters['chat/allSessions']);
const currentChatId = computed(() => store.getters['chat/activeChatId']);
const isGenerating = computed(() => store.getters['chat/isGenerating']);

// --- LIFECYCLE ---
onMounted(async () => {
  const token = await authService.getToken();
  if (!token) { router.push('/login'); return; }

  if (auth.currentUser) userEmail.value = auth.currentUser.email;

  // 1. Încărcăm lista de sesiuni
  await store.dispatch('chat/fetchSessions');
  
  // 2. Dacă suntem pe un URL cu ID, încărcăm mesajele
  if (route.params.id) {
    await store.dispatch('chat/fetchMessages', route.params.id);
  }
});

// Watcher pentru schimbarea URL-ului (ex: click pe istoric sau New Chat)
watch(() => route.params.id, async (newId) => {
  if (newId && newId !== currentChatId.value) {
    await store.dispatch('chat/fetchMessages', newId);
  } else if (!newId) {
    // Dacă URL-ul e doar /chat, curățăm store-ul
    store.dispatch('chat/startNewChat');
  }
});

// Watcher invers: Dacă store-ul primește un ID nou (după primul mesaj într-un chat nou), actualizăm URL-ul
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
  store.commit('chat/CLEAR_CHAT'); // Curățăm și chat-ul la logout
  router.push('/login');
};

const createNewChat = () => {
  store.dispatch('chat/startNewChat');
  router.push('/chat');
};

const selectChat = (id) => {
  // Doar schimbăm ruta, watcher-ul de pe route.params se ocupă de fetch
  router.push(`/chat/${id}`);
};

const handleDelete = async (id) => {
  if(!confirm("Delete this conversation?")) return;
  
  await store.dispatch('chat/deleteSession', id);
  
  // Dacă am șters chat-ul curent, mergem la pagina de start
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
  userInput.value = ''; // Golim input-ul imediat
  
  // Trimitem acțiunea către store
  await store.dispatch('chat/sendMessage', text);
};
</script>

<style scoped>
/* CSS rămâne neschimbat */
.chat-container { display: flex; height: 100vh; background: #fff; color: #333; transition: background 0.3s, color 0.3s; }
.chat-container.dark-theme { background: #343541; color: #ececec; }
.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; background: #fff; }
.dark-theme .chat-main { background: #343541; }
</style>