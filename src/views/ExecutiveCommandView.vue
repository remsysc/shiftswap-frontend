<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { dashboardApi } from '../api/dashboard';
import { shiftsApi } from '../api/shifts';
import { swapsApi } from '../api/swaps';
import { timeOffApi } from '../api/timeOff';
import { staffApi } from '../api/staff';
import type { Shift, ShiftSwap, TimeOffRequest, BusinessMember, Location } from '../types/api';

const authStore = useAuthStore();
const actionBanner = ref('');
const isLoading = ref(true);

const liveUpcomingShifts = ref<Shift[]>([]);
const liveSwaps = ref<ShiftSwap[]>([]);
const liveTimeOffRequests = ref<TimeOffRequest[]>([]);
const staffMembers = ref<BusinessMember[]>([]);

function triggerBanner(msg: string): void {
    actionBanner.value = msg;
    setTimeout(() => {
        if (actionBanner.value === msg) {
            actionBanner.value = '';
        }
    }, 4000);
}

function getInitials(name?: string | null): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'ST').slice(0, 2).toUpperCase();
}

function format24h(iso?: string): string {
    if (!iso) return '08:00';
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatShortDay(iso?: string): string {
    if (!iso) return 'Today';
    return new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

const locations = computed<Location[]>(() => authStore.locations);

const managersList = computed<BusinessMember[]>(() => {
    return staffMembers.value.filter((m) => m.role === 'manager' || m.role === 'owner');
});

const filteredShifts = computed<Shift[]>(() => {
    return liveUpcomingShifts.value.filter((s) =>
        authStore.matchesLocation(s.location_id, s.location?.name)
    );
});

const filteredPendingSwaps = computed<ShiftSwap[]>(() => {
    return liveSwaps.value.filter((sw) => {
        if (sw.status !== 'pending_approval') return false;
        return authStore.matchesLocation(sw.shift?.location_id, sw.shift?.location?.name);
    });
});

const filteredPendingTimeOff = computed<TimeOffRequest[]>(() => {
    return liveTimeOffRequests.value.filter((to) => to.status === 'pending');
});

// Real location coverage cards calculated from shifts
const locationCoverageCards = computed(() => {
    const list = locations.value;
    if (list.length === 0) {
        return [];
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    return list
        .filter((loc) => authStore.matchesLocation(loc.id, loc.name))
        .map((loc) => {
            const locShifts = liveUpcomingShifts.value.filter((s) => s.location_id === loc.id);
            const todayShifts = locShifts.filter((s) => s.start_at?.startsWith(todayStr));
            const coveredToday = todayShifts.filter((s) => ((s.assigned_staff || s.staff) ?? []).length > 0).length;
            const openGaps = todayShifts.length - coveredToday;

            const pendingSwaps = liveSwaps.value.filter(
                (sw) => sw.status === 'pending_approval' && sw.shift?.location_id === loc.id
            ).length;

            return {
                id: loc.id,
                name: loc.name,
                address: loc.address,
                todayTotal: todayShifts.length,
                todayAssigned: coveredToday,
                openGaps,
                pendingSwaps,
                shiftsCount: locShifts.length,
            };
        });
});

async function loadData(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        const bId = authStore.businessId;

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setDate(end.getDate() + 7);
        end.setHours(23, 59, 59, 999);

        const [dashRes, shiftsRes, swapsRes, timeOffRes, staffRes] = await Promise.allSettled([
            dashboardApi.get(bId),
            shiftsApi.listShifts(bId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)),
            swapsApi.listSwaps(bId),
            timeOffApi.list(bId, 'pending'),
            staffApi.list(bId),
        ]);

        if (shiftsRes.status === 'fulfilled') {
            liveUpcomingShifts.value = shiftsRes.value.data;
        } else if (dashRes.status === 'fulfilled') {
            liveUpcomingShifts.value = (dashRes.value.data as any)?.upcoming_shifts || [];
        }

        if (swapsRes.status === 'fulfilled') {
            liveSwaps.value = swapsRes.value.data;
        }

        if (timeOffRes.status === 'fulfilled') {
            liveTimeOffRequests.value = timeOffRes.value.data;
        }

        if (staffRes.status === 'fulfilled') {
            staffMembers.value = staffRes.value.data.map((m: any) => ({
                id: m.user?.id || m.id,
                name: m.name || m.user?.name || '',
                email: m.email || m.user?.email || '',
                role: m.role || m.user?.role || 'staff',
            }));
        }
    } finally {
        isLoading.value = false;
    }
}

async function approveSwap(swap: ShiftSwap): Promise<void> {
    if (!authStore.businessId) return;
    try {
        await swapsApi.approveSwap(authStore.businessId, swap.id, 'Approved via Executive Command');
        triggerBanner(`Approved shift swap #SW-${swap.id}.`);
        await loadData();
    } catch (err: any) {
        triggerBanner(err?.message || 'Failed to approve swap.');
    }
}

async function rejectSwap(swap: ShiftSwap): Promise<void> {
    if (!authStore.businessId) return;
    try {
        await swapsApi.rejectSwap(authStore.businessId, swap.id, 'Declined via Executive Command');
        triggerBanner(`Declined swap request #SW-${swap.id}. Returned to open pool.`);
        await loadData();
    } catch (err: any) {
        triggerBanner(err?.message || 'Failed to decline swap.');
    }
}

async function approveTimeOff(req: TimeOffRequest): Promise<void> {
    if (!authStore.businessId) return;
    try {
        await timeOffApi.approve(authStore.businessId, req.id, 'Approved via Executive Command');
        triggerBanner(`Approved time-off request for ${req.user?.name || 'Staff'}.`);
        await loadData();
    } catch (err: any) {
        triggerBanner(err?.message || 'Failed to approve time-off.');
    }
}

async function rejectTimeOff(req: TimeOffRequest): Promise<void> {
    if (!authStore.businessId) return;
    try {
        await timeOffApi.reject(authStore.businessId, req.id, 'Declined via Executive Command');
        triggerBanner(`Declined time-off request for ${req.user?.name || 'Staff'}.`);
        await loadData();
    } catch (err: any) {
        triggerBanner(err?.message || 'Failed to decline time-off.');
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) loadData();
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadData();
    }
});
</script>

