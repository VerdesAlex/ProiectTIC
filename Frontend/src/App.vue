<template>
  <div class="app-wrapper">
    <ChatLayout 
      v-if="user" 
      :userEmail="user.email" 
      :userId="user.uid" 
      @logout="handleLogout"
    />
    
    <AuthTest v-else />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { authService } from './firebase/authService';
import AuthTest from './components/AuthTest.vue';
import ChatLayout from './components/ChatLayout.vue';

const user = ref(null);

onMounted(() => {
  authService.onAuthChange((currentUser) => {
    user.value = currentUser;
  });
});

const handleLogout = async () => {
  await authService.logout();
  user.value = null;
};
</script>

<style>
/* Reset body styles for full screen app */
body, html { margin: 0; padding: 0; height: 100%; }
.app-wrapper { height: 100vh; }
</style>