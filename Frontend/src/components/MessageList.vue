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
        <div class="bubble-content markdown-body" v-html="renderMarkdown(msg.content)"></div>
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

// Auto-Scroll
watch(() => props.messages, async () => {
  await nextTick();
  if (scrollBox.value) {
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  }
}, { deep: true });
</script>

<style scoped>
.messages-display { flex: 1; overflow-y: auto; padding: 20px 10%; display: flex; flex-direction: column; gap: 24px; }
.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #888; text-align: center; }

/* Message Row & Avatars */
.message-row { display: flex; gap: 16px; width: 100%; align-items: flex-start; }
.message-row.user { flex-direction: row-reverse; }

.avatar { width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.9rem; }
.avatar.user { background: #5c7cfa; color: white; }
.avatar.assistant { background: #10a37f; color: white; }

/* Bubbles */
.message-bubble { max-width: 85%; display: flex; flex-direction: column; }
.bubble-content { padding: 10px 15px; border-radius: 8px; line-height: 1.6; font-size: 1rem; }

/* User Bubble */
.message-bubble.user .bubble-content { 
  background: #eef2ff; border: 1px solid #c7d2fe; color: #1a1a1a; 
  border-top-left-radius: 8px; border-top-right-radius: 2px; 
}
/* AI Bubble */
.message-bubble.assistant .bubble-content { 
  background: #f7f7f8; border: 1px solid #e5e5e5; color: #333; 
  border-top-left-radius: 2px; border-top-right-radius: 8px;
}

.message-time { font-size: 0.75rem; color: #999; margin-top: 4px; }
.message-row.user .message-time { text-align: right; }

/* Markdown Styles */
.markdown-body :deep(pre) { background: #0d1117 !important; padding: 12px; border-radius: 6px; overflow-x: auto; color: #c9d1d9; margin: 10px 0; }
.markdown-body :deep(code) { font-family: 'Courier New', Courier, monospace; }

/* Dark Theme Overrides */
:global(.dark-theme) .message-bubble.user .bubble-content { background: rgba(92, 124, 250, 0.15); border: 1px solid rgba(92, 124, 250, 0.3); color: #ececec; }
:global(.dark-theme) .message-bubble.assistant .bubble-content { background: #444654; border: 1px solid rgba(255,255,255,0.05); color: #ececec; }
</style>