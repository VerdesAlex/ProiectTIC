import { createRouter, createWebHistory } from 'vue-router'


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
    component: Login
  },
  {
    path: '/chat',
    name: 'Chat',
    component: Chat,
    // Children routes could be added here, but for now 
    // we handle the ID via the same component logic or prop
  },
  {
    path: '/chat/:id',
    name: 'ChatSession',
    component: Chat,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [],
})

export default router
