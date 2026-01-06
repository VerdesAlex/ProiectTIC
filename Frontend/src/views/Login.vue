<template>
  <div class="login-view">
    <div class="background-glow"></div>

    <div class="login-container">
      <div class="brand-header">
        <div class="logo-icon">🧠</div>
        <h1>LocalMind</h1>
        <p class="subtitle">Your Private AI Workspace</p>
      </div>

      <div class="login-card">
        <div class="tabs">
          <button 
            :class="{ active: isLoginMode }" 
            @click="isLoginMode = true"
          >
            Login
          </button>
          <button 
            :class="{ active: !isLoginMode }" 
            @click="isLoginMode = false"
          >
            Sign Up
          </button>
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <div class="form-group">
            <label>Email</label>
            <input 
              v-model="email" 
              type="email" 
              placeholder="name@example.com" 
              required
              class="input-field"
            />
          </div>
          
          <div class="form-group">
            <label>Password</label>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              required
              class="input-field"
            />
          </div>

          <div v-if="error" class="error-message">
            ⚠️ {{ error }}
          </div>

          <button type="submit" :disabled="loading" class="submit-btn">
            <span v-if="loading" class="loader"></span>
            <span v-else>{{ isLoginMode ? 'Unlock Access' : 'Create Account' }}</span>
          </button>
        </form>
      </div>
      
      <p class="footer-text">Powered by Local AI & Firebase</p>
    </div>
  </div>
</template>

<script>
import { mapActions, mapGetters } from 'vuex';

export default {
  name: 'LoginView',
  data() {
    return {
      email: '',
      password: '',
      isLoginMode: true,
      loading: false
    }
  },
  computed: {
    ...mapGetters('auth', ['authError']),
    error() {
      return this.authError;
    }
  },
  methods: {
    ...mapActions('auth', ['login', 'signup']),
    
    async handleSubmit() {
      this.loading = true;
      const action = this.isLoginMode ? 'login' : 'signup';
      
      const success = await this[action]({
        email: this.email,
        password: this.password
      });

      if (success) {
        this.$router.push('/chat');
      }
      this.loading = false;
    }
  }
}
</script>

<style scoped>
* { box-sizing: border-box; }

.login-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #343541;
  color: #fff;
  position: relative;
  overflow: hidden;
}

/* Glow Effect */
.background-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at center, rgba(66, 185, 131, 0.1) 0%, transparent 50%);
  animation: pulse 10s infinite ease-in-out;
  pointer-events: none;
}

@keyframes pulse {
  0% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 0.5; }
}

.login-container {
  width: 100%;
  max-width: 420px;
  z-index: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.brand-header { text-align: center; }

.logo-icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

h1 { font-size: 2rem; font-weight: 700; margin: 0; }
.subtitle { color: #8e8ea0; margin-top: 0.5rem; font-size: 1rem; }

.login-card {
  background: #202123;
  border: 1px solid #4d4d4f;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.tabs {
  display: flex;
  border-bottom: 2px solid #343541;
  margin-bottom: 1.5rem;
}

.tabs button {
  flex: 1;
  background: none;
  border: none;
  padding: 10px;
  color: #8e8ea0;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s;
  border-bottom: 2px solid transparent;
}

.tabs button.active { color: #fff; border-bottom: 2px solid #42b983; }

.form-group { margin-bottom: 1.2rem; text-align: left; }
label { display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: #c5c5d2; }

.input-field {
  width: 100%;
  padding: 0.85rem 1rem;
  background-color: #343541;
  border: 1px solid #565869;
  border-radius: 6px;
  color: white;
  font-size: 1rem;
}
.input-field:focus { outline: none; border-color: #42b983; }

.error-message {
  background: rgba(220, 53, 69, 0.1);
  color: #ff6b6b;
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  border: 1px solid rgba(220, 53, 69, 0.2);
}

.submit-btn {
  width: 100%;
  padding: 0.9rem;
  background: linear-gradient(135deg, #42b983 0%, #3aa876 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.submit-btn:hover:not(:disabled) { transform: translateY(-1px); }
.submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

.footer-text { text-align: center; color: #565869; font-size: 0.8rem; margin-top: 1rem; }

.loader {
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}
@keyframes rotation { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>