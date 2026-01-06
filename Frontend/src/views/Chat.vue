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
          <button class="delete-btn" @click.stop="handleDelete(chat.id)" title="Delete Chat">×</button>
        </div>
      </div>

      <div class="user-footer">
        <div class="theme-switch" @click="toggleTheme">
          <span>{{ isDark ? '🌙 Dark Mode' : '☀️ Light Mode' }}</span>
        </div>
        <div class="user-info">{{ userEmail }}</div>
        <button @click="handleLogout" class="logout-link">Logout</button>
      </div>
    </aside>

    <main class="chat-main">
      <div class="messages-display" ref="scrollBox">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="welcome-card">
            <h3>How can LocalMind help you today?</h3>
            <p>I'm ready to chat. Type a message below.</p>
          </div>
        </div>

        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message-row', msg.role]"
        >
          <div :class="['avatar', msg.role]">
            {{ msg.role === 'user' ? (userEmail?.[0]?.toUpperCase() || 'U') : 'AI' }}
          </div>

          <div :class="['message-bubble', msg.role]">
            <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
            <span v-if="msg.time" class="message-time">{{ msg.time }}</span>
          </div>
        </div>
      </div>

      <div class="input-area-container">
        <button v-if="isTyping" class="stop-btn" @click="stopGeneration">
          <span class="stop-icon">■</span> Stop Generating
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
          <button 
            class="send-btn" 
            @click="sendMessage" 
            :disabled="!userInput.trim() || isTyping"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { chatService } from '@/firebase/chatService';
import { authService } from '@/firebase/authService';
import { auth } from '@/firebase/config';

// Markdown Libraries
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

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
const userEmail = ref('');

// Markdown Config
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

// Auto-height for Textarea
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

// --- INIT LOGIC ---
onMounted(async () => {
  const token = await authService.getToken();
  if (!token) {
    router.push('/login');
    return;
  }

  // Set User Info
  if (auth.currentUser) {
    userEmail.value = auth.currentUser.email;
  }

  // Fetch History
  try {
    history.value = await chatService.getUserConversations(token);
  } catch (e) {
    console.error("History fetch error:", e);
  }
  
  if (route.params.id) {
    await selectChat(route.params.id);
  }
});

watch(() => route.params.id, async (newId) => {
  if (newId && newId !== currentChatId.value) {
    await selectChat(newId);
  } else if (!newId) {
    messages.value = [];
    currentChatId.value = null;
  }
});

// --- ACTIONS ---

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const handleLogout = async () => {
  await authService.logout();
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
  
  if (route.params.id !== id) {
    router.push(`/chat/${id}`);
  }

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
    scrollToBottom();
  } catch (e) {
    console.error("Load chat error:", e);
  }
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
    if (err.name !== 'AbortError') {
      messages.value[aiIndex].content += "\n[Error generating response]";
    } else {
      messages.value[aiIndex].content += "\n[Stopped by user]";
    }
  } finally {
    isTyping.value = false;
    abortController.value = null;
  }
};
</script>

