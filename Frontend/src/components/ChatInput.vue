<template>
  <div class="input-area-container">
    <button v-if="isTyping" class="stop-btn" @click="$emit('stop-generation')">
      <span class="stop-icon">■</span> Stop Generating
    </button>

    <div v-if="attachedFile" class="attachment-badge">
      <span class="file-icon">📄</span>
      <span class="file-name">{{ attachedFile.name }}</span>
      <button class="remove-file-btn" @click="removeAttachment" title="Remove file">×</button>
    </div>

    <div class="input-area">
      <input 
        type="file" 
        ref="fileInputRef" 
        accept=".txt,.md,.csv,.js,.json,.html,.css" 
        style="display: none;" 
        @change="handleFileUpload"
      />

      <button 
        class="upload-btn" 
        @click="triggerFileUpload" 
        title="Attach text file"
        :disabled="isTyping || attachedFile"
        :class="{ 'active': attachedFile }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
        </svg>
      </button>

      <textarea 
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        @keydown.enter.exact.prevent="send"
        placeholder="Message LocalMind..."
        rows="1"
      ></textarea>
      
      <button 
        class="send-btn" 
        @click="send" 
        :disabled="(!modelValue.trim() && !attachedFile) || isTyping"
      >
        Send
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps({
  modelValue: String,
  isTyping: Boolean
});

const emit = defineEmits(['update:modelValue', 'send-message', 'stop-generation']);
const textareaRef = ref(null);
const fileInputRef = ref(null);

// Stare locală pentru fișierul atașat (nu apare în textarea)
const attachedFile = ref(null); // { name: '...', content: '...' }

const handleInput = (e) => {
  emit('update:modelValue', e.target.value);
  adjustHeight();
};

const triggerFileUpload = () => {
  fileInputRef.value.click();
};

const handleFileUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    // Salvăm conținutul în variabila locală, NU în textarea
    attachedFile.value = {
      name: file.name,
      content: e.target.result
    };
    // Resetăm input-ul html pentru a permite re-selecția aceluiași fișier
    event.target.value = '';
  };
  reader.readAsText(file);
};

const removeAttachment = () => {
  attachedFile.value = null;
};

const send = () => {
  // Verificăm dacă avem ceva de trimis (text sau fișier)
  if ((!props.modelValue.trim() && !attachedFile.value) || props.isTyping) return;

  // 1. Construim mesajul final invizibil
  let finalMessage = props.modelValue || '';
  
  if (attachedFile.value) {
    const fileHeader = `\n\n--- Content of file: ${attachedFile.value.name} ---\n`;
    const fileFooter = `\n--- End of file ---\n`;
    
    // Dacă utilizatorul a scris ceva, adăugăm fișierul dedesubt.
    // Dacă nu a scris nimic, trimitem doar conținutul fișierului (poate cu un prefix generic dacă vrei).
    finalMessage = finalMessage.trim() 
      ? finalMessage + fileHeader + attachedFile.value.content + fileFooter
      : `Analyze this file: ${attachedFile.value.name}` + fileHeader + attachedFile.value.content + fileFooter;
  }

  // 2. Actualizăm modelul părintelui cu tot conținutul chiar înainte de trimitere
  emit('update:modelValue', finalMessage);
  
  // 3. Declanșăm trimiterea
  emit('send-message');

  // 4. Curățăm starea locală
  attachedFile.value = null;
  
  // Resetăm înălțimea textarea
  nextTick(() => {
    if (textareaRef.value) textareaRef.value.style.height = 'auto';
  });
};

const adjustHeight = () => {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  el.style.overflowY = el.scrollHeight > 200 ? 'auto' : 'hidden';
};
</script>

<style scoped>
.input-area-container { padding: 20px 10%; position: relative; background: transparent; display: flex; flex-direction: column; gap: 8px; }
.input-area { display: flex; gap: 10px; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #ddd; box-shadow: 0 5px 15px rgba(0,0,0,0.05); align-items: flex-end; }

textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; font-size: 1rem; color: inherit; line-height: 1.5; font-family: inherit; max-height: 200px; padding: 8px 0; }

.send-btn { background: #19c37d; color: white; border: none; padding: 0 16px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s; height: 40px; align-self: flex-end; }
.send-btn:hover:not(:disabled) { background: #15a569; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.7; }

/* STILURI UPLOAD */
.upload-btn {
  background: transparent;
  border: none;
  color: #8e8ea0;
  cursor: pointer;
  padding: 0;
  border-radius: 8px;
  transition: all 0.2s;
  height: 40px;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.upload-btn:hover:not(:disabled) { background: #ececf1; color: #333; }
.upload-btn:disabled { opacity: 0.3; cursor: default; }

/* ATTACHMENT BADGE - Stil nou */
.attachment-badge {
  align-self: flex-start;
  background: #f0f0f2;
  border: 1px solid #d9d9e3;
  border-radius: 6px;
  padding: 6px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #374151;
  animation: fadeIn 0.2s ease;
  margin-left: 10px; /* Aliniat ușor cu inputul */
}
.file-icon { font-size: 1.1em; }
.file-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.remove-file-btn { background: none; border: none; color: #6b7280; font-size: 1.1rem; cursor: pointer; padding: 0 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
.remove-file-btn:hover { color: #ef4444; background: rgba(0,0,0,0.05); }

.stop-btn { position: absolute; top: -50px; left: 50%; transform: translateX(-50%); background: #202123; color: white; border: 1px solid #565869; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; gap: 8px; align-items: center; z-index: 10; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.stop-icon { color: #ff6b6b; font-size: 10px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

/* Dark theme overrides */
:global(.dark-theme) .input-area { background: #40414f; border-color: #565869; box-shadow: none; }
:global(.dark-theme) .textarea { color: #525252 !important; caret-color: #ffffff; }
:global(.dark-theme) textarea::placeholder {color: #aaa;}
:global(.dark-theme) .upload-btn:hover:not(:disabled) { background: #565869; color: #ececec; }
:global(.dark-theme) .attachment-badge { background: #40414f; border-color: #565869; color: #ececec; }
:global(.dark-theme) .remove-file-btn { color: #aaa; }
:global(.dark-theme) .remove-file-btn:hover { color: #ff6b6b; background: rgba(255,255,255,0.1); }
</style>