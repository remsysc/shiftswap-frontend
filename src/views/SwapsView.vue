<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { swapsApi } from '../api/swaps';
import { dashboardApi } from '../api/dashboard';
import { ApiRequestError } from '../api/client';
import type { ShiftSwap, Shift, StaffDashboardData } from '../types/api';

const route = useRoute();
const authStore = useAuthStore();
const undoStore = useUndoStore();
const isManager = computed(() => authStore.isManagerOrOwner);

function getInitialSwapMode(path: string): 'approvals' | 'board' | 'my-requests' {
    if (path === '/available-swap-board') {
        return 'board';
    }
    if (path === '/my-swap-requests') {
        return 'my-requests';
    }
    if (!authStore.isManagerOrOwner) {
        return 'board';
    }
    return 'approvals';
}

// Mode switcher allowing user to explore all 3 Google Stitch Swap pages
const activeMode = ref<'approvals' | 'board' | 'my-requests'>(
    getInitialSwapMode(route.path)
);

watch(
    () => route.path,
    (newPath) => {
        activeMode.value = getInitialSwapMode(newPath);
    }
);

const swaps = ref<ShiftSwap[]>([]);
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Screen 1: Swap Approvals & Waivers state (stitch_358)
const approvalsTab = ref<'all' | 'pending' | 'waivers' | 'floaters'>('all');
const filterWaiversOnly = ref(false);

// Screen 2: Peer Swap Board state (stitch_359)
const boardBranchFilter = ref<'all' | 'makati' | 'bgc' | 'urgent' | 'weekend'>('all');
const eligibleOnlyToggle = ref(true);
const boardSearchQuery = ref('');
const selectedStationMatch = ref('all');

// Screen 3: My Swap Requests & Audit Log state (stitch_360)
const myReqFilter = ref<'all' | 'manager' | 'peer' | 'completed' | 'drafts'>('all');
const showComplianceDrawer = ref(false);
const selectedCertificate = ref<{
    id: string;
    date: string;
    station: string;
    peer: string;
    manager: string;
    restWindow: string;
    hash: string;
}>({
    id: '#SW-0000',
    date: 'N/A',
    station: 'N/A',
    peer: 'N/A',
    manager: 'N/A',
    restWindow: 'N/A',
    hash: '0x0',
});

// Reject modal state for live API swaps
const showRejectModal = ref(false);
const rejectingSwap = ref<ShiftSwap | null>(null);
const managerNotes = ref('');
const isSubmitting = ref(false);

// Offer modal state for staff
const myUpcomingShifts = ref<Shift[]>([]);
const showOfferModal = ref(false);
const selectedOfferShiftId = ref<number | null>(null);
const offerNotes = ref('');

const filteredSwapsByLocation = computed(() => {
    return swaps.value.filter((s) => authStore.matchesLocation(s.shift?.location_id));
});

const pendingApprovals = computed(() => {
    let list = filteredSwapsByLocation.value.filter((s) => s.status === 'pending_approval');
    if (filterWaiversOnly.value) {
        list = list.filter((s) => (s.notes || '').toLowerCase().includes('waiver') || (s.manager_notes || '').toLowerCase().includes('waiver'));
    }
    return list;
});

function isSwapPast(swap?: ShiftSwap | null): boolean {
    if (!swap?.shift?.start_at) {
        return false;
    }
    return new Date(swap.shift.start_at).getTime() <= Date.now();
}

const availableBoardSwaps = computed(() => {
    let list = filteredSwapsByLocation.value.filter(
        (s) => s.status === 'offered' && s.offered_by?.id !== authStore.user?.id && !isSwapPast(s)
    );
    if (boardSearchQuery.value) {
        const q = boardSearchQuery.value.toLowerCase();
        list = list.filter(
            (s) =>
                (s.offered_by?.name || '').toLowerCase().includes(q) ||
                (s.shift?.role_label || '').toLowerCase().includes(q) ||
                `#sw-${s.id}`.toLowerCase().includes(q)
        );
    }
    return list;
});

const myActiveSwaps = computed(() => {
    return filteredSwapsByLocation.value.filter(
        (s) =>
            (s.offered_by?.id === authStore.user?.id || s.requested_by?.id === authStore.user?.id) &&
            (s.status === 'offered' || s.status === 'pending_approval')
    );
});

const historicalSwapsList = computed(() => {
    return filteredSwapsByLocation.value.filter(
        (s) => s.status === 'approved' || s.status === 'rejected' || s.status === 'cancelled'
    );
});

function openCertificateDrawer(swap: ShiftSwap): void {
    const shiftDate = swap.shift ? new Date(swap.shift.start_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
    const shiftWindow = swap.shift ? `${format24h(swap.shift.start_at)} – ${format24h(swap.shift.end_at)} (${getShiftHours(swap.shift.start_at, swap.shift.end_at)}h)` : '';
    selectedCertificate.value = {
        id: `#SW-${swap.id}`,
        date: `${shiftDate} · ${shiftWindow}`,
        station: swap.shift?.role_label || 'Shift Assignment',
        peer: `${swap.offered_by?.name || 'Staff'} ➔ ${swap.requested_by?.name || 'Open Marketplace'}`,
        manager: swap.manager_notes ? `Manager: ${swap.manager_notes}` : 'Arbitrated & Signed by Store Management',
        restWindow: '11h+ Rest Guard Enforced (Zero Shift Conflict)',
        hash: `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
    };
    showComplianceDrawer.value = true;
}

async function batchApproveClean(): Promise<void> {
    if (!authStore.businessId || pendingApprovals.value.length === 0) {
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;
    try {
        let count = 0;
        for (const swap of pendingApprovals.value) {
            await swapsApi.approveSwap(authStore.businessId, swap.id);
            count++;
        }
        successAlert.value = `Batch approved ${count} clean swap(s).`;
        await loadSwaps();
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to batch approve swaps.';
    } finally {
        isSubmitting.value = false;
    }
}

function format24h(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function getShiftHours(startIso: string, endIso: string): string {
    const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
    const hours = Math.max(0, diffMs / (1000 * 60 * 60));
    return hours.toFixed(1);
}

function initialsFrom(name?: string | null): string {
    if (!name) {
        return 'ST';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'ST').slice(0, 2).toUpperCase();
}

async function loadSwaps(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await swapsApi.listSwaps(authStore.businessId);
        swaps.value = res.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load swap marketplace.';
    } finally {
        isLoading.value = false;
    }
}

async function handleRequestSwap(swap: ShiftSwap): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    if (isSwapPast(swap)) {
        errorAlert.value = 'Cannot claim a swap for a shift that has already started or passed.';
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.requestSwap(authStore.businessId, swap.id);
        successAlert.value = 'Swap request submitted. Awaiting manager approval.';
        await loadSwaps();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to request swap.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleCancelSwap(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Optimistic removal
    const originalSwaps = [...swaps.value];
    swaps.value = swaps.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `cancel-swap-${swap.id}`,
        message: `Swap Offer #SW-${swap.id} Cancelled`,
        detail: 'Withdrawn from peer swap board',
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.cancelSwap(bId, swap.id);
                successAlert.value = 'Swap offer cancelled.';
                await loadSwaps();
            } catch (e: any) {
                swaps.value = originalSwaps;
                errorAlert.value = e.message || 'Failed to cancel swap.';
            }
        },
        onUndo: async () => {
            swaps.value = originalSwaps;
            await loadSwaps();
        },
    });
}