<style scoped>
/* RESET & LAYOUT */
* { box-sizing: border-box; }
.chat-container { display: flex; height: 100vh; background: #fff; color: #333; transition: background 0.3s, color 0.3s; }
.chat-container.dark-theme { background: #343541; color: #ececec; }

/* SIDEBAR */
.sidebar { width: 260px; background: #202123; color: white; display: flex; flex-direction: column; padding: 15px; border-right: 1px solid #ddd; }
.dark-theme .sidebar { border-right: 1px solid #4d4d4f; }

.new-chat-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid #4d4d4f; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 20px; transition: 0.2s; }
.new-chat-btn:hover { background: rgba(255,255,255,0.2); }

.history-list { flex: 1; overflow-y: auto; }
.history-item { padding: 10px; cursor: pointer; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; color: #ececec; margin-bottom: 2px;}
.history-item:hover { background: #2a2b32; }
.history-item.active { background: #343541; border: 1px solid #555; }

.chat-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; padding-right: 5px; }

.user-footer { padding-top: 15px; border-top: 1px solid #4d4d4f; font-size: 0.9rem; }
.theme-switch { cursor: pointer; padding: 5px; margin-bottom: 8px; opacity: 0.8; user-select: none; }
.theme-switch:hover { opacity: 1; }
.user-info { font-size: 0.85rem; color: #aaa; margin-bottom: 5px; }
.logout-link { color: #ff6b6b; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; }

.delete-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; line-height: 1; opacity: 0.6; }
.delete-btn:hover { color: #ff4d4d; opacity: 1; }

/* MAIN AREA */
.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; background: #fff; }
.dark-theme .chat-main { background: #343541; }

.messages-display { flex: 1; overflow-y: auto; padding: 20px 10%; display: flex; flex-direction: column; gap: 24px; }

/* Message Row */
.message-row { display: flex; gap: 16px; width: 100%; align-items: flex-start; }

/* --- RIGHT SIDE FOR USER --- */
.message-row.user {
  flex-direction: row-reverse; 
}

/* Avatars */
.avatar { width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.9rem; }
.avatar.user { background: #5c7cfa; color: white; }
.avatar.assistant { background: #10a37f; color: white; }

/* Bubbles */
.message-bubble { max-width: 85%; display: flex; flex-direction: column; }
.bubble-content { padding: 10px 15px; border-radius: 8px; line-height: 1.6; font-size: 1rem; }

/* --- USER BUBBLE (Blue) --- */
.message-bubble.user .bubble-content { 
  background: #eef2ff; 
  border: 1px solid #c7d2fe; 
  color: #1a1a1a; 
  border-top-left-radius: 8px;
  border-top-right-radius: 2px; /* Pointy corner towards Avatar */
}
.dark-theme .message-bubble.user .bubble-content { 
  background: rgba(92, 124, 250, 0.15); 
  border: 1px solid rgba(92, 124, 250, 0.3); 
  color: #ececec; 
}

/* --- AI BUBBLE (Grey/Dark) --- */
.message-bubble.assistant .bubble-content { 
  background: #f7f7f8; /* Light grey */
  border: 1px solid #e5e5e5;
  color: #333; 
  border-top-left-radius: 2px; /* Pointy corner towards Avatar */
  border-top-right-radius: 8px;
}
.dark-theme .message-bubble.assistant .bubble-content { 
  background: #444654; /* Darker grey */
  border: 1px solid rgba(255,255,255,0.05);
  color: #ececec; 
}

.message-time { font-size: 0.75rem; color: #999; margin-top: 4px; }
.message-row.user .message-time { text-align: right; }

/* INPUT */
.input-area-container { padding: 20px 10%; position: relative; background: transparent; }
.input-area { display: flex; gap: 10px; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #ddd; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
.dark-theme .input-area { background: #40414f; border-color: #565869; box-shadow: none; }

textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; font-size: 1rem; color: inherit; line-height: 1.5; font-family: inherit; }
.send-btn { background: #19c37d; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
.send-btn:hover:not(:disabled) { background: #15a569; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.7; }

.stop-btn { position: absolute; top: -50px; left: 50%; transform: translateX(-50%); background: #202123; color: white; border: 1px solid #565869; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; gap: 8px; align-items: center; z-index: 10; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.stop-icon { color: #ff6b6b; font-size: 10px; }

/* Utilities */
.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #888; text-align: center; }
.welcome-card h3 { margin-bottom: 0.5rem; color: inherit; }

/* Markdown Overrides */
.markdown-body :deep(pre) { background: #0d1117 !important; padding: 12px; border-radius: 6px; overflow-x: auto; color: #c9d1d9; margin: 10px 0; }
.markdown-body :deep(code) { font-family: 'Courier New', Courier, monospace; }
</style>