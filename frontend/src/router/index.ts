import { api } from '@/api/api'
import AppRegister from '@/pages/auth/AppRegister.vue'
import AppHome from '@/pages/home/AppHome.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', component: AppRegister, meta: { header: false } },
    { path: '/', component: AppHome, meta: { requiresAuth: true, footer: true, header: true } },
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

router.beforeEach(async (to, from, next) => {
  console.log('guard start', to.path)
  try {
    await api.get('/users/me')
    console.log('user authenticated')

    if (to.path === '/login') {
      console.log('redirecting to /')
      return next('/')
    }

    if (to.meta.requiresAuth) {
      return next()
    }

    next()
  } catch {
    if (to.meta.requiresAuth) {
      console.log('not authenticated')
      return next('/login')
    }

    next()
  }
})

export default router
