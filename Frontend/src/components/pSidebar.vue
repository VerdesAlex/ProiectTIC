<template>
  <div 
    v-for="conv in conversations" 
    :key="conv.id" 
    class="history-item"
    @click="selectChat(conv.id)" 
  >
    <span class="conv-title">{{ conv.title || 'New Chat' }}</span>
    <button class="delete-icon" @click.stop="confirmDelete(conv.id)">🗑️</button>
  </div>
</template>

<script>
export default {
  name: 'Sidebar',
  // Definim 'conversations' ca prop pentru a primi datele de la Chat.vue
  props: {
    conversations: {
      type: Array,
      default: () => []
    }
  },
  methods: {
      selectChat(id) {
        // Schimbăm ruta: acest lucru va declanșa reactivitatea în Chat.vue
        this.$router.push({ name: 'ChatSession', params: { id } });
      },
      confirmDelete(id) {
        this.$emit('delete-conversation', id);
      }
  }
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  background-color: #202123;
  color: white;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sidebar-header { padding: 1rem; border-bottom: 1px solid #4d4d4f; }
.history-container {
  flex: 1;
  overflow-y: auto; /* Zona de scroll */
  padding: 0.5rem;
}
.history-item {
  padding: 0.8rem;
  margin-bottom: 0.5rem;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  transition: background 0.2s;
}
.history-item:hover { background: #2a2b32; }
.delete-icon { background: none; border: none; cursor: pointer; opacity: 0.6; }
.delete-icon:hover { opacity: 1; }
</style>