import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

function getRoleHomePath(role?: string | null): string {
    if (role === 'manager') {
        return '/operations-console';
    }
    if (role === 'staff') {
        return '/staff-schedule';
    }
    return '/executive-command';
}

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
                redirect: () => {
                    const authStore = useAuthStore();
                    return getRoleHomePath(authStore.role);
                },
            },
            // =================================================================
            // OWNER-ONLY PAGES (Strict role: owner)
            // =================================================================
            {
                path: 'executive-command',
                name: 'executive-command',
                component: () => import('../views/ExecutiveCommandView.vue'),
                meta: { roles: ['owner'] },
            },
            {
                path: 'master-benefits-and-policy',
                name: 'master-benefits-and-policy',
                component: () => import('../views/MasterBenefitsPolicyView.vue'),
                meta: { roles: ['owner'] },
            },
            {
                path: 'executive-payroll-tape',
                name: 'executive-payroll-tape',
                component: () => import('../views/ExecutivePayrollTapeView.vue'),
                meta: { roles: ['owner'] },
            },
            {
                path: 'inter-store-floaters',
                name: 'inter-store-floaters',
                component: () => import('../views/InterStoreFloatersView.vue'),
                meta: { roles: ['owner'] },
            },
            {
                path: 'store-managers-and-delegation',
                name: 'store-managers-and-delegation',
                component: () => import('../views/ManagersDelegationView.vue'),
                meta: { roles: ['owner'] },
            },
            {
                path: 'financial-and-labor-audit',
                name: 'financial-and-labor-audit',
                component: () => import('../views/FinancialLaborAuditView.vue'),
                meta: { roles: ['owner'] },
            },
            // =================================================================
            // MANAGER & OWNER PAGES (Strict roles: owner, manager)
            // =================================================================
            {
                path: 'operations-console',
                name: 'operations-console',
                component: () => import('../views/DashboardView.vue'),
                meta: { roles: ['owner', 'manager'] },
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
                path: 'team',
                name: 'team',
                component: () => import('../views/TeamView.vue'),
                meta: { roles: ['owner', 'manager'] },
            },
            {
                path: 'locations',
                name: 'locations',
                component: () => import('../views/LocationsView.vue'),
                meta: { roles: ['owner', 'manager'] },
            },
            {
                path: 'settings',
                name: 'settings',
                component: () => import('../views/SettingsView.vue'),
                meta: { roles: ['owner', 'manager'] },
            },
            // =================================================================
            // STAFF & SHARED PAGES
            // =================================================================
            {
                path: 'staff-schedule',
                name: 'staff-schedule',
                component: () => import('../views/DashboardView.vue'),
            },
            {
                path: 'available-swap-board',
                name: 'available-swap-board',
                component: () => import('../views/SwapsView.vue'),
            },
            {
                path: 'my-swap-requests',
                name: 'my-swap-requests',
                component: () => import('../views/SwapsView.vue'),
            },
            {
                path: 'time-off',
                name: 'time-off',
                component: () => import('../views/TimeOffView.vue'),
            },
            {
                path: 'pay-and-hour-tape',
                name: 'pay-and-hour-tape',
                component: () => import('../views/PayAndHourTapeView.vue'),
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
        return getRoleHomePath(authStore.role);
    }

    const allowedRoles = to.meta.roles as string[] | undefined;
    if (allowedRoles && allowedRoles.length > 0) {
        const userRole = authStore.role || 'staff';
        if (!allowedRoles.includes(userRole)) {
            return getRoleHomePath(userRole);
        }
    }
});
