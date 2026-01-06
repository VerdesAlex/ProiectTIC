import { createRouter, createWebHashHistory } from 'vue-router'
import store from '../store'
import { authService } from '../firebase/authService'
import { auth } from '../firebase/config' // Avem nevoie de asta pentru obiectul user complet

const Login = () => import('../views/Login.vue')
const Chat = () => import('../views/Chat.vue')

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    beforeEnter: (to, from, next) => {
      // Dacă ești deja logat, nu te lasă să vezi Login, te trimite la Chat
      if (store.getters['auth/isAuthenticated']) {
        next('/chat');
      } else {
        next();
      }
    }
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat/:id',
    name: 'ChatSession',
    component: Chat,
    props: true,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// --- AICI ESTE MAGIA ---
router.beforeEach(async (to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = store.getters['auth/isAuthenticated'];

  // Cazul 1: Ruta protejată și nu știm încă dacă e logat
  if (requiresAuth && !isAuthenticated) {
    // Așteptăm ca Firebase să ne zică statusul (folosind funcția ta existentă)
    const token = await authService.getToken(); 
    
    if (token) {
      // E logat! Trebuie să actualizăm Store-ul manual aici, 
      // pentru că main.js nu o mai face.
      store.commit('auth/SET_TOKEN', token);
      store.commit('auth/SET_USER', auth.currentUser);
      next(); // Permite navigarea
    } else {
      // Nu e logat, la revedere
      next('/login');
    }
  } 
  // Cazul 2: Ruta publică sau deja autentificat
  else {
    next();
  }
});

export default router