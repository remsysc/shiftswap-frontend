<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { swapsApi } from '../api/swaps';
import { ApiRequestError } from '../api/client';
import type { ShiftSwap, SwapStatus } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const swaps = ref<ShiftSwap[]>([]);
const activeFilter = ref<string>('all');
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Reject modal state
const showRejectModal = ref(false);
const rejectingSwap = ref<ShiftSwap | null>(null);
const managerNotes = ref('');
const isSubmitting = ref(false);

const filterTabs = [
    { label: 'All', value: 'all' },
    { label: 'Offered', value: 'offered' },
    { label: 'Pending Approval', value: 'pending_approval' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Cancelled', value: 'cancelled' },
];

const filteredSwaps = computed(() => {
    if (activeFilter.value === 'all') return swaps.value;
    return swaps.value.filter((s) => s.status === activeFilter.value);
});

async function loadSwaps(): Promise<void> {
    if (!authStore.businessId) return;
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
    if (!authStore.businessId) return;
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
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.cancelSwap(authStore.businessId, swap.id);
        successAlert.value = 'Swap offer cancelled.';
        await loadSwaps();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to cancel swap.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleApproveSwap(swap: ShiftSwap): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.approveSwap(authStore.businessId, swap.id);
        successAlert.value = 'Shift swap approved and assignments updated.';
        await loadSwaps();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to approve swap.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

function openRejectModal(swap: ShiftSwap): void {
    rejectingSwap.value = swap;
    managerNotes.value = '';
    showRejectModal.value = true;
}

async function confirmRejectSwap(): Promise<void> {
    if (!authStore.businessId || !rejectingSwap.value) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.rejectSwap(authStore.businessId, rejectingSwap.value.id, managerNotes.value);
        showRejectModal.value = false;
        successAlert.value = 'Swap request rejected and returned to open offers.';
        await loadSwaps();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to reject swap.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

function statusBadgeClass(status: SwapStatus): string {
    switch (status) {
        case 'offered':
            return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'pending_approval':
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        case 'rejected':
            return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'cancelled':
            return 'bg-slate-50 text-slate-600 border-slate-200';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200';
    }
}

onMounted(() => {
    loadSwaps();
});
</script>

<template>
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">Shift Swap Marketplace</h1>
            <p class="text-sm text-slate-500 mt-0.5">Trade shifts with teammates or review pending approvals</p>
        </div>

        <!-- Alerts -->
        <div v-if="errorAlert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {{ errorAlert }}
        </div>
        <div v-if="successAlert" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {{ successAlert }}
        </div>

        <!-- Filter Tabs -->
        <div class="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
            <button
                v-for="tab in filterTabs"
                :key="tab.value"
                :class="[
                    activeFilter === tab.value
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 font-medium',
                    'px-3.5 py-1.5 rounded-xl text-xs transition border border-slate-200/80',
                ]"
                @click="activeFilter = tab.value"
            >
                {{ tab.label }}
            </button>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="py-12 text-center text-sm text-slate-500">
            Loading swap marketplace...
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredSwaps.length === 0" class="bg-white p-10 text-center rounded-2xl border border-slate-200/80 shadow-sm">
            <p class="text-sm font-semibold text-slate-700">No shift swaps found</p>
            <p class="text-xs text-slate-400 mt-1">Check back later or offer a shift from the Schedule tab.</p>
        </div>

        <!-- Swaps Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                v-for="swap in filteredSwaps"
                :key="swap.id"
                class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4"
            >
                <div class="space-y-3">
                    <!-- Card Top: Offerer & Status -->
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                {{ swap.offered_by.name.slice(0, 2).toUpperCase() }}
                            </div>
                            <div>
                                <p class="text-xs font-bold text-slate-900">{{ swap.offered_by.name }}</p>
                                <p class="text-[11px] text-slate-400">Offered for swap</p>
                            </div>
                        </div>

                        <span :class="['text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border', statusBadgeClass(swap.status)]">
                            {{ swap.status.replace('_', ' ') }}
                        </span>
                    </div>

                    <!-- Shift Info Box -->
                    <div v-if="swap.shift" class="bg-slate-50/70 p-3 rounded-xl border border-slate-100 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold text-slate-800">{{ swap.shift.role_label }}</span>
                            <span v-if="swap.shift.location" class="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {{ swap.shift.location.name }}
                            </span>
                        </div>
                        <p class="text-xs text-slate-600 font-medium">
                            {{ new Date(swap.shift.start_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }} • 
                            {{ new Date(swap.shift.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }} – 
                            {{ new Date(swap.shift.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}
                        </p>
                    </div>

                    <!-- Offerer Notes -->
                    <p v-if="swap.notes" class="text-xs text-slate-600 italic bg-amber-50/30 p-2 rounded-lg border border-amber-100/50">
                        "{{ swap.notes }}"
                    </p>

                    <!-- Requester Callout -->
                    <div v-if="swap.requested_by" class="text-xs text-slate-700 bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                        <div>
                            <span class="text-[10px] font-bold uppercase text-indigo-600">Requested by:</span>
                            <p class="font-semibold text-slate-900">{{ swap.requested_by.name }}</p>
                        </div>
                    </div>

                    <!-- Manager Notes (on rejection) -->
                    <p v-if="swap.manager_notes" class="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                        <span class="font-bold">Manager note:</span> {{ swap.manager_notes }}
                    </p>
                </div>

                <!-- Card Actions Footer -->
                <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                    <!-- Staff can request swap if offered and not own -->
                    <button
                        v-if="swap.status === 'offered' && swap.offered_by.id !== authStore.user?.id"
                        :disabled="isSubmitting"
                        class="px-3.5 py-1.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                        @click="handleRequestSwap(swap)"
                    >
                        Request Swap
                    </button>

                    <!-- Offerer can cancel if still in offered status -->
                    <button
                        v-if="swap.status === 'offered' && swap.offered_by.id === authStore.user?.id"
                        :disabled="isSubmitting"
                        class="px-3.5 py-1.5 rounded-xl font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                        @click="handleCancelSwap(swap)"
                    >
                        Cancel Offer
                    </button>

                    <!-- Managers can approve or reject pending_approval swaps -->
                    <template v-if="isManager && swap.status === 'pending_approval'">
                        <button
                            :disabled="isSubmitting"
                            class="px-3 py-1.5 rounded-xl font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                            @click="openRejectModal(swap)"
                        >
                            Reject
                        </button>
                        <button
                            :disabled="isSubmitting"
                            class="px-3.5 py-1.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition"
                            @click="handleApproveSwap(swap)"
                        >
                            Approve
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- Reject Modal -->
        <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Reject Swap Request</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showRejectModal = false">✕</button>
                </div>

                <p class="text-xs text-slate-500">
                    Rejecting will return the shift offer to the marketplace and notify the requester.
                </p>

                <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Reason / Notes (Optional)</label>
                    <textarea
                        v-model="managerNotes"
                        rows="3"
                        placeholder="e.g. Requires specific senior barista certification."
                        class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    ></textarea>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        @click="showRejectModal = false"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        :disabled="isSubmitting"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700"
                        @click="confirmRejectSwap"
                    >
                        Confirm Rejection
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
