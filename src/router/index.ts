import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
    {
        path: '/login',
        name: 'login',
        component: () => import('../views/LoginView.vue'),
        meta: { guestOnly: true },
    },
    {
        path: '/register',
        name: 'register',
        component: () => import('../views/RegisterView.vue'),
        meta: { guestOnly: true },
    },
    {
        path: '/invitations/:token/accept',
        name: 'accept-invitation',
        component: () => import('../views/AcceptInvitationView.vue'),
        meta: { guestOnly: true },
    },
    {
        path: '/',
        component: () => import('../layouts/AppLayout.vue'),
        meta: { requiresAuth: true },
        children: [
            {
                path: '',
                redirect: '/dashboard',
            },
            {
                path: 'dashboard',
                name: 'dashboard',
                component: () => import('../views/DashboardView.vue'),
            },
            {
                path: 'schedule',
                name: 'schedule',
                component: () => import('../views/ScheduleView.vue'),
            },
            {
                path: 'swaps',
                name: 'swaps',
                component: () => import('../views/SwapsView.vue'),
            },
            {
                path: 'time-off',
                name: 'time-off',
                component: () => import('../views/TimeOffView.vue'),
            },
            {
                path: 'team',
                name: 'team',
                component: () => import('../views/TeamView.vue'),
            },
            {
                path: 'locations',
                name: 'locations',
                component: () => import('../views/LocationsView.vue'),
            },
            {
                path: 'settings',
                name: 'settings',
                component: () => import('../views/SettingsView.vue'),
            },
        ],
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/dashboard',
    },
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});

router.beforeEach(async (to, _from) => {
    const authStore = useAuthStore();

    if (!authStore.isInitialized) {
        await authStore.fetchUser();
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }

    if (to.meta.guestOnly && authStore.isAuthenticated) {
        return { name: 'dashboard' };
    }
});
