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
          <span class="chat-title">{{ chat.title || 'Untitled Chat' }}</span>
          
          <button 
            class="delete-btn" 
            @click.stop="handleDelete(chat.id)"
            title="Delete Chat"
          >
            ×
          </button>
        </div>
      </div>
      <div class="user-footer">
        <div class="theme-switch" @click="toggleTheme">
          <span>{{ isDark ? '🌙 Dark Mode' : '☀️ Light Mode' }}</span>
        </div>
        <span>{{ userEmail }}</span>
        <button @click="$emit('logout')" class="logout-link">Logout</button>
      </div>
    </aside>

    <main class="chat-main">
    <div class="messages-display" ref="scrollBox">
      <div v-if="messages.length === 0" class="empty-state">
        <div class="welcome-card">
          <h3>How can LocalMind help you today?</h3>
          <p>Ask me anything. I'm running locally on your machine.</p>
        </div>
      </div>

      <div 
        v-for="(msg, index) in messages" 
        :key="index" 
        :class="['message-bubble', msg.role]"
      >
        <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
      </div>
      
      </div>

      <div class="input-area">
        <textarea 
          v-model="userInput" 
          @keyup.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          rows="1"
        ></textarea>
        <button @click="sendMessage" :disabled="!userInput.trim() || isTyping">
          Send
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { chatService } from '../firebase/chatService';
import { auth } from '../firebase/config';

import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

marked.setOptions({
  breaks: true,
  gfm: true
});

const renderMarkdown = (rawText) => {
  const html = marked.parse(rawText || '');
  return DOMPurify.sanitize(html);
};

const props = defineProps(['userEmail', 'userId']);
const emit = defineEmits(['logout']);

const userInput = ref('');
const messages = ref([]);
const history = ref([]);
const currentChatId = ref(null);
const isTyping = ref(false);
const scrollBox = ref(null);
const textareaRef = ref(null); // Create a ref for the textarea element

const adjustHeight = () => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  // Reset height to calculate correctly
  textarea.style.height = 'auto';
  
  // Set height based on content (max 200px)
  const newHeight = Math.min(textarea.scrollHeight, 200);
  textarea.style.height = newHeight + 'px';
};

// We need to call this whenever userInput changes
import { watch } from 'vue';
watch(userInput, () => {
  nextTick(adjustHeight);
});

// Placeholder for fetching history (We will connect this to Firestore next)
const fetchHistory = async () => {
  try {
    history.value = await chatService.getUserConversations(props.userId);
  } catch (err) {
    console.error("Failed to fetch history:", err);
  }
};

// Call it when the component loads
onMounted(() => {
  fetchHistory();
});

const scrollToBottom = async () => {
  await nextTick();
  if (scrollBox.value) {
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim()) return;

  const text = userInput.value;
  userInput.value = '';
  
  // 1. Add User message to UI
  messages.value.push({ role: 'user', content: text });
  await scrollToBottom();

  // 2. Trigger "Thinking" state
  isTyping.ref = true;

  // TODO: Here is where we will call your Express Backend
  // For now, let's simulate a delay
  const assistantMsgIndex = messages.value.push({ role: 'assistant', content: '' }) - 1;

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, conversationId: currentChatId.value })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // GUARD: Only append if data.content is not null/undefined
            if (data.content) {
              messages.value[assistantMsgIndex].content += data.content;
              scrollToBottom();
            }
          } catch (e) {
            // Logic for when the stream sends "done" signal
            if (line.includes('"done":true')) {
              console.log("Stream finished successfully");
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Stream error:", err);
    // Only show error if we haven't received any content yet
    if (messages.value[assistantMsgIndex].content === '') {
      messages.value[assistantMsgIndex].content = "Error connecting to AI.";
    }
  } finally {
    isTyping.value = false;
  }
};
const createNewChat = () => {
  messages.value = [];
  currentChatId.value = null;
};

const selectChat = async (id) => {
  currentChatId.value = id;
  messages.value = []; // Clear current screen while loading
  isTyping.value = true;
  
  try {
    // 1. Fetch messages from Firestore using our service
    const fetchedMessages = await chatService.getChatMessages(id);
    
    // 2. Map them to the format our UI expects (role and content)
    messages.value = fetchedMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    await scrollToBottom();
  } catch (err) {
    console.error("Error loading chat:", err);
  } finally {
    isTyping.value = false;
  }
};

const isDark = ref(localStorage.getItem('theme') === 'dark');

const toggleTheme = () => {
  isDark.value = !isDark.value;
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};

const handleDelete = async (id) => {
if (!confirm("Delete this conversation?")) return;
  try {
    const token = await auth.currentUser.getIdToken();
    await chatService.deleteConversation(id, token); // Now calls the backend
    
    history.value = history.value.filter(c => c.id !== id);
    if (currentChatId.value === id) {
      messages.value = [];
      currentChatId.value = null;
    }
  } catch (err) {
    console.error("Delete failed:", err);
  }
};



</script>

