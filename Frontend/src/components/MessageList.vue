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
          @click="handleCodeClick"
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

        <div class="message-footer">
          <button 
            v-if="msg.role !== 'user'" 
            class="msg-action-btn" 
            @click="copyMessage(parseMessage(msg.content).text, index)"
            title="Copy full message"
          >
            <span v-if="copiedIndex === index">✅ Copied</span>
            <span v-else>📋 Copy</span>
          </button>

          <span v-if="msg.time" class="message-time">{{ msg.time }}</span>
        </div>

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
const expandedFiles = ref({});
const copiedIndex = ref(-1);

// --- LOGICA COPY MESSAGE ---
const copyMessage = async (text, index) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedIndex.value = index;
    setTimeout(() => {
      copiedIndex.value = -1;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy message:", err);
  }
};

// --- PARSING LOGIC (FIXED) ---
const parseMessage = (content) => {
  // [FIX] Verificăm explicit dacă content este string.
  // Previne eroarea "content.indexOf is not a function" dacă content este un Obiect sau null.
  if (typeof content !== 'string') {
    return { text: '', file: null };
  }

  const markerStart = "\n\n--- Content of file: ";
  const startIndex = content.indexOf(markerStart);
  
  if (startIndex === -1) return { text: content, file: null };
  
  try {
    const text = content.substring(0, startIndex).trim();
    const rest = content.substring(startIndex + markerStart.length);
    const nameEnd = rest.indexOf(" ---\n");
    if (nameEnd === -1) return { text: content, file: null };
    
    const fileName = rest.substring(0, nameEnd);
    const contentStart = nameEnd + 5;
    const markerEnd = "\n--- End of file ---";
    const endIndex = rest.lastIndexOf(markerEnd);
    if (endIndex === -1) return { text: content, file: null };

    const fileContent = rest.substring(contentStart, endIndex);
    return { text, file: { name: fileName, content: fileContent } };
  } catch (e) {
    return { text: content, file: null };
  }
};

const toggleFile = (index) => expandedFiles.value[index] = !expandedFiles.value[index];
const isExpanded = (index) => !!expandedFiles.value[index];

// --- MARKDOWN & CODE BUTTONS LOGIC ---
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
  const sanitized = DOMPurify.sanitize(rawHtml);

  return sanitized.replace(
    /<pre><code class="([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
    (match, classNames, codeContent) => {
      const langMatch = classNames.match(/language-([a-zA-Z0-9_-]+)/);
      const language = langMatch ? langMatch[1] : 'text';

      return `
        <div class="code-wrapper">
          <div class="code-header">
            <span class="lang-label">${language}</span>
            <div class="code-actions">
              <button class="action-btn download-btn" data-lang="${language}" title="Download">⬇</button>
              <button class="action-btn copy-btn" title="Copy">📋</button>
            </div>
          </div>
          <pre><code class="${classNames}">${codeContent}</code></pre>
        </div>
      `;
    }
  );
};

const handleCodeClick = async (event) => {
  const target = event.target;
  if (target.closest('.copy-btn')) {
    const btn = target.closest('.copy-btn');
    const wrapper = btn.closest('.code-wrapper');
    const code = wrapper.querySelector('code').innerText;
    try {
      await navigator.clipboard.writeText(code);
      const originalText = btn.innerText;
      btn.innerText = '✅';
      setTimeout(() => btn.innerText = originalText, 2000);
    } catch (err) { console.error('Copy failed', err); }
  }
  if (target.closest('.download-btn')) {
    const btn = target.closest('.download-btn');
    const wrapper = btn.closest('.code-wrapper');
    const code = wrapper.querySelector('code').innerText;
    const lang = btn.getAttribute('data-lang') || 'txt';
    downloadCode(code, lang);
  }
};

