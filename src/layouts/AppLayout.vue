<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { notificationsApi } from '../api/notifications';
import { locationsApi } from '../api/locations';
import { dashboardApi } from '../api/dashboard';
import type { AppNotification, Location, ManagerDashboardData, StaffDashboardData } from '../types/api';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const undoStore = useUndoStore();

const sidebarCollapsed = ref(localStorage.getItem('shiftswap_sidebar_collapsed') === 'true');
const mobileMenuOpen = ref(false);
const notificationsOpen = ref(false);
const accountMenuOpen = ref(false);

const currentRole = computed<'owner' | 'manager' | 'staff'>(() => {
    if (authStore.role === 'owner' || authStore.role === 'manager' || authStore.role === 'staff') {
        return authStore.role;
    }
    return 'owner';
});

const roleSubtitle = computed(() => {
    if (currentRole.value === 'owner') {
        return 'Owner Portal';
    }
    if (currentRole.value === 'manager') {
        return 'Manager Portal';
    }
    return 'Staff Portal';
});

const activeNavLinks = computed<NavItem[]>(() => {
    if (currentRole.value === 'owner') {
        return ownerNavLinks.value;
    }
    if (currentRole.value === 'manager') {
        return managerNavLinks.value;
    }
    return staffNavLinks.value;
});

const notifications = ref<AppNotification[]>([]);
const locations = computed<Location[]>(() => authStore.locations);
const pendingSwapsCount = ref<number>(0);
const pendingTimeOffCount = ref<number>(0);
const isFetchingNotifs = ref(false);

const nowTime = ref(new Date());
let clockInterval: ReturnType<typeof setInterval> | null = null;

const unreadCount = computed(() => {
    return notifications.value.filter((n) => !n.read_at).length;
});

const userInitials = computed(() => {
    if (!authStore.user?.name) {
        return 'EV';
    }
    const parts = authStore.user.name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'U').slice(0, 2).toUpperCase();
});

