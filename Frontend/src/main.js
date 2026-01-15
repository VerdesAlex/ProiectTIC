import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import { auth } from './firebase/config'
import { onAuthStateChanged } from 'firebase/auth'

let app

// Așteptăm ca Firebase să ne zică dacă userul e logat sau nu
onAuthStateChanged(auth, async (user) => {
  
  if (user) {
    // Dacă e logat, forțăm încărcarea profilului extins (Avatar) din Firestore
    console.log("User detectat în main.js. Se încarcă profilul...");
    await store.dispatch('auth/fetchUser', user);
  } else {
    store.commit('auth/RESET_AUTH');
  }

  // Montăm aplicația DOAR după ce știm starea userului
  if (!app) {
    app = createApp(App)
    app.use(store)
    app.use(router)
    app.mount('#app')
  }
})
