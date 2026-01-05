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

      <!-- <div class="avatar">
        {{ msg.role === 'user' ? userEmail[0].toUpperCase() : 'AI' }}
      </div> -->

      <div 
        v-for="(msg, index) in messages" 
        :key="index" 
        :class="['message-row', msg.role]"
      >
        <div class="avatar">
          {{ msg.role === 'user' ? userEmail[0].toUpperCase() : 'AI' }}
        </div>

        <div class="message-bubble">
          <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
          <span class="message-time">{{ msg.time }}</span>
        </div>
      </div>
      
      <!-- <div class="message-bubble" ...>
        <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
        <span class="message-time">{{ msg.time }}</span>
      </div> -->
      
    </div>

    <div class="input-area-container">
      <button 
        v-if="isTyping" 
        type="button"
        class="stop-btn" 
        @click="stopGeneration"
      >
        <span class="stop-icon">■</span> Stop Generating
      </button>

      <div class="input-area">
        <textarea 
          ref="textareaRef"
          v-model="userInput" 
          @input="adjustHeight"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="Message LocalMind..."
          rows="1"
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
import { chatService } from '../firebase/chatService';
import { auth } from '../firebase/config';

import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

const props = defineProps(['userEmail', 'userId']);
const emit = defineEmits(['logout']);

const userInput = ref('');
const messages = ref([]);
const history = ref([]);
const currentChatId = ref(null);
const isTyping = ref(false);
const scrollBox = ref(null);
const textareaRef = ref(null);



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
  const rawHtml = marked.parse(rawText || '');
  
  // This Regex looks for <pre> tags and injects a Copy button
  const withButtons = rawHtml.replace(
    /<pre><code/g, 
    '<div class="code-container"><button class="copy-code-btn">Copy</button><pre><code'
  ).replace(/<\/code><\/pre>/g, '</code></pre></div>');

  return DOMPurify.sanitize(withButtons);
};

// Handle clicks globally for injected buttons
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-code-btn')) {
      const code = e.target.parentElement.querySelector('code').innerText;
      navigator.clipboard.writeText(code);
      
      e.target.innerText = "Copied!";
      setTimeout(() => e.target.innerText = "Copy", 2000);
    }
  });
});

 // Create a ref for the textarea element

const adjustHeight = () => {
  const el = textareaRef.value;
  if (!el) return;

  // 1. Force the height to 'auto' to get the "true" scrollHeight of the content
  el.style.height = 'auto';

  // 2. Set the height to the scrollHeight
  // We add 2px to prevent slight "jitter" or "shaking"
  const newHeight = el.scrollHeight;
  
  if (newHeight > 200) {
    el.style.height = '200px';
    el.style.overflowY = 'auto'; // Show scrollbar only at max height
  } else {
    el.style.height = (newHeight) + 'px';
    el.style.overflowY = 'hidden';
  }
};

watch(userInput, async () => {
  await nextTick();
  adjustHeight();
});

// onMounted(() => {
//   adjustHeight();
// });

// We need to call this whenever userInput changes
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

const abortController = ref(null);

const stopGeneration = () => {
  if (abortController.value) {
    abortController.value.abort(); // Signal the fetch to stop
    isTyping.value = false;
    abortController.value = null;
    console.log("Generation stopped.");
  }
};

/*
const sendMessage = async () => {
  if (!userInput.value.trim() || isTyping.value) return;
  
  isTyping.value = true; // This makes the button appear
  abortController.value = new AbortController();

  const text = userInput.value;
  userInput.value = '';
  if (textareaRef.value) textareaRef.value.style.height = 'auto';
  
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // // 2. Add USER message to UI
  // messages.value.push({ role: 'user', content: text, time: now });
  
  // 3. Prepare for AI and show STOP button
  isTyping.value = true;
  abortController.value = new AbortController();

  // Add empty AI message placeholder
  messages.value.push({ role: 'user', content: text });
  const assistantMsgIndex = messages.value.push({ role: 'assistant', content: '', time: now }) - 1;

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      signal: abortController.value.signal,
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

            if(data.done && data.conversationId) {
              if (!currentChatId.value) {
                currentChatId.value = data.conversationId;
              }
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
    if (err.name === 'AbortError') {
      messages.value[assistantMsgIndex].content += " [Stopped by user]";
    } else {
      console.error("Chat Error:", err);
    }
  } finally {
    abortController.value = null;
    isTyping.value = false;
  }
};
*/

