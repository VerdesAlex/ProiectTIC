<template>
  <aside class="sidebar">
    <button @click="showNewChatModal = true" class="new-chat-btn">+ New Chat</button>
    
    <div class="search-container">
      <input 
        type="text" 
        v-model="searchQuery" 
        @input="handleSearch" 
        placeholder="Caută conversații..." 
        class="search-input"
      />
    </div>

    <div class="history-list">
      <div v-if="history.length === 0" class="empty-state">
        {{ searchQuery ? 'Niciun rezultat găsit' : 'Nu există conversații' }}
      </div>

      <div 
        v-for="chat in history" 
        :key="chat.id" 
        @click="$emit('select-chat', chat.id)"
        :class="['history-item', { active: currentChatId === chat.id }]"
      >
        <span class="chat-title">{{ chat.title || 'Conversation' }}</span>
        <button class="delete-btn" @click.stop="$emit('delete-chat', chat.id)" title="Delete Chat">×</button>
      </div>
    </div>

    <div class="user-footer">
      <div class="theme-switch" @click="$emit('toggle-theme')">
        <span>{{ isDark ? '🌙 Dark Mode' : '☀️ Light Mode' }}</span>
      </div>
      <div class="user-info">{{ userEmail }}</div>
      <button @click="$emit('logout')" class="logout-link">Logout</button>
    </div>

    <div v-if="showNewChatModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Create New Persona</h3>
        
        <div class="form-group">
          <label>AI Name:</label>
          <input type="text" v-model="newChatData.aiName" placeholder="ex: LocalMindAI" />
        </div>

        <div class="form-group">
          <label>Personality:</label>
          <select v-model="newChatData.selectedPersonaId">
            <option v-for="p in PRESET_PROMPTS" :key="p.id" :value="p.id">
              {{ p.label }}
            </option>
          </select>
        </div>

        <div v-if="newChatData.selectedPersonaId === 'custom'" class="form-group">
          <label>Custom System Prompt:</label>
          <textarea 
            v-model="newChatData.customPrompt" 
            placeholder="Definește aici regulile AI-ului..."
            rows="4"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeModal">Cancel</button>
          <button 
            class="ok-btn" 
            @click="confirmNewChat" 
            :disabled="!isFormValid"
          >
            Create Chat
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useStore } from 'vuex';
import { PRESET_PROMPTS, DEFAULT_AI_NAME } from '@/config/prompts'; // Importăm config-ul

defineProps({
  history: Array,
  currentChatId: String,
  isDark: Boolean,
  userEmail: String
});

const emit = defineEmits(['create-chat', 'select-chat', 'delete-chat', 'toggle-theme', 'logout']);
const store = useStore();
const searchQuery = ref('');
let debounceTimer = null;

// --- STATE PENTRU MODAL ---
const showNewChatModal = ref(false);
const newChatData = ref({
  aiName: DEFAULT_AI_NAME,
  selectedPersonaId: 'standard',
  customPrompt: ''
});

// Validare buton OK
const isFormValid = computed(() => {
  // Dacă e Custom, text box-ul nu trebuie să fie gol
  if (newChatData.value.selectedPersonaId === 'custom') {
    return newChatData.value.customPrompt.trim().length > 0;
  }
  return true;
});

const closeModal = () => {
  showNewChatModal.value = false;
  // Reset la valori default
  newChatData.value = {
    aiName: DEFAULT_AI_NAME,
    selectedPersonaId: 'standard',
    customPrompt: ''
  };
};

const confirmNewChat = () => {
  // 1. Determinăm System Prompt-ul final
  let finalPrompt = '';
  if (newChatData.value.selectedPersonaId === 'custom') {
    finalPrompt = newChatData.value.customPrompt;
  } else {
    const preset = PRESET_PROMPTS.find(p => p.id === newChatData.value.selectedPersonaId);
    finalPrompt = preset ? preset.content : '';
  }

  // 2. Emitem evenimentul cu obiect complex
  emit('create-chat', {
    systemPrompt: finalPrompt,
    aiName: newChatData.value.aiName || DEFAULT_AI_NAME
  });

  closeModal();
};

const handleSearch = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.dispatch('chat/fetchSessions', searchQuery.value);
  }, 300);
};
</script>

<style scoped>
.sidebar { width: 260px; background: #202123; color: white; display: flex; flex-direction: column; padding: 15px; border-right: 1px solid #ddd; }
.dark-theme .sidebar { border-right: 1px solid #4d4d4f; }

.persona-selector { margin-bottom: 10px; }
.persona-label { font-size: 0.8rem; color: #8e8ea0; margin-bottom: 4px; display: block; }
.persona-select { 
  width: 100%; 
  padding: 8px; 
  background: #343541; 
  color: white; 
  border: 1px solid #555; 
  border-radius: 5px; 
  cursor: pointer; 
}
.persona-select:focus { outline: none; border-color: #19c37d; }

.new-chat-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid #4d4d4f; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: 0.2s; }
.new-chat-btn:hover { background: rgba(255,255,255,0.2); }

/* [NOU] Stiluri pentru bara de căutare */
.search-container { margin-bottom: 15px; }
.search-input {
  width: 90%;
  padding: 8px;
  background: #343541;
  border: 1px solid #555;
  border-radius: 5px;
  color: white;
  font-size: 0.9rem;
}
.search-input:focus { outline: none; border-color: #888; }
.empty-state { font-size: 0.8rem; color: #888; text-align: center; margin-top: 10px; }

.history-list { flex: 1; overflow-y: auto; }
/* Restul stilurilor rămân la fel */
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

/* === STILURI MODAL === */
.modal-overlay {
  position: fixed; /* Fix pe tot ecranul */
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.7); /* Fundal întunecat transparent */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* Deasupra la orice */
  backdrop-filter: blur(2px);
}

.modal-content {
  background: #202123;
  padding: 25px;
  border-radius: 10px;
  width: 400px;
  max-width: 90%;
  border: 1px solid #4d4d4f;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  color: white;
}

.modal-content h3 { margin-top: 0; margin-bottom: 20px; text-align: center; }

.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-size: 0.9rem; color: #ccc; }
.form-group input, 
.form-group select, 
.form-group textarea {
  width: 100%;
  padding: 8px;
  background: #343541;
  border: 1px solid #555;
  border-radius: 5px;
  color: white;
  font-family: inherit;
}
.form-group input:focus, .form-group textarea:focus, .form-group select:focus {
  outline: none; border-color: #19c37d;
}

.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.cancel-btn { background: transparent; border: 1px solid #555; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; }
.cancel-btn:hover { background: #343541; }

.ok-btn { background: #19c37d; border: none; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.ok-btn:hover:not(:disabled) { background: #15a569; }
.ok-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #555; }
</style>