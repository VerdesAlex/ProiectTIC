// src/axios.js
import axios from 'axios';
import store from './store';
const API_URL = import.meta.env.VITE_API_URL;

// Setează URL-ul de bază al backend-ului tău (ajustează portul dacă e necesar)
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor pentru cereri (Request Interceptor)
apiClient.interceptors.request.use(
  config => {
    // Luăm token-ul din Vuex Store
    const token = store.getters['auth/isAuthenticated'] ? store.state.auth.token : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

export default apiClient;