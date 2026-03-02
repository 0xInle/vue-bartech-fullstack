import AppAbout from '@/pages/about/AppAbout.vue'
import AppAnalytics from '@/pages/analytics/AppAnalytics.vue'
import AppDocuments from '@/pages/documents/AppDocuments.vue'
import AppHome from '@/pages/home/AppHome.vue'
import AppReports from '@/pages/reports/AppReports.vue'
import AppRestaurants from '@/pages/restaurants/AppRestaurants.vue'
import AppSuppliers from '@/pages/suppliers/AppSuppliers.vue'
import AppTech from '@/pages/tech/AppTech.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: AppHome, meta: { footer: true } },
    { path: '/about', component: AppAbout },
    { path: '/tech', component: AppTech },
    { path: '/restaurants', component: AppRestaurants },
    { path: '/documents', component: AppDocuments },
    { path: '/reports', component: AppReports },
    { path: '/analytics', component: AppAnalytics },
    { path: '/suppliers', component: AppSuppliers },
  ],
})

export default router
