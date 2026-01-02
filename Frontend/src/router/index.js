import { createRouter, createWebHashHistory } from 'vue-router'

// We will stick to lazy loading, but ensure the paths are correct
// The '@' alias is standard, but relative paths '../' are safer if config is unknown
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
    component: Chat
  },
  {
    path: '/chat/:id',
    name: 'ChatSession',
    component: Chat,
    props: true
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router