const shortUserName = computed(() => {
    if (!authStore.user?.name) {
        return 'Elena V.';
    }
    const parts = authStore.user.name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0]} ${parts[1][0]}.`;
    }
    return parts[0] ?? 'User';
});

const formattedHeaderDate = computed(() => {
    return nowTime.value.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        timeZone: authStore.business?.timezone || 'Asia/Manila',
    });
});

const formattedHeaderClock = computed(() => {
    return nowTime.value.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: authStore.business?.timezone || 'Asia/Manila',
    });
});

interface NavItem {
    label: string;
    path: string;
    aliases?: string[];
    icon: string;
    badge: number | null;
    dot: boolean;
}

// Exact 6 Google Stitch Owner Atelier screens (stitch_363, 366, 367, 365, 368, 369)
const ownerNavLinks = computed<NavItem[]>(() => [
    {
        label: 'Executive Command',
        path: '/executive-command',
        aliases: ['/dashboard'],
        icon: 'grid_view',
        badge: null,
        dot: false,
    },
    {
        label: 'Master Benefits & Policy',
        path: '/master-benefits-and-policy',
        icon: 'verified_user',
        badge: null,
        dot: false,
    },
    {
        label: 'Executive Payroll Tape',
        path: '/executive-payroll-tape',
        icon: 'receipt_long',
        badge: null,
        dot: false,
    },
    {
        label: 'Inter-Store Floaters',
        path: '/inter-store-floaters',
        icon: 'swap_horiz',
        badge: null,
        dot: false,
    },
    {
        label: 'Managers & Delegation',
        path: '/store-managers-and-delegation',
        icon: 'supervisor_account',
        badge: null,
        dot: false,
    },
    {
        label: 'Financial & Labor Audit',
        path: '/financial-and-labor-audit',
        icon: 'query_stats',
        badge: null,
        dot: false,
    },
]);

// Exact Google Stitch Manager Atelier screens (stitch_313, 358, 362, 361 + Baseline Console)
const managerNavLinks = computed<NavItem[]>(() => [
    {
        label: 'Operations Console',
        path: '/operations-console',
        icon: 'dashboard',
        badge: null,
        dot: false,
    },
    {
        label: 'Master Roster Builder',
        path: '/schedule',
        icon: 'calendar_month',
        badge: null,
        dot: false,
    },
    {
        label: 'Swap Approvals & Waivers',
        path: '/swaps',
        icon: 'swap_horiz',
        badge: pendingSwapsCount.value > 0 ? pendingSwapsCount.value : null,
        dot: pendingSwapsCount.value > 0,
    },
    {
        label: 'Staff Directory & Contracts',
        path: '/team',
        icon: 'badge',
        badge: null,
        dot: false,
    },
    {
        label: 'Time-Off Inquiries',
        path: '/time-off',
        icon: 'event_busy',
        badge: pendingTimeOffCount.value > 0 ? pendingTimeOffCount.value : null,
        dot: pendingTimeOffCount.value > 0,
    },
]);

// Exact Google Stitch Staff Atelier screens (stitch_359, 360, 361, 370)
const staffNavLinks = computed<NavItem[]>(() => [
    {
        label: 'My Schedule & Shifts',
        path: '/staff-schedule',
        icon: 'calendar_month',
        badge: null,
        dot: false,
    },
    {
        label: 'Available Swap Board',
        path: '/available-swap-board',
        icon: 'swap_horizontal_circle',
        badge: null,
        dot: false,
    },
    {
        label: 'My Swap Requests',
        path: '/my-swap-requests',
        icon: 'pending_actions',
        badge: pendingSwapsCount.value > 0 ? pendingSwapsCount.value : null,
        dot: pendingSwapsCount.value > 0,
    },
    {
        label: 'Time-Off & Leave',
        path: '/time-off',
        icon: 'event_busy',
        badge: pendingTimeOffCount.value > 0 ? pendingTimeOffCount.value : null,
        dot: pendingTimeOffCount.value > 0,
    },
    {
        label: 'Pay & Hour Tape',
        path: '/pay-and-hour-tape',
        icon: 'receipt_long',
        badge: null,
        dot: false,
    },
]);

function isRouteActive(item: NavItem): boolean {
    if (route.path === item.path || route.path.startsWith(item.path + '/')) {
        return true;
    }
    if (item.aliases && item.aliases.includes(route.path)) {
        return true;
    }
    return false;
}

function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem('shiftswap_sidebar_collapsed', String(sidebarCollapsed.value));
}

function handleKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
    }
}

async function loadShellContext(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        isFetchingNotifs.value = true;
        const [notifRes, locRes, dashRes] = await Promise.allSettled([
            notificationsApi.list(authStore.businessId),
            locationsApi.list(authStore.businessId),
            dashboardApi.get(authStore.businessId),
        ]);

        if (notifRes.status === 'fulfilled') {
            notifications.value = notifRes.value.data;
        }
        if (locRes.status === 'fulfilled') {
            authStore.setLocations(locRes.value.data);
        }
        if (dashRes.status === 'fulfilled') {
            if (authStore.isManagerOrOwner) {
                const mData = dashRes.value.data as ManagerDashboardData;
                pendingSwapsCount.value = mData.pending_swaps_count || 0;
                pendingTimeOffCount.value = mData.pending_time_off_count || 0;
            } else {
                const sData = dashRes.value.data as StaffDashboardData;
                pendingSwapsCount.value = sData.active_swaps?.length || 0;
                pendingTimeOffCount.value = sData.pending_time_off_requests?.length || 0;
            }
        }
    } catch {
        // silent fail on shell poll
    } finally {
        isFetchingNotifs.value = false;
    }
}

async function markAllNotificationsRead(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
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
    if (!authStore.businessId || notif.read_at) {
        return;
    }
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
            loadShellContext();
        }
    }
);

watch(
    () => route.path,
    () => {
        mobileMenuOpen.value = false;
    }
);

onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
    clockInterval = setInterval(() => {
        nowTime.value = new Date();
    }, 30000);
    if (authStore.businessId) {
        loadShellContext();
    }
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
    if (clockInterval) {
        clearInterval(clockInterval);
    }
    undoStore.commitCurrent();
});
</script>

<template>
    <div class="relative isolate bg-[#F2EFE9] text-[#1F1F28] font-body antialiased selection:bg-[#2D4F67] selection:text-white min-h-screen">
        <!-- Mobile Backdrop -->
        <div
            v-if="mobileMenuOpen"
            class="fixed inset-0 z-30 bg-[#16181D]/60 backdrop-blur-xs lg:hidden"
            @click="mobileMenuOpen = false"
        ></div>

        <!-- ========================================================================= -->
        <!-- 1. LEFT EXECUTIVE SIDEBAR (Kanagawa Dragon Sumi Ink #16181D)              -->
        <!-- ========================================================================= -->
        <aside
            id="app-sidebar"
            :class="[
                'fixed top-0 left-0 h-screen flex flex-col justify-between p-4 z-40 bg-[#16181D] border-r border-[#24272E] transition-all duration-300 ease-in-out',
                sidebarCollapsed ? 'lg:w-[72px] lg:px-2.5 w-[260px]' : 'w-[260px]',
                mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            ]"
        >
            <!-- Bottom Wave Artwork -->
            <div class="pointer-events-none absolute bottom-0 left-0 right-0 overflow-hidden h-56 select-none z-0">
                <svg class="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="sidebarWaveDeep" x1="0%" x2="100%" y1="100%" y2="0%">
                            <stop offset="0%" stop-color="#132838" stop-opacity="0.45"></stop>
                            <stop offset="100%" stop-color="#2D4F67" stop-opacity="0.65"></stop>
                        </linearGradient>
                        <linearGradient id="sidebarWaveAqua" x1="0%" x2="100%" y1="100%" y2="20%">
                            <stop offset="0%" stop-color="#3C5A58" stop-opacity="0.15"></stop>
                            <stop offset="100%" stop-color="#5A7E7D" stop-opacity="0.35"></stop>
                        </linearGradient>
                    </defs>
                    <path d="M-10,220 L270,220 L270,165 C200,185 130,195 50,210 C15,215 -5,218 -10,220 Z" fill="url(#sidebarWaveAqua)"></path>
                    <path d="M-10,220 L270,220 L270,120 C220,135 170,140 110,165 C50,190 10,205 -10,220 Z" fill="url(#sidebarWaveDeep)"></path>
                    <path d="M-10,220 L270,220 L270,75 C215,90 155,115 95,145 C45,170 10,195 -10,220 Z" fill="#3E6583" fill-opacity="0.3"></path>
                    <path d="M-10,220 C40,180 110,140 170,105 C210,80 240,76 270,72" stroke="#BACEDD" stroke-linecap="round" stroke-opacity="0.55" stroke-width="2.5"></path>
                    <path d="M-10,220 C50,190 115,160 175,130 C220,108 245,112 270,118" stroke="#BACEDD" stroke-dasharray="8 6" stroke-opacity="0.35" stroke-width="1.5"></path>
                </svg>
            </div>

            <div class="flex flex-col gap-4 relative z-10 min-h-0 flex-1">
                <!-- Tenant & Atelier Monogram Header + Collapse Toggle Button -->
                <div class="flex items-center justify-between px-1 pt-1 pb-3 border-b border-[#24272E] shrink-0">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <RouterLink
                            to="/dashboard"
                            class="w-10 h-10 rounded-lg bg-[#2D4F67] text-white flex items-center justify-center font-headline font-extrabold text-base tracking-tight shadow-sm border border-[#3E6583] shrink-0"
                            title="ShiftSwap Atelier"
                        >
                            SS
                        </RouterLink>
                        <div v-show="!sidebarCollapsed" class="flex flex-col min-w-0 transition-opacity duration-200">
                            <div class="flex items-center gap-1.5">
                                <span class="font-headline text-sm font-bold text-white tracking-tight truncate">ShiftSwap</span>
                                <span class="px-1.5 py-0.5 rounded text-[10px] font-headline font-bold bg-[#C0A36E]/20 text-[#C0A36E] border border-[#C0A36E]/40 tracking-wider uppercase">
                                    {{ currentRole }}
                                </span>
                            </div>
                            <span class="font-body text-xs text-[#8A8D93] truncate">{{ roleSubtitle }}</span>
                        </div>
                    </div>

                    <button
                        id="toggle-sidebar-btn"
                        aria-label="Toggle navigation collapse"
                        class="hidden lg:flex w-8 h-8 rounded-lg text-[#8A8D93] hover:text-white hover:bg-[#1E2127] border border-transparent hover:border-[#2B2F38] items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Toggle Sidebar [Ctrl/⌘ + B]"
                        @click="toggleSidebar"
                    >
                        <span
                            :class="[
                                'material-symbols-outlined text-lg transition-transform duration-300',
                                sidebarCollapsed ? 'rotate-180' : '',
                            ]"
                        >
                            first_page
                        </span>
                    </button>
                </div>

                <!-- Active Workspace Branch Indicator -->
                <div
                    v-if="!sidebarCollapsed"
                    class="p-2.5 rounded-lg bg-[#1E2127] border border-[#2B2F38] flex flex-col gap-1 shrink-0"
                >
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-headline font-bold text-[#8A8D93] uppercase tracking-wider">TENANT WORKSPACE</span>
                        <span class="w-2 h-2 rounded-full bg-[#76946A] animate-pulse"></span>
                    </div>
                    <div class="font-headline text-xs font-semibold text-white truncate">
                        {{ authStore.business?.name || 'Kape Artisan Roasters PH' }}
                    </div>
                    <div class="text-[11px] text-[#8A8D93] font-body flex items-center gap-1 truncate">
                        <span class="material-symbols-outlined text-xs text-[#BACEDD]">storefront</span>
                        <span><strong class="font-mono-num font-semibold text-[#C8C6C1]">{{ locations.length || 3 }}</strong> Branches · {{ authStore.business?.timezone || 'Asia/Manila' }}</span>
                    </div>
                </div>

                <div
                    v-else
                    class="flex justify-center items-center py-2 px-1 rounded-lg bg-[#1E2127] border border-[#2B2F38] shrink-0"
                    :title="`${authStore.business?.name || 'Kape Artisan Roasters PH'} · ${locations.length || 3} Branches`"
                >
                    <div class="relative flex items-center justify-center">
                        <span class="material-symbols-outlined text-base text-[#BACEDD]">storefront</span>
                        <span class="w-2 h-2 rounded-full bg-[#76946A] animate-pulse absolute -top-1 -right-1"></span>
                    </div>
                </div>

                <!-- Role-Specific Navigation Tabs -->
                <nav class="flex flex-col gap-1 overflow-y-auto pr-0.5 flex-1">
                    <RouterLink
                        v-for="item in activeNavLinks"
                        :key="item.path"
                        :to="item.path"
                        :title="item.label"
                        :class="[
                            'flex items-center gap-3 py-2.5 rounded-lg font-body text-sm transition-all relative group',
                            sidebarCollapsed ? 'justify-center px-2' : 'px-3',
                            isRouteActive(item)
                                ? 'bg-[#2D4F67] text-white font-semibold shadow-sm border border-[#3E6583]'
                                : 'text-[#C8C6C1] hover:text-white hover:bg-[#1E2127] font-medium',
                        ]"
                    >
                        <div class="relative shrink-0 flex items-center justify-center">
                            <span
                                :class="[
                                    'material-symbols-outlined text-xl',
                                    isRouteActive(item)
                                        ? 'text-[#BACEDD]'
                                        : 'text-[#8A8D93] group-hover:text-[#BACEDD]',
                                ]"
                            >
                                {{ item.icon }}
                            </span>
                            <span
                                v-if="sidebarCollapsed && item.dot"
                                class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#C0A36E] border-2 border-[#16181D]"
                            ></span>
                        </div>

                        <span v-show="!sidebarCollapsed" class="truncate flex-1">{{ item.label }}</span>

                        <span
                            v-if="!sidebarCollapsed && isRouteActive(item)"
                            class="w-1.5 h-4 rounded-full bg-white"
                        ></span>
                        <span
                            v-else-if="!sidebarCollapsed && item.badge !== null"
                            class="px-1.5 py-0.2 rounded-full text-[11px] font-mono-num font-bold bg-[#C0A36E] text-[#16181D] shadow-xs"
                        >
                            {{ item.badge }}
                        </span>
                    </RouterLink>
                </nav>
            </div>

            <!-- Sidebar Bottom Utilities & Quick Action -->
            <div class="flex flex-col gap-2 pt-2.5 border-t border-[#24272E] relative z-10 shrink-0">
                <template v-if="authStore.isManagerOrOwner">
                    <RouterLink
                        v-if="!sidebarCollapsed"
                        to="/locations"
                        class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline font-semibold text-xs transition-colors border border-[#3E6583] shadow-sm"
                        title="New Branch / Rule"
                    >
                        <span class="material-symbols-outlined text-sm text-[#BACEDD]">add_business</span>
                        <span>+ New Branch / Rule</span>
                    </RouterLink>
                    <RouterLink
                        v-else
                        to="/locations"
                        class="flex w-9 h-9 mx-auto items-center justify-center rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs transition-colors border border-[#3E6583] shadow-sm"
                        title="+ New Branch / Rule"
                    >
                        <span class="material-symbols-outlined text-base text-white">add_business</span>
                    </RouterLink>
                </template>
                <template v-else>
                    <RouterLink
                        v-if="!sidebarCollapsed"
                        to="/available-swap-board"
                        class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline font-semibold text-xs transition-colors border border-[#3E6583] shadow-sm"
                        title="Browse Swap Board"
                    >
                        <span class="material-symbols-outlined text-sm text-[#BACEDD]">swap_horiz</span>
                        <span>Browse Swap Board</span>
                    </RouterLink>
                    <RouterLink
                        v-else
                        to="/available-swap-board"
                        class="flex w-9 h-9 mx-auto items-center justify-center rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs transition-colors border border-[#3E6583] shadow-sm"
                        title="Browse Swap Board"
                    >
                        <span class="material-symbols-outlined text-base text-white">swap_horiz</span>
                    </RouterLink>
                </template>

                <div v-if="!sidebarCollapsed" class="flex items-center justify-between gap-1 pt-0.5">
                    <RouterLink
                        v-if="authStore.isManagerOrOwner"
                        to="/settings"
                        class="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[#8A8D93] hover:text-white transition-colors"
                    >
                        <span class="material-symbols-outlined text-sm">settings</span>
                        <span>Company Settings</span>
                    </RouterLink>
                    <span v-else class="px-2 py-1 text-[11px] text-[#8A8D93] truncate">
                        {{ shortUserName }}
                    </span>
                    <button
                        type="button"
                        class="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-[#8A8D93] hover:text-[#C34043] transition-colors cursor-pointer"
                        @click="handleLogout"
                    >
                        <span class="material-symbols-outlined text-sm">logout</span>
                        <span>Sign Out</span>
                    </button>
                </div>

                <div v-else class="flex flex-col items-center gap-1.5 py-1">
                    <RouterLink
                        v-if="authStore.isManagerOrOwner"
                        to="/settings"
                        class="w-8 h-8 rounded flex items-center justify-center text-[#8A8D93] hover:text-white hover:bg-[#1E2127] transition-colors"
                        title="Company Settings"
                    >
                        <span class="material-symbols-outlined text-base">settings</span>
                    </RouterLink>
                    <button
                        type="button"
                        class="w-8 h-8 rounded flex items-center justify-center text-[#8A8D93] hover:text-[#C34043] hover:bg-[#1E2127] transition-colors cursor-pointer"
                        title="Sign Out"
                        @click="handleLogout"
                    >
                        <span class="material-symbols-outlined text-base">logout</span>
                    </button>
                </div>
            </div>
        </aside>

        <!-- ========================================================================= -->
        <!-- 2. TOP CONTEXT HEADER (Kanagawa Lotus tinted backdrop)                   -->
        <!-- ========================================================================= -->
        <header
            id="app-header"
            :class="[
                'fixed top-0 right-0 left-0 h-16 z-20 bg-[#F2EFE9]/95 backdrop-blur-md border-b border-[#DCD7CE] flex items-center justify-between px-4 sm:px-8 transition-all duration-300 ease-in-out',
                sidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]',
            ]"
        >
            <div class="flex items-center gap-3 sm:gap-4">
                <button
                    type="button"
                    class="lg:hidden p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE]"
                    @click="mobileMenuOpen = !mobileMenuOpen"
                >
                    <span class="material-symbols-outlined text-xl">menu</span>
                </button>

                <div class="flex items-center gap-2">
                    <div class="relative flex items-center">
                        <span class="material-symbols-outlined absolute left-2.5 text-base text-[#2D4F67] pointer-events-none">
                            domain
                        </span>
                        <select
                            v-model="authStore.selectedLocationId"
                            aria-label="Branch location filter"
                            class="appearance-none pl-8 pr-7 py-1.5 text-xs font-headline font-bold text-[#1F1F28] bg-white border border-[#DCD7CE] rounded-lg hover:border-[#2D4F67] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#2D4F67] shadow-2xs"
                        >
                            <option value="all">
                                All Locations
                            </option>
                            <option v-for="loc in locations" :key="loc.id" :value="String(loc.id)">
                                {{ loc.name }}
                            </option>
                        </select>
                        <span class="material-symbols-outlined pointer-events-none absolute right-2 text-sm text-[#5A5D64]">
                            expand_more
                        </span>
                    </div>
                </div>

                <div class="hidden md:block h-4 w-px bg-[#DCD7CE]"></div>

                <div class="hidden md:flex items-center gap-2 text-xs font-semibold text-[#5A5D64]">
                    <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                    <span class="text-[#1F1F28] font-headline font-bold">{{ formattedHeaderDate }}</span>
                    <span class="text-[#5A5D64]/80 font-mono-num">· {{ formattedHeaderClock }} PHT</span>
                </div>
            </div>

            <div class="flex items-center gap-2.5">
                <template v-if="authStore.isManagerOrOwner">
                    <RouterLink
                        to="/schedule"
                        class="hidden sm:flex items-center justify-center w-8 h-8 text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] rounded-lg border border-[#DCD7CE] transition-colors"
                        title="Master Roster"
                    >
                        <span class="material-symbols-outlined text-base">calendar_month</span>
                    </RouterLink>

                    <RouterLink
                        to="/schedule"
                        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] rounded-lg transition-colors shadow-sm"
                        title="Create Shift"
                    >
                        <span class="material-symbols-outlined text-base">add</span>
                        <span>Shift</span>
                    </RouterLink>
                </template>
                <template v-else>
                    <RouterLink
                        to="/available-swap-board"
                        class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] rounded-lg transition-colors shadow-sm"
                        title="Available Swap Board"
                    >
                        <span class="material-symbols-outlined text-base">swap_horiz</span>
                        <span>Swap Board</span>
                    </RouterLink>
                </template>

                <div class="h-5 w-px bg-[#DCD7CE] mx-1"></div>

                <!-- Notifications Dropdown -->
                <div class="flex items-center gap-1 relative">
                    <button
                        type="button"
                        class="relative p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] transition-colors cursor-pointer"
                        title="Notifications"
                        @click="
                            notificationsOpen = !notificationsOpen;
                            accountMenuOpen = false;
                        "
                    >
                        <span class="material-symbols-outlined text-xl">notifications</span>
                        <span
                            v-if="unreadCount > 0 || pendingSwapsCount > 0"
                            class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C0A36E]"
                        ></span>
                    </button>

                    <RouterLink
                        v-if="currentRole === 'owner'"
                        to="/financial-and-labor-audit"
                        class="hidden sm:flex p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] transition-colors"
                        title="Financial & Labor Audit"
                    >
                        <span class="material-symbols-outlined text-xl">history</span>
                    </RouterLink>

                    <!-- Notification Flyout -->
                    <div
                        v-if="notificationsOpen"
                        class="absolute right-0 top-10 mt-1 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-[#DCD7CE] py-3 z-50"
                    >
                        <div class="flex items-center justify-between px-4 pb-2 border-b border-[#DCD7CE]">
                            <h3 class="text-xs font-headline font-bold text-[#1F1F28] uppercase tracking-wider">
                                Shopfloor Notifications
                            </h3>
                            <button
                                v-if="unreadCount > 0"
                                type="button"
                                class="text-xs font-headline font-bold text-[#2D4F67] hover:underline cursor-pointer"
                                @click="markAllNotificationsRead"
                            >
                                Mark all read
                            </button>
                        </div>

                        <div class="max-h-80 overflow-y-auto divide-y divide-[#E7E3DC]">
                            <div
                                v-if="notifications.length === 0"
                                class="py-6 text-center text-xs font-body text-[#5A5D64]"
                            >
                                No unread shopfloor alerts.
                            </div>
                            <div
                                v-for="notif in notifications"
                                :key="notif.id"
                                :class="[
                                    'px-4 py-3 text-xs cursor-pointer transition',
                                    notif.read_at
                                        ? 'bg-white hover:bg-[#FAF8F5]'
                                        : 'bg-[#E6ECF0]/50 hover:bg-[#E6ECF0] font-medium',
                                ]"
                                @click="markNotificationRead(notif)"
                            >
                                <p class="text-[#1F1F28] font-headline font-bold">
                                    {{ notif.data.title || 'Shift Update' }}
                                </p>
                                <p class="text-[#5A5D64] mt-0.5 leading-relaxed">
                                    {{ notif.data.message || notif.data.reason || 'Update on your shift schedule.' }}
                                </p>
                                <p class="text-[10px] font-mono-num text-[#8A8D93] mt-1">
                                    {{ new Date(notif.created_at).toLocaleString() }}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- User Profile Menu -->
                <div class="relative pl-2">
                    <button
                        type="button"
                        class="flex items-center gap-2 p-1 rounded-lg hover:bg-[#E6ECF0] transition-colors cursor-pointer"
                        @click="
                            accountMenuOpen = !accountMenuOpen;
                            notificationsOpen = false;
                        "
                    >
                        <div class="w-8 h-8 rounded-full bg-[#C0A36E]/25 text-[#8C6D36] font-headline font-bold text-xs flex items-center justify-center border-2 border-[#C0A36E]">
                            {{ userInitials }}
                        </div>
                        <span class="hidden sm:inline font-headline text-xs font-bold text-[#1F1F28]">
                            {{ shortUserName }}
                        </span>
                    </button>

                    <div
                        v-if="accountMenuOpen"
                        class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-[#DCD7CE] py-1.5 z-50 text-xs"
                    >
                        <div class="px-4 py-2.5 border-b border-[#E7E3DC]">
                            <p class="font-headline font-bold text-[#1F1F28]">{{ authStore.user?.name || 'Elena Vance' }}</p>
                            <p class="font-body text-[11px] text-[#5A5D64] truncate">{{ authStore.user?.email || 'elena@kapeartisan.ph' }}</p>
                        </div>
                        <RouterLink
                            v-if="currentRole === 'owner'"
                            to="/master-benefits-and-policy"
                            class="flex items-center gap-2 px-4 py-2 text-[#1F1F28] hover:bg-[#FAF8F5] transition"
                            @click="accountMenuOpen = false"
                        >
                            <span class="material-symbols-outlined text-sm text-[#5A5D64]">verified_user</span>
                            <span>Master Benefits & Policy</span>
                        </RouterLink>
                        <RouterLink
                            v-if="currentRole === 'owner'"
                            to="/store-managers-and-delegation"
                            class="flex items-center gap-2 px-4 py-2 text-[#1F1F28] hover:bg-[#FAF8F5] transition"
                            @click="accountMenuOpen = false"
                        >
                            <span class="material-symbols-outlined text-sm text-[#5A5D64]">supervisor_account</span>
                            <span>Managers & Delegation</span>
                        </RouterLink>
                        <RouterLink
                            v-if="authStore.isManagerOrOwner"
                            to="/settings"
                            class="flex items-center gap-2 px-4 py-2 text-[#1F1F28] hover:bg-[#FAF8F5] transition"
                            @click="accountMenuOpen = false"
                        >
                            <span class="material-symbols-outlined text-sm text-[#5A5D64]">tune</span>
                            <span>Company Settings</span>
                        </RouterLink>
                        <button
                            type="button"
                            class="w-full flex items-center gap-2 text-left px-4 py-2 text-[#C34043] hover:bg-[#FCECEC] transition font-semibold cursor-pointer"
                            @click="handleLogout"
                        >
                            <span class="material-symbols-outlined text-sm">logout</span>
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- ========================================================================= -->
        <!-- 3. MAIN DASHBOARD CANVAS                                                 -->
        <!-- ========================================================================= -->
        <main
            id="app-main"
            :class="[
                'pt-20 px-4 sm:px-8 pb-14 min-h-screen relative transition-all duration-300 ease-in-out',
                sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]',
            ]"
        >
            <!-- Kanagawa Dotted Ocean Wave Background Art -->
            <div
                id="app-bg-wave"
                :class="[
                    'pointer-events-none fixed top-16 right-0 bottom-0 left-0 overflow-hidden select-none z-0 transition-all duration-300 ease-in-out',
                    sidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[260px]',
                ]"
            >
                <svg
                    class="absolute right-0 bottom-0 top-0 w-full h-full pointer-events-none select-none"
                    fill="none"
                    preserveAspectRatio="none"
                    viewBox="0 0 1440 900"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern id="topoGridDots" width="28" height="28" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.15" fill="#2D4F67" fill-opacity="0.12"></circle>
                        </pattern>
                        <linearGradient id="dotWaveGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#2D4F67" stop-opacity="0.14"></stop>
                            <stop offset="50%" stop-color="#426E8B" stop-opacity="0.52"></stop>
                            <stop offset="100%" stop-color="#BACEDD" stop-opacity="0.30"></stop>
                        </linearGradient>
                        <linearGradient id="dotWaveGrad2" x1="0%" y1="100%" x2="100%" y2="10%">
                            <stop offset="0%" stop-color="#2D4F67" stop-opacity="0.20"></stop>
                            <stop offset="60%" stop-color="#3E6583" stop-opacity="0.55"></stop>
                            <stop offset="100%" stop-color="#76946A" stop-opacity="0.35"></stop>
                        </linearGradient>
                        <linearGradient id="dotWaveGrad3" x1="20%" y1="100%" x2="80%" y2="0%">
                            <stop offset="0%" stop-color="#1F384C" stop-opacity="0.16"></stop>
                            <stop offset="50%" stop-color="#2D4F67" stop-opacity="0.42"></stop>
                            <stop offset="100%" stop-color="#C0A36E" stop-opacity="0.34"></stop>
                        </linearGradient>
                        <radialGradient id="waveGlow" cx="75%" cy="65%" r="45%">
                            <stop offset="0%" stop-color="#426E8B" stop-opacity="0.14"></stop>
                            <stop offset="100%" stop-color="#F2EFE9" stop-opacity="0"></stop>
                        </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#topoGridDots)"></rect>
                    <rect width="100%" height="100%" fill="url(#waveGlow)"></rect>
                    <g stroke="url(#dotWaveGrad1)" stroke-dasharray="2.5 6.5" stroke-linecap="round" stroke-width="2">
                        <path d="M-40,860 C320,870 560,780 840,810 C1080,835 1280,740 1480,760"></path>
                        <path d="M-40,820 C320,830 570,740 850,770 C1090,795 1290,695 1480,715"></path>
                        <path d="M-40,780 C310,790 580,700 860,730 C1100,755 1300,650 1480,670"></path>
                        <path d="M-40,740 C300,750 590,660 870,690 C1110,715 1310,605 1480,625"></path>
                        <path d="M-40,700 C290,710 600,620 880,650 C1120,675 1320,560 1480,580"></path>
                    </g>
                    <g stroke="url(#dotWaveGrad2)" stroke-dasharray="3 7" stroke-linecap="round" stroke-width="2.4">
                        <path d="M-40,660 C280,670 610,575 890,605 C1130,630 1330,515 1480,535"></path>
                        <path d="M-40,620 C270,630 620,530 900,560 C1140,585 1340,470 1480,490"></path>
                        <path d="M-40,580 C260,590 630,485 910,515 C1150,540 1350,425 1480,445"></path>
                        <path d="M-40,540 C250,550 640,440 920,470 C1160,495 1360,380 1480,400"></path>
                    </g>
                    <g stroke="url(#dotWaveGrad3)" stroke-dasharray="1.5 5.5" stroke-linecap="round" stroke-width="1.6">
                        <path d="M-40,500 C240,510 650,395 930,425 C1170,450 1370,335 1480,355"></path>
                        <path d="M-40,460 C230,470 660,350 940,380 C1180,405 1380,290 1480,310"></path>
                        <path d="M-40,420 C220,430 670,305 950,335 C1190,360 1390,245 1480,265"></path>
                    </g>
                    <g fill="#2D4F67" fill-opacity="0.34">
                        <circle cx="720" cy="610" r="2.5"></circle>
                        <circle cx="780" cy="625" r="2"></circle>
                        <circle cx="840" cy="640" r="2.5"></circle>
                        <circle cx="900" cy="650" r="2"></circle>
                        <circle cx="960" cy="645" r="3"></circle>
                        <circle cx="1020" cy="630" r="2.5"></circle>
                        <circle cx="1080" cy="610" r="2"></circle>
                        <circle cx="1140" cy="580" r="2.5"></circle>
                        <circle cx="1200" cy="550" r="3"></circle>
                        <circle cx="1260" cy="520" r="2.5"></circle>
                        <circle cx="1320" cy="490" r="2"></circle>
                        <circle cx="1380" cy="465" r="2.5"></circle>
                    </g>
                    <g fill="#426E8B" fill-opacity="0.42">
                        <circle cx="800" cy="520" r="2"></circle>
                        <circle cx="860" cy="540" r="2.5"></circle>
                        <circle cx="920" cy="555" r="2"></circle>
                        <circle cx="980" cy="550" r="3"></circle>
                        <circle cx="1040" cy="535" r="2.5"></circle>
                        <circle cx="1100" cy="510" r="2"></circle>
                        <circle cx="1160" cy="480" r="3"></circle>
                        <circle cx="1220" cy="450" r="2.5"></circle>
                        <circle cx="1280" cy="420" r="2"></circle>
                        <circle cx="1340" cy="395" r="2.5"></circle>
                    </g>
                </svg>
            </div>

            <div class="relative z-10">
                <RouterView />
            </div>
        </main>

        <!-- Global Undo Pop-up Notification (Recommended 4s grace window) -->
        <Teleport to="body">
            <Transition name="undo-pop">
                <div
                    v-if="undoStore.currentAction"
                    class="fixed bottom-6 right-6 z-50 max-w-md w-[calc(100vw-3rem)] bg-[#1F1F28] text-[#DCD7CE] rounded-xl shadow-2xl border border-[#363646] overflow-hidden"
                    role="alert"
                >
                    <div class="p-3.5 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-[#2D4F67] flex items-center justify-center text-[#E6ECF0] shrink-0 shadow-2xs">
                                <span class="material-symbols-outlined text-lg">history</span>
                            </div>
                            <div class="min-w-0">
                                <p class="font-headline text-xs font-bold text-[#FAF8F5] truncate leading-tight">
                                    {{ undoStore.currentAction.message }}
                                </p>
                                <p v-if="undoStore.currentAction.detail" class="text-[11px] font-body text-[#C8C093] truncate leading-tight mt-0.5">
                                    {{ undoStore.currentAction.detail }}
                                </p>
                            </div>
                        </div>

                        <div class="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#76946A] hover:bg-[#85A977] text-white font-headline text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                                @click="undoStore.undo"
                            >
                                <span class="material-symbols-outlined text-sm">undo</span>
                                <span>Undo ({{ undoStore.timeRemainingSeconds }}s)</span>
                            </button>
                            <button
                                type="button"
                                class="p-1 rounded-md text-[#727169] hover:text-[#DCD7CE] hover:bg-[#2A2A37] transition-colors cursor-pointer"
                                title="Dismiss and commit immediately"
                                @click="undoStore.dismiss"
                            >
                                <span class="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                    </div>

                    <!-- Animated Linear Progress Countdown Bar -->
                    <div class="w-full bg-[#2A2A37] h-1 overflow-hidden">
                        <div
                            class="bg-[#76946A] h-full transition-all duration-75 ease-linear"
                            :style="{ width: `${undoStore.progressPercent}%` }"
                        ></div>
                    </div>
                </div>
            </Transition>

            <!-- Undone Feedback Toast -->
            <Transition name="fade">
                <div
                    v-if="undoStore.toastFeedback"
                    class="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[#2D4F67] text-white shadow-xl border border-[#426E8B] flex items-center gap-2 text-xs font-headline font-bold"
                >
                    <span class="material-symbols-outlined text-base text-[#76946A]">check_circle</span>
                    <span>{{ undoStore.toastFeedback }}</span>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
