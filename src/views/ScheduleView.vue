<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { shiftsApi } from '../api/shifts';
import { locationsApi } from '../api/locations';
import { staffApi } from '../api/staff';
import { swapsApi } from '../api/swaps';
import { ApiRequestError } from '../api/client';
import type { Shift, Location, BusinessMember } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const weekOffset = ref(0);
const activeView = ref<'week' | 'list'>('week');
const selectedLocation = ref<string>('all');
const selectedStaff = ref<string>('all');

const shifts = ref<Shift[]>([]);
const locations = ref<Location[]>([]);
const staffMembers = ref<BusinessMember[]>([]);
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Modal states
const showCreateModal = ref(false);
const showAssignModal = ref(false);
const showOfferSwapModal = ref(false);
const activeShift = ref<Shift | null>(null);

// Form models
const newShiftRole = ref('');
const newShiftLocation = ref<number | null>(null);
const newShiftDate = ref(new Date().toISOString().slice(0, 10));
const newShiftStart = ref('09:00');
const newShiftEnd = ref('17:00');
const assignUserId = ref<number | null>(null);
const swapNotes = ref('');
const isSubmitting = ref(false);

const hours = [
    '8 AM', '9 AM', '10 AM', '11 AM', '12 PM',
    '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM',
];

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Calculate start of current week (Monday)
const baseMonday = computed(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff + weekOffset.value * 7);
    d.setHours(0, 0, 0, 0);
    return d;
});

const weekDays = computed(() => {
    return dayNames.map((name, index) => {
        const d = new Date(baseMonday.value);
        d.setDate(d.getDate() + index);
        const iso = d.toISOString().slice(0, 10);
        const todayIso = new Date().toISOString().slice(0, 10);
        return {
            name,
            dateNumber: d.getDate(),
            fullDate: iso,
            isToday: iso === todayIso,
        };
    });
});

const weekRange = computed(() => {
    const start = weekDays.value[0]?.fullDate || '';
    const end = weekDays.value[6]?.fullDate || '';
    return { start, end };
});