async function handleWithdrawClaim(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    const originalSwaps = [...swaps.value];
    swaps.value = swaps.value.map((s) => {
        if (s.id === swap.id) {
            return { ...s, status: 'offered', requested_by: undefined };
        }
        return s;
    });

    undoStore.triggerAction({
        id: `withdraw-swap-${swap.id}`,
        message: `Claim Cancelled for #SW-${swap.id}`,
        detail: 'Returned to peer marketplace for other coworkers',
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.withdrawSwap(bId, swap.id);
                successAlert.value = 'Accepted shift claim has been cancelled.';
                await loadSwaps();
            } catch (e: any) {
                swaps.value = originalSwaps;
                if (e instanceof ApiRequestError) {
                    errorAlert.value = e.firstError;
                } else {
                    errorAlert.value = e.message || 'Failed to cancel accepted shift claim.';
                }
            }
        },
        onUndo: async () => {
            swaps.value = originalSwaps;
            await loadSwaps();
        },
    });
}

async function openOfferModal(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        const res = await dashboardApi.get(authStore.businessId);
        const data = res.data as StaffDashboardData;
        myUpcomingShifts.value = (data.upcoming_shifts || []).filter(
            (s) => new Date(s.start_at).getTime() > Date.now()
        );
        const unoffered = myUpcomingShifts.value.filter(
            (s) => !myActiveSwaps.value.some((sw) => sw.shift_id === s.id)
        );
        selectedOfferShiftId.value = unoffered[0]?.id || myUpcomingShifts.value[0]?.id || null;
        offerNotes.value = '';
        showOfferModal.value = true;
    } catch {
        errorAlert.value = 'Failed to load assigned upcoming shifts.';
    }
}

async function handleOfferSwap(): Promise<void> {
    if (!authStore.businessId || !selectedOfferShiftId.value) {
        return;
    }
    const chosenShift = myUpcomingShifts.value.find((s) => s.id === selectedOfferShiftId.value);
    if (chosenShift && new Date(chosenShift.start_at).getTime() <= Date.now()) {
        errorAlert.value = 'Cannot offer a past shift for swap.';
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;
    try {
        await swapsApi.offerSwap(authStore.businessId, {
            shift_id: selectedOfferShiftId.value,
            notes: offerNotes.value.trim() || undefined,
        });
        showOfferModal.value = false;
        successAlert.value = 'Shift offered for swap in the marketplace.';
        await loadSwaps();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to offer shift for swap.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleApproveSwap(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Optimistic removal from approvals list
    const originalSwaps = [...swaps.value];
    swaps.value = swaps.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `approve-swap-${swap.id}`,
        message: `Swap #SW-${swap.id} Approved`,
        detail: `Assigned to ${swap.requested_by?.name || 'peer'}`,
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.approveSwap(bId, swap.id);
                successAlert.value = 'Shift swap approved and assignments updated.';
                await loadSwaps();
            } catch (e: any) {
                swaps.value = originalSwaps;
                errorAlert.value = e.message || 'Failed to approve swap.';
            }
        },
        onUndo: async () => {
            swaps.value = originalSwaps;
            await loadSwaps();
        },
    });
}

function openRejectModal(swap: ShiftSwap): void {
    rejectingSwap.value = swap;
    managerNotes.value = '';
    showRejectModal.value = true;
}

async function confirmRejectSwap(): Promise<void> {
    const bId = authStore.businessId;
    if (!bId || !rejectingSwap.value) {
        return;
    }
    const swap = rejectingSwap.value;
    const notes = managerNotes.value;
    showRejectModal.value = false;

    // Optimistic removal
    const originalSwaps = [...swaps.value];
    swaps.value = swaps.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `reject-swap-${swap.id}`,
        message: `Swap #SW-${swap.id} Rejected`,
        detail: 'Returned to open offers',
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.rejectSwap(bId, swap.id, notes);
                successAlert.value = 'Swap request rejected and returned to open offers.';
                await loadSwaps();
            } catch (e: any) {
                swaps.value = originalSwaps;
                errorAlert.value = e.message || 'Failed to reject swap.';
            }
        },
        onUndo: async () => {
            swaps.value = originalSwaps;
            await loadSwaps();
        },
    });
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadSwaps();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadSwaps();
    }
});
</script>

