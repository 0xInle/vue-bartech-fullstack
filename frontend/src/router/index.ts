import AppAbout from '@/components/pages/about/AppAbout.vue'
import AppAnalytics from '@/components/pages/analytics/AppAnalytics.vue'
import AppDocuments from '@/components/pages/documents/AppDocuments.vue'
import AppHome from '@/components/pages/home/AppHome.vue'
import AppReports from '@/components/pages/reports/AppReports.vue'
import AppRestaurants from '@/components/pages/restaurants/AppRestaurants.vue'
import AppSuppliers from '@/components/pages/suppliers/AppSuppliers.vue'
import AppTech from '@/components/pages/tech/AppTech.vue'
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
