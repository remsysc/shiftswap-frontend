<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { timeOffApi } from '../api/timeOff';
import { ApiRequestError } from '../api/client';
import type { TimeOffRequest, Shift } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const requests = ref<TimeOffRequest[]>([]);
const activeFilter = ref<string>('all');
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Modals
const showCreateModal = ref(false);
const showDetailModal = ref(false);
const activeDetail = ref<TimeOffRequest | null>(null);
const activeConflicts = ref<Shift[]>([]);

// Form state
const newStartDate = ref(new Date().toISOString().slice(0, 10));
const newEndDate = ref(new Date().toISOString().slice(0, 10));
const newReason = ref('');
const managerDecisionNotes = ref('');
const isSubmitting = ref(false);

const filterTabs = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Approved', value: 'approved' },
    { label: 'Rejected', value: 'rejected' },
];

const filteredRequests = computed(() => {
    if (activeFilter.value === 'all') return requests.value;
    return requests.value.filter((r) => r.status === activeFilter.value);
});

async function loadRequests(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await timeOffApi.list(authStore.businessId);
        requests.value = res.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load time-off requests.';
    } finally {
        isLoading.value = false;
    }
}

async function handleCreateRequest(): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await timeOffApi.create(authStore.businessId, {
            start_date: newStartDate.value,
            end_date: newEndDate.value,
            reason: newReason.value,
        });

        showCreateModal.value = false;
        newReason.value = '';
        successAlert.value = 'Time-off request submitted successfully.';
        await loadRequests();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to submit time-off request.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function openDetails(req: TimeOffRequest): Promise<void> {
    if (!authStore.businessId) return;
    activeDetail.value = req;
    activeConflicts.value = [];
    showDetailModal.value = true;

    try {
        const detailRes = await timeOffApi.get(authStore.businessId, req.id);
        activeDetail.value = detailRes.data;
        activeConflicts.value = detailRes.conflicts || [];
    } catch {
        // ignore
    }
}

async function handleApprove(req: TimeOffRequest): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await timeOffApi.approve(authStore.businessId, req.id, managerDecisionNotes.value);
        showDetailModal.value = false;
        successAlert.value = 'Time-off request approved.';
        await loadRequests();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to approve request.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleReject(req: TimeOffRequest): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await timeOffApi.reject(authStore.businessId, req.id, managerDecisionNotes.value);
        showDetailModal.value = false;
        successAlert.value = 'Time-off request rejected.';
        await loadRequests();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to reject request.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

onMounted(() => {
    loadRequests();
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Time-Off Requests</h1>
                <p class="text-sm text-slate-500 mt-0.5">Request vacation or leave and manage team availability</p>
            </div>

            <button
                class="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                @click="showCreateModal = true"
            >
                + Request Time Off
            </button>
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

        <!-- Loading -->
        <div v-if="isLoading" class="py-12 text-center text-sm text-slate-500">
            Loading time-off requests...
        </div>

        <!-- Empty -->
        <div v-else-if="filteredRequests.length === 0" class="bg-white p-10 text-center rounded-2xl border border-slate-200/80 shadow-sm">
            <p class="text-sm font-semibold text-slate-700">No time-off requests</p>
            <p class="text-xs text-slate-400 mt-1">Submit a new request above.</p>
        </div>

        <!-- Requests Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
                v-for="req in filteredRequests"
                :key="req.id"
                class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4"
            >
                <div class="space-y-3">
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                                {{ (req.user?.name || 'U').slice(0, 2).toUpperCase() }}
                            </div>
                            <div>
                                <p class="text-xs font-bold text-slate-900">{{ req.user?.name }}</p>
                                <p class="text-[11px] text-slate-400">Time-off request</p>
                            </div>
                        </div>

                        <span
                            :class="[
                                req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : '',
                                req.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : '',
                                req.status === 'pending' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : '',
                                'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                            ]"
                        >
                            {{ req.status }}
                        </span>
                    </div>

                    <div class="bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <p class="text-xs font-bold text-slate-800">
                            {{ new Date(req.start_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) }}
                            –
                            {{ new Date(req.end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) }}
                        </p>
                        <p v-if="req.reason" class="text-xs text-slate-600 mt-1 italic">"{{ req.reason }}"</p>
                    </div>

                    <div v-if="req.manager_notes" class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span class="font-bold text-[10px] uppercase text-slate-400 block">Manager note:</span>
                        {{ req.manager_notes }}
                    </div>
                </div>

                <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                    <button
                        class="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                        @click="openDetails(req)"
                    >
                        {{ isManager && req.status === 'pending' ? 'Review Request' : 'View Details' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Request Time-Off Modal -->
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Request Time Off</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showCreateModal = false">✕</button>
                </div>

                <form class="space-y-3" @submit.prevent="handleCreateRequest">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Start Date</label>
                            <input
                                v-model="newStartDate"
                                type="date"
                                required
                                class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">End Date</label>
                            <input
                                v-model="newEndDate"
                                type="date"
                                required
                                class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Reason (Optional)</label>
                        <textarea
                            v-model="newReason"
                            rows="3"
                            placeholder="e.g. Doctor's appointment, vacation, personal leave."
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        ></textarea>
                    </div>

                    <div class="pt-3 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showCreateModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                        >
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Detail / Review Modal -->
        <div v-if="showDetailModal && activeDetail" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Time-Off Details</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showDetailModal = false">✕</button>
                </div>

                <div class="space-y-3 text-xs">
                    <div>
                        <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Staff Member:</span>
                        <p class="font-bold text-sm text-slate-900">{{ activeDetail.user?.name }} ({{ activeDetail.user?.email }})</p>
                    </div>

                    <div>
                        <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Dates:</span>
                        <p class="font-semibold text-slate-800">{{ activeDetail.start_date }} to {{ activeDetail.end_date }}</p>
                    </div>

                    <!-- Conflicts Section -->
                    <div>
                        <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Overlapping Assigned Shifts:</span>
                        <div v-if="activeConflicts.length === 0" class="p-2 rounded-lg bg-emerald-50 text-emerald-700 font-semibold mt-1">
                            ✓ No overlapping shifts assigned during this period.
                        </div>
                        <div v-else class="space-y-1.5 mt-1">
                            <div
                                v-for="cf in activeConflicts"
                                :key="cf.id"
                                class="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium"
                            >
                                <span class="font-bold">{{ cf.role_label }}</span> — 
                                {{ new Date(cf.start_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) }}
                            </div>
                        </div>
                    </div>

                    <!-- Manager Review Actions -->
                    <div v-if="isManager && activeDetail.status === 'pending'" class="pt-3 border-t border-slate-100 space-y-3">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Manager Note</label>
                            <input
                                v-model="managerDecisionNotes"
                                type="text"
                                placeholder="Optional decision note..."
                                class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>

                        <div class="flex items-center justify-end gap-2">
                            <button
                                :disabled="isSubmitting"
                                class="px-3.5 py-1.5 rounded-xl font-bold text-xs text-rose-600 hover:bg-rose-50 border border-rose-200"
                                @click="handleReject(activeDetail)"
                            >
                                Reject
                            </button>
                            <button
                                :disabled="isSubmitting"
                                class="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                @click="handleApprove(activeDetail)"
                            >
                                Approve
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
