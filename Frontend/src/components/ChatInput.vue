<template>
  <div class="input-area-container">
    <button v-if="isTyping" class="stop-btn" @click="$emit('stop-generation')">
      <span class="stop-icon">■</span> Stop Generating
    </button>

    <div class="input-area">
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
        :disabled="!modelValue.trim() || isTyping"
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

const handleInput = (e) => {
  emit('update:modelValue', e.target.value);
  adjustHeight();
};

const send = () => {
  if (!props.modelValue.trim() || props.isTyping) return;
  emit('send-message');
  // Reset height after send
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
.input-area-container { padding: 20px 10%; position: relative; background: transparent; }
.input-area { display: flex; gap: 10px; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #ddd; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }

textarea { flex: 1; border: none; background: transparent; resize: none; outline: none; font-size: 1rem; color: inherit; line-height: 1.5; font-family: inherit; }
.send-btn { background: #19c37d; color: white; border: none; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
.send-btn:hover:not(:disabled) { background: #15a569; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; opacity: 0.7; }

.stop-btn { position: absolute; top: -50px; left: 50%; transform: translateX(-50%); background: #202123; color: white; border: 1px solid #565869; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: flex; gap: 8px; align-items: center; z-index: 10; font-size: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.stop-icon { color: #ff6b6b; font-size: 10px; }

/* Dark theme overrides */
:global(.dark-theme) .input-area { background: #40414f; border-color: #565869; box-shadow: none; }
</style>