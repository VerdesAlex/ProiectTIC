<template>
  <div :class="['chat-container', { 'dark-theme': isDark }]">
    <aside class="sidebar">
      <button @click="createNewChat" class="new-chat-btn">+ New Chat</button>
      <div class="history-list">
        <div 
          v-for="chat in history" 
          :key="chat.id" 
          @click="selectChat(chat.id)"
          :class="['history-item', { active: currentChatId === chat.id }]"
        >
          <span class="chat-title">{{ chat.title || 'Conversation' }}</span>
          <button class="delete-btn" @click.stop="handleDelete(chat.id)">×</button>
        </div>
      </div>
      <div class="user-footer">
        <div class="theme-switch" @click="toggleTheme">
          <span>{{ isDark ? '🌙 Dark Mode' : '☀️ Light Mode' }}</span>
        </div>
        <div class="user-info">{{ userEmail }}</div>
        <button @click="$emit('logout')" class="logout-link">Logout</button>
      </div>
    </aside>

    <main class="chat-main">
      <div class="messages-display" ref="scrollBox">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="welcome-card">
            <h3>How can LocalMind help you today?</h3>
            <p>I'm ready to chat.</p>
          </div>
        </div>

        <div v-for="(msg, index) in messages" :key="index" class="message-row">
          <div :class="['avatar', msg.role]">
            {{ msg.role === 'user' ? 'U' : 'AI' }}
          </div>

          <div :class="['message-bubble', msg.role]">
            <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
          </div>
        </div>
      </div>

      <div class="input-area-container">
        <button v-if="isTyping" class="stop-btn" @click="stopGeneration">
          <span class="stop-icon">■</span> Stop
        </button>

        <div class="input-area">
          <textarea 
            ref="textareaRef"
            v-model="userInput" 
            @keydown.enter.exact.prevent="sendMessage"
            placeholder="Message LocalMind..."
            rows="1"
            @input="adjustHeight"
          ></textarea>
          <button class="send-btn" @click="sendMessage" :disabled="!userInput.trim() || isTyping">Send</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // <--- IMPORT CRITIC
import { chatService } from '../../firebase/chatService';
import { authService } from '../../firebase/authService';
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

const props = defineProps(['userEmail', 'userId']);
const emit = defineEmits(['logout']);

const route = useRoute();
const router = useRouter();

// State
const userInput = ref('');
const messages = ref([]);
const history = ref([]);
const currentChatId = ref(null);
const isTyping = ref(false);
const scrollBox = ref(null);
const textareaRef = ref(null);
const isDark = ref(localStorage.getItem('theme') === 'dark');
const abortController = ref(null);

// Markdown setup
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);
marked.setOptions({ breaks: true, gfm: true });

const renderMarkdown = (text) => {
  const rawHtml = marked.parse(text || '');
  return DOMPurify.sanitize(rawHtml);
};

// Auto-height textarea
const adjustHeight = () => {
  const el = textareaRef.value;
  if(!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
};
watch(userInput, () => nextTick(adjustHeight));

const scrollToBottom = async () => {
  await nextTick();
  if (scrollBox.value) scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
};

// --- INIT LOGIC (CRITIC PENTRU REFRESH) ---
onMounted(async () => {
  const token = await authService.getToken();
  if(token) {
    history.value = await chatService.getUserConversations(token);
    
    // Dacă avem un ID în URL, încărcăm conversația
    if (route.params.id) {
      await selectChat(route.params.id);
    }
  }
});

// Ascultăm schimbările din URL (când dai click pe sidebar)
watch(() => route.params.id, async (newId) => {
  if (newId && newId !== currentChatId.value) {
    await selectChat(newId);
  } else if (!newId) {
    messages.value = [];
    currentChatId.value = null;
  }
});

const createNewChat = () => {
  messages.value = [];
  currentChatId.value = null;
  router.push('/chat');
};

const selectChat = async (id) => {
  currentChatId.value = id;
  messages.value = [];
  router.push(`/chat/${id}`); // Actualizăm URL-ul
  
  const token = await authService.getToken();
  const fetched = await chatService.getChatMessages(id, token);
  messages.value = fetched.map(m => ({
    role: m.role,
    content: m.content,
    time: m.timestamp
  }));
  scrollToBottom();
};

const handleDelete = async (id) => {
  if(!confirm("Delete?")) return;
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
  isTyping.value = true;
  
  const isNewChat = !currentChatId.value;

  messages.value.push({ role: 'user', content: text });
  const aiIndex = messages.value.push({ role: 'assistant', content: '' }) - 1;
  await scrollToBottom();

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
            if (data.content) {
              messages.value[aiIndex].content += data.content;
              scrollToBottom();
            }
            if (data.done) {
              currentChatId.value = data.conversationId;
              if(isNewChat) {
                const token = await authService.getToken();
                history.value = await chatService.getUserConversations(token);
                // Nu uita să schimbi URL-ul pentru noul chat
                router.replace(`/chat/${data.conversationId}`);
              }
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') messages.value[aiIndex].content += " [Error]";
  } finally {
    isTyping.value = false;
    abortController.value = null;
  }
};

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};
</script>