<template>
    <div class="space-y-6 max-w-7xl mx-auto pb-10">
        <!-- Toast Notification -->
        <div
            v-if="actionBanner"
            class="rounded-xl border border-[#76946A]/40 bg-[#EDF3EA] px-4 py-3 text-xs font-body text-[#475F3E] flex items-center justify-between shadow-xs"
        >
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base text-[#76946A]">check_circle</span>
                <span class="font-semibold">{{ actionBanner }}</span>
            </div>
            <button type="button" class="text-[11px] font-headline font-bold underline cursor-pointer" @click="actionBanner = ''">
                Dismiss
            </button>
        </div>

        <!-- ========================================================================= -->
        <!-- PAGE HEADER                                                               -->
        <!-- ========================================================================= -->
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#DCD7CE]">
            <div>
                <div class="flex items-center gap-2 mb-1.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67] uppercase tracking-wider">
                        Owner Overview
                    </span>
                    <span class="text-xs font-mono-num text-[#5A5D64]">
                        {{ authStore.selectedLocation ? authStore.selectedLocation.name : `${authStore.locations.length || 3} Locations` }}
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Executive Command
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Upcoming 7-day shift coverage, pending shift swaps, and time-off requests
                    {{ authStore.selectedLocation ? `for ${authStore.selectedLocation.name}` : 'across all locations' }}.
                </p>
            </div>

            <div class="flex items-center gap-2.5 shrink-0">
                <RouterLink
                    to="/inter-store-floaters"
                    class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#1F1F28] bg-white hover:bg-[#FAF8F5] border border-[#DCD7CE] shadow-2xs transition-all"
                >
                    <span class="material-symbols-outlined text-base text-[#2D4F67]">swap_horiz</span>
                    <span>Cover Open Shifts</span>
                </RouterLink>
                <RouterLink
                    to="/schedule"
                    class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all"
                >
                    <span class="material-symbols-outlined text-base">calendar_month</span>
                    <span>Open Schedule</span>
                </RouterLink>
            </div>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP (Aligned with PRD FR-29: Upcoming Shifts, Swaps, Time-Off) -->
        <!-- ========================================================================= -->
        <section aria-label="Schedule Key Metrics" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Upcoming Shifts (7d)</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-mono-num font-bold bg-[#EDF3EA] text-[#475F3E]">
                        {{ filteredShifts.length > 0 ? `${filteredShifts.length} Shifts` : '0 Scheduled' }}
                    </span>
                </div>
                <div class="my-3 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28] tracking-tight">
                        {{ filteredShifts.length }}
                    </span>
                    <span class="text-xs font-body text-[#5A5D64]">shifts scheduled</span>
                </div>
                <p class="text-xs text-[#5A5D64] font-body">
                    {{ filteredShifts.length > 0 ? 'Active shift schedule across selected scope.' : 'No shifts currently scheduled for this window.' }}
                </p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Pending Shift Swaps</span>
                    <span
                        :class="[
                            'px-2 py-0.5 rounded-full text-[11px] font-mono-num font-bold',
                            filteredPendingSwaps.length > 0 ? 'bg-[#F9F3E8] text-[#8C6D36]' : 'bg-[#EDF3EA] text-[#475F3E]',
                        ]"
                    >
                        {{ filteredPendingSwaps.length > 0 ? 'Needs Review' : 'All Clear' }}
                    </span>
                </div>
                <div class="my-3 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28] tracking-tight">
                        {{ filteredPendingSwaps.length }}
                    </span>
                    <span class="text-xs font-body text-[#5A5D64]">awaiting approval</span>
                </div>
                <p class="text-xs text-[#5A5D64] font-body">
                    Peer swap requests verified for zero overlap.
                </p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Pending Time-Off</span>
                    <span
                        :class="[
                            'px-2 py-0.5 rounded-full text-[11px] font-mono-num font-bold',
                            filteredPendingTimeOff.length > 0 ? 'bg-[#E6ECF0] text-[#2D4F67]' : 'bg-[#EDF3EA] text-[#475F3E]',
                        ]"
                    >
                        {{ filteredPendingTimeOff.length > 0 ? 'In Queue' : 'Zero Pending' }}
                    </span>
                </div>
                <div class="my-3 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28] tracking-tight">
                        {{ filteredPendingTimeOff.length }}
                    </span>
                    <span class="text-xs font-body text-[#5A5D64]">requests</span>
                </div>
                <p class="text-xs text-[#5A5D64] font-body">
                    Checked against existing assigned shifts.
                </p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div class="flex items-center justify-between">
                    <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Active Locations</span>
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#EDF3EA] text-[#475F3E]">
                        Operational
                    </span>
                </div>
                <div class="my-3 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#475F3E] tracking-tight">
                        {{ locations.length }}
                    </span>
                    <span class="text-xs font-body text-[#5A5D64]">branches active</span>
                </div>
                <p class="text-xs text-[#5A5D64] font-body">
                    Multi-tenant location roster.
                </p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: LOCATION SCHEDULE COVERAGE & 7-DAY SHIFT VOLUME -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <!-- Multi-Location Staffing Status -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] flex items-center justify-between bg-[#FAF8F5]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Location Shift Coverage</h2>
                            <p class="text-xs text-[#5A5D64] font-body mt-0.5">
                                Today's assigned shifts and coverage by branch
                                {{ authStore.selectedLocation ? `for ${authStore.selectedLocation.name}` : '' }}
                            </p>
                        </div>
                        <RouterLink
                            to="/locations"
                            class="text-xs font-headline font-bold text-[#2D4F67] hover:underline"
                        >
                            Manage Locations →
                        </RouterLink>
                    </div>

                    <div v-if="locationCoverageCards.length === 0" class="p-8 text-center text-xs text-[#5A5D64]">
                        <p class="font-headline font-bold text-sm text-[#1F1F28]">No branches configured</p>
                        <p class="mt-1">Add your locations to start scheduling shifts across stores.</p>
                        <RouterLink
                            to="/locations"
                            class="inline-flex items-center gap-1 mt-3 px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C]"
                        >
                            + Add Branch Location
                        </RouterLink>
                    </div>

                    <div v-else class="divide-y divide-[#E7E3DC]">
                        <div
                            v-for="branch in locationCoverageCards"
                            :key="branch.id"
                            class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5]/60 transition-colors"
                        >
                            <div class="space-y-1">
                                <div class="flex items-center gap-2.5">
                                    <span
                                        class="w-2.5 h-2.5 rounded-full"
                                        :class="branch.openGaps > 0 ? 'bg-[#C0A36E]' : 'bg-[#76946A]'"
                                    ></span>
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">{{ branch.name }}</h3>
                                    <span
                                        :class="[
                                            'px-2 py-0.5 rounded text-[11px] font-headline font-bold',
                                            branch.openGaps > 0
                                                ? 'bg-[#F9F3E8] text-[#8C6D36]'
                                                : 'bg-[#EDF3EA] text-[#475F3E]',
                                        ]"
                                    >
                                        {{ branch.openGaps > 0 ? `${branch.openGaps} Open Shift` : 'Fully Staffed' }}
                                    </span>
                                </div>
                                <p class="text-xs text-[#5A5D64] font-body pl-5">
                                    {{ branch.address || 'Location Branch' }} · {{ branch.shiftsCount }} upcoming scheduled shifts
                                </p>
                            </div>
                            <div class="flex items-center gap-6 pl-5 sm:pl-0">
                                <div class="text-right">
                                    <div class="text-xs text-[#5A5D64]">Today's Shifts</div>
                                    <div class="text-sm font-mono-num font-bold text-[#1F1F28]">
                                        {{ branch.todayAssigned }} / {{ branch.todayTotal }}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-[#5A5D64]">Pending Swaps</div>
                                    <div class="text-sm font-mono-num font-bold text-[#1F1F28]">{{ branch.pendingSwaps }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Upcoming Scheduled Shifts Tape -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#DCD7CE]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">7-Day Scheduled Shifts</h2>
                            <p class="text-xs text-[#5A5D64] font-body mt-0.5">Upcoming roster shifts across branches</p>
                        </div>
                        <RouterLink
                            to="/schedule"
                            class="text-xs font-headline font-bold text-[#2D4F67] hover:underline"
                        >
                            Open Master Roster →
                        </RouterLink>
                    </div>

                    <div v-if="filteredShifts.length === 0" class="py-12 text-center text-xs text-[#5A5D64]">
                        <span class="material-symbols-outlined text-3xl text-[#8A8D93] mb-1">calendar_month</span>
                        <p class="font-headline font-bold text-sm text-[#1F1F28]">No shifts scheduled in the next 7 days</p>
                        <p class="mt-1">Create shifts on the schedule board to populate the executive tape.</p>
                        <RouterLink
                            to="/schedule"
                            class="inline-flex items-center gap-1 mt-3 px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C]"
                        >
                            + Add Shifts
                        </RouterLink>
                    </div>

                    <div v-else class="divide-y divide-[#E7E3DC] mt-2">
                        <div
                            v-for="shift in filteredShifts.slice(0, 6)"
                            :key="shift.id"
                            class="py-3.5 flex items-center justify-between gap-4"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-[#E6ECF0] text-[#2D4F67] border border-[#BACEDD] flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-base">schedule</span>
                                </div>
                                <div>
                                    <div class="text-xs font-headline font-bold text-[#1F1F28] flex items-center gap-2">
                                        <span>{{ shift.role_label || 'Shift' }}</span>
                                        <span class="px-1.5 py-0.2 rounded text-[10px] font-mono-num font-semibold bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64]">
                                            {{ shift.location?.name || 'Main Location' }}
                                        </span>
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64] font-body mt-0.5">
                                        {{ formatShortDay(shift.start_at) }} · <span class="font-mono-num">{{ format24h(shift.start_at) }} – {{ format24h(shift.end_at) }}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span
                                    v-if="((shift.assigned_staff || shift.staff) ?? []).length > 0"
                                    class="px-2.5 py-1 rounded-full text-[11px] font-headline font-semibold bg-[#EDF3EA] text-[#475F3E]"
                                >
                                    {{ (shift.assigned_staff || shift.staff)?.[0]?.user?.name || 'Assigned' }}
                                </span>
                                <span
                                    v-else
                                    class="px-2.5 py-1 rounded-full text-[11px] font-headline font-semibold bg-[#F9F3E8] text-[#8C6D36]"
                                >
                                    Unassigned
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: PENDING SWAP & TIME-OFF APPROVALS + MANAGERS -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <!-- Pending Swap & Time-Off Queue -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5">
                    <div class="flex items-center justify-between pb-4 border-b border-[#DCD7CE]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Pending Approvals</h2>
                            <p class="text-xs text-[#5A5D64] font-body mt-0.5">Shift swaps &amp; time-off requests</p>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-xs font-mono-num font-bold bg-[#F9F3E8] text-[#8C6D36]">
                            {{ filteredPendingSwaps.length + filteredPendingTimeOff.length }}
                        </span>
                    </div>

                    <div class="space-y-3 mt-4">
                        <!-- Pending Shift Swaps -->
                        <div
                            v-for="swap in filteredPendingSwaps"
                            :key="`swap-${swap.id}`"
                            class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] space-y-2.5"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#2D4F67]">
                                        Shift Swap · {{ swap.shift?.location?.name || 'Branch' }}
                                    </span>
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28] mt-0.5">
                                        {{ swap.offered_by?.name }} → {{ swap.requested_by?.name || 'Claimant' }}
                                    </h3>
                                </div>
                                <span class="text-[11px] font-mono-num font-bold text-[#475F3E]">Pending</span>
                            </div>
                            <p class="text-xs text-[#5A5D64] font-body">
                                {{ formatShortDay(swap.shift?.start_at) }} · {{ format24h(swap.shift?.start_at) }}–{{ format24h(swap.shift?.end_at) }} ({{ swap.shift?.role_label || 'Shift' }}).
                            </p>
                            <div class="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    class="flex-1 py-1.5 px-3 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-colors cursor-pointer"
                                    @click="approveSwap(swap)"
                                >
                                    Approve Swap
                                </button>
                                <button
                                    type="button"
                                    class="py-1.5 px-3 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#C34043] bg-white border border-[#DCD7CE] transition-colors cursor-pointer"
                                    @click="rejectSwap(swap)"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>

                        <!-- Pending Time-Off Requests -->
                        <div
                            v-for="req in filteredPendingTimeOff"
                            :key="`timeoff-${req.id}`"
                            class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] space-y-2.5"
                        >
                            <div class="flex items-start justify-between gap-2">
                                <div>
                                    <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#8C6D36]">
                                        Time-Off Request
                                    </span>
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28] mt-0.5">
                                        {{ req.user?.name }} ({{ req.start_date }} – {{ req.end_date }})
                                    </h3>
                                </div>
                                <span class="text-[11px] font-mono-num font-bold text-[#475F3E]">Pending</span>
                            </div>
                            <p class="text-xs text-[#5A5D64] font-body">
                                {{ req.reason || 'Requested leave' }}
                            </p>
                            <div class="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    class="flex-1 py-1.5 px-3 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-colors cursor-pointer"
                                    @click="approveTimeOff(req)"
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    class="py-1.5 px-3 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#C34043] bg-white border border-[#DCD7CE] transition-colors cursor-pointer"
                                    @click="rejectTimeOff(req)"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="filteredPendingSwaps.length === 0 && filteredPendingTimeOff.length === 0"
                            class="py-6 text-center text-xs text-[#5A5D64] font-body"
                        >
                            All pending swap and time-off requests reviewed.
                        </div>
                    </div>
                </section>

                <!-- Store Managers Summary -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5">
                    <div class="flex items-center justify-between pb-4 border-b border-[#DCD7CE]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Store Managers</h2>
                            <p class="text-xs text-[#5A5D64] font-body mt-0.5">Role &amp; management staff</p>
                        </div>
                        <RouterLink
                            to="/team"
                            class="text-xs font-headline font-bold text-[#2D4F67] hover:underline"
                        >
                            Manage Roles →
                        </RouterLink>
                    </div>

                    <div v-if="managersList.length === 0" class="py-6 text-center text-xs text-[#5A5D64]">
                        No managers assigned. Promote staff in Team Management.
                    </div>

                    <div v-else class="divide-y divide-[#E7E3DC] mt-2">
                        <div
                            v-for="mgr in managersList"
                            :key="mgr.id"
                            class="py-3 flex items-center justify-between gap-3"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline font-bold text-xs flex items-center justify-center">
                                    {{ getInitials(mgr.name) }}
                                </div>
                                <div>
                                    <div class="text-xs font-headline font-bold text-[#1F1F28]">{{ mgr.name }}</div>
                                    <div class="text-[11px] text-[#5A5D64] font-body">{{ mgr.email }}</div>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#EDF3EA] text-[#475F3E] capitalize">
                                {{ mgr.role }}
                            </span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
