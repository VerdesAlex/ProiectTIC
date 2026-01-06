<template>
  <div class="auth-test">
    <h2>LocalMind Auth Test</h2>
    
    <div v-if="!user">
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <button @click="handleSignUp">Sign Up</button>
      <button @click="handleLogin">Login</button>
    </div>

    <div v-else>
      <p>Logged in as: <strong>{{ user.email }}</strong></p>
      <button @click="handleLogout">Logout</button>
    </div>

    <p v-if="error" style="color: red;">{{ error }}</p>
  </div>
  
  </template>


<script setup>
import { ref, onMounted } from 'vue';
import { authService } from '../firebase/authService';
import { auth } from '../firebase/config';

const email = ref('');
const password = ref('');
const user = ref(null);
const error = ref('');
const API_URL = import.meta.env.VITE_API_URL;


// Check if user is already logged in when component loads
onMounted(() => {
  authService.onAuthChange((currentUser) => {
    // Ensure this says .value, NOT .ref
    user.value = currentUser; 
    console.log("Auth State Changed. Current User:", currentUser?.email);
  });
});

const handleSignUp = async () => {
  try {
    error.value = '';
    user.value = await authService.signUp(email.value, password.value);
  } catch (err) {
    error.value = err;
  }
};

const handleLogin = async () => {
  try {
    error.value = '';
    user.value = await authService.login(email.value, password.value);
  } catch (err) {
    error.value = err;
  }
};

const handleLogout = async () => {
  await authService.logout();
  user.value = null;
};
</script>