<style scoped>
* { box-sizing: border-box; }
.chat-container { display: flex; height: 100vh; background: #fff; color: #333; transition: 0.3s; }
.chat-container.dark-theme { background: #343541; color: #ececec; }

/* SIDEBAR */
.sidebar { width: 260px; background: #202123; color: white; display: flex; flex-direction: column; padding: 15px; }
.new-chat-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid #4d4d4f; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
.history-list { flex: 1; overflow-y: auto; }
.history-item { padding: 10px; cursor: pointer; border-radius: 5px; display: flex; justify-content: space-between; color: #ececec; margin-bottom: 2px;}
.history-item:hover { background: #2a2b32; }
.history-item.active { background: #343541; }
.user-footer { padding-top: 10px; border-top: 1px solid #4d4d4f; font-size: 0.8rem; }
.logout-link { color: #ff6b6b; background: none; border: none; cursor: pointer; text-decoration: underline; margin-top: 5px; }
.delete-btn { background: none; border: none; color: #888; cursor: pointer; }
.delete-btn:hover { color: #f00; }
.user-info { margin-bottom: 5px; opacity: 0.7; }

/* MAIN AREA */
.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; }
.dark-theme .chat-main { background: #343541; }
.chat-main { background: #fff; }

.messages-display { flex: 1; overflow-y: auto; padding: 20px 10%; display: flex; flex-direction: column; gap: 20px; }

/* ROW LAYOUT - Toate pe stânga */
.message-row { display: flex; gap: 15px; width: 100%; align-items: flex-start; }

/* AVATARS */
.avatar { width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.avatar.user { background: #5c7cfa; color: white; }
.avatar.assistant { background: #10a37f; color: white; }

/* BUBBLES */
.message-bubble { 
  max-width: 80%; 
  padding: 10px 15px; 
  border-radius: 8px; 
  line-height: 1.5;
}

/* User Bubble - Albastru */
.message-bubble.user { background: #eef2ff; border: 1px solid #c7d2fe; color: #333; }
.dark-theme .message-bubble.user { background: rgba(92, 124, 250, 0.15); border: 1px solid rgba(92, 124, 250, 0.3); color: #ececec; }

/* AI Bubble - Transparent/Gri */
.message-bubble.assistant { background: #f7f7f8; color: #333; border: 1px solid #e5e5e5; }
.dark-theme .message-bubble.assistant { background: rgba(255,255,255,0.05); color: #ececec; border: 1px solid transparent; }

/* INPUT */
.input-area-container { padding: 20px 10%; position: relative; }
.input-area { display: flex; gap: 10px; background: #fff; padding: 10px; border-radius: 10px; border: 1px solid #ddd; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
.dark-theme .input-area { background: #40414f; border-color: #565869; }
textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; font-size: 1rem; color: inherit; }
.send-btn { background: #19c37d; color: white; border: none; padding: 0 20px; border-radius: 5px; cursor: pointer; }
.send-btn:disabled { opacity: 0.6; }
.stop-btn { position: absolute; top: -40px; left: 50%; transform: translateX(-50%); background: #202123; color: white; border: 1px solid #565869; padding: 6px 12px; border-radius: 4px; cursor: pointer; display: flex; gap: 5px; align-items: center; z-index: 10; }

.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #888; }
.markdown-body :deep(pre) { background: #000 !important; padding: 10px; border-radius: 5px; overflow-x: auto; color: #fff; }
</style>