<template>
  <aside class="sidebar">
    <button @click="$emit('create-chat')" class="new-chat-btn">+ New Chat</button>
    
    <div class="history-list">
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
  </aside>
</template>

<script setup>
defineProps({
  history: Array,
  currentChatId: String,
  isDark: Boolean,
  userEmail: String
});

defineEmits(['create-chat', 'select-chat', 'delete-chat', 'toggle-theme', 'logout']);
</script>

<style scoped>
.sidebar { width: 260px; background: #202123; color: white; display: flex; flex-direction: column; padding: 15px; border-right: 1px solid #ddd; }
.dark-theme .sidebar, .sidebar { border-right: 1px solid #4d4d4f; } /* Fallback pt dark mode controlat de parinte */

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
</style>