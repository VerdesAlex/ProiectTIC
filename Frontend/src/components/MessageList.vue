<template>
  <div class="messages-display" ref="scrollBox">
    <div v-if="messages.length === 0" class="empty-state">
      <div class="welcome-card">
        <h3>How can LocalMind help you today?</h3>
        <p>I'm ready to chat. Type a message below.</p>
      </div>
    </div>

    <div v-for="(msg, index) in messages" :key="index" :class="['message-row', msg.role]">
      <div :class="['avatar', msg.role]">
        {{ msg.role === 'user' ? (userEmail?.[0]?.toUpperCase() || 'U') : 'AI' }}
      </div>

      <div :class="['message-bubble', msg.role]">
        <div 
          class="bubble-content markdown-body" 
          v-html="renderMarkdown(parseMessage(msg.content).text)"
          v-if="parseMessage(msg.content).text"
        ></div>

        <div v-if="parseMessage(msg.content).file" class="file-attachment-card">
          <div class="file-header" @click="toggleFile(index)">
            <div class="file-info">
              <span class="file-icon">📄</span>
              <span class="file-name">{{ parseMessage(msg.content).file.name }}</span>
            </div>
            <button class="toggle-btn">
              {{ isExpanded(index) ? 'Hide Content ▲' : 'Show Content ▼' }}
            </button>
          </div>
          
          <div v-if="isExpanded(index)" class="file-content-viewer">
            <pre>{{ parseMessage(msg.content).file.content }}</pre>
          </div>
        </div>

        <span v-if="msg.time" class="message-time">{{ msg.time }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

const props = defineProps({
  messages: Array,
  userEmail: String
});

const scrollBox = ref(null);
const expandedFiles = ref({}); // Stare pentru a ține minte ce fișiere sunt deschise

// --- PARSING LOGIC ---
// Aceasta funcție detectează formatul special creat în ChatInput
const parseMessage = (content) => {
  if (!content) return { text: '', file: null };
  
  const markerStart = "\n\n--- Content of file: ";
  
  // Verificăm dacă mesajul conține markerul nostru
  const startIndex = content.indexOf(markerStart);
  if (startIndex === -1) return { text: content, file: null };
  
  // Extragem textul utilizatorului (partea dinainte de marker)
  const text = content.substring(0, startIndex).trim();
  
  // Încercăm să parsăm restul pentru a găsi numele și conținutul
  try {
    const rest = content.substring(startIndex + markerStart.length);
    const nameEnd = rest.indexOf(" ---\n");
    
    if (nameEnd === -1) return { text: content, file: null }; // Fallback
    
    const fileName = rest.substring(0, nameEnd);
    const contentStart = nameEnd + 5; // Lungimea " ---\n"
    
    // Căutăm finalul fișierului
    const markerEnd = "\n--- End of file ---";
    const endIndex = rest.lastIndexOf(markerEnd);
    
    if (endIndex === -1) return { text: content, file: null }; // Fallback

    const fileContent = rest.substring(contentStart, endIndex);
    
    return {
      text,
      file: { name: fileName, content: fileContent }
    };
  } catch (e) {
    console.error("Error parsing file attachment:", e);
    return { text: content, file: null };
  }
};

const toggleFile = (index) => {
  expandedFiles.value[index] = !expandedFiles.value[index];
};

const isExpanded = (index) => !!expandedFiles.value[index];

// --- MARKDOWN SETUP (NESCHIMBAT) ---
const marked = new Marked(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

const renderMarkdown = (content) => {
  if (!content) return '';
  const rawHtml = marked.parse(content);
  return DOMPurify.sanitize(rawHtml);
};

// --- SCROLL LOGIC ---
watch(() => props.messages, async () => {
  await nextTick();
  scrollToBottom();
}, { deep: true });

const scrollToBottom = () => {
  if (scrollBox.value) {
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  }
};
</script>

<style scoped>
.messages-display { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #888; }
.welcome-card { text-align: center; }

.message-row { display: flex; gap: 15px; max-width: 900px; margin: 0 auto; width: 100%; }
.message-row.user { flex-direction: row-reverse; }

.avatar { width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.9rem; }
.avatar.user { background: #5c7cfa; color: white; }
.avatar.assistant { background: #10a37f; color: white; }

/* Bubbles */
.message-bubble { max-width: 85%; display: flex; flex-direction: column; gap: 8px; }

/* User Bubble Styles */
.message-bubble.user .bubble-content { 
  background: #eef2ff; border: 1px solid #c7d2fe; color: #1a1a1a; 
  padding: 10px 15px; border-radius: 8px; line-height: 1.6;
  border-top-right-radius: 2px;
}

/* AI Bubble Styles */
.message-bubble.assistant .bubble-content { 
  background: #f7f7f8; border: 1px solid #e5e5e5; color: #333; 
  padding: 10px 15px; border-radius: 8px; line-height: 1.6;
  border-top-left-radius: 2px;
}

/* --- STILURI NOI PENTRU ATAȘAMENTE --- */
.file-attachment-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 5px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  font-size: 0.9rem;
}

.message-bubble.user .file-attachment-card {
  /* Stil specific dacă e în bula userului */
  border-color: #c7d2fe;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  cursor: pointer;
  transition: background 0.2s;
}
.file-header:hover { background: #f1f1f1; }

.file-info { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.file-name { font-weight: 600; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.file-icon { font-size: 1.1rem; }

.toggle-btn {
  background: none; border: none; font-size: 0.75rem; color: #666; cursor: pointer;
}

.file-content-viewer {
  padding: 10px;
  background: #2d2d2d; /* Code editor look */
  color: #ccc;
  font-family: 'Consolas', monospace;
  font-size: 0.85rem;
  max-height: 300px;
  overflow-y: auto;
  border-top: 1px solid #ddd;
}
.file-content-viewer pre { margin: 0; white-space: pre-wrap; word-break: break-all; }

/* Markdown Styles Override */
.markdown-body :deep(pre) { background: #2d2d2d; padding: 10px; border-radius: 6px; overflow-x: auto; color: #fff; }
.markdown-body :deep(code) { font-family: 'Consolas', monospace; font-size: 0.9em; }
.markdown-body :deep(p) { margin-bottom: 0.5em; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }

.message-time { font-size: 0.75rem; color: #999; margin-top: 4px; align-self: flex-end; }
.message-row.user .message-time { align-self: flex-start; } /* Timpul pe partea opusă la user */

/* Dark Mode Support */
:global(.dark-theme) .message-bubble.user .bubble-content { background: #343541; border-color: #565869; color: #ececec; }
:global(.dark-theme) .message-bubble.assistant .bubble-content { background: #444654; border-color: #565869; color: #ececec; }
:global(.dark-theme) .file-attachment-card { background: #40414f; border-color: #565869; }
:global(.dark-theme) .file-header { background: #343541; color: #ececec; }
:global(.dark-theme) .file-header:hover { background: #2a2b32; }
:global(.dark-theme) .file-name { color: #ececec; }
</style>