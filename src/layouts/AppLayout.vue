<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { notificationsApi } from '../api/notifications';
import type { AppNotification } from '../types/api';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const mobileMenuOpen = ref(false);
const notificationsOpen = ref(false);
const accountMenuOpen = ref(false);

const notifications = ref<AppNotification[]>([]);
const isFetchingNotifs = ref(false);

const unreadCount = computed(() => {
    return notifications.value.filter((n) => !n.read_at).length;
});

const userInitials = computed(() => {
    if (!authStore.user?.name) return 'U';
    const parts = authStore.user.name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
});

const navLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
    { label: 'Schedule', path: '/schedule', icon: 'calendar' },
    { label: 'Shift swaps', path: '/swaps', icon: 'repeat' },
    { label: 'Time off', path: '/time-off', icon: 'clock' },
    { label: 'Team', path: '/team', icon: 'users' },
];

const managementLinks = [
    { label: 'Locations', path: '/locations', icon: 'pin' },
    { label: 'Settings', path: '/settings', icon: 'settings' },
];

async function loadNotifications(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isFetchingNotifs.value = true;
        const res = await notificationsApi.list(authStore.businessId);
        notifications.value = res.data;
    } catch {
        // silent fail on notification poll
    } finally {
        isFetchingNotifs.value = false;
    }
}

async function markAllNotificationsRead(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        await notificationsApi.markAllRead(authStore.businessId);
        notifications.value.forEach((n) => {
            n.read_at = new Date().toISOString();
        });
    } catch {
        // ignore
    }
}

async function markNotificationRead(notif: AppNotification): Promise<void> {
    if (!authStore.businessId || notif.read_at) return;
    try {
        await notificationsApi.markRead(authStore.businessId, notif.id);
        notif.read_at = new Date().toISOString();
    } catch {
        // ignore
    }
}

async function handleLogout(): Promise<void> {
    accountMenuOpen.value = false;
    await authStore.logout();
    router.push('/login');
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadNotifications();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadNotifications();
    }
});
</script>

<template>
    <div class="min-h-screen bg-[#f7f8fc] flex font-sans text-slate-900">
        <!-- Desktop Sidebar -->
        <aside class="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200/80 fixed inset-y-0 z-30">
            <!-- Brand -->
            <div class="h-16 flex items-center px-6 gap-3 border-b border-slate-100">
                <div class="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    SS
                </div>
                <div class="overflow-hidden">
                    <h1 class="text-base font-bold tracking-tight text-slate-900 leading-none">ShiftSwap</h1>
                    <p class="text-xs text-slate-500 truncate mt-0.5 font-medium">{{ authStore.business?.name || 'Workspace' }}</p>
                </div>
            </div>

            <!-- Navigation Links -->
            <div class="flex-1 overflow-y-auto px-4 py-5 space-y-6">
                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">Main</div>
                    <nav class="space-y-1">
                        <RouterLink
                            v-for="item in navLinks"
                            :key="item.path"
                            :to="item.path"
                            :class="[
                                route.path.startsWith(item.path)
                                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium',
                                'flex items-center px-3 py-2 rounded-xl text-sm transition',
                            ]"
                        >
                            <span class="flex-1">{{ item.label }}</span>
                        </RouterLink>
                    </nav>
                </div>

                <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">Manage</div>
                    <nav class="space-y-1">
                        <RouterLink
                            v-for="item in managementLinks"
                            :key="item.path"
                            :to="item.path"
                            :class="[
                                route.path.startsWith(item.path)
                                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium',
                                'flex items-center px-3 py-2 rounded-xl text-sm transition',
                            ]"
                        >
                            <span class="flex-1">{{ item.label }}</span>
                        </RouterLink>
                    </nav>
                </div>
            </div>

            <!-- User footer -->
            <div class="p-4 border-t border-slate-100">
                <div class="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-xs shrink-0">
                            {{ userInitials }}
                        </div>
                        <div class="overflow-hidden">
                            <p class="text-xs font-semibold text-slate-900 truncate leading-none">{{ authStore.user?.name }}</p>
                            <span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                                {{ authStore.role }}
                            </span>
                        </div>
                    </div>
                    <button
                        title="Sign out"
                        class="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                        @click="handleLogout"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>

        <!-- Main Content Wrapper -->
        <div class="flex-1 lg:pl-64 flex flex-col min-h-screen">
            <!-- Topbar -->
            <header class="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
                <div class="flex items-center gap-3">
                    <button
                        class="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                        @click="mobileMenuOpen = !mobileMenuOpen"
                    >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <div class="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                        <span>{{ authStore.business?.name }}</span>
                        <span>•</span>
                        <span class="text-slate-800 font-semibold capitalize">{{ authStore.role }} Portal</span>
                    </div>
                </div>

                <!-- Top Right Controls -->
                <div class="flex items-center gap-3 relative">
                    <!-- Notifications Dropdown -->
                    <div class="relative">
                        <button
                            class="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                            @click="notificationsOpen = !notificationsOpen; accountMenuOpen = false"
                        >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            <span
                                v-if="unreadCount > 0"
                                class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center"
                            >
                                {{ unreadCount }}
                            </span>
                        </button>

                        <!-- Notification Flyout -->
                        <div
                            v-if="notificationsOpen"
                            class="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-3 z-40"
                        >
                            <div class="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                                <h3 class="text-sm font-bold text-slate-900">Notifications</h3>
                                <button
                                    v-if="unreadCount > 0"
                                    class="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                    @click="markAllNotificationsRead"
                                >
                                    Mark all read
                                </button>
                            </div>

                            <div class="max-h-80 overflow-y-auto divide-y divide-slate-100">
                                <div
                                    v-if="notifications.length === 0"
                                    class="py-6 text-center text-xs text-slate-500"
                                >
                                    No notifications right now.
                                </div>
                                <div
                                    v-for="notif in notifications"
                                    :key="notif.id"
                                    :class="[
                                        'px-4 py-3 text-xs cursor-pointer transition',
                                        notif.read_at ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50 font-medium',
                                    ]"
                                    @click="markNotificationRead(notif)"
                                >
                                    <p class="text-slate-900 font-semibold">{{ notif.data.title || 'Shift Notification' }}</p>
                                    <p class="text-slate-600 mt-0.5 leading-relaxed">{{ notif.data.message || notif.data.reason || 'Update on your shift.' }}</p>
                                    <p class="text-[10px] text-slate-400 mt-1">{{ new Date(notif.created_at).toLocaleString() }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- User Profile Dropdown Button -->
                    <div class="relative">
                        <button
                            class="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition"
                            @click="accountMenuOpen = !accountMenuOpen; notificationsOpen = false"
                        >
                            <div class="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center">
                                {{ userInitials }}
                            </div>
                            <span class="hidden sm:inline text-xs font-semibold text-slate-700">{{ authStore.user?.name }}</span>
                        </button>

                        <div
                            v-if="accountMenuOpen"
                            class="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40 text-xs"
                        >
                            <div class="px-4 py-2 border-b border-slate-100 font-medium">
                                <p class="font-semibold text-slate-900">{{ authStore.user?.name }}</p>
                                <p class="text-slate-500 truncate">{{ authStore.user?.email }}</p>
                            </div>
                            <RouterLink
                                to="/settings"
                                class="block px-4 py-2 text-slate-700 hover:bg-slate-50 transition"
                                @click="accountMenuOpen = false"
                            >
                                Settings
                            </RouterLink>
                            <button
                                class="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 transition font-medium"
                                @click="handleLogout"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Main View Container -->
            <main class="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                <RouterView />
            </main>
        </div>
    </div>
</template>
