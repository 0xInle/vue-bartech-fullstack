import { api } from '@/api/api'
import AppAuth from '@/pages/auth/AppAuth.vue'
import AppLogin from '@/pages/auth/components/AppLogin.vue'
import AppRegister from '@/pages/auth/components/AppRegister.vue'
import AppHome from '@/pages/home/AppHome.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/',
      component: AppAuth,
      children: [
        { path: 'login', component: AppLogin, meta: { header: false } },
        { path: 'register', component: AppRegister, meta: { header: false } },
      ],
    },
    { path: '/home', component: AppHome, meta: { requiresAuth: true, footer: true, header: true } },
    {
      path: '/about',
      component: () => import('@/pages/about/AppAbout.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/tech',
      component: () => import('@/pages/tech/AppTech.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/restaurants',
      component: () => import('@/pages/restaurants/AppRestaurants.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/documents',
      component: () => import('@/pages/documents/AppDocuments.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/reports',
      component: () => import('@/pages/reports/AppReports.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/analytics',
      component: () => import('@/pages/analytics/AppAnalytics.vue'),
      meta: { requiresAuth: true, header: true },
    },
    {
      path: '/suppliers',
      component: () => import('@/pages/suppliers/AppSuppliers.vue'),
      meta: { requiresAuth: true, header: true },
    },
  ],
})

router.beforeEach(async (to, _, next) => {
  try {
    await api.get('/users/me')

    if (['/login', '/register'].includes(to.path)) {
      return next('/home')
    }

    next()
  } catch {
    if (to.meta.requiresAuth) {
      return next('/login')
    }

    next()
  }
})

export default router
