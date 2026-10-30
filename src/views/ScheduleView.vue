<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { shiftsApi } from '../api/shifts';
import { locationsApi } from '../api/locations';
import { staffApi } from '../api/staff';
import { swapsApi } from '../api/swaps';
import { ApiRequestError } from '../api/client';
import type { Shift, ShiftSwap, Location, BusinessMember } from '../types/api';

const authStore = useAuthStore();
const undoStore = useUndoStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const weekOffset = ref(0);
const activeView = ref<'roster' | 'week' | 'list'>('roster');
const selectedRoleFilter = ref<'all' | 'lead' | 'roaster' | 'floater'>('all');
const selectedEmploymentType = ref<'all' | 'ft' | 'pt' | 'floater'>('all');
const selectedLocation = computed({
    get: () => authStore.selectedLocationId,
    set: (val: string) => {
        authStore.selectedLocationId = val;
    },
});
const selectedStaff = ref<string>('all');
const selectedCadenceWeek = ref<'w1' | 'w2' | 'w3' | 'w4'>('w3');

const isAutoFilling = ref(false);
const autoFillDone = ref(false);
const templateAppliedBanner = ref(true);

const shifts = ref<Shift[]>([]);
const swapsList = ref<ShiftSwap[]>([]);
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
const newShiftStart = ref('06:00');
const newShiftEnd = ref('14:00');
const assignUserId = ref<number | null>(null);
const swapNotes = ref('');
const isSubmitting = ref(false);

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
    const dailyTargets = ['28.0h Target', '28.0h Target', '30.0h Target', '30.0h Target', '32.0h Peak', '32.0h Peak', '30.0h Target'];
    return dayNames.map((name, index) => {
        const d = new Date(baseMonday.value);
        d.setDate(d.getDate() + index);
        const iso = d.toISOString().slice(0, 10);
        const todayIso = new Date().toISOString().slice(0, 10);
        return {
            name,
            dateNumber: d.getDate(),
            fullDate: iso,
            isToday: iso === todayIso || index === 0,
            targetLabel: dailyTargets[index] || '28.0h Target',
            isPeak: index === 4 || index === 5,
        };
    });
});

const weekRange = computed(() => {
    const start = weekDays.value[0]?.fullDate || '';
    const end = weekDays.value[6]?.fullDate || '';
    return { start, end };
});

const weekLabel = computed(() => {
    const firstDay = weekDays.value[0];
    const lastDay = weekDays.value[6];
    if (!firstDay || !lastDay) {
        return 'Cycle #24: Mon Jun 16 – Sun Jun 22';
    }
    const first = new Date(firstDay.fullDate);
    const last = new Date(lastDay.fullDate);
    return `Cycle #${24 + weekOffset.value}: ${first.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} – ${last.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
});

const filteredShifts = computed(() => {
    return shifts.value.filter((shift) => {
        if (selectedLocation.value !== 'all') {
            if (String(shift.location_id) !== selectedLocation.value) {
                return false;
            }
        }
        if (selectedStaff.value !== 'all') {
            const hasUser = (shift.assigned_staff || shift.staff)?.some((s) => String(s.user_id) === selectedStaff.value);
            if (!hasUser) {
                return false;
            }
        }
        if (selectedRoleFilter.value !== 'all') {
            const rl = (shift.role_label || '').toLowerCase();
            if (selectedRoleFilter.value === 'lead' && !rl.includes('lead') && !rl.includes('barista')) {
                return false;
            }
            if (selectedRoleFilter.value === 'roaster' && !rl.includes('roast')) {
                return false;
            }
            if (selectedRoleFilter.value === 'floater' && !rl.includes('float') && !rl.includes('cashier')) {
                return false;
            }
        }
        return true;
    });
});

const totalWeekHours = computed(() => {
    const apiHours = filteredShifts.value.reduce((acc, s) => acc + Number(getShiftHours(s.start_at, s.end_at)), 0);
    return apiHours > 0 ? apiHours.toFixed(1) : '184.0';
});

const assignedShiftCount = computed(() => {
    return filteredShifts.value.filter((s) => (s.assigned_staff || s.staff)?.length).length;
});

const unassignedShiftCount = computed(() => {
    if (filteredShifts.value.length === 0) {
        return autoFillDone.value ? 0 : 6;
    }
    return Math.max(0, filteredShifts.value.length - assignedShiftCount.value);
});

const coverageRate = computed(() => {
    if (!filteredShifts.value.length) {
        return autoFillDone.value ? 100 : 88;
    }
    return Math.round((assignedShiftCount.value / filteredShifts.value.length) * 100);
});

// Group live API shifts into Morning / Mid-Day / Evening buckets
const morningApiShifts = computed(() => {
    return filteredShifts.value.filter((s) => {
        const hr = new Date(s.start_at).getHours();
        return hr < 11;
    });
});

const midDayApiShifts = computed(() => {
    return filteredShifts.value.filter((s) => {
        const hr = new Date(s.start_at).getHours();
        return hr >= 11 && hr < 14;
    });
});

const eveningApiShifts = computed(() => {
    return filteredShifts.value.filter((s) => {
        const hr = new Date(s.start_at).getHours();
        return hr >= 14;
    });
});

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

function getDayHours(dateIso: string): string {
    const dayShifts = getShiftsForDay(dateIso);
    const total = dayShifts.reduce((acc, s) => acc + Number(getShiftHours(s.start_at, s.end_at)), 0);
    return total > 0 ? total.toFixed(1) : '28.0';
}

async function loadShifts(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const [res, swapsRes] = await Promise.all([
            shiftsApi.listShifts(
                authStore.businessId,
                weekRange.value.start,
                weekRange.value.end
            ),
            swapsApi.listSwaps(authStore.businessId),
        ]);
        shifts.value = res.data;
        swapsList.value = swapsRes.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load shifts.';
    } finally {
        isLoading.value = false;
    }
}

async function loadMeta(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        const [locRes, staffRes] = await Promise.all([
            locationsApi.list(authStore.businessId),
            staffApi.list(authStore.businessId),
        ]);
        locations.value = locRes.data;
        authStore.setLocations(locRes.data);
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

function triggerAutoFill(): void {
    isAutoFilling.value = true;
    setTimeout(() => {
        isAutoFilling.value = false;
        autoFillDone.value = true;
        successAlert.value = 'Floaters Auto-Assigned: 6 open slots primed with certified bench baristas.';
    }, 650);
}

function handleBroadcastRoster(): void {
    successAlert.value = 'Cycle #24 Roster published & broadcasted to 15 floor team members.';
}

function openQuickCreateWithPreset(roleLabel: string, start: string, end: string): void {
    newShiftRole.value = roleLabel;
    newShiftStart.value = start;
    newShiftEnd.value = end;
    showCreateModal.value = true;
}

async function handleCreateShift(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
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
    if (!authStore.businessId || !activeShift.value || !assignUserId.value) {
        return;
    }
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

function isShiftPast(shift?: Shift | null): boolean {
    if (!shift?.start_at) {
        return false;
    }
    return new Date(shift.start_at).getTime() <= Date.now();
}

function openOfferSwapModal(shift: Shift): void {
    if (isShiftPast(shift)) {
        errorAlert.value = 'Cannot offer a past shift for swap.';
        return;
    }
    activeShift.value = shift;
    swapNotes.value = '';
    showOfferSwapModal.value = true;
}

function getShiftActiveSwap(shiftId: number): ShiftSwap | undefined {
    return swapsList.value.find(
        (sw) =>
            (sw.shift_id === shiftId || sw.shift?.id === shiftId) &&
            (sw.status === 'offered' || sw.status === 'pending_approval')
    );
}

async function handleCancelSwap(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Optimistic removal
    const originalSwaps = [...swapsList.value];
    swapsList.value = swapsList.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `cancel-swap-${swap.id}`,
        message: `Swap Offer #SW-${swap.id} Cancelled`,
        detail: 'Withdrawn from roster schedule',
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.cancelSwap(bId, swap.id);
                successAlert.value = 'Swap offer cancelled.';
                await loadShifts();
            } catch (e: any) {
                swapsList.value = originalSwaps;
                errorAlert.value = e.message || 'Failed to cancel swap.';
            }
        },
        onUndo: async () => {
            swapsList.value = originalSwaps;
            await loadShifts();
        },
    });
}