const weekLabel = computed(() => {
    if (!weekDays.value.length) return '';
    const first = new Date(weekDays.value[0].fullDate);
    const last = new Date(weekDays.value[6].fullDate);
    return `${first.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
});

const filteredShifts = computed(() => {
    return shifts.value.filter((shift) => {
        if (selectedLocation.value !== 'all') {
            if (String(shift.location_id) !== selectedLocation.value) return false;
        }
        if (selectedStaff.value !== 'all') {
            const hasUser = shift.assigned_staff?.some((s) => String(s.user_id) === selectedStaff.value);
            if (!hasUser) return false;
        }
        return true;
    });
});

async function loadShifts(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await shiftsApi.listShifts(
            authStore.businessId,
            weekRange.value.start,
            weekRange.value.end
        );
        shifts.value = res.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load shifts.';
    } finally {
        isLoading.value = false;
    }
}

async function loadMeta(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        const [locRes, staffRes] = await Promise.all([
            locationsApi.list(authStore.businessId),
            staffApi.list(authStore.businessId),
        ]);
        locations.value = locRes.data;
        staffMembers.value = staffRes.data.map((m: any) => ({
            id: m.user?.id || m.id,
            name: m.name || m.user?.name || '',
            email: m.email || m.user?.email || '',
            role: m.role || m.user?.role || 'staff',
        }));
    } catch {
        // ignore
    }
}

function prevWeek(): void {
    weekOffset.value--;
    loadShifts();
}

function nextWeek(): void {
    weekOffset.value++;
    loadShifts();
}

function today(): void {
    weekOffset.value = 0;
    loadShifts();
}

async function handleCreateShift(): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        const startAt = `${newShiftDate.value}T${newShiftStart.value}:00Z`;
        const endAt = `${newShiftDate.value}T${newShiftEnd.value}:00Z`;

        await shiftsApi.createShift(authStore.businessId, {
            role_label: newShiftRole.value,
            location_id: newShiftLocation.value ? Number(newShiftLocation.value) : null,
            start_at: startAt,
            end_at: endAt,
        });

        showCreateModal.value = false;
        newShiftRole.value = '';
        successAlert.value = 'Shift created successfully.';
        await loadShifts();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to create shift.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

function openAssignModal(shift: Shift): void {
    activeShift.value = shift;
    assignUserId.value = null;
    showAssignModal.value = true;
}

async function handleAssignStaff(): Promise<void> {
    if (!authStore.businessId || !activeShift.value || !assignUserId.value) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await shiftsApi.assignStaff(authStore.businessId, activeShift.value.id, assignUserId.value);
        showAssignModal.value = false;
        successAlert.value = 'Staff member assigned successfully.';
        await loadShifts();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to assign staff member.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

function openOfferSwapModal(shift: Shift): void {
    activeShift.value = shift;
    swapNotes.value = '';
    showOfferSwapModal.value = true;
}

async function handleOfferSwap(): Promise<void> {
    if (!authStore.businessId || !activeShift.value) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.offerSwap(authStore.businessId, {
            shift_id: activeShift.value.id,
            notes: swapNotes.value,
        });
        showOfferSwapModal.value = false;
        successAlert.value = 'Shift offered for swap in the marketplace.';
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

function getShiftsForDay(dateIso: string): Shift[] {
    return filteredShifts.value.filter((s) => s.start_at.startsWith(dateIso));
}

function isMyShift(shift: Shift): boolean {
    return shift.assigned_staff?.some((s) => s.user_id === authStore.user?.id) || false;
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadMeta();
            loadShifts();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadMeta();
        loadShifts();
    }
});
</script>

<template>
    <div class="space-y-5">
        <!-- Header & Action Controls -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Team Schedule</h1>
                <p class="text-sm text-slate-500 mt-0.5">Manage work shifts, assign coverage, and post swap offers</p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <!-- Week Navigator -->
                <div class="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button class="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition" @click="prevWeek">
                        ‹ Prev
                    </button>
                    <button class="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition" @click="today">
                        Today
                    </button>
                    <button class="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 transition" @click="nextWeek">
                        Next ›
                    </button>
                </div>

                <!-- View Switcher -->
                <div class="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                        :class="[activeView === 'week' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 font-medium', 'px-3 py-1 text-xs rounded-lg transition']"
                        @click="activeView = 'week'"
                    >
                        Calendar
                    </button>
                    <button
                        :class="[activeView === 'list' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 font-medium', 'px-3 py-1 text-xs rounded-lg transition']"
                        @click="activeView = 'list'"
                    >
                        List
                    </button>
                </div>

                <!-- Create Shift Button -->
                <button
                    v-if="isManager"
                    class="inline-flex items-center justify-center px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition"
                    @click="showCreateModal = true"
                >
                    + Create Shift
                </button>
            </div>
        </div>

        <!-- Feedback Alerts -->
        <div v-if="errorAlert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {{ errorAlert }}
        </div>
        <div v-if="successAlert" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {{ successAlert }}
        </div>

        <!-- Filter Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
            <div class="flex items-center gap-3">
                <span class="text-xs font-bold text-slate-700">{{ weekLabel }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <select
                    v-model="selectedLocation"
                    class="text-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                    <option value="all">All Locations</option>
                    <option v-for="loc in locations" :key="loc.id" :value="String(loc.id)">
                        {{ loc.name }}
                    </option>
                </select>

                <select
                    v-model="selectedStaff"
                    class="text-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                    <option value="all">All Staff</option>
                    <option v-for="member in staffMembers" :key="member.id" :value="String(member.id)">
                        {{ member.name }}
                    </option>
                </select>
            </div>
        </div>

        <!-- Calendar / Week Grid View -->
        <div v-if="activeView === 'week'" class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
            <div class="min-w-[800px]">
                <!-- Day Headers -->
                <div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
                    <div
                        v-for="d in weekDays"
                        :key="d.fullDate"
                        :class="['p-3 text-center border-r last:border-r-0 border-slate-200', d.isToday ? 'bg-indigo-50/60' : '']"
                    >
                        <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">{{ d.name }}</p>
                        <p :class="['text-base font-extrabold mt-0.5', d.isToday ? 'text-indigo-600' : 'text-slate-800']">
                            {{ d.dateNumber }}
                        </p>
                    </div>
                </div>

                <!-- Shift Columns -->
                <div class="grid grid-cols-7 min-h-[460px] divide-x divide-slate-100">
                    <div
                        v-for="d in weekDays"
                        :key="d.fullDate"
                        :class="['p-2 space-y-2 bg-slate-50/20', d.isToday ? 'bg-indigo-50/20' : '']"
                    >
                        <div
                            v-for="shift in getShiftsForDay(d.fullDate)"
                            :key="shift.id"
                            class="p-2.5 rounded-xl border border-indigo-100 bg-white shadow-xs hover:shadow-md transition space-y-1.5"
                        >
                            <div class="flex items-center justify-between gap-1">
                                <span class="font-bold text-xs text-slate-900 truncate">{{ shift.role_label }}</span>
                                <span v-if="shift.location" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                    {{ shift.location.name }}
                                </span>
                            </div>

                            <p class="text-[11px] text-slate-500 font-medium">
                                {{ new Date(shift.start_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }} – 
                                {{ new Date(shift.end_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}
                            </p>

                            <!-- Staff assignment pill -->
                            <div class="pt-1 flex flex-wrap items-center gap-1">
                                <template v-if="shift.assigned_staff?.length">
                                    <span
                                        v-for="st in shift.assigned_staff"
                                        :key="st.id"
                                        class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700"
                                    >
                                        {{ st.user?.name || 'Staff' }}
                                    </span>
                                </template>
                                <span v-else class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                    Unassigned
                                </span>
                            </div>

                            <!-- Actions -->
                            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                <button
                                    v-if="isManager"
                                    class="text-indigo-600 hover:text-indigo-800 font-semibold"
                                    @click="openAssignModal(shift)"
                                >
                                    Assign
                                </button>
                                <button
                                    v-if="isMyShift(shift)"
                                    class="text-amber-600 hover:text-amber-700 font-semibold ml-auto"
                                    @click="openOfferSwapModal(shift)"
                                >
                                    Offer Swap
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- List View -->
        <div v-else class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div v-if="filteredShifts.length === 0" class="p-8 text-center text-sm text-slate-500">
                No shifts found for this week.
            </div>

            <div
                v-for="shift in filteredShifts"
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

                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-1.5">
                        <span
                            v-for="st in shift.assigned_staff"
                            :key="st.id"
                            class="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700"
                        >
                            {{ st.user?.name }}
                        </span>
                    </div>

                    <button
                        v-if="isManager"
                        class="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition"
                        @click="openAssignModal(shift)"
                    >
                        Assign
                    </button>

                    <button
                        v-if="isMyShift(shift)"
                        class="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
                        @click="openOfferSwapModal(shift)"
                    >
                        Offer Swap
                    </button>
                </div>
            </div>
        </div>

        <!-- Create Shift Modal -->
        <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Create New Shift</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showCreateModal = false">✕</button>
                </div>

                <form class="space-y-3" @submit.prevent="handleCreateShift">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Role / Label</label>
                        <input
                            v-model="newShiftRole"
                            type="text"
                            required
                            placeholder="e.g. Barista, Kitchen Support"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Location</label>
                        <select
                            v-model="newShiftLocation"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                        >
                            <option :value="null">No location selected</option>
                            <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Date</label>
                        <input
                            v-model="newShiftDate"
                            type="date"
                            required
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Start Time</label>
                            <input
                                v-model="newShiftStart"
                                type="time"
                                required
                                class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">End Time</label>
                            <input
                                v-model="newShiftEnd"
                                type="time"
                                required
                                class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                            />
                        </div>
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
                            {{ isSubmitting ? 'Saving...' : 'Create Shift' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Assign Staff Modal -->
        <div v-if="showAssignModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Assign Staff Member</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showAssignModal = false">✕</button>
                </div>

                <form class="space-y-4" @submit.prevent="handleAssignStaff">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Select Member</label>
                        <select
                            v-model="assignUserId"
                            required
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                        >
                            <option :value="null">Choose staff member...</option>
                            <option v-for="m in staffMembers" :key="m.id" :value="m.id">
                                {{ m.name }} ({{ m.role }})
                            </option>
                        </select>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showAssignModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting || !assignUserId"
                            class="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                        >
                            Confirm Assignment
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Offer Swap Modal -->
        <div v-if="showOfferSwapModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Offer Shift for Swap</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showOfferSwapModal = false">✕</button>
                </div>

                <form class="space-y-4" @submit.prevent="handleOfferSwap">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Note (Optional)</label>
                        <textarea
                            v-model="swapNotes"
                            rows="3"
                            placeholder="e.g. Willing to trade for weekend morning shifts."
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        ></textarea>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showOfferSwapModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700"
                        >
                            Post to Marketplace
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
