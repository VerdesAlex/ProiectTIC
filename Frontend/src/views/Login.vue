<template>
  <div class="login-view">
    <div class="login-card">
      <h1>Welcome to LocalMind</h1>
      <p>Phase 1: Frontend Setup</p>
      <button @click="handleLogin">Enter Chat</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LoginView',
  methods: {
    handleLogin() {
      // Navigate to the chat route programmatically
      this.$router.push('/chat');
    }
  }
}
</script>

<style scoped>
.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}
.login-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  text-align: center;
}
button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #3aa876;
}
</style>