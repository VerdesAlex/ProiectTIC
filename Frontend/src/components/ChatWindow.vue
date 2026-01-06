<template>
  <div class="chat-window">
    <div class="messages-scroll-area">
      <div v-for="msg in messages" :key="msg.id" :class="['message', msg.role]">
        <div class="content">
          {{ msg.content }}
        </div>
      </div>
      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatWindow',
  props: {
    messages: { type: Array, default: () => [] }
  }
}
</script>

<style scoped>
.chat-window {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.messages-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.message { max-width: 80%; padding: 1rem; border-radius: 10px; }
.message.user { align-self: flex-end; background: #007bff; color: white; }
.message.assistant { align-self: flex-start; background: #f4f4f9; color: #333; }
</style>