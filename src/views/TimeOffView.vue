<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { timeOffApi } from '../api/timeOff';
import { shiftsApi } from '../api/shifts';
import { ApiRequestError } from '../api/client';
import type { TimeOffRequest, Shift } from '../types/api';

const authStore = useAuthStore();
const undoStore = useUndoStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const requests = ref<TimeOffRequest[]>([]);
const monthShifts = ref<Shift[]>([]);
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Date helper
function formatDateYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const today = new Date();
const todayYmd = formatDateYmd(today);

// Dynamic Month / Year Calendar Navigation state
const currentYear = ref(today.getFullYear());
const currentMonth = ref(today.getMonth()); // 0-11

const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const currentMonthLabel = computed(() => {
    return `${monthNames[currentMonth.value]} ${currentYear.value}`;
});

const shortMonthLabel = computed(() => {
    return `${monthNames[currentMonth.value].slice(0, 3)} ${currentYear.value}`;
});

// Leave form state with dynamic default dates (tomorrow and day after)
const defaultStart = new Date(today);
defaultStart.setDate(defaultStart.getDate() + 1);
const defaultEnd = new Date(defaultStart);
defaultEnd.setDate(defaultEnd.getDate() + 1);

const selectedLeaveType = ref<'pto' | 'sick' | 'cultural' | 'unpaid'>('pto');
const newStartDate = ref(formatDateYmd(defaultStart));
const newEndDate = ref(formatDateYmd(defaultEnd));
const newReason = ref('');
const isSubmitting = ref(false);

// Conflict Inspector Modal state
const showDetailModal = ref(false);
const activeDetail = ref<TimeOffRequest | null>(null);
const activeConflicts = ref<Shift[]>([]);
const managerDecisionNotes = ref('');

interface CalendarCell {
    dayNumber: number;
    dateIso: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
    isSelected: boolean;
    approvedRequest?: TimeOffRequest;
    pendingRequest?: TimeOffRequest;
    shifts: Shift[];
    hasConflict: boolean;
}

function isDateInRange(dateIso: string, startIso: string, endIso: string): boolean {
    return dateIso >= startIso && dateIso <= endIso;
}

const calendarGrid = computed<CalendarCell[]>(() => {
    const year = currentYear.value;
    const month = currentMonth.value;
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 for Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarCell[] = [];

    // Previous month trailing padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const dayNumber = daysInPrevMonth - i;
        const d = new Date(year, month - 1, dayNumber);
        const dateIso = formatDateYmd(d);
        cells.push(createCell(dayNumber, dateIso, false, d.getDay()));
    }

    // Current month days
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
        const d = new Date(year, month, dayNumber);
        const dateIso = formatDateYmd(d);
        cells.push(createCell(dayNumber, dateIso, true, d.getDay()));
    }

    // Next month leading padding to complete the grid (35 or 42 cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let dayNumber = 1; dayNumber <= remaining; dayNumber++) {
        const d = new Date(year, month + 1, dayNumber);
        const dateIso = formatDateYmd(d);
        cells.push(createCell(dayNumber, dateIso, false, d.getDay()));
    }

    return cells;

    function createCell(dayNumber: number, dateIso: string, isCurrentMonth: boolean, dayOfWeek: number): CalendarCell {
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = dateIso === todayYmd;

        const isSelected = !!(
            newStartDate.value &&
            newEndDate.value &&
            isDateInRange(dateIso, newStartDate.value, newEndDate.value)
        );

        const approvedRequest = requests.value.find(
            (r) => r.status === 'approved' && isDateInRange(dateIso, r.start_date, r.end_date)
        );

        const pendingRequest = requests.value.find(
            (r) => r.status === 'pending' && isDateInRange(dateIso, r.start_date, r.end_date)
        );

        const shifts = monthShifts.value.filter((s) => {
            if (!s.start_at.startsWith(dateIso)) {
                return false;
            }
            if (isManager.value) {
                return authStore.matchesLocation(s.location_id, s.location?.name);
            }
            const staffList = s.assigned_staff || s.staff || [];
            return staffList.some((a) => a.user_id === authStore.user?.id);
        });

        const hasConflict = isSelected && shifts.length > 0;

        return {
            dayNumber,
            dateIso,
            isCurrentMonth,
            isToday,
            isWeekend,
            isSelected,
            approvedRequest,
            pendingRequest,
            shifts,
            hasConflict,
        };
    }
});

