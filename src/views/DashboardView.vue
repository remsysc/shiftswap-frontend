<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { dashboardApi } from '../api/dashboard';
import type { ManagerDashboardData, StaffDashboardData, Shift } from '../types/api';

const authStore = useAuthStore();
const isLoading = ref(true);
const managerData = ref<ManagerDashboardData | null>(null);
const staffData = ref<StaffDashboardData | null>(null);

const isManager = computed(() => authStore.isManagerOrOwner);

async function loadDashboard(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        const res = await dashboardApi.get(authStore.businessId);
        if (isManager.value) {
            managerData.value = res.data as ManagerDashboardData;
        } else {
            staffData.value = res.data as StaffDashboardData;
        }
    } catch (e) {
        // error handled
    } finally {
        isLoading.value = false;
    }
}

onMounted(() => {
    loadDashboard();
});
</script>

<template>
    <div class="space-y-6">
        <!-- Greeting Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                    Welcome back, {{ authStore.user?.name }}
                </h1>
                <p class="text-sm text-slate-500 mt-1">
                    {{ isManager ? 'Manager overview for the next 7 days' : 'Your personal schedule and pending requests' }}
                </p>
            </div>

            <div class="flex items-center gap-3">
                <RouterLink
                    to="/schedule"
                    class="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                >
                    View Schedule
                </RouterLink>
            </div>
        </div>

        <div v-if="isLoading" class="py-16 text-center text-sm text-slate-500">
            Loading dashboard data...
        </div>

        <template v-else>
            <!-- Manager Dashboard View -->
            <div v-if="isManager" class="space-y-6">
                <!-- Stat Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Next 7 Days</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ managerData?.upcoming_shifts.length || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Scheduled shifts</p>
                    </div>

                    <RouterLink
                        to="/swaps"
                        class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition block"
                    >
                        <p class="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Review</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ managerData?.pending_swaps_count || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Shift swap requests</p>
                    </RouterLink>

                    <RouterLink
                        to="/time-off"
                        class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition block"
                    >
                        <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Pending Review</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ managerData?.pending_time_off_count || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Time-off requests</p>
                    </RouterLink>
                </div>

                <!-- Upcoming Shifts Table -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 class="text-base font-bold text-slate-900">Upcoming Shifts (7 Days)</h2>
                        <RouterLink to="/schedule" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            See calendar →
                        </RouterLink>
                    </div>

                    <div v-if="!managerData?.upcoming_shifts.length" class="p-8 text-center text-sm text-slate-500">
                        No upcoming shifts scheduled in the next 7 days.
                    </div>

                    <div v-else class="divide-y divide-slate-100">
                        <div
                            v-for="shift in managerData.upcoming_shifts"
                            :key="shift.id"
                            class="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                        >
                            <div class="space-y-1">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-sm text-slate-900">{{ shift.role_label }}</span>
                                    <span v-if="shift.location" class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {{ shift.location.name }}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500">
                                    {{ new Date(shift.start_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }} • 
                                    {{ new Date(shift.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }} – 
                                    {{ new Date(shift.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                                </p>
                            </div>

                            <div class="flex items-center gap-2">
                                <span class="text-xs text-slate-500 font-medium">Assigned:</span>
                                <div v-if="shift.assigned_staff?.length" class="flex items-center gap-1.5">
                                    <span
                                        v-for="staff in shift.assigned_staff"
                                        :key="staff.id"
                                        class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700"
                                    >
                                        {{ staff.user?.name || 'Staff' }}
                                    </span>
                                </div>
                                <span v-else class="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    Unassigned
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Staff Dashboard View -->
            <div v-else class="space-y-6">
                <!-- Stat Cards -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Upcoming (14 Days)</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ staffData?.upcoming_shifts.length || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">My scheduled shifts</p>
                    </div>

                    <RouterLink
                        to="/swaps"
                        class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition block"
                    >
                        <p class="text-xs font-bold uppercase tracking-wider text-amber-600">Active Swaps</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ staffData?.active_swaps.length || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Swaps offered or requested</p>
                    </RouterLink>

                    <RouterLink
                        to="/time-off"
                        class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:border-indigo-300 transition block"
                    >
                        <p class="text-xs font-bold uppercase tracking-wider text-indigo-600">Time-Off Requests</p>
                        <p class="text-3xl font-extrabold text-slate-900 mt-2">
                            {{ staffData?.pending_time_off_requests.length || 0 }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1">Pending approval</p>
                    </RouterLink>
                </div>

                <!-- My Upcoming Shifts -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 class="text-base font-bold text-slate-900">My Upcoming Shifts</h2>
                        <RouterLink to="/schedule" class="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                            Schedule calendar →
                        </RouterLink>
                    </div>

                    <div v-if="!staffData?.upcoming_shifts.length" class="p-8 text-center text-sm text-slate-500">
                        You have no shifts assigned in the next 14 days.
                    </div>

                    <div v-else class="divide-y divide-slate-100">
                        <div
                            v-for="shift in staffData.upcoming_shifts"
                            :key="shift.id"
                            class="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-sm text-slate-900">{{ shift.role_label }}</span>
                                    <span v-if="shift.location" class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                        {{ shift.location.name }}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 mt-1">
                                    {{ new Date(shift.start_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }} • 
                                    {{ new Date(shift.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }} – 
                                    {{ new Date(shift.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                                </p>
                            </div>

                            <RouterLink
                                to="/swaps"
                                class="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                            >
                                Swap marketplace
                            </RouterLink>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
