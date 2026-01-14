// src/axios.js
import axios from 'axios';
import store from './store';
import auth from './firebase/mauth';
const API_URL = import.meta.env.VITE_API_URL;

// Setează URL-ul de bază al backend-ului tău (ajustează portul dacă e necesar)
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor pentru cereri (Request Interceptor)
apiClient.interceptors.request.use(async (config) => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;