function selectCalendarDate(cell: CalendarCell): void {
    const clickedIso = cell.dateIso;

    // If clicking outside current month, auto-navigate to that month
    const clickedDate = new Date(clickedIso);
    if (clickedDate.getMonth() !== currentMonth.value) {
        currentMonth.value = clickedDate.getMonth();
        currentYear.value = clickedDate.getFullYear();
        loadMonthShifts();
    }

    if (!newStartDate.value || newStartDate.value !== newEndDate.value) {
        newStartDate.value = clickedIso;
        newEndDate.value = clickedIso;
    } else {
        if (clickedIso < newStartDate.value) {
            newStartDate.value = clickedIso;
        } else {
            newEndDate.value = clickedIso;
        }
    }
}

function prevMonth(): void {
    if (currentMonth.value === 0) {
        currentMonth.value = 11;
        currentYear.value--;
    } else {
        currentMonth.value--;
    }
    loadMonthShifts();
}

function nextMonth(): void {
    if (currentMonth.value === 11) {
        currentMonth.value = 0;
        currentYear.value++;
    } else {
        currentMonth.value++;
    }
    loadMonthShifts();
}

function goToToday(): void {
    const d = new Date();
    currentYear.value = d.getFullYear();
    currentMonth.value = d.getMonth();
    loadMonthShifts();
}

const pendingCount = computed(() => {
    return requests.value.filter((r) => r.status === 'pending').length;
});

const requestedDaysCount = computed(() => {
    return getLeaveDays(newStartDate.value, newEndDate.value);
});

const conflictingShiftsForRequest = computed<Shift[]>(() => {
    if (!newStartDate.value || !newEndDate.value) {
        return [];
    }
    return monthShifts.value.filter((s) => {
        const shiftDate = s.start_at.slice(0, 10);
        if (shiftDate < newStartDate.value || shiftDate > newEndDate.value) {
            return false;
        }
        const staffList = s.assigned_staff || s.staff || [];
        return staffList.some((a) => a.user_id === authStore.user?.id);
    });
});

function getLeaveDays(startIso?: string | null, endIso?: string | null): number {
    if (!startIso || !endIso) {
        return 1;
    }
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 1;
    }
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff + 1);
}

function format24h(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function scrollToRequestForm(): void {
    const el = document.getElementById('requestFormSection');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}

async function loadRequests(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
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

async function loadMonthShifts(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        const startPad = new Date(currentYear.value, currentMonth.value, 1 - 7);
        const endPad = new Date(currentYear.value, currentMonth.value + 1, 14);
        const res = await shiftsApi.listShifts(
            authStore.businessId,
            formatDateYmd(startPad),
            formatDateYmd(endPad)
        );
        monthShifts.value = res.data;
    } catch {
        // silent fallback
    }
}

async function handleCreateRequest(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        const reasonNote = newReason.value.trim()
            ? `[${selectedLeaveType.value.toUpperCase()}] ${newReason.value.trim()}`
            : `[${selectedLeaveType.value.toUpperCase()}] Scheduled Leave`;

        await timeOffApi.create(authStore.businessId, {
            start_date: newStartDate.value,
            end_date: newEndDate.value,
            reason: reasonNote,
        });

        successAlert.value = 'Time-off request submitted for review.';
        newReason.value = '';
        await Promise.all([loadRequests(), loadMonthShifts()]);
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
    if (!authStore.businessId) {
        return;
    }
    activeDetail.value = req;
    activeConflicts.value = [];
    managerDecisionNotes.value = '';
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
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    showDetailModal.value = false;
    // Optimistic status update
    const prevStatus = req.status;
    const target = requests.value.find((r) => r.id === req.id);
    if (target) {
        target.status = 'approved';
    }

    undoStore.triggerAction({
        id: `approve-timeoff-${req.id}`,
        message: 'Leave Request Approved',
        detail: `${req.user?.name || 'Staff'}: ${req.start_date} to ${req.end_date}`,
        durationMs: 4000,
        execute: async () => {
            try {
                await timeOffApi.approve(bId, req.id, managerDecisionNotes.value);
                successAlert.value = 'Time-off request approved.';
                await Promise.all([loadRequests(), loadMonthShifts()]);
            } catch (e: any) {
                if (target) {
                    target.status = prevStatus;
                }
                errorAlert.value = e.message || 'Failed to approve request.';
                await Promise.all([loadRequests(), loadMonthShifts()]);
            }
        },
        onUndo: async () => {
            if (target) {
                target.status = prevStatus;
            }
            await Promise.all([loadRequests(), loadMonthShifts()]);
        },
    });
}

async function handleReject(req: TimeOffRequest): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    showDetailModal.value = false;
    // Optimistic status update
    const prevStatus = req.status;
    const target = requests.value.find((r) => r.id === req.id);
    if (target) {
        target.status = 'rejected';
    }

    undoStore.triggerAction({
        id: `reject-timeoff-${req.id}`,
        message: 'Leave Request Declined',
        detail: `${req.user?.name || 'Staff'}: ${req.start_date} to ${req.end_date}`,
        durationMs: 4000,
        execute: async () => {
            try {
                await timeOffApi.reject(bId, req.id, managerDecisionNotes.value);
                successAlert.value = 'Time-off request rejected.';
                await Promise.all([loadRequests(), loadMonthShifts()]);
            } catch (e: any) {
                if (target) {
                    target.status = prevStatus;
                }
                errorAlert.value = e.message || 'Failed to reject request.';
                await Promise.all([loadRequests(), loadMonthShifts()]);
            }
        },
        onUndo: async () => {
            if (target) {
                target.status = prevStatus;
            }
            await Promise.all([loadRequests(), loadMonthShifts()]);
        },
    });
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadRequests();
            loadMonthShifts();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadRequests();
        loadMonthShifts();
    }
});
</script>