const sendMessage = async () => {
  if (!userInput.value.trim() || isTyping.value) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  console.log("Setting time to:", now);
  const text = userInput.value;
  userInput.value = '';
  isTyping.value = true;

  // Push User Message and Placeholder for AI
  messages.value.push({ role: 'user', content: text, time: now });
  const aiIndex = messages.value.push({ role: 'assistant', content: '', time: now }) - 1;
  await scrollToBottom();


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
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          
          try {
            const data = JSON.parse(raw);
            if (data.content) {
              // Update the bubble directly
              messages.value[aiIndex].content += data.content;
            }
            if (data.done) currentChatId.value = data.conversationId;
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.error("Stream failed:", err);
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
    // messages.value = fetchedMessages.map(msg => ({
    //   role: msg.role,
    //   content: msg.content
    // }));

    messages.value = fetchedMessages.map(doc => {
    // Convert Firestore timestamp to "10:30 AM" format
      let displayTime = '';
      if (doc.timestamp) {
        // If it's a Firestore timestamp, it has a .toDate() method
        const date = doc.timestamp.toDate ? doc.timestamp.toDate() : new Date(doc.timestamp);
        displayTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      else {
        displayTime = 'Unknown Time';
      }

      return {
        role: doc.role,
        content: doc.content,
        time: displayTime
      };
    });

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

const isRecording = ref(false);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const startSpeech = () => {
  if (!Recognition) return alert("Browser not supported");
  
  const rec = new Recognition();
  rec.onstart = () => isRecording.value = true;
  rec.onend = () => isRecording.value = false;
  rec.onresult = (event) => {
    userInput.value += event.results[0][0].transcript;
    adjustHeight();
  };
  rec.start();
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

.message-bubble {
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
  max-width: 80%; /* Ensure bubbles don't take full width */
}

.message-time {
  display: block;      /* Fixes the 0x0 size issue */
  font-size: 11px;
  color: #888;         /* Subtle grey */
  margin-top: 4px;
  min-width: 50px;     /* Ensures it has a footprint */
  white-space: nowrap; /* Prevents the time from wrapping */
}

.assistant .message-time {
  align-self: flex-start;
}
.message-bubble.user {
  align-self: flex-end;
  align-items: flex-end;
}

.message-bubble.assistant {
  align-self: flex-start;
  align-items: flex-start;
}

.message-row {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: flex-start;
}

/* User row goes from right to left */
.message-row.user {
  flex-direction: row-reverse;
}

.avatar {
  width: 35px;
  height: 35px;
  border-radius: 6px;
  background-color: #555;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8rem;
  flex-shrink: 0; /* Prevents avatar from getting squished */
}

.user .avatar {
  background-color: #007bff; /* Blue for user */
}

.assistant .avatar {
  background-color: #10a37f; /* Green for AI */
}

.message-bubble {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}

/* Ensure user text aligns right, AI text aligns left */
.user .message-bubble { align-items: flex-end; }
.assistant .message-bubble { align-items: flex-start; }

.bubble-content { 
  padding: 12px 16px; border-radius: 15px; font-size: 1rem; line-height: 1.5;
}
.user .bubble-content { background: #007bff; color: white; border-bottom-right-radius: 2px; }
.assistant .bubble-content { background: #e9e9eb; color: #333; border-bottom-left-radius: 2px; }

.input-area-container {
  position: relative;
  width: 100%;
  padding-top: 10px; /* Space for the button */
}

.input-area { 
  padding: 20px 15%; 
  background: white; 
  border-top: 1px solid #eee;
  display: flex; 
  gap: 10px;
  align-items: flex-end; /* Keeps button at the bottom as textarea grows */
}

textarea {
  flex: 1;
  min-height: 44px; /* The starting height */
  height: 44px;     /* Initial fixed height */
  max-height: 200px; 
  
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background-color: var(--input-bg);
  color: var(--text-main);
  
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  
  resize: none;
  overflow-y: hidden; /* This is key: hide scrollbar so it doesn't interfere with measurement */
  outline: none;
  box-sizing: border-box; /* Crucial for padding calculation */
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

.stop-btn {
  /* Use fixed if absolute isn't working, but absolute is better */
  position: absolute;
  top: -45px; 
  left: 50%;
  transform: translateX(-50%);
  
  z-index: 9999; /* Ensure it's above everything */
  background-color: var(--bg-sidebar); /* Darker background so it stands out */
  color: white;
  border: 1px solid var(--border-color);
  padding: 10px 20px;
  border-radius: 25px;
  
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 500;
}

.stop-icon {
  color: #ff4d4d; /* Red square */
  font-size: 14px;
}

:deep(.code-container) {
  position: relative;
}

:deep(.copy-code-btn) {
  position: absolute;
  top: 5px;
  right: 5px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #ccc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  cursor: pointer;
  z-index: 5;
}

:deep(.copy-code-btn:hover) {
  background: rgba(255,255,255,0.2);
  color: white;
}
</style>