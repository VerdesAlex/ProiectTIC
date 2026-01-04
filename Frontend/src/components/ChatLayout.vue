<template>
  <div class="chat-container">
    <aside class="sidebar">
      <button @click="createNewChat" class="new-chat-btn">+ New Chat</button>
      <div class="history-list">
        <div 
          v-for="chat in history" 
          :key="chat.id" 
          @click="selectChat(chat.id)"
          :class="['history-item', { active: currentChatId === chat.id }]"
        >
          <span class="chat-title">{{ chat.title || 'Untitled Chat' }}</span>
          
          <button 
            class="delete-btn" 
            @click.stop="handleDelete(chat.id)"
            title="Delete Chat"
          >
            ×
          </button>
        </div>
      </div>
      <div class="user-footer">
        <span>{{ userEmail }}</span>
        <button @click="$emit('logout')" class="logout-link">Logout</button>
      </div>
    </aside>

    <main class="chat-main">
      <div class="messages-display" ref="scrollBox">
        <div v-if="messages.length === 0" class="empty-state">
          <h3>How can LocalMind help you today?</h3>
        </div>
        
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['message-bubble', msg.role]"
        >
          <div class="bubble-content">{{ msg.content }}</div>
        </div>
        
        <div v-if="isTyping" class="message-bubble assistant">
          <div class="bubble-content typing-dots">LocalMind is thinking...</div>
        </div>
      </div>

      <div class="input-area">
        <textarea 
          v-model="userInput" 
          @keyup.enter.exact.prevent="sendMessage"
          placeholder="Type your message..."
          rows="1"
        ></textarea>
        <button @click="sendMessage" :disabled="!userInput.trim() || isTyping">
          Send
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { chatService } from '../firebase/chatService';
import { auth } from '../firebase/config';

const props = defineProps(['userEmail', 'userId']);
const emit = defineEmits(['logout']);

const userInput = ref('');
const messages = ref([]);
const history = ref([]);
const currentChatId = ref(null);
const isTyping = ref(false);
const scrollBox = ref(null);

// Placeholder for fetching history (We will connect this to Firestore next)
const fetchHistory = async () => {
  try {
    history.value = await chatService.getUserConversations(props.userId);
  } catch (err) {
    console.error("Failed to fetch history:", err);
  }
};

// Call it when the component loads
onMounted(() => {
  fetchHistory();
});

const scrollToBottom = async () => {
  await nextTick();
  if (scrollBox.value) {
    scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  }
};

const sendMessage = async () => {
  if (!userInput.value.trim()) return;

  const text = userInput.value;
  userInput.value = '';
  
  // 1. Add User message to UI
  messages.value.push({ role: 'user', content: text });
  await scrollToBottom();

  // 2. Trigger "Thinking" state
  isTyping.ref = true;

  // TODO: Here is where we will call your Express Backend
  // For now, let's simulate a delay
  const assistantMsgIndex = messages.value.push({ role: 'assistant', content: '' }) - 1;

  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, conversationId: currentChatId.value })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // GUARD: Only append if data.content is not null/undefined
            if (data.content) {
              messages.value[assistantMsgIndex].content += data.content;
              scrollToBottom();
            }
          } catch (e) {
            // Logic for when the stream sends "done" signal
            if (line.includes('"done":true')) {
              console.log("Stream finished successfully");
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Stream error:", err);
    // Only show error if we haven't received any content yet
    if (messages.value[assistantMsgIndex].content === '') {
      messages.value[assistantMsgIndex].content = "Error connecting to AI.";
    }
  } finally {
    isTyping.value = false;
  }
};
const createNewChat = () => {
  messages.value = [];
  currentChatId.value = null;
};

const selectChat = async (id) => {
  currentChatId.value = id;
  messages.value = []; // Clear current screen while loading
  isTyping.value = true;
  
  try {
    // 1. Fetch messages from Firestore using our service
    const fetchedMessages = await chatService.getChatMessages(id);
    
    // 2. Map them to the format our UI expects (role and content)
    messages.value = fetchedMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    await scrollToBottom();
  } catch (err) {
    console.error("Error loading chat:", err);
  } finally {
    isTyping.value = false;
  }
};

const handleDelete = async (id) => {
if (!confirm("Delete this conversation?")) return;
  try {
    const token = await auth.currentUser.getIdToken();
    await chatService.deleteConversation(id, token); // Now calls the backend
    
    history.value = history.value.filter(c => c.id !== id);
    if (currentChatId.value === id) {
      messages.value = [];
      currentChatId.value = null;
    }
  } catch (err) {
    console.error("Delete failed:", err);
  }
};

</script>

<style scoped>
.chat-container { display: flex; height: 100vh; background: #f9f9f9; }

.sidebar { 
  width: 260px; background: #202123; color: white; 
  display: flex; flex-direction: column; padding: 15px;
}

.new-chat-btn {
  border: 1px solid #4d4d4f; background: transparent; color: white;
  padding: 10px; border-radius: 5px; cursor: pointer; margin-bottom: 20px;
}

.history-list { flex: 1; overflow-y: auto; }
.history-item {
  display: flex;
  justify-content: space-between; /* Pushes the X to the end */
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
  position: relative;
  color: #ececec;
}

.history-item:hover {
  background: #2a2b32;
}

.history-item.active {
  background: #343541;
}

.chat-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 10px;
}

/* The "×" button styling */
.delete-btn {
  background: transparent;
  border: none;
  color: #666;
  font-size: 1.2rem;
  padding: 0 5px;
  cursor: pointer;
  opacity: 0; /* Hidden by default */
  transition: opacity 0.2s, color 0.2s;
}

/* Show the X only when hovering the row */
.history-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  color: #ff4d4d; /* Turns red on hover */
}

.chat-main { flex: 1; display: flex; flex-direction: column; position: relative; }

.messages-display { 
  flex: 1; overflow-y: auto; padding: 40px 15%; 
  display: flex; flex-direction: column; gap: 20px;
}

.message-bubble { display: flex; max-width: 80%; }
.message-bubble.user { align-self: flex-end; }
.message-bubble.assistant { align-self: flex-start; }

.bubble-content { 
  padding: 12px 16px; border-radius: 15px; font-size: 1rem; line-height: 1.5;
}
.user .bubble-content { background: #007bff; color: white; border-bottom-right-radius: 2px; }
.assistant .bubble-content { background: #e9e9eb; color: #333; border-bottom-left-radius: 2px; }

.input-area { 
  padding: 20px 15%; background: white; border-top: 1px solid #eee;
  display: flex; gap: 10px;
}

textarea { 
  flex: 1; border: 1px solid #ddd; border-radius: 5px; padding: 10px;
  resize: none; outline: none; font-family: inherit;
}

button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
button:disabled { background: #ccc; }

.user-footer { border-top: 1px solid #4d4d4f; padding-top: 10px; font-size: 0.8rem; }
.logout-link { background: none; color: #ff4d4d; border: none; padding: 0; margin-left: 10px; cursor: pointer; }
</style>