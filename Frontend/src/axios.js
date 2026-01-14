// src/axios.js
import axios from 'axios';
// Importăm instanța auth direct din fișierul tău de configurare
import { auth } from './firebase/config'; 

const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor pentru cereri
apiClient.interceptors.request.use(async (config) => {
  // Folosim instanța auth importată mai sus
  const user = auth.currentUser;
  
  if (user) {
    // Obținem token-ul utilizatorului logat
    const token = await user.getIdToken();
    // Îl adăugăm în header-ul Authorization pentru Backend (Render)
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;