<style scoped>
.chat-container { display: flex; height: 100vh; background: #f9f9f9; }

.sidebar { 
  width: 260px; background: #202123; color: white; 
  display: flex; flex-direction: column; padding: 15px;
}

.new-chat-btn {
  border: 1px solid #4d4d4f; background: transparent; color: white;
  padding: 10px; border-radius: 5px; cursor: pointer; margin-bottom: 20px;
}

.history-list { flex: 1; overflow-y: auto; }
.history-item {
  display: flex;
  justify-content: space-between; /* Pushes the X to the end */
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
  position: relative;
  color: #ececec;
}

.history-item:hover {
  background: #2a2b32;
}

.history-item.active {
  background: #343541;
}

.chat-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 10px;
}

/* The "×" button styling */
.delete-btn {
  background: transparent;
  border: none;
  color: #666;
  font-size: 1.2rem;
  padding: 0 5px;
  cursor: pointer;
  opacity: 0; /* Hidden by default */
  transition: opacity 0.2s, color 0.2s;
}

/* Show the X only when hovering the row */
.history-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #ff4d4d; /* Turns red on hover */
}

.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; }

.messages-display { 
  flex: 1; overflow-y: auto; padding: 40px 15%; 
  display: flex; flex-direction: column; gap: 20px;
}

.message-bubble { display: flex; max-width: 80%; }
.message-bubble.user { align-self: flex-end; }
.message-bubble.assistant { align-self: flex-start; }

.bubble-content { 
  padding: 12px 16px; border-radius: 15px; font-size: 1rem; line-height: 1.5;
}
.user .bubble-content { background: #007bff; color: white; border-bottom-right-radius: 2px; }
.assistant .bubble-content { background: #e9e9eb; color: #333; border-bottom-left-radius: 2px; }

.input-area { 
  padding: 20px 15%; background: white; border-top: 1px solid #eee;
  display: flex; gap: 10px;
}

textarea { 
  flex: 1; border: 1px solid #ddd; border-radius: 5px; padding: 10px;
  resize: none; outline: none; font-family: inherit;
}

button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
button:disabled { background: #ccc; }

.user-footer { border-top: 1px solid #4d4d4f; padding-top: 10px; font-size: 0.8rem; }
.logout-link { background: none; color: #ff4d4d; border: none; padding: 0; margin-left: 10px; cursor: pointer; }

/* Styling for Markdown container */
.markdown-body {
  line-height: 1.6;
  word-wrap: break-word;
}

/* Styling for the code blocks generated by Highlight.js */
:deep(.markdown-body pre) {
  background-color: #0d1117; /* Dark background */
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5rem 0;
}

:deep(.markdown-body code) {
  font-family: 'Courier New', Courier, monospace;
  background-color: rgba(110, 118, 129, 0.4);
  padding: 0.2rem 0.4rem;
  border-radius: 6px;
  font-size: 85%;
}

:deep(.markdown-body pre code) {
  background-color: transparent;
  padding: 0;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-align: center;
  color: #666;
}

.welcome-card {
  max-width: 400px;
  padding: 2rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.input-area {
  padding: 20px 15%;
  background: white;
  border-top: 1px solid #eee;
  display: flex;
  align-items: flex-end; /* Keeps button at the bottom as textarea grows */
  gap: 10px;
}

textarea {
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 12px 16px;
  resize: none; /* Disables manual resizing */
  outline: none;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  max-height: 200px; /* Limits how tall it can get */
  overflow-y: auto;
  transition: height 0.1s ease;
}

/* --- Theme Variables --- */
.chat-container {
  display: flex;
  height: 100vh;
  transition: background 0.3s, color 0.3s;
  
  /* Default Light Theme */
  --bg-main: #ffffff;
  --bg-sidebar: #202123;
  --bg-chat: #f9f9f9;
  --text-main: #333333;
  --text-sidebar: #ececec;
  --border-color: #eeeeee;
  --bubble-user: #007bff;
  --bubble-ai: #e9e9eb;
  --text-ai: #333333;
  --input-bg: #ffffff;
}

.chat-container.dark-theme {
  /* Dark Theme Overrides */
  --bg-main: #343541;
  --bg-sidebar: #202123;
  --bg-chat: #343541;
  --text-main: #ececec;
  --border-color: #4d4d4f;
  --bubble-user: #218cff;
  --bubble-ai: #444654;
  --text-ai: #ececec;
  --input-bg: #40414f;
}

/* --- Apply Variables to Elements --- */
.chat-main {
  background-color: var(--bg-chat);
  color: var(--text-main);
}

.sidebar {
  background-color: var(--bg-sidebar);
  color: var(--text-sidebar);
}

.input-area {
  background-color: var(--input-bg);
  border-top: 1px solid var(--border-color);
}

textarea {
  background-color: var(--input-bg);
  color: var(--text-main);
  border: 1px solid var(--border-color);
}

.assistant .bubble-content {
  background-color: var(--bubble-ai);
  color: var(--text-ai);
}

.welcome-card {
  background-color: var(--input-bg);
  color: var(--text-main);
}

.theme-switch {
  cursor: pointer;
  padding: 8px;
  margin-bottom: 10px;
  border-radius: 4px;
  background: rgba(255,255,255,0.1);
  text-align: center;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.theme-switch:hover {
  background: rgba(255,255,255,0.2);
}
</style>