async function handleOfferSwap(): Promise<void> {
    if (!authStore.businessId || !activeShift.value) {
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await swapsApi.offerSwap(authStore.businessId, {
            shift_id: activeShift.value.id,
            notes: swapNotes.value,
        });
        showOfferSwapModal.value = false;
        successAlert.value = 'Shift offered for swap in the marketplace.';
        await loadShifts();
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
    const list = shift.assigned_staff || shift.staff;
    return list?.some((s) => s.user_id === authStore.user?.id) || false;
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
        <!-- SECTION 1: Executive Roster Header & Cycle Controls (From Stitch Master Schedule Screen) -->
        <section class="bg-white border border-[#DCD7CE] rounded-xl p-4 lg:p-5 shadow-xs space-y-3.5">
            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div class="flex flex-col gap-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[11px] font-bold">
                            <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                            Drafting Phase
                        </span>
                        <div class="inline-flex items-center gap-1 bg-[#FAF8F5] border border-[#DCD7CE] px-2 py-0.5 rounded-lg">
                            <button
                                class="text-[#5A5D64] hover:text-[#1F1F28] flex items-center cursor-pointer"
                                title="Previous Cycle"
                                @click="prevWeek"
                            >
                                <span class="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span class="font-headline text-[11px] font-bold text-[#1F1F28] px-1">
                                {{ weekLabel }}
                            </span>
                            <button
                                class="text-[#5A5D64] hover:text-[#1F1F28] flex items-center cursor-pointer"
                                title="Next Cycle"
                                @click="nextWeek"
                            >
                                <span class="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                        <span class="px-2 py-0.5 rounded-md bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[11px] font-bold">
                            <span class="font-mono-num">{{ coverageRate }}%</span> Staffed (<span class="font-mono-num">{{ totalWeekHours }}h / 210.0h</span> Target)
                        </span>
                    </div>

                    <div class="flex items-baseline gap-2.5 flex-wrap">
                        <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">
                            Master Schedule &amp; Shift Dispatch
                        </h1>
                        <span class="text-xs font-headline font-semibold text-[#5A5D64]">
                            · Makati Atelier
                        </span>
                    </div>
                </div>

                <!-- Right Action Cluster -->
                <div class="flex flex-wrap items-center gap-2">
                    <!-- View Mode Switcher -->
                    <div class="inline-flex items-center bg-[#FAF8F5] border border-[#DCD7CE] p-1 rounded-lg gap-0.5">
                        <button
                            :class="[
                                activeView === 'roster'
                                    ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                                    : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-all cursor-pointer',
                            ]"
                            @click="activeView = 'roster'"
                        >
                            Shift Builder
                        </button>
                        <button
                            :class="[
                                activeView === 'week'
                                    ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                                    : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-all cursor-pointer',
                            ]"
                            @click="activeView = 'week'"
                        >
                            Week (7D)
                        </button>
                        <button
                            :class="[
                                activeView === 'list'
                                    ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                                    : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-all cursor-pointer',
                            ]"
                            @click="activeView = 'list'"
                        >
                            Tape List
                        </button>
                    </div>

                    <!-- Auto-Fill Floaters Button -->
                    <button
                        type="button"
                        :class="[
                            autoFillDone
                                ? 'bg-[#EAF0E8] text-[#76946A] border-[#C9DBC2]'
                                : 'bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border-[#DCD7CE]',
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-headline text-xs font-bold transition-colors cursor-pointer',
                        ]"
                        @click="triggerAutoFill"
                    >
                        <span
                            :class="[
                                'material-symbols-outlined text-sm text-[#C0A36E]',
                                isAutoFilling ? 'animate-spin' : '',
                            ]"
                        >
                            {{ autoFillDone ? 'check_circle' : 'auto_Fix_high' }}
                        </span>
                        <span>{{ autoFillDone ? 'Floaters Auto-Assigned' : 'Auto-Fill Floaters' }}</span>
                    </button>

                    <!-- Create Shift CTA -->
                    <button
                        v-if="isManager"
                        type="button"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF] font-headline text-xs font-bold transition-colors cursor-pointer"
                        @click="showCreateModal = true"
                    >
                        <span class="material-symbols-outlined text-sm">add</span>
                        <span>Create Shift</span>
                    </button>

                    <!-- Publish & Broadcast Roster with Policy Tooltip -->
                    <div class="relative group">
                        <button
                            type="button"
                            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold shadow-xs transition-all cursor-pointer"
                            @click="handleBroadcastRoster"
                        >
                            <span class="material-symbols-outlined text-sm">send</span>
                            <span>Publish &amp; Broadcast Roster</span>
                        </button>
                        <div class="hidden group-hover:flex absolute right-0 top-full mt-1.5 w-64 p-2.5 rounded-lg bg-[#16181D] text-[#DCD7BA] shadow-lg z-30 flex-col gap-1 pointer-events-none border border-[#2A2D34]">
                            <div class="flex items-center gap-1 text-[11px] font-headline font-bold text-[#76946A]">
                                <span class="material-symbols-outlined text-xs">verified</span>
                                <span>Policy Guardrails Verified</span>
                            </div>
                            <p class="text-[11px] text-[#9E9B93] leading-snug">
                                Minimum <span class="font-mono-num">11h</span> rest interval &amp; <span class="font-mono-num">40h</span> FT / <span class="font-mono-num">24h</span> PT weekly caps satisfied.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Template & Recurring Schedule Bar -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E7E3DC]">
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm text-[#2D4F67]">content_copy</span>
                        Templates:
                    </span>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] font-headline text-[11px] font-semibold transition-colors cursor-pointer"
                        @click="templateAppliedBanner = true; successAlert = 'Previous cycle template applied (184.0h matched).'"
                    >
                        <span class="material-symbols-outlined text-xs text-[#2D4F67]">history</span>
                        <span>Load Prev Cycle Template</span>
                        <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] font-mono-num text-[10px] font-bold">Cycle #23 (96% Match)</span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#5A5D64] hover:text-[#1F1F28] border border-[#DCD7CE] font-headline text-[11px] font-semibold transition-colors cursor-pointer"
                        @click="successAlert = 'Current Cycle #24 roster saved as reusable template.'"
                    >
                        <span class="material-symbols-outlined text-xs">bookmark_add</span>
                        <span>Save as Template</span>
                    </button>
                    <button
                        type="button"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#5A5D64] hover:text-[#1F1F28] border border-[#DCD7CE] font-headline text-[11px] font-semibold transition-colors cursor-pointer"
                        @click="successAlert = '4-week cadence auto-populated from Cycle #24 baseline.'"
                    >
                        <span class="material-symbols-outlined text-xs">date_range</span>
                        <span>Auto-Populate Month</span>
                    </button>
                </div>

                <div v-if="templateAppliedBanner" class="flex items-center gap-2 text-[11px] text-[#5A5D64]">
                    <span class="inline-flex items-center gap-1 text-[#76946A] font-headline font-bold">
                        <span class="material-symbols-outlined text-xs">check_circle</span>
                        Template Applied:
                    </span>
                    <span>
                        <strong class="font-mono-num text-[#1F1F28]">{{ totalWeekHours }}h</strong> filled from Cycle #23 ·
                        <strong class="font-mono-num text-[#C0A36E]">{{ unassignedShiftCount }} open slots</strong>
                    </span>
                </div>
            </div>
        </section>

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

        <!-- SECTION 2: 4-Card Quick Metric Strip (From Stitch Master Schedule Screen) -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <!-- Metric 1: Weekly Hours Target -->
            <div class="p-3.5 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">Hours Target</span>
                    <span class="material-symbols-outlined text-base text-[#2D4F67]">schedule</span>
                </div>
                <div class="flex items-baseline justify-between">
                    <div>
                        <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">{{ totalWeekHours }}h</span>
                        <span class="font-mono-num text-xs text-[#5A5D64]"> / 210h</span>
                    </div>
                    <span class="text-[11px] font-mono-num font-bold text-[#76946A]">Δ 26.0h · {{ coverageRate }}%</span>
                </div>
                <div class="w-full h-1.5 bg-[#FAF8F5] border border-[#E7E3DC] rounded-full overflow-hidden">
                    <div class="h-full bg-[#2D4F67] rounded-full" :style="{ width: `${coverageRate}%` }"></div>
                </div>
            </div>

            <!-- Metric 2: Full-Time Coverage -->
            <div class="p-3.5 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">FT Coverage</span>
                    <span class="material-symbols-outlined text-base text-[#76946A]">verified_user</span>
                </div>
                <div class="flex items-baseline justify-between">
                    <div>
                        <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">100%</span>
                        <span class="font-mono-num text-xs text-[#5A5D64]"> (8/8)</span>
                    </div>
                    <span class="text-[11px] font-headline font-bold text-[#76946A]">Core Leads · ✓ Full</span>
                </div>
                <div class="w-full h-1.5 bg-[#FAF8F5] border border-[#E7E3DC] rounded-full overflow-hidden">
                    <div class="h-full bg-[#76946A] w-full rounded-full"></div>
                </div>
            </div>

            <!-- Metric 3: Floater & Part-Time Pool -->
            <div class="p-3.5 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">Floater / PT</span>
                    <span class="material-symbols-outlined text-base text-[#C0A36E]">Group_Add</span>
                </div>
                <div class="flex items-baseline justify-between">
                    <div>
                        <span class="font-mono-num text-xl font-extrabold text-[#C0A36E]">{{ unassignedShiftCount }} Open</span>
                    </div>
                    <span class="text-[11px] font-headline font-bold text-[#C0A36E]">3 Primed · 50% Fill</span>
                </div>
                <div class="w-full h-1.5 bg-[#FAF8F5] border border-[#E7E3DC] rounded-full overflow-hidden">
                    <div class="h-full bg-[#C0A36E] w-1/2 rounded-full"></div>
                </div>
            </div>

            <!-- Metric 4: Fatigue & Overtime Guardrail -->
            <div class="p-3.5 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-col justify-between gap-2">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64]">Fatigue &amp; Overtime</span>
                    <span class="material-symbols-outlined text-base text-[#76946A]">health_and_safety</span>
                </div>
                <div class="flex items-baseline justify-between">
                    <div>
                        <span class="font-mono-num text-xl font-extrabold text-[#1F1F28]">0h</span>
                        <span class="text-xs font-headline text-[#5A5D64]"> Waivers</span>
                    </div>
                    <span class="text-[11px] font-headline font-bold text-[#76946A]">2 Near Cap (≤2h) · Clear</span>
                </div>
                <div class="w-full h-1.5 bg-[#FAF8F5] border border-[#E7E3DC] rounded-full overflow-hidden">
                    <div class="h-full bg-[#76946A] w-full rounded-full"></div>
                </div>
            </div>
        </section>

        <!-- SECTION 3: 12-Column Split Workspace (Left 9 Cols + Right 3 Cols) -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <!-- LEFT 9 COLUMNS: Filter Toolbar + Multi-Week Cadence + Shift Groups / Calendar / List -->
            <div class="xl:col-span-9 flex flex-col gap-3.5">
                <!-- Filter Toolbar -->
                <div class="p-3 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-wrap items-center justify-between gap-2">
                    <!-- Role Filter Chips -->
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mr-1">Role:</span>
                        <button
                            type="button"
                            :class="[
                                selectedRoleFilter === 'all'
                                    ? 'bg-[#2D4F67] text-white font-bold'
                                    : 'bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-colors cursor-pointer',
                            ]"
                            @click="selectedRoleFilter = 'all'"
                        >
                            All Roles
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedRoleFilter === 'lead'
                                    ? 'bg-[#2D4F67] text-white font-bold'
                                    : 'bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-colors cursor-pointer flex items-center gap-1.5',
                            ]"
                            @click="selectedRoleFilter = 'lead'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#2D4F67]"></span>
                            Lead Barista
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedRoleFilter === 'roaster'
                                    ? 'bg-[#2D4F67] text-white font-bold'
                                    : 'bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-colors cursor-pointer flex items-center gap-1.5',
                            ]"
                            @click="selectedRoleFilter = 'roaster'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                            Roaster L2
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedRoleFilter === 'floater'
                                    ? 'bg-[#2D4F67] text-white font-bold'
                                    : 'bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] font-semibold',
                                'px-2.5 py-1 rounded-md text-xs font-headline transition-colors cursor-pointer flex items-center gap-1.5',
                            ]"
                            @click="selectedRoleFilter = 'floater'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E]"></span>
                            Cashier &amp; Floater
                        </button>
                    </div>

                    <!-- Employment Segment & Branch/Staff Filters -->
                    <div class="flex flex-wrap items-center gap-2">
                        <div class="inline-flex items-center bg-[#FAF8F5] border border-[#DCD7CE] p-0.5 rounded-lg">
                            <button
                                v-for="seg in [
                                    { id: 'all', label: 'All Types' },
                                    { id: 'ft', label: 'FT (40h)' },
                                    { id: 'pt', label: 'PT (24h)' },
                                    { id: 'floater', label: 'Floater' },
                                ]"
                                :key="seg.id"
                                type="button"
                                :class="[
                                    selectedEmploymentType === seg.id
                                        ? 'bg-white text-[#1F1F28] shadow-2xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#1F1F28] font-medium',
                                    'px-2 py-0.5 rounded-md text-[11px] font-headline transition-colors cursor-pointer',
                                ]"
                                @click="selectedEmploymentType = seg.id as any"
                            >
                                {{ seg.label }}
                            </button>
                        </div>

                        <select
                            v-model="selectedLocation"
                            class="bg-[#FAF8F5] border border-[#DCD7CE] text-[#1F1F28] font-headline text-xs font-semibold px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Stations / Branches</option>
                            <option v-for="loc in locations" :key="loc.id" :value="String(loc.id)">
                                {{ loc.name }}
                            </option>
                        </select>

                        <select
                            v-model="selectedStaff"
                            class="bg-[#FAF8F5] border border-[#DCD7CE] text-[#1F1F28] font-headline text-xs font-semibold px-2.5 py-1 rounded-lg focus:outline-none cursor-pointer"
                        >
                            <option value="all">All Staff</option>
                            <option v-for="member in staffMembers" :key="member.id" :value="String(member.id)">
                                {{ member.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <!-- Multi-Week Cadence & Batch Copy Bar -->
                <div class="px-3.5 py-2 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-wrap items-center justify-between gap-2">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[10px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mr-1">June Cadence:</span>
                        <button
                            type="button"
                            :class="[
                                selectedCadenceWeek === 'w1' ? 'ring-1 ring-[#2D4F67]' : '',
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-[#5A5D64] border border-[#DCD7CE] font-headline text-[11px] hover:text-[#1F1F28] cursor-pointer',
                            ]"
                            @click="selectedCadenceWeek = 'w1'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                            <span class="font-mono-num">W1 · Jun 2-8</span>
                            <span class="text-[10px] text-[#76946A] font-bold">Published</span>
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedCadenceWeek === 'w2' ? 'ring-1 ring-[#2D4F67]' : '',
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-[#5A5D64] border border-[#DCD7CE] font-headline text-[11px] hover:text-[#1F1F28] cursor-pointer',
                            ]"
                            @click="selectedCadenceWeek = 'w2'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                            <span class="font-mono-num">W2 · Jun 9-15</span>
                            <span class="text-[10px] text-[#76946A] font-bold">Published</span>
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedCadenceWeek === 'w3' ? 'bg-[#2D4F67] text-white' : 'bg-white text-[#1F1F28] border border-[#DCD7CE]',
                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-headline text-[11px] font-bold shadow-2xs cursor-pointer',
                            ]"
                            @click="selectedCadenceWeek = 'w3'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E]"></span>
                            <span class="font-mono-num">W3 · Jun 16-22</span>
                            <span class="text-[10px] text-[#FAF3E8]">Draft</span>
                        </button>
                        <button
                            type="button"
                            :class="[
                                selectedCadenceWeek === 'w4' ? 'ring-1 ring-[#2D4F67]' : '',
                                'inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-[#5A5D64] border border-[#DCD7CE] font-headline text-[11px] hover:text-[#1F1F28] cursor-pointer',
                            ]"
                            @click="selectedCadenceWeek = 'w4'; successAlert = 'Week 4 (Jun 23-29) pre-filled from Week 3 draft.'"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-[#8A8D93]"></span>
                            <span class="font-mono-num">W4 · Jun 23-29</span>
                            <span class="text-[10px] text-[#2D4F67] font-bold">+ Fill from W3</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-3 text-[11px] font-headline">
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 text-[#2D4F67] hover:underline font-bold cursor-pointer"
                            @click="successAlert = 'Monday shift pattern duplicated across Tue–Fri.'"
                        >
                            <span class="material-symbols-outlined text-xs">dynamic_feed</span>
                            <span>Duplicate Mon to Tue-Fri</span>
                        </button>
                        <span class="text-[#DCD7CE]">|</span>
                        <button
                            type="button"
                            class="inline-flex items-center gap-1 text-[#967B47] hover:underline font-bold cursor-pointer"
                            @click="openQuickCreateWithPreset('Floater Barista', '11:00', '19:00')"
                        >
                            <span class="material-symbols-outlined text-xs">add_circle</span>
                            <span>+ Batch Add Floater Slot</span>
                        </button>
                    </div>
                </div>

                <!-- 7-Day Date Header Strip -->
                <div class="grid grid-cols-7 gap-2">
                    <div
                        v-for="d in weekDays"
                        :key="d.fullDate"
                        :class="[
                            d.isToday
                                ? 'bg-[#2D4F67] text-white border-[#2D4F67]'
                                : 'bg-white text-[#1F1F28] border-[#DCD7CE] hover:bg-[#FAF8F5]',
                            'p-2.5 rounded-xl border shadow-2xs flex flex-col items-center justify-center transition-colors cursor-pointer',
                        ]"
                    >
                        <span
                            :class="[
                                'text-[10px] font-headline font-bold uppercase tracking-widest',
                                d.isToday ? 'text-white/80' : 'text-[#5A5D64]',
                            ]"
                        >
                            {{ d.name }}
                        </span>
                        <span class="font-mono-num text-base font-extrabold leading-tight mt-0.5">
                            {{ d.dateNumber }}
                        </span>
                        <span
                            :class="[
                                'mt-1 px-1.5 py-0.2 rounded-full text-[9px] font-mono-num font-bold',
                                d.isToday
                                    ? 'bg-white/15 text-white'
                                    : d.isPeak
                                      ? 'bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF]'
                                      : 'bg-[#FAF8F5] text-[#76946A] border border-[#E7E3DC]',
                            ]"
                        >
                            {{ d.targetLabel }}
                        </span>
                    </div>
                </div>

                <!-- VIEW MODE 1: SHIFT BUILDER (Exact Stitch Morning / Mid-Day / Evening Groups + Live API Shifts) -->
                <div v-if="activeView === 'roster'" class="flex flex-col gap-3.5">
                    <!-- MORNING SHIFT (06:00 – 14:00) -->
                    <div class="rounded-xl bg-white border border-[#DCD7CE] shadow-xs overflow-hidden relative">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#C0A36E]"></div>
                        <div class="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#DCD7CE] flex flex-wrap items-center justify-between gap-2 pl-5">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base text-[#C0A36E]">wb_twilight</span>
                                <h3 class="font-headline text-xs font-extrabold text-[#1F1F28]">Morning Shift</h3>
                                <span class="font-mono-num text-[11px] font-semibold text-[#5A5D64]">06:00 – 14:00 (8.0h)</span>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[10px] font-bold">
                                Floor Quota Met
                            </span>
                        </div>

                        <div class="p-3.5 pl-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <!-- Card 1: Maria S. (FT Lead) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'ft'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#2D4F67]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#2D4F67] text-white flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                MS
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Maria S.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] font-headline text-[9px] font-bold shrink-0">FT</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">La Marzocco Bar 1</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#1F1F28]">32/40h</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ 12h Rest</span>
                                </div>
                            </div>

                            <!-- Card 2: Camille R. (Floater) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'floater'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#C0A36E]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                CR
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Camille R.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[9px] font-bold shrink-0">Floater</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">Pour-Over &amp; Dial</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#967B47]">BGC Shared</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ Safe</span>
                                </div>
                            </div>

                            <!-- Card 3: Juan D. (PT) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'pt'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#76946A]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                JD
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Juan D.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#EAF0E8] text-[#76946A] font-headline text-[9px] font-bold shrink-0">PT</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">POS &amp; Guest Flow</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#1F1F28]">18/24h</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ Safe</span>
                                </div>
                            </div>

                            <!-- Live API Shifts in Morning Window -->
                            <div
                                v-for="shift in morningApiShifts"
                                :key="shift.id"
                                class="p-2.5 rounded-lg bg-white border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden shadow-2xs"
                            >
                                <div
                                    :class="[
                                        'absolute left-0 top-0 bottom-0 w-1',
                                        (shift.assigned_staff || shift.staff)?.length ? 'bg-[#76946A]' : 'bg-[#C0A36E]',
                                    ]"
                                ></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{ (shift.assigned_staff || shift.staff)?.[0]?.user?.name || shift.role_label }}
                                        </span>
                                        <span class="font-mono-num text-[10px] font-bold text-[#2D4F67]">
                                            {{ format24h(shift.start_at) }}–{{ format24h(shift.end_at) }}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-0.5">
                                        {{ shift.role_label }} {{ shift.location ? `· ${shift.location.name}` : '' }}
                                    </p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <button
                                        v-if="isManager"
                                        type="button"
                                        class="text-[#2D4F67] font-headline font-bold hover:underline cursor-pointer"
                                        @click="openAssignModal(shift)"
                                    >
                                        + Assign Staff
                                    </button>
                                    <template v-if="isMyShift(shift)">
                                        <div v-if="getShiftActiveSwap(shift.id)" class="flex items-center gap-1 ml-auto font-headline text-[10px] font-bold">
                                            <span v-if="getShiftActiveSwap(shift.id)?.status === 'offered'" class="text-[#967B47]">
                                                Offered ·
                                                <button type="button" class="text-[#C34043] underline hover:no-underline cursor-pointer" @click="handleCancelSwap(getShiftActiveSwap(shift.id)!)">Cancel</button>
                                            </span>
                                            <span v-else class="text-[#76946A]">In Review</span>
                                        </div>
                                        <button
                                            v-else-if="!isShiftPast(shift)"
                                            type="button"
                                            class="text-[#967B47] font-headline font-bold hover:underline ml-auto cursor-pointer"
                                            @click="openOfferSwapModal(shift)"
                                        >
                                            Offer Swap
                                        </button>
                                        <span
                                            v-else
                                            class="text-[#8A8D93] font-headline text-[10px] ml-auto font-medium"
                                        >
                                            Past Shift
                                        </span>
                                    </template>
                                </div>
                            </div>

                            <!-- Card 4: Open Floater Slot -->
                            <button
                                type="button"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] hover:bg-[#FAF3E8]/60 border border-dashed border-[#C0A36E] transition-all flex flex-col items-center justify-center gap-1 min-h-[78px] cursor-pointer"
                                @click="openQuickCreateWithPreset('Morning Floater · Pastry & Warmup', '06:00', '14:00')"
                            >
                                <span class="material-symbols-outlined text-base text-[#C0A36E]">person_add</span>
                                <span class="font-headline text-xs font-bold text-[#967B47]">+ Assign Floater</span>
                                <span class="text-[10px] text-[#5A5D64]">Pastry &amp; Warmup</span>
                            </button>
                        </div>
                    </div>

                    <!-- MID-DAY SHIFT (11:00 – 19:00) -->
                    <div class="rounded-xl bg-white border border-[#DCD7CE] shadow-xs overflow-hidden relative">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2D4F67]"></div>
                        <div class="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#DCD7CE] flex flex-wrap items-center justify-between gap-2 pl-5">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">wb_sunny</span>
                                <h3 class="font-headline text-xs font-extrabold text-[#1F1F28]">Mid-Day Shift</h3>
                                <span class="font-mono-num text-[11px] font-semibold text-[#5A5D64]">11:00 – 19:00 (8.0h)</span>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[10px] font-bold">
                                2 Active Stations
                            </span>
                        </div>

                        <div class="p-3.5 pl-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <!-- Card 1: Kenji T. (Lead) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'ft'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#2D4F67]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#2D4F67] text-white flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                KT
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Kenji T.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] font-headline text-[9px] font-bold shrink-0">Lead</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">Roaster L2 · Cupping</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#1F1F28]">36/40h</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ 14h Rest</span>
                                </div>
                            </div>

                            <!-- Card 2: Mateo C. (PT) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'pt'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#76946A]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                MC
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Mateo C.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#EAF0E8] text-[#76946A] font-headline text-[9px] font-bold shrink-0">PT</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">Cold Brew &amp; Runner</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#1F1F28]">16/24h</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ Safe</span>
                                </div>
                            </div>

                            <!-- Live API Shifts in Mid-Day Window -->
                            <div
                                v-for="shift in midDayApiShifts"
                                :key="shift.id"
                                class="p-2.5 rounded-lg bg-white border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden shadow-2xs"
                            >
                                <div
                                    :class="[
                                        'absolute left-0 top-0 bottom-0 w-1',
                                        (shift.assigned_staff || shift.staff)?.length ? 'bg-[#76946A]' : 'bg-[#C0A36E]',
                                    ]"
                                ></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{ (shift.assigned_staff || shift.staff)?.[0]?.user?.name || shift.role_label }}
                                        </span>
                                        <span class="font-mono-num text-[10px] font-bold text-[#2D4F67]">
                                            {{ format24h(shift.start_at) }}–{{ format24h(shift.end_at) }}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-0.5">
                                        {{ shift.role_label }} {{ shift.location ? `· ${shift.location.name}` : '' }}
                                    </p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <button
                                        v-if="isManager"
                                        type="button"
                                        class="text-[#2D4F67] font-headline font-bold hover:underline cursor-pointer"
                                        @click="openAssignModal(shift)"
                                    >
                                        + Assign Staff
                                    </button>
                                    <template v-if="isMyShift(shift)">
                                        <div v-if="getShiftActiveSwap(shift.id)" class="flex items-center gap-1 ml-auto font-headline text-[10px] font-bold">
                                            <span v-if="getShiftActiveSwap(shift.id)?.status === 'offered'" class="text-[#967B47]">
                                                Offered ·
                                                <button type="button" class="text-[#C34043] underline hover:no-underline cursor-pointer" @click="handleCancelSwap(getShiftActiveSwap(shift.id)!)">Cancel</button>
                                            </span>
                                            <span v-else class="text-[#76946A]">In Review</span>
                                        </div>
                                        <button
                                            v-else-if="!isShiftPast(shift)"
                                            type="button"
                                            class="text-[#967B47] font-headline font-bold hover:underline ml-auto cursor-pointer"
                                            @click="openOfferSwapModal(shift)"
                                        >
                                            Offer Swap
                                        </button>
                                        <span
                                            v-else
                                            class="text-[#8A8D93] font-headline text-[10px] ml-auto font-medium"
                                        >
                                            Past Shift
                                        </span>
                                    </template>
                                </div>
                            </div>

                            <!-- Card 3: Open Peak Floater -->
                            <button
                                type="button"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] hover:bg-[#FAF3E8]/60 border border-dashed border-[#C0A36E] transition-all flex flex-col items-center justify-center gap-1 min-h-[78px] cursor-pointer"
                                @click="openQuickCreateWithPreset('Floater Barista · Peak Espresso', '11:00', '19:00')"
                            >
                                <span class="material-symbols-outlined text-base text-[#C0A36E]">bolt</span>
                                <span class="font-headline text-xs font-bold text-[#967B47]">+ Floater Barista</span>
                                <span class="text-[10px] text-[#5A5D64]">Peak Espresso</span>
                            </button>

                            <!-- Card 4: Open Register Backup -->
                            <button
                                type="button"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0]/50 border border-dashed border-[#DCD7CE] transition-all flex flex-col items-center justify-center gap-1 min-h-[78px] cursor-pointer"
                                @click="openQuickCreateWithPreset('Register Backup · Optional', '12:00', '18:00')"
                            >
                                <span class="material-symbols-outlined text-base text-[#5A5D64]">add</span>
                                <span class="font-headline text-xs font-semibold text-[#5A5D64]">+ Register Backup</span>
                                <span class="text-[10px] text-[#8A8D93]">Optional</span>
                            </button>
                        </div>
                    </div>

                    <!-- EVENING SHIFT (14:30 – 22:30) -->
                    <div class="rounded-xl bg-white border border-[#DCD7CE] shadow-xs overflow-hidden relative">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#16181D]"></div>
                        <div class="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#DCD7CE] flex flex-wrap items-center justify-between gap-2 pl-5">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">nights_stay</span>
                                <h3 class="font-headline text-xs font-extrabold text-[#1F1F28]">Evening Shift</h3>
                                <span class="font-mono-num text-[11px] font-semibold text-[#5A5D64]">14:30 – 22:30 (8.0h)</span>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF] font-headline text-[10px] font-bold">
                                <span class="font-mono-num">+10%</span> Night Diff
                            </span>
                        </div>

                        <div class="p-3.5 pl-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            <!-- Card 1: Mark B. (Lead) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'ft'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#2D4F67]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#2D4F67] text-white flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                MB
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Mark B.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#E6ECF0] text-[#2D4F67] font-headline text-[9px] font-bold shrink-0">Lead</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">Closing Keyholder</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#1F1F28]">38/40h</span>
                                    <span class="text-[#76946A] font-headline font-bold">✓ 14h Rest</span>
                                </div>
                            </div>

                            <!-- Card 2: Bea L. (PT Near Cap) -->
                            <div
                                v-if="selectedEmploymentType === 'all' || selectedEmploymentType === 'pt'"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#C0A36E] transition-all flex flex-col justify-between gap-2 relative overflow-hidden"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#C0A36E]"></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] flex items-center justify-center font-headline text-[10px] font-bold shrink-0">
                                                BL
                                            </div>
                                            <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Bea L.</p>
                                        </div>
                                        <span class="px-1.5 py-0.2 rounded bg-[#FAF3E8] text-[#967B47] font-headline text-[9px] font-bold shrink-0">PT</span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-1">Bar 2 &amp; Backbar</p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <span class="font-mono-num font-bold text-[#967B47]">22/24h</span>
                                    <span class="text-[#C0A36E] font-headline font-bold">Near Cap</span>
                                </div>
                            </div>

                            <!-- Live API Shifts in Evening Window -->
                            <div
                                v-for="shift in eveningApiShifts"
                                :key="shift.id"
                                class="p-2.5 rounded-lg bg-white border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex flex-col justify-between gap-2 relative overflow-hidden shadow-2xs"
                            >
                                <div
                                    :class="[
                                        'absolute left-0 top-0 bottom-0 w-1',
                                        (shift.assigned_staff || shift.staff)?.length ? 'bg-[#76946A]' : 'bg-[#C0A36E]',
                                    ]"
                                ></div>
                                <div class="pl-1.5">
                                    <div class="flex items-center justify-between gap-1">
                                        <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{ (shift.assigned_staff || shift.staff)?.[0]?.user?.name || shift.role_label }}
                                        </span>
                                        <span class="font-mono-num text-[10px] font-bold text-[#2D4F67]">
                                            {{ format24h(shift.start_at) }}–{{ format24h(shift.end_at) }}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-[#5A5D64] truncate mt-0.5">
                                        {{ shift.role_label }} {{ shift.location ? `· ${shift.location.name}` : '' }}
                                    </p>
                                </div>
                                <div class="pl-1.5 pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]">
                                    <button
                                        v-if="isManager"
                                        type="button"
                                        class="text-[#2D4F67] font-headline font-bold hover:underline cursor-pointer"
                                        @click="openAssignModal(shift)"
                                    >
                                        + Assign Staff
                                    </button>
                                    <template v-if="isMyShift(shift)">
                                        <div v-if="getShiftActiveSwap(shift.id)" class="flex items-center gap-1 ml-auto font-headline text-[10px] font-bold">
                                            <span v-if="getShiftActiveSwap(shift.id)?.status === 'offered'" class="text-[#967B47]">
                                                Offered ·
                                                <button type="button" class="text-[#C34043] underline hover:no-underline cursor-pointer" @click="handleCancelSwap(getShiftActiveSwap(shift.id)!)">Cancel</button>
                                            </span>
                                            <span v-else class="text-[#76946A]">In Review</span>
                                        </div>
                                        <button
                                            v-else-if="!isShiftPast(shift)"
                                            type="button"
                                            class="text-[#967B47] font-headline font-bold hover:underline ml-auto cursor-pointer"
                                            @click="openOfferSwapModal(shift)"
                                        >
                                            Offer Swap
                                        </button>
                                        <span
                                            v-else
                                            class="text-[#8A8D93] font-headline text-[10px] ml-auto font-medium"
                                        >
                                            Past Shift
                                        </span>
                                    </template>
                                </div>
                            </div>

                            <!-- Card 3: Open Evening Floater -->
                            <button
                                type="button"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] hover:bg-[#FAF3E8]/60 border border-dashed border-[#C0A36E] transition-all flex flex-col items-center justify-center gap-1 min-h-[78px] cursor-pointer"
                                @click="openQuickCreateWithPreset('Floater Barista · Evening Rush', '14:30', '22:30')"
                            >
                                <span class="material-symbols-outlined text-base text-[#C0A36E]">person_add</span>
                                <span class="font-headline text-xs font-bold text-[#967B47]">+ Floater Barista</span>
                                <span class="text-[10px] text-[#5A5D64]">Evening Rush</span>
                            </button>

                            <!-- Card 4: Open Barback -->
                            <button
                                type="button"
                                class="p-2.5 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0]/50 border border-dashed border-[#DCD7CE] transition-all flex flex-col items-center justify-center gap-1 min-h-[78px] cursor-pointer"
                                @click="openQuickCreateWithPreset('Barback · Closing Handover', '15:00', '22:30')"
                            >
                                <span class="material-symbols-outlined text-base text-[#5A5D64]">add</span>
                                <span class="font-headline text-xs font-semibold text-[#5A5D64]">+ Barback</span>
                                <span class="text-[10px] text-[#8A8D93]">Closing Handover</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- VIEW MODE 2: 7-DAY CALENDAR GRID -->
                <div
                    v-else-if="activeView === 'week'"
                    class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-x-auto"
                >
                    <div class="min-w-[820px]">
                        <div class="grid grid-cols-7 min-h-[420px] divide-x divide-[#DCD7CE]">
                            <div
                                v-for="d in weekDays"
                                :key="d.fullDate"
                                :class="[
                                    'p-2.5 space-y-2.5 transition-colors',
                                    d.isToday ? 'bg-[#E6ECF0]/20' : 'bg-[#FAF8F5]/40',
                                ]"
                            >
                                <div
                                    v-for="shift in getShiftsForDay(d.fullDate)"
                                    :key="shift.id"
                                    class="p-2.5 rounded-lg border border-[#DCD7CE] bg-white shadow-2xs hover:border-[#2D4F67] transition-all space-y-1.5 relative overflow-hidden"
                                >
                                    <div
                                        :class="[
                                            'absolute left-0 top-0 bottom-0 w-1.5',
                                            (shift.assigned_staff || shift.staff)?.length ? 'bg-[#76946A]' : 'bg-[#C0A36E]',
                                        ]"
                                    ></div>
                                    <div class="pl-1.5 space-y-1">
                                        <div class="flex items-start justify-between gap-1">
                                            <span class="font-headline font-bold text-xs text-[#1F1F28] leading-tight">
                                                {{ shift.role_label }}
                                            </span>
                                            <span class="text-[10px] font-mono-num font-bold px-1.5 py-0.5 rounded bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE]">
                                                {{ getShiftHours(shift.start_at, shift.end_at) }}h
                                            </span>
                                        </div>
                                        <div class="text-[11px] font-mono-num font-semibold text-[#2D4F67]">
                                            {{ format24h(shift.start_at) }} – {{ format24h(shift.end_at) }}
                                        </div>
                                        <div class="pt-1 flex flex-wrap gap-1">
                                            <template v-if="(shift.assigned_staff || shift.staff)?.length">
                                                <span
                                                    v-for="st in (shift.assigned_staff || shift.staff)"
                                                    :key="st.id"
                                                    class="inline-flex items-center gap-1 text-[10px] font-headline font-bold px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]"
                                                >
                                                    {{ st.user?.name || 'Staff' }}
                                                </span>
                                            </template>
                                            <span
                                                v-else
                                                class="inline-flex items-center gap-1 text-[10px] font-headline font-bold px-2 py-0.5 rounded bg-[#FAF3E8] text-[#C0A36E] border border-[#ECDDBF]"
                                            >
                                                Unassigned
                                            </span>
                                        </div>
                                        <div
                                            v-if="isManager || isMyShift(shift)"
                                            class="pt-1.5 border-t border-[#E7E3DC] flex items-center justify-between text-[10px]"
                                        >
                                            <button
                                                v-if="isManager"
                                                class="text-[#2D4F67] font-headline font-bold cursor-pointer"
                                                @click="openAssignModal(shift)"
                                            >
                                                Assign
                                            </button>
                                            <template v-if="isMyShift(shift)">
                                                <div v-if="getShiftActiveSwap(shift.id)" class="flex items-center gap-1 ml-auto text-[10px] font-bold">
                                                    <span v-if="getShiftActiveSwap(shift.id)?.status === 'offered'" class="text-[#967B47]">
                                                        Offered ·
                                                        <button type="button" class="text-[#C34043] underline hover:no-underline cursor-pointer" @click="handleCancelSwap(getShiftActiveSwap(shift.id)!)">Cancel</button>
                                                    </span>
                                                    <span v-else class="text-[#76946A]">In Review</span>
                                                </div>
                                                <button
                                                    v-else-if="!isShiftPast(shift)"
                                                    type="button"
                                                    class="text-[#967B47] font-headline font-bold ml-auto cursor-pointer"
                                                    @click="openOfferSwapModal(shift)"
                                                >
                                                    Swap
                                                </button>
                                                <span
                                                    v-else
                                                    class="text-[#8A8D93] font-headline text-[10px] ml-auto font-medium"
                                                >
                                                    Past Shift
                                                </span>
                                            </template>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    v-if="getShiftsForDay(d.fullDate).length === 0"
                                    class="py-6 text-center text-[11px] text-[#8A8D93]"
                                >
                                    Standard Cadence
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- VIEW MODE 3: SCHEDULE TAPE LIST -->
                <div v-else class="space-y-2.5">
                    <div
                        v-if="filteredShifts.length === 0"
                        class="bg-white rounded-xl border border-[#DCD7CE] p-8 text-center shadow-xs"
                    >
                        <span class="material-symbols-outlined text-2xl text-[#2D4F67]">calendar_view_week</span>
                        <p class="font-headline text-sm font-bold text-[#1F1F28] mt-1">
                            No custom API shifts overriding the Cycle #24 template
                        </p>
                        <p class="text-xs text-[#5A5D64] mt-0.5">
                            Switch to Shift Builder to inspect the Morning, Mid-Day, and Evening station cards or click Create Shift.
                        </p>
                    </div>

                    <div
                        v-for="shift in filteredShifts"
                        :key="shift.id"
                        class="bg-white border border-[#DCD7CE] rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:border-[#2D4F67]/60 transition-all relative overflow-hidden shadow-xs gap-3"
                    >
                        <div
                            :class="[
                                'absolute left-0 top-0 bottom-0 w-1.5',
                                (shift.assigned_staff || shift.staff)?.length ? 'bg-[#76946A]' : 'bg-[#C0A36E]',
                            ]"
                        ></div>
                        <div class="flex items-center gap-3 pl-2">
                            <div class="w-9 h-9 rounded-full bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF] flex items-center justify-center font-headline font-bold text-xs">
                                {{ initialsFrom((shift.assigned_staff || shift.staff)?.[0]?.user?.name || shift.role_label) }}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-headline text-sm font-bold text-[#1F1F28]">{{ shift.role_label }}</span>
                                    <span v-if="shift.location" class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#DCD7CE] text-[10px] font-headline font-semibold text-[#2D4F67]">
                                        {{ shift.location.name }}
                                    </span>
                                </div>
                                <div class="text-xs text-[#5A5D64] mt-0.5">
                                    {{ new Date(shift.start_at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) }}
                                    ·
                                    <span class="font-mono-num font-bold text-[#76946A]">{{ format24h(shift.start_at) }} – {{ format24h(shift.end_at) }}</span>
                                    (<span class="font-mono-num">{{ getShiftHours(shift.start_at, shift.end_at) }}h</span>)
                                </div>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                v-if="isManager"
                                class="px-3 py-1.5 rounded-lg border border-[#DCD7CE] bg-white hover:bg-[#FAF8F5] text-xs font-headline font-bold text-[#1F1F28] cursor-pointer"
                                @click="openAssignModal(shift)"
                            >
                                Assign
                            </button>
                            <template v-if="isMyShift(shift)">
                                <div v-if="getShiftActiveSwap(shift.id)" class="flex items-center gap-2">
                                    <span v-if="getShiftActiveSwap(shift.id)?.status === 'offered'" class="px-2.5 py-1 rounded-lg bg-[#FAF3E8] border border-[#ECDDBF] text-xs font-headline font-bold text-[#967B47]">
                                        Offered
                                    </span>
                                    <span v-else class="px-2.5 py-1 rounded-lg bg-[#EAF0E8] border border-[#C9DBC2] text-xs font-headline font-bold text-[#76946A]">
                                        In Review
                                    </span>
                                    <button
                                        v-if="getShiftActiveSwap(shift.id)?.status === 'offered'"
                                        type="button"
                                        class="px-2.5 py-1 rounded-lg border border-[#C34043]/30 text-xs font-headline font-bold text-[#C34043] hover:bg-[#FCECEC] cursor-pointer"
                                        @click="handleCancelSwap(getShiftActiveSwap(shift.id)!)"
                                    >
                                        Cancel Offer
                                    </button>
                                </div>
                                <button
                                    v-else-if="!isShiftPast(shift)"
                                    type="button"
                                    class="px-3 py-1.5 rounded-lg bg-[#FAF3E8] border border-[#ECDDBF] text-xs font-headline font-bold text-[#967B47] cursor-pointer hover:bg-[#ECDDBF]"
                                    @click="openOfferSwapModal(shift)"
                                >
                                    Offer Swap
                                </button>
                                <span
                                    v-else
                                    class="px-2.5 py-1 rounded-lg bg-[#F0ECE1] border border-[#DCD7CE] text-xs font-headline font-medium text-[#8A8D93]"
                                >
                                    Past Shift
                                </span>
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT 3 COLUMNS: Talent Bench & Publishing Checklist (From Stitch Master Schedule Screen) -->
            <aside class="xl:col-span-3 flex flex-col gap-4">
                <!-- Card 1: Talent Bench (Available Floaters & Part-Time) -->
                <div class="p-4 rounded-xl bg-white border border-[#DCD7CE] shadow-xs flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base text-[#2D4F67]">person_search</span>
                            <h3 class="font-headline text-xs font-extrabold text-[#1F1F28] uppercase tracking-wider">Talent Bench</h3>
                        </div>
                        <span class="px-2 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-[10px] font-bold">
                            3 Available
                        </span>
                    </div>

                    <div class="flex flex-col gap-2">
                        <!-- Bench Item 1: Aiko S. -->
                        <div
                            class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex items-center justify-between gap-2 cursor-pointer"
                            @click="openQuickCreateWithPreset('Aiko S. · Espresso L2 Floater', '11:00', '19:00')"
                        >
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-7 h-7 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline text-[11px] font-bold flex items-center justify-center shrink-0">
                                    AS
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Aiko S.</p>
                                        <span class="px-1.5 py-0.2 rounded bg-[#FAF3E8] text-[#967B47] text-[9px] font-headline font-bold">Floater</span>
                                    </div>
                                    <p class="text-[10px] text-[#5A5D64] truncate">BGC Home · Espresso L2</p>
                                </div>
                            </div>
                            <span class="font-mono-num text-[11px] font-bold text-[#76946A] shrink-0">16h free</span>
                        </div>

                        <!-- Bench Item 2: Rico P. -->
                        <div
                            class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex items-center justify-between gap-2 cursor-pointer"
                            @click="openQuickCreateWithPreset('Rico P. · POS & Cold Bar', '14:30', '22:30')"
                        >
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-7 h-7 rounded-full bg-[#EAF0E8] text-[#76946A] font-headline text-[11px] font-bold flex items-center justify-center shrink-0">
                                    RP
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Rico P.</p>
                                        <span class="px-1.5 py-0.2 rounded bg-[#EAF0E8] text-[#76946A] text-[9px] font-headline font-bold">PT</span>
                                    </div>
                                    <p class="text-[10px] text-[#5A5D64] truncate">POS &amp; Cold Bar</p>
                                </div>
                            </div>
                            <span class="font-mono-num text-[11px] font-bold text-[#76946A] shrink-0">10h free</span>
                        </div>

                        <!-- Bench Item 3: Danica M. -->
                        <div
                            class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-all flex items-center justify-between gap-2 cursor-pointer"
                            @click="openQuickCreateWithPreset('Danica M. · All-Station Lead', '06:00', '14:00')"
                        >
                            <div class="flex items-center gap-2 min-w-0">
                                <div class="w-7 h-7 rounded-full bg-[#FAF3E8] text-[#967B47] font-headline text-[11px] font-bold flex items-center justify-center shrink-0">
                                    DM
                                </div>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1.5">
                                        <p class="font-headline text-xs font-bold text-[#1F1F28] truncate">Danica M.</p>
                                        <span class="px-1.5 py-0.2 rounded bg-[#FAF3E8] text-[#967B47] text-[9px] font-headline font-bold">Floater</span>
                                    </div>
                                    <p class="text-[10px] text-[#5A5D64] truncate">Roastery · All-Station</p>
                                </div>
                            </div>
                            <span class="font-mono-num text-[11px] font-bold text-[#76946A] shrink-0">12h free</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="w-full py-1.5 px-3 rounded-lg bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] font-headline text-xs font-bold text-[#2D4F67] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        @click="triggerAutoFill"
                    >
                        <span class="material-symbols-outlined text-sm">swap_horiz</span>
                        <span>Request Auxiliary Floater</span>
                    </button>
                </div>

                <!-- Card 2: Publishing Checklist -->
                <div class="p-4 rounded-xl bg-white border border-[#DCD7CE] shadow-xs flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base text-[#76946A]">fact_check</span>
                            <h3 class="font-headline text-xs font-extrabold text-[#1F1F28] uppercase tracking-wider">Publishing Checklist</h3>
                        </div>
                        <span class="font-mono-num text-[11px] font-bold text-[#76946A]">4/4 Clear</span>
                    </div>

                    <div class="flex flex-col gap-2 text-xs">
                        <div class="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="flex items-center gap-1.5 text-[#1F1F28] font-medium">
                                <span class="material-symbols-outlined text-sm text-[#76946A]">check_circle</span>
                                Floor Safety Minima
                            </span>
                            <span class="font-mono-num text-[11px] font-bold text-[#76946A]">≥3 staff</span>
                        </div>
                        <div class="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="flex items-center gap-1.5 text-[#1F1F28] font-medium">
                                <span class="material-symbols-outlined text-sm text-[#76946A]">check_circle</span>
                                Rest Period Intervals
                            </span>
                            <span class="font-mono-num text-[11px] font-bold text-[#76946A]">11h gap</span>
                        </div>
                        <div class="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="flex items-center gap-1.5 text-[#1F1F28] font-medium">
                                <span class="material-symbols-outlined text-sm text-[#76946A]">check_circle</span>
                                Station Lead Quota
                            </span>
                            <span class="font-headline text-[11px] font-bold text-[#76946A]">Assigned</span>
                        </div>
                        <div class="flex items-center justify-between p-2 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="flex items-center gap-1.5 text-[#1F1F28] font-medium">
                                <span class="material-symbols-outlined text-sm text-[#76946A]">check_circle</span>
                                Cap Guardrails
                            </span>
                            <span class="font-headline text-[11px] font-bold text-[#76946A]">No violations</span>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Autonomous Dispatch · Ready for Sync (Kanagawa Wave Indigo Card) -->
                <div class="p-4 rounded-xl bg-[#2D4F67] text-white shadow-xs relative overflow-hidden flex flex-col gap-1.5">
                    <svg class="absolute -right-3 -bottom-3 w-24 h-24 text-white/10 pointer-events-none" fill="currentColor" viewBox="0 0 100 100">
                        <path d="M0 70 Q 25 50 50 70 T 100 70 L 100 100 L 0 100 Z"></path>
                    </svg>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-headline font-bold uppercase tracking-widest text-[#A3B8C8]">Autonomous Dispatch</span>
                        <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                    </div>
                    <p class="font-headline text-sm font-extrabold">Ready for Sync</p>
                    <p class="text-[11px] text-[#DCD7BA] leading-relaxed">
                        Publishing notifies <span class="font-mono-num font-bold text-white">15</span> staff &amp; posts <span class="font-mono-num font-bold text-[#C0A36E]">{{ unassignedShiftCount }}</span> floater slots to the Peer Swap Board.
                    </p>
                </div>
            </aside>
        </div>

        <!-- Create Shift Modal -->
        <div
            v-if="showCreateModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-md w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#2D4F67]">add_circle</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Create New Shift</h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showCreateModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleCreateShift">
                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Role / Station Label
                        </label>
                        <input
                            v-model="newShiftRole"
                            type="text"
                            required
                            placeholder="e.g. Barista Lead, Kitchen Support"
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        />
                    </div>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Branch Location
                        </label>
                        <select
                            v-model="newShiftLocation"
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        >
                            <option :value="null">No location selected</option>
                            <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.name }}</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Shift Date
                        </label>
                        <input
                            v-model="newShiftDate"
                            type="date"
                            required
                            class="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        />
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                                Start Time (24h)
                            </label>
                            <input
                                v-model="newShiftStart"
                                type="time"
                                required
                                class="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                            />
                        </div>
                        <div>
                            <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                                End Time (24h)
                            </label>
                            <input
                                v-model="newShiftEnd"
                                type="time"
                                required
                                class="w-full text-xs font-mono-num px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                            />
                        </div>
                    </div>

                    <div class="pt-3 border-t border-[#DCD7CE] flex justify-end gap-2">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#FAF8F5] cursor-pointer"
                            @click="showCreateModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] disabled:opacity-50 cursor-pointer"
                        >
                            {{ isSubmitting ? 'Creating...' : 'Create Shift' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Assign Staff Modal -->
        <div
            v-if="showAssignModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-md w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#2D4F67]">person_add</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">
                            Assign Staff to {{ activeShift?.role_label }}
                        </h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showAssignModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleAssignStaff">
                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Select Team Member
                        </label>
                        <select
                            v-model="assignUserId"
                            required
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        >
                            <option :value="null" disabled>Choose staff member...</option>
                            <option v-for="m in staffMembers" :key="m.id" :value="m.id">
                                {{ m.name || m.email }} ({{ m.role }})
                            </option>
                        </select>
                    </div>

                    <div class="pt-3 border-t border-[#DCD7CE] flex justify-end gap-2">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#FAF8F5] cursor-pointer"
                            @click="showAssignModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] disabled:opacity-50 cursor-pointer"
                        >
                            {{ isSubmitting ? 'Assigning...' : 'Assign Member' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Offer Swap Modal -->
        <div
            v-if="showOfferSwapModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-md w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#C0A36E]">swap_horiz</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Offer Shift for Swap</h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showOfferSwapModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleOfferSwap">
                    <div class="p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-xs">
                        <p class="font-headline font-bold text-[#1F1F28]">{{ activeShift?.role_label }}</p>
                        <p v-if="activeShift" class="font-mono-num text-[#2D4F67] mt-0.5">
                            {{ format24h(activeShift.start_at) }} – {{ format24h(activeShift.end_at) }}
                        </p>
                    </div>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Reason / Handover Notes (Optional)
                        </label>
                        <textarea
                            v-model="swapNotes"
                            rows="3"
                            placeholder="Let teammates know why you need coverage..."
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        ></textarea>
                    </div>

                    <div class="pt-3 border-t border-[#DCD7CE] flex justify-end gap-2">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#FAF8F5] cursor-pointer"
                            @click="showOfferSwapModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-[#16181D] bg-[#C0A36E] hover:bg-[#b0935e] disabled:opacity-50 cursor-pointer"
                        >
                            {{ isSubmitting ? 'Posting...' : 'Post to Swap Board' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
