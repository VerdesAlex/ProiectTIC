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
      
      <div class="user-profile-section">
        <div class="avatar-wrapper" @click="triggerFileInput" title="Schimbă poza de profil">
          <img 
            v-if="userPhotoURL" 
            :src="userPhotoURL" 
            alt="User Avatar" 
            class="user-avatar-img"
          />
          <div v-else class="user-avatar-placeholder">
            {{ userEmail?.[0]?.toUpperCase() || 'U' }}
          </div>
          
          <div class="avatar-overlay">📷</div>
        </div>

        <div class="user-details">
          <div class="user-info">{{ userEmail }}</div>
          <button @click="$emit('logout')" class="logout-link">Logout</button>
        </div>
      </div>

      <input 
        type="file" 
        ref="fileInput" 
        accept="image/*" 
        class="hidden-input"
        @change="handleFileUpload"
      />
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
import { PRESET_PROMPTS, DEFAULT_AI_NAME } from '@/config/prompts';

const props = defineProps({
  history: Array,
  currentChatId: String,
  isDark: Boolean,
  userEmail: String
});

const emit = defineEmits(['create-chat', 'select-chat', 'delete-chat', 'toggle-theme', 'logout']);
const store = useStore();

// --- STATE CĂUTARE ---
const searchQuery = ref('');
let debounceTimer = null;

const handleSearch = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    store.dispatch('chat/fetchSessions', searchQuery.value);
  }, 300);
};

// --- LOGICA AVATAR (ZERO COST / BASE64) ---
const fileInput = ref(null);

// Luăm poza direct din Vuex (auth module)
const userPhotoURL = computed(() => store.state.auth.user?.photoURL);

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click();
  }
};

/**
 * Procesează imaginea: Resize + Conversie la Base64
 * Esențial pentru a nu depăși limita Firestore de 1MB per document
 */
const processImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 150; // Dimensiune mică, perfectă pentru avatar
        const MAX_HEIGHT = 150;
        let width = img.width;
        let height = img.height;

        // Calculăm noile dimensiuni păstrând aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Returnăm imaginea ca string Base64 (JPEG, calitate 0.8)
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Validare tip fișier
  if (!file.type.startsWith('image/')) {
    alert('Te rog încarcă o imagine validă.');
    return;
  }

  try {
    // 1. Convertim și redimensionăm imaginea local
    const base64Image = await processImage(file);
    
    // 2. Trimitem string-ul la Store -> Firestore
    await store.dispatch('auth/updateAvatar', base64Image);
  } catch (err) {
    console.error("Eroare la procesarea imaginii:", err);
    alert("Nu am putut procesa imaginea. Încearcă alta.");
  }
  
  // Resetăm input-ul pentru a permite re-încărcarea aceluiași fișier
  event.target.value = '';
};

// --- STATE MODAL ---
const showNewChatModal = ref(false);
const newChatData = ref({
  aiName: DEFAULT_AI_NAME,
  selectedPersonaId: 'standard',
  customPrompt: ''
});

const isFormValid = computed(() => {
  if (newChatData.value.selectedPersonaId === 'custom') {
    return newChatData.value.customPrompt.trim().length > 0;
  }
  return true;
});

const closeModal = () => {
  showNewChatModal.value = false;
  newChatData.value = {
    aiName: DEFAULT_AI_NAME,
    selectedPersonaId: 'standard',
    customPrompt: ''
  };
};

const confirmNewChat = () => {
  let finalPrompt = '';
  if (newChatData.value.selectedPersonaId === 'custom') {
    finalPrompt = newChatData.value.customPrompt;
  } else {
    const preset = PRESET_PROMPTS.find(p => p.id === newChatData.value.selectedPersonaId);
    finalPrompt = preset ? preset.content : '';
  }

  emit('create-chat', {
    systemPrompt: finalPrompt,
    aiName: newChatData.value.aiName || DEFAULT_AI_NAME
  });

  closeModal();
};
</script>

<style scoped>
.sidebar { width: 260px; background: #202123; color: white; display: flex; flex-direction: column; padding: 15px; border-right: 1px solid #ddd; }
.dark-theme .sidebar { border-right: 1px solid #4d4d4f; }

.new-chat-btn { width: 100%; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid #4d4d4f; color: white; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: 0.2s; }
.new-chat-btn:hover { background: rgba(255,255,255,0.2); }

/* Căutare */
.search-container { margin-bottom: 15px; }
.search-input { width: 90%; padding: 8px; background: #343541; border: 1px solid #555; border-radius: 5px; color: white; font-size: 0.9rem; }
.search-input:focus { outline: none; border-color: #888; }
.empty-state { font-size: 0.8rem; color: #888; text-align: center; margin-top: 10px; }

/* Istoric */
.history-list { flex: 1; overflow-y: auto; }
.history-item { padding: 10px; cursor: pointer; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; color: #ececec; margin-bottom: 2px;}
.history-item:hover { background: #2a2b32; }
.history-item.active { background: #343541; border: 1px solid #555; }
.chat-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; padding-right: 5px; }
.delete-btn { background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; line-height: 1; opacity: 0.6; }
.delete-btn:hover { color: #ff4d4d; opacity: 1; }

/* Footer & Avatar */
.user-footer { padding-top: 15px; border-top: 1px solid #4d4d4f; font-size: 0.9rem; }
.theme-switch { cursor: pointer; padding: 5px; margin-bottom: 8px; opacity: 0.8; user-select: none; }
.theme-switch:hover { opacity: 1; }

.user-profile-section { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.user-details { overflow: hidden; display: flex; flex-direction: column; justify-content: center;}
.user-info { font-size: 0.85rem; color: #aaa; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
.logout-link { color: #ff6b6b; background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; text-align: left; font-size: 0.8rem;}

.avatar-wrapper {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  border: 2px solid #555;
  background: #343541;
}

.user-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.user-avatar-placeholder { width: 100%; height: 100%; background: #5c7cfa; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.1rem; }

.avatar-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
  font-size: 1.2rem;
}
.avatar-wrapper:hover .avatar-overlay { opacity: 1; }
.hidden-input { display: none; }

/* Modal */
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px); }
.modal-content { background: #202123; padding: 25px; border-radius: 10px; width: 400px; max-width: 90%; border: 1px solid #4d4d4f; box-shadow: 0 10px 25px rgba(0,0,0,0.5); color: white; }
.modal-content h3 { margin-top: 0; margin-bottom: 20px; text-align: center; }
.form-group { margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-size: 0.9rem; color: #ccc; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 8px; background: #343541; border: 1px solid #555; border-radius: 5px; color: white; font-family: inherit; }
.form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #19c37d; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
.cancel-btn { background: transparent; border: 1px solid #555; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; }
.cancel-btn:hover { background: #343541; }
.ok-btn { background: #19c37d; border: none; color: white; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; }
.ok-btn:hover:not(:disabled) { background: #15a569; }
.ok-btn:disabled { opacity: 0.5; cursor: not-allowed; background: #555; }
</style>