const downloadCode = (code, lang) => {
  const extensions = { javascript: 'js', js: 'js', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', vue: 'vue', java: 'java', c: 'c', cpp: 'cpp', sql: 'sql', bash: 'sh', shell: 'sh', text: 'txt', plaintext: 'txt' };
  const ext = extensions[lang] || lang || 'txt';
  const filename = `snippet_${Date.now()}.${ext}`;
  const blob = new Blob([code], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
/* CSS Neschimbat - folosește stilurile pe care le ai deja */
.messages-display { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 20px; }
.empty-state { height: 100%; display: flex; align-items: center; justify-content: center; color: #888; }
.welcome-card { text-align: center; }

.message-row { display: flex; gap: 15px; max-width: 900px; margin: 0 auto; width: 100%; }
.message-row.user { flex-direction: row-reverse; }

.avatar { width: 36px; height: 36px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 0.9rem; }
.avatar.user { background: #5c7cfa; color: white; }
.avatar.assistant { background: #10a37f; color: white; }

.message-bubble { max-width: 85%; display: flex; flex-direction: column; gap: 8px; }

.message-bubble.user .bubble-content { 
  background: #eef2ff; border: 1px solid #c7d2fe; color: #1a1a1a; 
  padding: 10px 15px; border-radius: 8px; line-height: 1.6;
  border-top-right-radius: 2px;
}

.message-bubble.assistant .bubble-content { 
  background: #f7f7f8; border: 1px solid #e5e5e5; color: #333; 
  padding: 10px 15px; border-radius: 8px; line-height: 1.6;
  border-top-left-radius: 2px;
}

.message-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding: 0 4px; }
.message-row.user .message-footer { flex-direction: row-reverse; }

.msg-action-btn { background: transparent; border: none; color: #888; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; transition: color 0.2s, background 0.2s; }
.msg-action-btn:hover { color: #333; background: rgba(0,0,0,0.05); }

.message-time { font-size: 0.75rem; color: #999; }

:deep(.code-wrapper) { margin: 10px 0; border-radius: 6px; overflow: hidden; border: 1px solid #ddd; background: #2d2d2d; }
:deep(.code-header) { display: flex; justify-content: space-between; align-items: center; background: #444; padding: 5px 10px; color: #ccc; font-family: sans-serif; font-size: 0.75rem; border-bottom: 1px solid #555; }
:deep(.lang-label) { text-transform: uppercase; font-weight: bold; opacity: 0.8; }
:deep(.code-actions) { display: flex; gap: 8px; }
:deep(.action-btn) { background: transparent; border: none; color: #fff; cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
:deep(.action-btn:hover) { background: rgba(255,255,255,0.2); }
.markdown-body :deep(pre) { margin: 0 !important; border-radius: 0 0 6px 6px !important; border: none !important; }

.file-attachment-card { background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-top: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-size: 0.9rem; }
.message-bubble.user .file-attachment-card { border-color: #c7d2fe; }
.file-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8f9fa; cursor: pointer; transition: background 0.2s; }
.file-header:hover { background: #f1f1f1; }
.file-info { display: flex; align-items: center; gap: 8px; overflow: hidden; }
.file-name { font-weight: 600; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
.file-icon { font-size: 1.1rem; }
.toggle-btn { background: none; border: none; font-size: 0.75rem; color: #666; cursor: pointer; }
.file-content-viewer { padding: 10px; background: #2d2d2d; color: #ccc; font-family: 'Consolas', monospace; font-size: 0.85rem; max-height: 300px; overflow-y: auto; border-top: 1px solid #ddd; }
.file-content-viewer pre { margin: 0; white-space: pre-wrap; word-break: break-all; }

.markdown-body :deep(code) { font-family: 'Consolas', monospace; font-size: 0.9em; }
.markdown-body :deep(p) { margin-bottom: 0.5em; }
.markdown-body :deep(p:last-child) { margin-bottom: 0; }

:global(.dark-theme) .message-bubble.user .bubble-content { background: #343541; border-color: #565869; color: #ececec; }
:global(.dark-theme) .message-bubble.assistant .bubble-content { background: #444654; border-color: #565869; color: #ececec; }
:global(.dark-theme) .file-attachment-card { background: #40414f; border-color: #565869; }
:global(.dark-theme) .file-header { background: #343541; color: #ececec; }
:global(.dark-theme) .file-header:hover { background: #2a2b32; }
:global(.dark-theme) .file-name { color: #ececec; }
:global(.dark-theme) :deep(.code-wrapper) { border-color: #565869; }
:global(.dark-theme) :deep(.code-header) { background: #202123; border-color: #565869; }
:global(.dark-theme) .msg-action-btn { color: #aaa; }
:global(.dark-theme) .msg-action-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
</style>