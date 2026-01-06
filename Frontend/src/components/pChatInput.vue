<template>
  <div class="chat-input-container">
    <div class="input-wrapper">
      <input type="text" placeholder="Type a message..." @keyup.enter="send" v-model="text" />
      <button @click="send">Send</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatInput',
  data() {
    return {
      text: '' // Aceasta este proprietatea cerută de v-model
    }
  },
  methods: {
    send() {
      if (this.text.trim() === '') return;
      
      // Trimitem mesajul către părinte
      this.$emit('send-message', this.text);
      
      // Resetăm câmpul de input
      this.text = '';
    }
  }
}
</script>

<style scoped>
.chat-input-container {
  padding: 1.5rem;
  border-top: 1px solid #eee;
  background: white;
}
.input-wrapper {
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  gap: 10px;
}
input { flex: 1; padding: 0.8rem; border: 1px solid #ddd; border-radius: 5px; }
button { padding: 0.8rem 1.5rem; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
</style>