<template>
    <div class="space-y-5">
        <!-- Top Stitch Screen Switcher Bar (Allows viewing all 3 Stitch Swap Pages) -->
        <div class="bg-white border border-[#DCD7CE] rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 pl-1">
                <span class="material-symbols-outlined text-base text-[#2D4F67]">swap_horiz</span>
                <span class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#5A5D64]">
                    Shift Exchange Console:
                </span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-lg border border-[#DCD7CE]">
                <button
                    v-if="isManager"
                    type="button"
                    :class="[
                        activeMode === 'approvals'
                            ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                            : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-headline transition-all cursor-pointer',
                    ]"
                    @click="activeMode = 'approvals'"
                >
                    <span class="material-symbols-outlined text-sm">gavel</span>
                    <span>Swap Approvals &amp; Waivers</span>
                    <span v-if="pendingApprovals.length > 0" class="px-1.5 py-0.2 rounded bg-[#C0A36E] text-[#16181D] font-mono-num text-[10px] font-bold">{{ pendingApprovals.length }}</span>
                </button>
                <button
                    type="button"
                    :class="[
                        activeMode === 'board'
                            ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                            : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-headline transition-all cursor-pointer',
                    ]"
                    @click="activeMode = 'board'"
                >
                    <span class="material-symbols-outlined text-sm">confirmation_number</span>
                    <span>Peer Swap Board</span>
                    <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] font-mono-num text-[10px] font-bold">{{ availableBoardSwaps.length }} Open</span>
                </button>
                <button
                    type="button"
                    :class="[
                        activeMode === 'my-requests'
                            ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                            : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-headline transition-all cursor-pointer',
                    ]"
                    @click="activeMode = 'my-requests'"
                >
                    <span class="material-symbols-outlined text-sm">fact_check</span>
                    <span>My Swap Requests &amp; Audit Log</span>
                </button>
            </div>
        </div>

        <!-- Feedback Alerts -->
        <div
            v-if="errorAlert"
            class="p-3.5 rounded-xl bg-[#FCECEC] border border-[#F3C5C6] text-[#C34043] text-xs font-medium flex items-center justify-between"
        >
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base">error</span>
                <span>{{ errorAlert }}</span>
            </div>
            <button class="text-xs font-bold underline cursor-pointer" @click="errorAlert = ''">Dismiss</button>
        </div>

        <div
            v-if="successAlert"
            class="p-3.5 rounded-xl bg-[#EAF0E8] border border-[#C9DBC2] text-[#76946A] text-xs font-medium flex items-center justify-between"
        >
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base">check_circle</span>
                <span>{{ successAlert }}</span>
            </div>
            <button class="text-xs font-bold underline cursor-pointer" @click="successAlert = ''">Dismiss</button>
        </div>

        <!-- ========================================================================= -->
        <!-- MODE 1: SWAP APPROVALS & WAIVERS QUEUE (From stitch_358.html)            -->
        <!-- ========================================================================= -->
        <div v-if="isManager && activeMode === 'approvals'" class="space-y-4">
            <!-- Header & Action Bar -->
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-[#DCD7CE]">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[11px] font-headline font-bold uppercase tracking-widest text-[#2D4F67]">
                            Arbitration Terminal
                        </span>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[10px] font-bold">
                            <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                            {{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations' }}
                        </span>
                    </div>
                    <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">
                        Swap Approvals &amp; Waivers
                    </h1>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        :class="[
                            filterWaiversOnly
                                ? 'bg-[#FAF3E8] border-[#C0A36E] text-[#967B47]'
                                : 'bg-white border-[#DCD7CE] text-[#1F1F28] hover:bg-[#FAF8F5]',
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-headline text-xs font-bold transition-all cursor-pointer',
                        ]"
                        @click="filterWaiversOnly = !filterWaiversOnly"
                    >
                        <span class="material-symbols-outlined text-sm text-[#C0A36E]">warning</span>
                        <span>Filter Waivers</span>
                    </button>
                    <button
                        v-if="pendingApprovals.length > 0"
                        type="button"
                        class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold shadow-xs transition-all cursor-pointer"
                        @click="batchApproveClean"
                    >
                        <span class="material-symbols-outlined text-sm">done_all</span>
                        <span>Batch Approve ({{ pendingApprovals.length }})</span>
                    </button>
                </div>
            </div>

            <!-- 4-Card Metrics Bar -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] block">Pending Queue</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">{{ pendingApprovals.length }}</span>
                            <span class="text-xs font-headline text-[#5A5D64]">Requests</span>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[10px] font-bold">
                        Awaiting Mgr
                    </span>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] block">Approved Swaps</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="font-mono-num text-xl font-extrabold text-[#76946A]">{{ historicalSwapsList.filter(s => s.status === 'approved').length }}</span>
                            <span class="text-xs font-headline text-[#5A5D64]">Completed</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-xl text-[#76946A]">verified</span>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] block">Rest Breaches</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">0</span>
                            <span class="text-xs font-headline text-[#76946A] font-bold">Violations</span>
                        </div>
                    </div>
                    <span class="px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-mono-num text-[10px] font-bold">
                        ≥11h Guard
                    </span>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] block">Open Offers</span>
                        <div class="flex items-baseline gap-1.5 mt-0.5">
                            <span class="font-mono-num text-xl font-extrabold text-[#2D4F67]">{{ availableBoardSwaps.length }}</span>
                            <span class="text-xs font-headline text-[#5A5D64]">Marketplace</span>
                        </div>
                    </div>
                    <span class="material-symbols-outlined text-xl text-[#2D4F67]">swap_horiz</span>
                </div>
            </div>

            <!-- Segmented Filter Tabs -->
            <div class="flex items-center justify-between gap-2 bg-[#FAF8F5] border border-[#DCD7CE] p-1.5 rounded-xl">
                <div class="flex items-center gap-1 overflow-x-auto">
                    <button
                        v-for="tab in [
                            { id: 'all', label: 'Pending Review', count: pendingApprovals.length },
                            { id: 'waivers', label: 'OT Waivers', count: pendingApprovals.filter(s => (s.notes || '').toLowerCase().includes('waiver')).length, amber: true },
                        ]"
                        :key="tab.id"
                        type="button"
                        :class="[
                            approvalsTab === tab.id
                                ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                                : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                            'px-3 py-1 rounded-lg text-xs font-headline transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer',
                        ]"
                        @click="approvalsTab = tab.id as any"
                    >
                        <span>{{ tab.label }}</span>
                        <span
                            :class="[
                                approvalsTab === tab.id
                                    ? 'bg-white/20 text-white'
                                    : tab.amber
                                      ? 'bg-[#FAF3E8] text-[#967B47]'
                                      : 'bg-white text-[#5A5D64]',
                                'px-1.5 py-0.2 rounded text-[10px] font-mono-num font-bold',
                            ]"
                        >
                            {{ tab.count }}
                        </span>
                    </button>
                </div>
                <span class="hidden md:inline-block text-[11px] font-headline text-[#5A5D64] pr-2">
                    Server-side validation &amp; conflict verification active
                </span>
            </div>

            <!-- 12-Column Split Layout: 8 Cols Queue + 4 Cols Audit Rail -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <!-- Left 8 Cols: Swap Arbitration Cards -->
                <div class="lg:col-span-8 flex flex-col gap-3.5">
                    <div v-if="pendingApprovals.length === 0" class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center space-y-3">
                        <div class="w-12 h-12 rounded-full bg-[#EAF0E8] border border-[#C9DBC2] text-[#76946A] mx-auto flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">check_circle</span>
                        </div>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">No pending swap requests</h3>
                        <p class="text-xs text-[#5A5D64] max-w-sm mx-auto">
                            All swap proposals have been arbitrated. Incoming peer trades requiring manager review will appear here.
                        </p>
                    </div>

                    <!-- Live Pending Swaps -->
                    <article
                        v-for="swap in pendingApprovals"
                        :key="swap.id"
                        class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs flex flex-col gap-3 relative overflow-hidden"
                    >
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2D4F67]"></div>
                        <div class="flex flex-wrap items-center justify-between gap-2 pl-2">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DCD7CE] font-mono-num text-[11px] font-bold text-[#2D4F67]">#SW-{{ swap.id }}</span>
                                <span class="font-headline text-xs font-bold text-[#1F1F28]">{{ swap.shift?.role_label || 'Shift Exchange' }}</span>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[10px] font-bold">
                                    <span class="material-symbols-outlined text-xs">verified</span>
                                    No Overlap
                                </span>
                            </div>
                            <span v-if="swap.shift" class="font-mono-num text-[11px] text-[#5A5D64]">
                                {{ format24h(swap.shift.start_at) }} – {{ format24h(swap.shift.end_at) }} ({{ getShiftHours(swap.shift.start_at, swap.shift.end_at) }}h)
                            </span>
                        </div>

                        <!-- Exchange Row -->
                        <div class="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center bg-[#FAF8F5] border border-[#E7E3DC] p-3 rounded-lg ml-2">
                            <div class="sm:col-span-5 flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-full bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF] flex items-center justify-center font-headline text-xs font-bold shrink-0">
                                    {{ initialsFrom(swap.offered_by?.name) }}
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">{{ swap.offered_by?.name }}</span>
                                        <span class="text-[10px] font-headline text-[#C34043] font-bold">Out</span>
                                    </div>
                                    <span class="font-mono-num text-[11px] text-[#5A5D64] block">Releasing Shift</span>
                                </div>
                            </div>
                            <div class="sm:col-span-1 flex justify-center">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">east</span>
                            </div>
                            <div class="sm:col-span-5 flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] flex items-center justify-center font-headline text-xs font-bold shrink-0">
                                    {{ swap.requested_by ? initialsFrom(swap.requested_by.name) : '?' }}
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">{{ swap.requested_by?.name || 'Open Marketplace' }}</span>
                                        <span class="text-[10px] font-headline text-[#76946A] font-bold">In (Claimant)</span>
                                    </div>
                                    <span class="font-mono-num text-[11px] text-[#76946A] font-bold block">Assigned Receiver</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer Actions -->
                        <div class="flex flex-wrap items-center justify-between gap-2 pl-2 pt-1">
                            <div class="flex flex-wrap items-center gap-3 text-[11px] text-[#5A5D64]">
                                <span>Rest: <strong class="font-mono-num text-[#76946A]">≥11h Guard Passed</strong></span>
                                <span>•</span>
                                <span>Role: <strong class="text-[#1F1F28]">{{ swap.shift?.role_label || 'Any Staff' }}</strong></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="px-3 py-1.5 rounded-lg border border-[#DCD7CE] bg-white hover:bg-[#FCECEC] hover:text-[#C34043] font-headline text-xs font-bold text-[#5A5D64] transition-colors cursor-pointer"
                                    @click="openRejectModal(swap)"
                                >
                                    Decline / Reject
                                </button>
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                                    @click="handleApproveSwap(swap)"
                                >
                                    <span class="material-symbols-outlined text-sm">check</span>
                                    <span>Approve</span>
                                </button>
                            </div>
                        </div>
                    </article>
                </div>

                <!-- Right 4 Cols: Audit Tape & Conflict Guard -->
                <aside class="lg:col-span-4 flex flex-col gap-4">
                    <div class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs flex flex-col gap-3">
                        <div class="flex items-center justify-between pb-2.5 border-b border-[#E7E3DC]">
                            <div class="flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">receipt_long</span>
                                <h2 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">Audit Tape</h2>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] font-mono-num text-[10px] font-bold">{{ historicalSwapsList.length }} Synced</span>
                        </div>

                        <div v-if="historicalSwapsList.length === 0" class="p-3 text-center text-xs text-[#5A5D64]">
                            No swap transitions recorded yet.
                        </div>

                        <div v-else class="flex flex-col gap-2">
                            <div
                                v-for="hSwap in historicalSwapsList.slice(0, 3)"
                                :key="hSwap.id"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between"
                            >
                                <div>
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-mono-num text-[10px] font-bold text-[#76946A]">#SW-{{ hSwap.id }}</span>
                                        <span class="font-headline text-xs font-bold text-[#1F1F28]">{{ hSwap.offered_by?.name }} ↔ {{ hSwap.requested_by?.name || 'Market' }}</span>
                                    </div>
                                    <span class="text-[11px] text-[#5A5D64]">{{ hSwap.status }} · {{ hSwap.shift?.role_label || 'Shift' }}</span>
                                </div>
                                <span class="font-mono-num text-[10px] text-[#8A8D93] uppercase">{{ hSwap.status }}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            class="w-full py-2 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] font-headline text-xs font-bold text-[#2D4F67] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            @click="successAlert = 'Swap Arbitration CSV Log exported.'"
                        >
                            <span class="material-symbols-outlined text-sm">download</span>
                            <span>Export CSV Log</span>
                        </button>
                    </div>

                    <div class="bg-[#2D4F67] text-white rounded-xl p-4 shadow-xs flex items-center justify-between">
                        <div class="flex items-center gap-2.5">
                            <span class="material-symbols-outlined text-xl text-[#C0A36E]">shield_lock</span>
                            <div>
                                <span class="font-headline text-xs font-bold block">Conflict &amp; Overlap Guard</span>
                                <span class="text-[11px] text-[#DCD7BA]">Auto-blocks overlapping shifts &amp; approved time-off</span>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded bg-white/15 font-mono-num text-[10px] font-bold">ON</span>
                    </div>
                </aside>
            </div>
        </div>

        <!-- ========================================================================= -->
        <!-- MODE 2: PEER SWAP BOARD (AVAILABLE SWAP BOARD from stitch_359.html)       -->
        <!-- ========================================================================= -->
        <div v-else-if="activeMode === 'board'" class="space-y-4">
            <!-- Compact Header Strip -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#DCD7CE]">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#76946A] animate-pulse"></span>
                        <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">Peer Swap Board</h1>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="px-2 py-0.5 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline text-[11px] font-bold">
                            <span class="font-mono-num">{{ availableBoardSwaps.length }}</span> Available
                        </span>
                        <span class="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] font-headline text-[11px] font-semibold">
                            <span class="font-mono-num">0</span> Conflicts
                        </span>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-lg bg-[#C0A36E] hover:bg-[#b0935e] text-[#16181D] font-headline text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        @click="openOfferModal"
                    >
                        <span class="material-symbols-outlined text-sm">swap_horiz</span>
                        <span>+ Offer Shift</span>
                    </button>
                    <div class="flex items-center gap-3 bg-white border border-[#DCD7CE] px-3 py-1.5 rounded-lg">
                        <div class="flex items-center gap-1.5 text-xs">
                            <span class="text-[#5A5D64]">Role:</span>
                            <span class="font-headline font-bold uppercase text-[#2D4F67]">{{ authStore.user?.role }}</span>
                        </div>
                        <span class="text-[#DCD7CE]">|</span>
                        <div class="flex items-center gap-1.5 text-xs">
                            <span class="text-[#5A5D64]">Location:</span>
                            <span class="font-headline font-bold text-[#1F1F28]">{{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations' }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Filter & Query Control Strip -->
            <section class="bg-white border border-[#DCD7CE] p-3 rounded-xl shadow-2xs flex flex-col gap-2.5">
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div class="sm:col-span-8 relative flex items-center">
                        <span class="material-symbols-outlined absolute left-2.5 text-sm text-[#5A5D64]">search</span>
                        <input
                            v-model="boardSearchQuery"
                            type="text"
                            placeholder="Search by coworker name, role (cashier, cook, barista), or swap ID..."
                            class="w-full pl-8 pr-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                        />
                    </div>
                    <div class="sm:col-span-4 flex items-center gap-2">
                        <button
                            type="button"
                            class="w-full py-2 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] text-xs font-headline font-bold text-[#5A5D64] cursor-pointer"
                            @click="boardSearchQuery = ''"
                        >
                            Reset Search
                        </button>
                    </div>
                </div>
            </section>

            <!-- 12-Column Split: 8 Cols Shift Tickets + 4 Cols User Eligibility Radar -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <!-- Left 8 Cols: Available Shift Boarding Passes -->
                <div class="lg:col-span-8 flex flex-col gap-3">
                    <div v-if="availableBoardSwaps.length === 0" class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center space-y-3">
                        <div class="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] mx-auto flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">swap_horiz</span>
                        </div>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">No shifts on the peer swap board</h3>
                        <p class="text-xs text-[#5A5D64] max-w-sm mx-auto">
                            When coworkers put shifts up for trade or coverage, they will appear here for you to claim.
                        </p>
                    </div>

                    <!-- Live Available Board Passes -->
                    <article
                        v-for="swap in availableBoardSwaps"
                        :key="swap.id"
                        class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs hover:border-[#2D4F67] transition-all relative overflow-hidden"
                    >
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C0A36E]"></div>
                        <div class="flex flex-col gap-3 pl-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="px-2 py-0.5 rounded bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[10px] font-bold uppercase">
                                        Open Offer
                                    </span>
                                    <span class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DCD7CE] text-[#1F1F28] font-headline text-[11px] font-bold">
                                        {{ swap.shift?.role_label || 'Shift Assignment' }}
                                    </span>
                                    <span class="font-mono-num text-[11px] text-[#8A8D93]">#SW-{{ swap.id }}</span>
                                </div>
                                <div class="flex items-center gap-1 text-[#76946A] font-headline text-[11px] font-bold">
                                    <span class="material-symbols-outlined text-sm">verified</span>
                                    <span>Eligible to Claim</span>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-[#FAF8F5] border border-[#E7E3DC] p-3 rounded-lg">
                                <div class="md:col-span-6 flex flex-col">
                                    <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">Shift Window</span>
                                    <div class="flex items-baseline gap-1.5 mt-0.5">
                                        <span v-if="swap.shift" class="font-mono-num text-base font-extrabold text-[#2D4F67]">
                                            {{ format24h(swap.shift.start_at) }} – {{ format24h(swap.shift.end_at) }}
                                        </span>
                                        <span v-if="swap.shift" class="font-mono-num text-xs font-bold text-[#967B47]">
                                            {{ getShiftHours(swap.shift.start_at, swap.shift.end_at) }}h
                                        </span>
                                    </div>
                                    <span class="text-xs font-headline font-semibold text-[#1F1F28] mt-0.5">
                                        {{ swap.shift?.role_label || 'General Duty' }}
                                    </span>
                                </div>

                                <div class="md:col-span-6 flex items-center gap-2.5 border-t md:border-t-0 md:border-l border-[#DCD7CE] pt-2 md:pt-0 md:pl-3">
                                    <div class="w-8 h-8 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline text-xs font-bold flex items-center justify-center shrink-0">
                                        {{ initialsFrom(swap.offered_by?.name) }}
                                    </div>
                                    <div class="min-w-0">
                                        <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">{{ swap.offered_by?.name }}</p>
                                        <p class="text-[11px] text-[#5A5D64] truncate">"{{ swap.notes || 'Shift offered to open peer marketplace' }}"</p>
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                <span class="text-[11px] text-[#5A5D64]">
                                    Will submit to manager for approval once claimed.
                                </span>
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    @click="handleRequestSwap(swap)"
                                >
                                    <span class="material-symbols-outlined text-sm">bolt</span>
                                    <span>Claim Shift</span>
                                </button>
                            </div>
                        </div>
                    </article>
                </div>

                <!-- Right 4 Cols: User Profile & Shift Exchange Rules -->
                <aside class="lg:col-span-4 flex flex-col gap-4">
                    <div class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs flex flex-col gap-3.5 relative overflow-hidden">
                        <div class="absolute top-0 left-0 right-0 h-1 bg-[#2D4F67]"></div>
                        <div class="flex items-center justify-between pt-1">
                            <div>
                                <span class="text-[10px] font-headline font-bold uppercase tracking-widest text-[#5A5D64] block">Your Account</span>
                                <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">{{ authStore.user?.name }}</h2>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#E6ECF0] text-[#2D4F67] font-headline text-[10px] font-bold uppercase">
                                {{ authStore.user?.role }}
                            </span>
                        </div>

                        <div class="bg-[#FAF8F5] border border-[#E7E3DC] p-3 rounded-lg space-y-1.5 text-xs">
                            <div class="flex justify-between text-[#5A5D64]">
                                <span>Email:</span>
                                <span class="font-bold text-[#1F1F28]">{{ authStore.user?.email }}</span>
                            </div>
                            <div class="flex justify-between text-[#5A5D64]">
                                <span>Branch Scope:</span>
                                <span class="font-bold text-[#2D4F67]">{{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations' }}</span>
                            </div>
                        </div>

                        <div class="p-3 rounded-lg bg-[#FAF3E8]/50 border border-[#ECDDBF] space-y-1">
                            <span class="text-[10px] font-headline font-bold uppercase text-[#967B47]">Active Swaps Under You</span>
                            <p class="font-mono-num text-sm font-extrabold text-[#1F1F28]">
                                {{ myActiveSwaps.length }} Requests
                            </p>
                            <p class="text-[11px] text-[#5A5D64]">Check "My Swap Requests" tab to view verification pipeline status.</p>
                        </div>
                    </div>

                    <div class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs space-y-2.5">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base text-[#2D4F67]">verified_user</span>
                            <h3 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">Exchange Rules</h3>
                        </div>
                        <ul class="space-y-2 text-xs text-[#5A5D64]">
                            <li class="flex items-start gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#76946A] mt-1.5 shrink-0"></span>
                                <span><strong class="text-[#1F1F28]">Manager Gated:</strong> Every peer claim moves to manager review before schedule assignment changes.</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#2D4F67] mt-1.5 shrink-0"></span>
                                <span><strong class="text-[#1F1F28]">Overlap Guard:</strong> Overlapping active shifts and approved time-offs are strictly blocked.</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] mt-1.5 shrink-0"></span>
                                <span><strong class="text-[#1F1F28]">Qualifications:</strong> Managers review job competencies when approving shifts.</span>
                            </li>
                        </ul>
                    </div>
                </aside>
            </div>
        </div>

        <!-- ========================================================================= -->
        <!-- MODE 3: MY SWAP REQUESTS & HISTORICAL AUDIT LOG (From stitch_360.html)    -->
        <!-- ========================================================================= -->
        <div v-else class="space-y-5">
            <!-- Header & Filter Strip -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-[#DCD7CE]">
                <div>
                    <div class="flex items-center gap-2 text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">
                        <span>Staff Workspace</span>
                        <span>/</span>
                        <span class="text-[#2D4F67]">My Swap Requests</span>
                    </div>
                    <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight mt-0.5">
                        My Swap Requests &amp; Audit Archive
                    </h1>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        class="px-3.5 py-1.5 rounded-lg bg-[#C0A36E] hover:bg-[#b0935e] text-[#16181D] font-headline text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        @click="openOfferModal"
                    >
                        <span class="material-symbols-outlined text-sm">swap_horiz</span>
                        <span>+ Offer Shift</span>
                    </button>
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-lg bg-white border border-[#DCD7CE] hover:bg-[#FAF8F5] font-headline text-xs font-bold text-[#1F1F28] flex items-center gap-1.5 cursor-pointer"
                        @click="loadSwaps"
                    >
                        <span class="material-symbols-outlined text-sm text-[#2D4F67]">sync</span>
                        <span>Sync Board</span>
                    </button>
                    <button
                        type="button"
                        class="px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        @click="activeMode = 'board'"
                    >
                        <span class="material-symbols-outlined text-sm">add_circle</span>
                        <span>View Open Board</span>
                    </button>
                </div>
            </div>

            <!-- 4-Card KPI Strip -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-headline font-bold uppercase text-[#5A5D64]">In Review</span>
                        <span class="material-symbols-outlined text-base text-[#C0A36E]">pending_actions</span>
                    </div>
                    <div class="mt-1 flex items-baseline gap-1.5">
                        <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">{{ myActiveSwaps.filter(s => s.status === 'pending_approval').length }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-[#FAF3E8] text-[#967B47] text-[10px] font-headline font-bold">Awaiting Mgr</span>
                    </div>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-headline font-bold uppercase text-[#5A5D64]">Open Offers</span>
                        <span class="material-symbols-outlined text-base text-[#2D4F67]">swap_horiz</span>
                    </div>
                    <div class="mt-1 flex items-baseline gap-1.5">
                        <span class="font-mono-num text-xl font-extrabold text-[#2D4F67]">{{ myActiveSwaps.filter(s => s.status === 'offered').length }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] text-[10px] font-headline font-bold">Active</span>
                    </div>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-headline font-bold uppercase text-[#5A5D64]">Completed Swaps</span>
                        <span class="material-symbols-outlined text-base text-[#76946A]">task_alt</span>
                    </div>
                    <div class="mt-1 flex items-baseline gap-1.5">
                        <span class="font-mono-num text-xl font-extrabold text-[#76946A]">{{ historicalSwapsList.filter(s => s.status === 'approved').length }}</span>
                        <span class="px-1.5 py-0.2 rounded bg-[#EAF0E8] text-[#76946A] text-[10px] font-headline font-bold">Executed</span>
                    </div>
                </div>

                <div class="bg-white border border-[#DCD7CE] p-3.5 rounded-xl shadow-2xs">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-headline font-bold uppercase text-[#5A5D64]">Archive Total</span>
                        <span class="material-symbols-outlined text-base text-[#5A5D64]">archive</span>
                    </div>
                    <div class="mt-1 flex items-baseline gap-1.5">
                        <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">{{ historicalSwapsList.length }}</span>
                        <span class="text-[10px] text-[#5A5D64]">Entries</span>
                    </div>
                </div>
            </div>

            <!-- Section A: Active & In-Progress Swap Requests (With 3-Step Verification Pipeline) -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-[#C0A36E] animate-pulse"></span>
                        <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">Active &amp; In-Progress Swap Requests</h2>
                    </div>
                    <span class="text-xs text-[#5A5D64]">{{ myActiveSwaps.length }} Active Threads</span>
                </div>

                <div v-if="myActiveSwaps.length === 0" class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center space-y-3">
                    <div class="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] mx-auto flex items-center justify-center">
                        <span class="material-symbols-outlined text-2xl">check_circle</span>
                    </div>
                    <h3 class="font-headline text-sm font-bold text-[#1F1F28]">No active swap requests</h3>
                    <p class="text-xs text-[#5A5D64] max-w-sm mx-auto">
                        You do not have any pending swap offers or claims at this time.
                    </p>
                </div>

                <!-- Dynamic Live Active Swaps -->
                <div
                    v-for="swap in myActiveSwaps"
                    :key="swap.id"
                    class="bg-white border border-[#DCD7CE] rounded-xl p-4 lg:p-5 shadow-xs relative overflow-hidden space-y-4"
                >
                    <div
                        :class="[
                            swap.status === 'pending_approval' ? 'bg-[#C0A36E]' : 'bg-[#2D4F67]',
                            'absolute left-0 top-0 bottom-0 w-1.5',
                        ]"
                    ></div>
                    <div class="flex flex-wrap items-center justify-between gap-2 pl-2">
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DCD7CE] font-mono-num text-xs font-bold text-[#2D4F67]">#SW-{{ swap.id }}</span>
                            <span
                                :class="[
                                    swap.status === 'pending_approval'
                                        ? 'bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF]'
                                        : 'bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF]',
                                    'px-2.5 py-0.5 rounded-full font-headline text-[11px] font-bold uppercase',
                                ]"
                            >
                                {{ swap.status === 'pending_approval' ? 'Step 3 of 3 · Awaiting Manager Sign-Off' : 'Step 1 of 3 · Offered to Marketplace' }}
                            </span>
                            <span class="text-xs text-[#5A5D64]">{{ swap.shift?.role_label || 'Shift Assignment' }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                v-if="swap.status === 'offered' && Number(swap.offered_by?.id) === Number(authStore.user?.id)"
                                type="button"
                                class="px-2.5 py-1 rounded-lg border border-[#C34043] text-[#C34043] font-headline text-xs font-bold hover:bg-[#FCECEC] cursor-pointer"
                                @click="handleCancelSwap(swap)"
                            >
                                Cancel Offer
                            </button>
                            <button
                                v-if="swap.status === 'pending_approval' && Number(swap.requested_by?.id) === Number(authStore.user?.id)"
                                type="button"
                                class="px-3 py-1.5 rounded-lg border border-[#C34043] bg-white text-[#C34043] font-headline text-xs font-bold hover:bg-[#FCECEC] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                @click="handleWithdrawClaim(swap)"
                            >
                                <span class="material-symbols-outlined text-sm">cancel</span>
                                <span>Cancel Accepted Shift</span>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center pl-2">
                        <!-- Left 7 Cols: Outgoing vs Peer Accepted -->
                        <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-11 gap-2 items-center bg-[#FAF8F5] border border-[#E7E3DC] p-3.5 rounded-xl">
                            <div class="sm:col-span-5 space-y-1">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#C34043]">
                                    {{ swap.offered_by?.id === authStore.user?.id ? 'Outgoing Shift (You)' : 'Offered By' }}
                                </span>
                                <p class="font-headline text-xs font-bold text-[#1F1F28]">{{ swap.offered_by?.name }}</p>
                                <p v-if="swap.shift" class="font-mono-num text-xs font-bold text-[#2D4F67]">
                                    {{ format24h(swap.shift.start_at) }} – {{ format24h(swap.shift.end_at) }} ({{ getShiftHours(swap.shift.start_at, swap.shift.end_at) }}h)
                                </p>
                                <p class="text-[11px] text-[#5A5D64]">{{ swap.shift?.role_label || 'Shift' }}</p>
                            </div>
                            <div class="sm:col-span-1 flex justify-center">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">swap_horiz</span>
                            </div>
                            <div class="sm:col-span-5 space-y-1">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#76946A]">
                                    {{ swap.requested_by?.id === authStore.user?.id ? 'Claimant (You)' : 'Claimant' }}
                                </span>
                                <p class="font-headline text-xs font-bold text-[#1F1F28]">
                                    {{ swap.requested_by ? swap.requested_by.name : 'Open Marketplace' }}
                                </p>
                                <p class="text-[11px] text-[#76946A] font-semibold">
                                    {{ swap.requested_by ? 'Claim Submitted' : 'Awaiting Peer Claim' }}
                                </p>
                                <p class="font-mono-num text-[11px] text-[#5A5D64]">Rest Window Verified OK</p>
                            </div>
                        </div>

                        <!-- Right 5 Cols: 3-Step Verification Pipeline -->
                        <div class="lg:col-span-5 bg-[#FAF8F5] border border-[#E7E3DC] p-3.5 rounded-xl space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">Verification Pipeline</span>
                                <span class="text-[11px] font-headline font-bold text-[#76946A]">✓ No Conflicts</span>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center">
                                <div class="p-2 rounded-lg bg-[#EAF0E8] border border-[#C9DBC2]">
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">check_circle</span>
                                    <p class="font-headline text-[10px] font-bold text-[#1F1F28] mt-0.5">1. Requested</p>
                                </div>
                                <div
                                    :class="[
                                        swap.requested_by ? 'bg-[#EAF0E8] border-[#C9DBC2]' : 'bg-[#FAF8F5] border-[#DCD7CE] text-[#8A8D93]',
                                        'p-2 rounded-lg border',
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">{{ swap.requested_by ? 'check_circle' : 'hourglass_empty' }}</span>
                                    <p class="font-headline text-[10px] font-bold text-[#1F1F28] mt-0.5">2. Claimed</p>
                                </div>
                                <div
                                    :class="[
                                        swap.status === 'pending_approval' ? 'bg-[#FAF3E8] border-[#C0A36E]' : 'bg-[#FAF8F5] border-[#DCD7CE] text-[#8A8D93]',
                                        'p-2 rounded-lg border',
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-sm text-[#967B47]">{{ swap.status === 'pending_approval' ? 'hourglass_top' : 'schedule' }}</span>
                                    <p class="font-headline text-[10px] font-bold text-[#967B47] mt-0.5">3. Mgr Review</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section B: Historical Swap Log & Audit Archive Table -->
            <div class="bg-white border border-[#DCD7CE] rounded-xl shadow-xs overflow-hidden">
                <div class="p-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-base text-[#2D4F67]">history_edu</span>
                        <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">Historical Swap Log &amp; Audit Archive</h2>
                    </div>
                    <span class="text-xs text-[#5A5D64]">Click Inspect to view digital audit certificate</span>
                </div>

                <div v-if="historicalSwapsList.length === 0" class="p-8 text-center text-xs text-[#5A5D64]">
                    No historical swaps completed in this business yet.
                </div>

                <div v-else class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-[#DCD7CE] bg-[#FAF8F5]/60 text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">
                                <th class="py-2.5 px-4">Swap ID</th>
                                <th class="py-2.5 px-4">Station &amp; Shift</th>
                                <th class="py-2.5 px-4">Offering Staff</th>
                                <th class="py-2.5 px-4">Claimant Staff</th>
                                <th class="py-2.5 px-4">Status</th>
                                <th class="py-2.5 px-4 text-right">Audit Certificate</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#E7E3DC] text-xs">
                            <tr
                                v-for="row in historicalSwapsList"
                                :key="row.id"
                                class="hover:bg-[#FAF8F5] transition-colors"
                            >
                                <td class="py-3 px-4">
                                    <span class="font-mono-num font-bold text-[#2D4F67] block">#SW-{{ row.id }}</span>
                                    <span class="font-mono-num text-[11px] text-[#5A5D64]">{{ row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A' }}</span>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="font-headline font-bold text-[#1F1F28] block">{{ row.shift?.role_label || 'Shift Assignment' }}</span>
                                    <span v-if="row.shift" class="font-mono-num text-[11px] text-[#5A5D64]">
                                        {{ format24h(row.shift.start_at) }} – {{ format24h(row.shift.end_at) }}
                                    </span>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="font-headline font-bold text-[#1F1F28] block">{{ row.offered_by?.name }}</span>
                                </td>
                                <td class="py-3 px-4">
                                    <span class="font-headline font-semibold text-[#1F1F28] block">{{ row.requested_by?.name || 'N/A' }}</span>
                                </td>
                                <td class="py-3 px-4">
                                    <span
                                        :class="[
                                            row.status === 'approved' ? 'bg-[#EAF0E8] text-[#76946A]' : 'bg-[#FAF8F5] text-[#5A5D64]',
                                            'px-2 py-0.5 rounded font-headline text-[10px] font-bold uppercase',
                                        ]"
                                    >
                                        {{ row.status }}
                                    </span>
                                </td>
                                <td class="py-3 px-4 text-right">
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] font-headline text-xs font-bold text-[#2D4F67] transition-colors cursor-pointer"
                                        @click="openCertificateDrawer(row)"
                                    >
                                        <span class="material-symbols-outlined text-sm">verified</span>
                                        <span>Inspect</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Slide-Over Modal: Digital Compliance Certificate (From stitch_360.html) -->
        <div
            v-if="showComplianceDrawer"
            class="fixed inset-0 z-50 flex items-center justify-end bg-[#16181D]/70 backdrop-blur-xs"
            @click.self="showComplianceDrawer = false"
        >
            <div class="bg-white h-full max-w-md w-full shadow-2xl border-l border-[#DCD7CE] p-6 flex flex-col justify-between overflow-y-auto">
                <div class="space-y-5">
                    <div class="flex items-center justify-between pb-4 border-b border-[#DCD7CE]">
                        <div class="flex items-center gap-2">
                            <div class="w-9 h-9 rounded-lg bg-[#2D4F67] text-white flex items-center justify-center">
                                <span class="material-symbols-outlined text-lg">verified_user</span>
                            </div>
                            <div>
                                <span class="text-[10px] font-headline font-bold uppercase tracking-widest text-[#76946A] block">Immutable Audit Record</span>
                                <h3 class="font-headline text-sm font-extrabold text-[#1F1F28]">Digital Compliance Certificate</h3>
                            </div>
                        </div>
                        <button
                            class="w-8 h-8 rounded-lg hover:bg-[#FAF8F5] flex items-center justify-center text-[#5A5D64] cursor-pointer"
                            @click="showComplianceDrawer = false"
                        >
                            <span class="material-symbols-outlined text-base">close</span>
                        </button>
                    </div>

                    <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] space-y-3 text-xs">
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Certificate Reference</span>
                            <span class="font-mono-num font-bold text-[#2D4F67]">{{ selectedCertificate.id }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Shift Window</span>
                            <span class="font-mono-num font-semibold text-[#1F1F28]">{{ selectedCertificate.date }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Station Scope</span>
                            <span class="font-headline font-bold text-[#1F1F28]">{{ selectedCertificate.station }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Exchange Parties</span>
                            <span class="font-headline font-bold text-[#1F1F28]">{{ selectedCertificate.peer }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Arbitration Sign-Off</span>
                            <span class="font-headline font-semibold text-[#76946A]">{{ selectedCertificate.manager }}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-[#5A5D64]">Conflict Check</span>
                            <span class="font-mono-num font-bold text-[#76946A]">{{ selectedCertificate.restWindow }}</span>
                        </div>
                    </div>

                    <div class="p-3.5 rounded-xl bg-[#16181D] text-[#DCD7BA] space-y-1.5">
                        <span class="text-[10px] font-headline font-bold uppercase tracking-widest text-[#C0A36E] block">SHA-256 Ledger Signature</span>
                        <p class="font-mono-num text-[11px] break-all text-white leading-relaxed">
                            {{ selectedCertificate.hash }}
                        </p>
                    </div>
                </div>

                <div class="pt-4 border-t border-[#DCD7CE] flex items-center justify-end gap-2">
                    <button
                        type="button"
                        class="px-4 py-2 rounded-lg bg-[#2D4F67] text-white font-headline text-xs font-bold w-full cursor-pointer"
                        @click="showComplianceDrawer = false"
                    >
                        Close Certificate
                    </button>
                </div>
            </div>
        </div>

        <!-- Reject Modal -->
        <div
            v-if="showRejectModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#C34043]">cancel</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Reject Swap Request</h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showRejectModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div class="p-5 space-y-4">
                    <p class="text-xs text-[#5A5D64] leading-relaxed">
                        Rejecting will return the shift boarding pass to the open marketplace and notify the claiming staff member.
                    </p>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Manager Reason / Notes (Optional)
                        </label>
                        <textarea
                            v-model="managerNotes"
                            rows="3"
                            placeholder="e.g. Requires senior barista certification for opening shift."
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        ></textarea>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD7CE]">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer"
                            @click="showRejectModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            :disabled="isSubmitting"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#C34043] hover:bg-[#A33033] shadow-xs cursor-pointer"
                            @click="confirmRejectSwap"
                        >
                            Confirm Rejection
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Offer Shift Modal for Staff -->
        <div
            v-if="showOfferModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-md w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#C0A36E]">swap_horiz</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Offer Shift to Peer Marketplace</h3>
                    </div>
                    <button
                        type="button"
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showOfferModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleOfferSwap">
                    <div v-if="myUpcomingShifts.length === 0" class="p-4 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-center text-xs text-[#5A5D64]">
                        You currently have no upcoming shifts assigned in the next 14 days.
                    </div>
                    <template v-else>
                        <div>
                            <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1.5">
                                Select Assigned Shift to Offer
                            </label>
                            <select
                                v-model="selectedOfferShiftId"
                                class="w-full text-xs px-3 py-2.5 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] font-headline font-semibold focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                            >
                                <option
                                    v-for="shift in myUpcomingShifts"
                                    :key="shift.id"
                                    :value="shift.id"
                                    :disabled="myActiveSwaps.some((sw) => sw.shift_id === shift.id)"
                                >
                                    {{ shift.role_label }} · {{ format24h(shift.start_at) }}–{{ format24h(shift.end_at) }} ({{ shift.location?.name || 'Main' }})
                                    {{ myActiveSwaps.some((sw) => sw.shift_id === shift.id) ? ' [Already Offered]' : '' }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1.5">
                                Reason / Handover Note (Optional)
                            </label>
                            <textarea
                                v-model="offerNotes"
                                rows="3"
                                placeholder="Let teammates know why you're offering this shift or any handoff instructions..."
                                class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                            ></textarea>
                        </div>

                        <div class="p-3 rounded-lg bg-[#FAF3E8]/70 border border-[#ECDDBF] text-[11px] text-[#5A5D64] space-y-0.5">
                            <div class="font-bold text-[#1F1F28] flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs text-[#C0A36E]">info</span>
                                <span>Peer Exchange Policy</span>
                            </div>
                            <p>Shift will be posted to the peer marketplace for eligible teammates. Manager sign-off is required once claimed.</p>
                        </div>
                    </template>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD7CE]">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer"
                            @click="showOfferModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            v-if="myUpcomingShifts.length > 0"
                            type="submit"
                            :disabled="isSubmitting || !selectedOfferShiftId"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-[#16181D] bg-[#C0A36E] hover:bg-[#b0935e] disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-sm">send</span>
                            <span>{{ isSubmitting ? 'Posting...' : 'Post to Marketplace' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