<template>
    <div class="space-y-5">
        <!-- Top Header Banner & Fast Action (From stitch_361.html) -->
        <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div class="flex items-center gap-2.5 flex-wrap">
                <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">
                    Time-Off &amp; Leave
                </h1>
                <span class="px-2.5 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF] font-headline text-xs font-bold">
                    Policy: {{ currentYear }} Cycle
                </span>
            </div>

            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold shadow-xs transition-all cursor-pointer"
                    @click="scrollToRequestForm"
                >
                    <span class="material-symbols-outlined text-base">add_circle</span>
                    <span>Request Time-Off</span>
                </button>
            </div>
        </div>

        <!-- Alerts -->
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

        <!-- KPI Balance Summary Strip (4 Cards from stitch_361.html) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <!-- Card 1: PTO Accrued -->
            <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#2D4F67]"></span>
                        <span class="font-headline text-[11px] uppercase tracking-wider text-[#5A5D64] font-bold">Paid Time-Off</span>
                    </div>
                    <span class="material-symbols-outlined text-lg text-[#2D4F67]">beach_access</span>
                </div>
                <div class="my-3">
                    <div class="flex items-baseline gap-1.5">
                        <span class="font-mono-num text-2xl font-extrabold text-[#2D4F67]">4.5</span>
                        <span class="font-headline text-xs text-[#5A5D64] font-semibold">Days</span>
                    </div>
                    <div class="w-full bg-[#FAF8F5] border border-[#E7E3DC] rounded-full h-1.5 mt-2 overflow-hidden">
                        <div class="bg-[#2D4F67] h-full rounded-full" style="width: 60%"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] font-mono-num font-bold">+0.5d / mo</span>
                    <span class="text-[#5A5D64]">Next: Jul 1</span>
                </div>
            </div>

            <!-- Card 2: Sick / Medical -->
            <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                        <span class="font-headline text-[11px] uppercase tracking-wider text-[#5A5D64] font-bold">Sick / Medical</span>
                    </div>
                    <span class="material-symbols-outlined text-lg text-[#76946A]">healing</span>
                </div>
                <div class="my-3">
                    <div class="flex items-baseline gap-1.5">
                        <span class="font-mono-num text-2xl font-extrabold text-[#76946A]">2.0</span>
                        <span class="font-headline text-xs text-[#5A5D64] font-semibold">Days</span>
                    </div>
                    <div class="w-full bg-[#FAF8F5] border border-[#E7E3DC] rounded-full h-1.5 mt-2 overflow-hidden">
                        <div class="bg-[#76946A] h-full rounded-full" style="width: 40%"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-full bg-[#EAF0E8] text-[#76946A] font-headline font-bold">Protected</span>
                    <span class="text-[#5A5D64]">Resets Dec 31</span>
                </div>
            </div>

            <!-- Card 3: Floating Cultural Holiday -->
            <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#C0A36E]"></span>
                        <span class="font-headline text-[11px] uppercase tracking-wider text-[#5A5D64] font-bold">Cultural Holiday</span>
                    </div>
                    <span class="material-symbols-outlined text-lg text-[#C0A36E]">festival</span>
                </div>
                <div class="my-3">
                    <div class="flex items-baseline gap-1.5">
                        <span class="font-mono-num text-2xl font-extrabold text-[#967B47]">1.0</span>
                        <span class="font-headline text-xs text-[#5A5D64] font-semibold">Day</span>
                    </div>
                    <div class="w-full bg-[#FAF8F5] border border-[#E7E3DC] rounded-full h-1.5 mt-2 overflow-hidden">
                        <div class="bg-[#C0A36E] h-full rounded-full" style="width: 100%"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] font-headline font-bold">1 Available</span>
                    <span class="text-[#5A5D64]">Exp Sep 30</span>
                </div>
            </div>

            <!-- Card 4: Pending Requests -->
            <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 shadow-2xs flex flex-col justify-between">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-1.5">
                        <span class="w-2 h-2 rounded-full bg-[#8A8D93]"></span>
                        <span class="font-headline text-[11px] uppercase tracking-wider text-[#5A5D64] font-bold">Pending</span>
                    </div>
                    <span class="material-symbols-outlined text-lg text-[#8A8D93]">hourglass_empty</span>
                </div>
                <div class="my-3">
                    <div class="flex items-baseline gap-1.5">
                        <span class="font-mono-num text-2xl font-extrabold text-[#1F1F28]">{{ pendingCount }}</span>
                        <span class="font-headline text-xs text-[#5A5D64] font-semibold">Requests</span>
                    </div>
                    <div class="w-full bg-[#FAF8F5] border border-[#E7E3DC] rounded-full h-1.5 mt-2 overflow-hidden">
                        <div class="bg-[#C0A36E] h-full rounded-full" :style="{ width: pendingCount > 0 ? '45%' : '0%' }"></div>
                    </div>
                </div>
                <div class="flex items-center justify-between text-[11px]">
                    <span class="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] font-headline font-semibold">
                        {{ pendingCount === 0 ? 'Queue Clear' : 'Awaiting Review' }}
                    </span>
                    <span class="text-[#2D4F67] font-headline font-bold">{{ pendingCount === 0 ? 'All Resolved' : 'Manager Queue' }}</span>
                </div>
            </div>
        </div>

        <!-- Main Body Grid: 12 Columns (7 Left + 5 Right from stitch_361.html) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <!-- LEFT COLUMN: Calendar & Blackout Radar (Col Span 7) -->
            <div class="lg:col-span-7 flex flex-col gap-4">
                <!-- Interactive Month Calendar Card -->
                <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 lg:p-5 shadow-xs flex flex-col gap-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div class="flex items-center gap-2">
                            <span class="font-headline text-base font-extrabold text-[#1F1F28]">{{ currentMonthLabel }}</span>
                            <button
                                type="button"
                                class="px-2 py-0.5 rounded-full bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] font-headline text-[11px] font-bold text-[#2D4F67] transition cursor-pointer"
                                title="Jump to today"
                                @click="goToToday"
                            >
                                Today
                            </button>
                        </div>
                        <div class="inline-flex items-center gap-1 bg-[#FAF8F5] border border-[#DCD7CE] p-1 rounded-lg">
                            <button
                                type="button"
                                class="w-6 h-6 flex items-center justify-center rounded text-[#5A5D64] hover:bg-white hover:text-[#1F1F28] transition cursor-pointer"
                                title="Previous Month"
                                @click="prevMonth"
                            >
                                <span class="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <span class="font-headline text-xs px-2 text-[#1F1F28] font-bold select-none">{{ shortMonthLabel }}</span>
                            <button
                                type="button"
                                class="w-6 h-6 flex items-center justify-center rounded text-[#5A5D64] hover:bg-white hover:text-[#1F1F28] transition cursor-pointer"
                                title="Next Month"
                                @click="nextMonth"
                            >
                                <span class="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>

                    <!-- Legend Bar -->
                    <div class="flex flex-wrap items-center gap-3 p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] text-[11px] font-headline text-[#5A5D64]">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-[#2D4F67]"></span>
                            <span>My Shifts</span>
                        </div>
                        <span>•</span>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                            <span>Approved Leave</span>
                        </div>
                        <span>•</span>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-[#C0A36E]"></span>
                            <span>Selected / Pending</span>
                        </div>
                        <span>•</span>
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-[#C34043]"></span>
                            <span>Shift Conflict</span>
                        </div>
                    </div>

                    <!-- Calendar Matrix (7 Days) -->
                    <div class="grid grid-cols-7 gap-1.5">
                        <div
                            v-for="dName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                            :key="dName"
                            class="text-center font-headline text-[10px] text-[#5A5D64] py-1 font-bold uppercase tracking-wider"
                        >
                            {{ dName }}
                        </div>

                        <div
                            v-for="cell in calendarGrid"
                            :key="cell.dateIso"
                            :class="[
                                !cell.isCurrentMonth ? 'opacity-40' : '',
                                cell.hasConflict
                                    ? 'bg-[#FCECEC] border-[#F3C5C6] ring-1 ring-[#C34043]'
                                    : cell.isSelected
                                      ? 'bg-[#FAF3E8] border-[#C0A36E] ring-1 ring-[#C0A36E]'
                                      : cell.approvedRequest
                                        ? 'bg-[#EAF0E8] border-[#76946A]'
                                        : cell.pendingRequest
                                          ? 'bg-[#FAF8F5] border-[#C0A36E]/60'
                                          : cell.isToday
                                            ? 'bg-[#E6ECF0] border-[#2D4F67]'
                                            : cell.isWeekend
                                              ? 'bg-[#FAF8F5]/60 border-[#E7E3DC]'
                                              : 'bg-white border-[#DCD7CE] hover:bg-[#FAF8F5]',
                                'min-h-[66px] p-1.5 rounded-lg border flex flex-col justify-between transition-all cursor-pointer select-none hover:shadow-2xs',
                            ]"
                            :title="`${cell.dateIso}: Click to select for leave request`"
                            @click="selectCalendarDate(cell)"
                        >
                            <div class="flex items-center justify-between">
                                <span
                                    :class="[
                                        'font-mono-num text-xs font-bold',
                                        cell.isToday ? 'text-[#2D4F67]' : 'text-[#1F1F28]'
                                    ]"
                                >
                                    {{ cell.dayNumber }}
                                </span>
                                <span
                                    v-if="cell.isToday"
                                    class="px-1 py-0.2 rounded bg-[#2D4F67] text-white font-headline text-[8px] font-bold uppercase"
                                >
                                    Today
                                </span>
                                <span
                                    v-else-if="cell.hasConflict"
                                    class="material-symbols-outlined text-xs text-[#C34043]"
                                    title="Shift conflict with requested leave"
                                >
                                    warning
                                </span>
                                <span
                                    v-else-if="cell.approvedRequest"
                                    class="material-symbols-outlined text-xs text-[#76946A]"
                                    title="Approved PTO"
                                >
                                    check_circle
                                </span>
                                <span
                                    v-else-if="cell.pendingRequest"
                                    class="material-symbols-outlined text-xs text-[#C0A36E]"
                                    title="Pending Leave Review"
                                >
                                    hourglass_top
                                </span>
                            </div>

                            <!-- Shift or Status Pill -->
                            <div v-if="cell.shifts.length > 0" class="flex items-center gap-1 overflow-hidden">
                                <span class="w-1.5 h-1.5 rounded-full bg-[#2D4F67] shrink-0"></span>
                                <span class="font-mono-num text-[10px] font-bold text-[#2D4F67] truncate">
                                    {{ format24h(cell.shifts[0].start_at) }}
                                </span>
                            </div>
                            <span
                                v-else-if="cell.approvedRequest"
                                class="font-headline text-[10px] font-bold text-[#76946A] truncate"
                            >
                                Approved
                            </span>
                            <span
                                v-else-if="cell.pendingRequest"
                                class="font-headline text-[10px] font-bold text-[#967B47] truncate"
                            >
                                In Review
                            </span>
                            <span
                                v-else-if="cell.isSelected"
                                class="font-headline text-[10px] font-bold text-[#C0A36E] truncate"
                            >
                                Selected
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Blackout Period Callout Card -->
                <div class="p-4 rounded-xl bg-[#FAF3E8] border border-[#ECDDBF] flex items-start gap-3">
                    <div class="w-8 h-8 rounded-lg bg-[#C0A36E] text-[#16181D] flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-base">event_busy</span>
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-headline text-xs font-extrabold text-[#1F1F28]">Annual Peak Operations Cadence</span>
                            <span class="px-2 py-0.5 rounded-full bg-white text-[#967B47] border border-[#ECDDBF] font-headline text-[10px] font-bold uppercase">
                                Notice
                            </span>
                        </div>
                        <p class="text-xs text-[#5A5D64]">
                            Shift swaps permitted with Lead sign-off
                        </p>
                    </div>
                </div>

                <!-- Coverage Guidelines Card -->
                <div class="p-4 rounded-xl bg-white border border-[#DCD7CE] shadow-2xs flex flex-col gap-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base text-[#2D4F67]">verified_user</span>
                            <h3 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">Coverage Guidelines</h3>
                        </div>
                        <span class="text-xs font-headline text-[#5A5D64]">{{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Branches' }}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="font-mono-num text-xs font-extrabold text-[#2D4F67] block">7 Days Notice</span>
                            <p class="text-[11px] text-[#5A5D64]">Regular PTO requests</p>
                        </div>
                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="font-mono-num text-xs font-extrabold text-[#967B47] block">Max 2 Concurrent</span>
                            <p class="text-[11px] text-[#5A5D64]">Per station coverage</p>
                        </div>
                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC]">
                            <span class="font-mono-num text-xs font-extrabold text-[#76946A] block">2h Notice</span>
                            <p class="text-[11px] text-[#5A5D64]">Emergency sick notice</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- RIGHT COLUMN: Submit Request & History (Col Span 5 from stitch_361.html) -->
            <div id="requestFormSection" class="lg:col-span-5 flex flex-col gap-4">
                <!-- Quick Leave Request Form Card -->
                <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 lg:p-5 shadow-xs flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full bg-[#C0A36E]"></span>
                            <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">Submit Leave Request</h2>
                        </div>
                        <span class="px-2 py-0.5 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] font-headline text-[10px] font-bold text-[#5A5D64]">
                            Instant Check
                        </span>
                    </div>

                    <form class="flex flex-col gap-3.5" @submit.prevent="handleCreateRequest">
                        <!-- Leave Classification Radio Pills -->
                        <div class="flex flex-col gap-1.5">
                            <label class="font-headline text-[10px] text-[#5A5D64] font-bold uppercase tracking-wider">
                                Leave Classification
                            </label>
                            <div class="grid grid-cols-2 gap-2">
                                <button
                                    v-for="lt in [
                                        { id: 'pto', label: 'PTO', sub: '4.5d balance', icon: 'beach_access' },
                                        { id: 'sick', label: 'Sick', sub: '2.0d balance', icon: 'healing' },
                                        { id: 'cultural', label: 'Cultural', sub: '1.0d balance', icon: 'festival' },
                                        { id: 'unpaid', label: 'Unpaid', sub: 'Review required', icon: 'work_history' },
                                    ]"
                                    :key="lt.id"
                                    type="button"
                                    :class="[
                                        selectedLeaveType === lt.id
                                            ? 'bg-[#2D4F67] text-white border-[#2D4F67]'
                                            : 'bg-[#FAF8F5] text-[#1F1F28] border-[#DCD7CE] hover:bg-[#E6ECF0]/50',
                                        'flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors cursor-pointer',
                                    ]"
                                    @click="selectedLeaveType = lt.id as any"
                                >
                                    <span class="material-symbols-outlined text-base">{{ lt.icon }}</span>
                                    <div>
                                        <span class="font-headline text-xs font-bold block">{{ lt.label }}</span>
                                        <span class="font-mono-num text-[10px] opacity-80 block">{{ lt.sub }}</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        <!-- Date Range Selector -->
                        <div class="grid grid-cols-2 gap-2.5">
                            <div>
                                <label class="font-headline text-[10px] text-[#5A5D64] font-bold uppercase tracking-wider block mb-1">
                                    Start Date
                                </label>
                                <input
                                    v-model="newStartDate"
                                    type="date"
                                    required
                                    class="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] font-mono-num text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                                />
                            </div>
                            <div>
                                <label class="font-headline text-[10px] text-[#5A5D64] font-bold uppercase tracking-wider block mb-1">
                                    End Date
                                </label>
                                <input
                                    v-model="newEndDate"
                                    type="date"
                                    required
                                    class="w-full px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] font-mono-num text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                                />
                            </div>
                        </div>

                        <div class="px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between text-xs">
                            <span class="text-[#5A5D64]">
                                Duration: <strong class="font-mono-num text-[#1F1F28]">{{ requestedDaysCount }} Days ({{ requestedDaysCount * 8 }}h)</strong>
                            </span>
                            <span class="font-mono-num font-bold text-[#2D4F67]">{{ requestedDaysCount }} Shifts</span>
                        </div>

                        <!-- Reason / Notes -->
                        <div>
                            <label class="font-headline text-[10px] text-[#5A5D64] font-bold uppercase tracking-wider block mb-1">
                                Reason / Notes
                            </label>
                            <textarea
                                v-model="newReason"
                                rows="2"
                                placeholder="Brief note for manager..."
                                class="w-full p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67] resize-none"
                            ></textarea>
                        </div>

                        <!-- Dynamic Coverage / Conflict Notice -->
                        <div
                            v-if="conflictingShiftsForRequest.length > 0"
                            class="p-2.5 rounded-lg bg-[#FAF3E8] border border-[#ECDDBF] flex items-center justify-between text-xs"
                        >
                            <div class="flex items-center gap-1.5 text-[#967B47] font-headline font-bold">
                                <span class="material-symbols-outlined text-base">warning</span>
                                <span>{{ conflictingShiftsForRequest.length }} assigned shift(s) will require coverage</span>
                            </div>
                            <span class="font-headline text-[10px] font-bold text-[#967B47]">Requires Sign-Off</span>
                        </div>
                        <div
                            v-else
                            class="p-2.5 rounded-lg bg-[#EAF0E8] border border-[#C9DBC2] flex items-center justify-between text-xs"
                        >
                            <div class="flex items-center gap-1.5 text-[#76946A] font-headline font-bold">
                                <span class="material-symbols-outlined text-base">check_circle</span>
                                <span>Zero Shift Conflicts · Coverage Verified</span>
                            </div>
                            <span class="font-headline text-[10px] font-bold text-[#76946A]">Auto-eligible</span>
                        </div>

                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold shadow-xs transition-all cursor-pointer"
                        >
                            <span class="material-symbols-outlined text-base">send</span>
                            <span>{{ isSubmitting ? 'Transmitting...' : `Submit Request (${requestedDaysCount}.0 Days)` }}</span>
                        </button>
                    </form>
                </div>

                <!-- Recent Leave History & Balances Used Card -->
                <div class="rounded-xl bg-white border border-[#DCD7CE] p-4 lg:p-5 shadow-xs flex flex-col gap-3.5">
                    <div class="flex items-center justify-between">
                        <h3 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">
                            Recent Leave History &amp; Queue
                        </h3>
                        <span class="font-mono-num text-xs font-bold text-[#967B47]">{{ requests.length }} Request(s)</span>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div
                            v-if="requests.length === 0"
                            class="p-5 text-center text-xs text-[#5A5D64] bg-[#FAF8F5] border border-[#DCD7CE] rounded-lg"
                        >
                            No time-off requests found. Click any date on the calendar to submit your first request.
                        </div>

                        <!-- Live API Requests -->
                        <div
                            v-for="req in requests"
                            :key="req.id"
                            class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:border-[#2D4F67] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                            @click="openDetails(req)"
                        >
                            <div class="flex items-center gap-2 min-w-0">
                                <span
                                    :class="[
                                        req.status === 'approved' ? 'bg-[#EAF0E8] text-[#76946A]' : '',
                                        req.status === 'rejected' ? 'bg-[#FCECEC] text-[#C34043]' : '',
                                        req.status === 'pending' ? 'bg-[#FAF3E8] text-[#967B47]' : '',
                                        'px-2 py-0.5 rounded font-headline text-[10px] font-bold uppercase shrink-0',
                                    ]"
                                >
                                    {{ req.status }}
                                </span>
                                <div class="min-w-0">
                                    <span class="font-mono-num text-xs font-bold text-[#1F1F28] block truncate">
                                        {{ req.start_date }} – {{ req.end_date }}
                                    </span>
                                    <span class="text-[11px] text-[#5A5D64] block truncate">
                                        {{ req.reason || req.user?.name || 'Leave Request' }}
                                    </span>
                                </div>
                            </div>
                            <span class="font-mono-num text-xs font-bold text-[#2D4F67] shrink-0">
                                {{ getLeaveDays(req.start_date, req.end_date) }}.0d
                            </span>
                        </div>



                        <!-- Donut Mini Summary -->
                        <div class="mt-1 p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="relative w-10 h-10 shrink-0">
                                    <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                                        <path
                                            class="text-[#E7E3DC]"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="3.5"
                                        ></path>
                                        <path
                                            class="text-[#2D4F67]"
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-dasharray="60, 100"
                                            stroke-linecap="round"
                                            stroke-width="3.5"
                                        ></path>
                                    </svg>
                                    <span class="absolute inset-0 flex items-center justify-center font-mono-num text-[10px] font-bold text-[#2D4F67]">
                                        60%
                                    </span>
                                </div>
                                <div>
                                    <span class="font-headline text-xs font-bold text-[#1F1F28] block">Allowance Health</span>
                                    <span class="font-mono-num text-[11px] text-[#5A5D64]">7.5 / 12.0 Days Available</span>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#E6ECF0] text-[#2D4F67] font-headline text-[10px] font-bold">
                                Tier L2 Lead
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Time-Off Conflict Inspector Modal -->
        <div
            v-if="showDetailModal && activeDetail"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#2D4F67]">fact_check</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">
                            Time-Off Conflict Inspector · <span class="font-mono-num text-[#2D4F67]">#TO-{{ activeDetail.id }}</span>
                        </h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showDetailModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <div class="p-5 space-y-4 text-xs">
                    <div class="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE]">
                        <div>
                            <span class="text-[#8A8D93] font-headline font-bold uppercase tracking-wider text-[10px]">
                                Staff Member
                            </span>
                            <p class="font-headline font-bold text-sm text-[#1F1F28] mt-0.5">
                                {{ activeDetail.user?.name }}
                            </p>
                            <p class="text-[11px] text-[#5A5D64]">{{ activeDetail.user?.email }}</p>
                        </div>

                        <div>
                            <span class="text-[#8A8D93] font-headline font-bold uppercase tracking-wider text-[10px]">
                                Requested Window
                            </span>
                            <p class="font-mono-num font-bold text-sm text-[#2D4F67] mt-0.5">
                                {{ activeDetail.start_date }} → {{ activeDetail.end_date }}
                            </p>
                            <p class="text-[11px] text-[#5A5D64]">
                                <span class="font-mono-num font-bold">{{ getLeaveDays(activeDetail.start_date, activeDetail.end_date) }}</span> day(s) requested
                            </p>
                        </div>
                    </div>

                    <div>
                        <span class="text-[#5A5D64] font-headline font-bold uppercase tracking-wider text-[10px] block mb-1.5">
                            Overlapping Assigned Shifts
                        </span>
                        <div
                            v-if="activeConflicts.length === 0"
                            class="p-3 rounded-lg bg-[#EAF0E8] border border-[#C9DBC2] text-[#76946A] font-headline font-bold flex items-center gap-2"
                        >
                            <span class="material-symbols-outlined text-base">check_circle</span>
                            <span>No overlapping shifts assigned during this leave period.</span>
                        </div>
                        <div v-else class="space-y-2">
                            <div
                                v-for="cf in activeConflicts"
                                :key="cf.id"
                                class="p-3 rounded-lg bg-[#FCECEC] border border-[#F3C5C6] text-[#C34043] flex items-center justify-between"
                            >
                                <div class="flex items-center gap-2">
                                    <span class="material-symbols-outlined text-base">warning</span>
                                    <span class="font-headline font-bold">{{ cf.role_label }}</span>
                                </div>
                                <span class="font-mono-num font-semibold text-[11px]">
                                    {{ new Date(cf.start_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) }}
                                    · {{ format24h(cf.start_at) }} – {{ format24h(cf.end_at) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        v-if="isManager && activeDetail.status === 'pending'"
                        class="pt-3 border-t border-[#DCD7CE] space-y-3"
                    >
                        <div>
                            <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                                Manager Decision Note
                            </label>
                            <input
                                v-model="managerDecisionNotes"
                                type="text"
                                placeholder="Optional decision note for staff member..."
                                class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                            />
                        </div>

                        <div class="flex items-center justify-end gap-2">
                            <button
                                :disabled="isSubmitting"
                                class="px-3.5 py-2 rounded-lg font-headline font-bold text-xs text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#DCD7CE] hover:border-[#C34043] transition cursor-pointer"
                                @click="handleReject(activeDetail)"
                            >
                                Reject Leave
                            </button>
                            <button
                                :disabled="isSubmitting"
                                class="inline-flex items-center gap-1 px-4 py-2 rounded-lg font-headline font-bold text-xs text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-xs transition cursor-pointer"
                                @click="handleApprove(activeDetail)"
                            >
                                <span class="material-symbols-outlined text-sm">check</span>
                                Approve Leave
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
