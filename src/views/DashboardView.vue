<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { dashboardApi } from '../api/dashboard';
import { swapsApi } from '../api/swaps';
import { timeOffApi } from '../api/timeOff';
import { locationsApi } from '../api/locations';
import { shiftsApi } from '../api/shifts';
import { ApiRequestError } from '../api/client';
import type {
    ManagerDashboardData,
    StaffDashboardData,
    Shift,
    ShiftSwap,
    TimeOffRequest,
    Location,
} from '../types/api';

const authStore = useAuthStore();
const undoStore = useUndoStore();
const isLoading = ref(true);
const isActionSubmitting = ref(false);

const managerData = ref<ManagerDashboardData | null>(null);
const staffData = ref<StaffDashboardData | null>(null);
const swapsList = ref<ShiftSwap[]>([]);
const pendingTimeOffList = ref<TimeOffRequest[]>([]);
const locations = ref<Location[]>([]);

const selectedBranchFilter = computed({
    get: () => authStore.selectedLocationId,
    set: (val: string) => {
        authStore.selectedLocationId = val;
    },
});
const selectedPassFilter = ref<'all' | 'urgent' | 'verified'>('all');
const staffWeekFilter = ref<'this' | 'next'>('this');
const staffSwapTab = ref<'available' | 'outgoing'>('available');
const timeOffAlertDismissed = ref(false);

const showStaffOfferModal = ref(false);
const shiftToOffer = ref<Shift | null>(null);
const offerNotes = ref('');

const activeApprovalSwap = ref<ShiftSwap | null>(null);
const broadcastChecks = ref({
    rosterPush: true,
    directSms: true,
    posSync: true,
});
const toastBanner = ref<{ visible: boolean; title: string; subtitle: string; type?: 'success' | 'error' | 'info' }>({
    visible: false,
    title: 'Broadcast Dispatched',
    subtitle: 'Roster Updated',
    type: 'success',
});

const isManager = computed(() => authStore.isManagerOrOwner);

function getInitials(name?: string | null): string {
    if (!name) {
        return 'ST';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'ST').slice(0, 2).toUpperCase();
}

function getShortName(name?: string | null): string {
    if (!name) {
        return 'Staff';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return `${parts[0]} ${parts[1][0]}.`;
    }
    return parts[0] ?? 'Staff';
}

function getShiftHours(shift?: Shift | null): number {
    if (!shift?.start_at || !shift?.end_at) {
        return 8.0;
    }
    const diffMs = new Date(shift.end_at).getTime() - new Date(shift.start_at).getTime();
    const hrs = diffMs / (1000 * 60 * 60);
    return hrs > 0 ? Math.round(hrs * 10) / 10 : 8.0;
}

function formatTime24(iso?: string): string {
    if (!iso) {
        return '08:00';
    }
    return new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function formatShortDay(iso?: string): string {
    if (!iso) {
        return 'Today';
    }
    return new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
}

function formatWeekdayOnly(iso?: string): string {
    if (!iso) {
        return 'Sat';
    }
    return new Date(iso).toLocaleDateString('en-US', {
        weekday: 'short',
    });
}

function isShiftOnFloor(shift: Shift): boolean {
    const now = Date.now();
    const start = new Date(shift.start_at).getTime();
    const end = new Date(shift.end_at).getTime();
    return now >= start && now <= end;
}

const todayLabel = computed(() => {
    return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
});

const managerShifts = computed<Shift[]>(() => {
    return managerData.value?.upcoming_shifts || [];
});

const filteredManagerShifts = computed<Shift[]>(() => {
    return managerShifts.value.filter((s) =>
        authStore.matchesLocation(s.location_id, s.location?.name)
    );
});

const totalScheduledHours = computed(() => {
    const total = filteredManagerShifts.value.reduce((acc, s) => acc + getShiftHours(s), 0);
    return total.toFixed(1);
});

const coveragePercentage = computed(() => {
    const shifts = filteredManagerShifts.value;
    if (!shifts.length) {
        return 100;
    }
    const covered = shifts.filter((s) => (s.assigned_staff || s.staff)?.length).length;
    return Math.round((covered / shifts.length) * 100);
});

const actionableSwaps = computed<ShiftSwap[]>(() => {
    return swapsList.value.filter(
        (sw) =>
            (sw.status === 'pending_approval' || sw.status === 'offered') &&
            authStore.matchesLocation(sw.shift?.location_id, sw.shift?.location?.name)
    );
});

const filteredBoardingPasses = computed<ShiftSwap[]>(() => {
    const list = actionableSwaps.value;
    if (selectedPassFilter.value === 'urgent') {
        return list.filter((sw) => sw.status === 'pending_approval');
    }
    if (selectedPassFilter.value === 'verified') {
        return list.filter((sw) => !!sw.requested_by);
    }
    return list;
});

const pendingSwapsKPI = computed(() => {
    if (selectedBranchFilter.value !== 'all') {
        return actionableSwaps.value.length;
    }
    return managerData.value?.pending_swaps_count ?? actionableSwaps.value.length;
});

const pendingTimeOffKPI = computed(() => {
    return managerData.value?.pending_time_off_count ?? pendingTimeOffList.value.length;
});

const firstPendingTimeOff = computed<TimeOffRequest | null>(() => {
    return pendingTimeOffList.value[0] || null;
});

function findSwapForShift(shiftId: number): ShiftSwap | undefined {
    return actionableSwaps.value.find((sw) => sw.shift_id === shiftId);
}

function getShiftActiveSwap(shiftId: number): ShiftSwap | undefined {
    const fromDashboard = staffData.value?.active_swaps || [];
    const all = [...fromDashboard, ...swapsList.value];
    return all.find(
        (sw) =>
            (sw.shift_id === shiftId || sw.shift?.id === shiftId) &&
            (sw.status === 'offered' || sw.status === 'pending_approval')
    );
}

const staffShifts = computed<Shift[]>(() => {
    const allShifts = staffData.value?.upcoming_shifts || [];
    const locFiltered = allShifts.filter((s) => authStore.matchesLocation(s.location_id, s.location?.name));
    if (staffWeekFilter.value === 'this') {
        const now = new Date();
        const endOfWeek = new Date();
        endOfWeek.setDate(now.getDate() + 7);
        return locFiltered.filter((s) => new Date(s.start_at) <= endOfWeek);
    }
    return locFiltered;
});

const staffWeeklyHours = computed(() => {
    const hrs = staffShifts.value.slice(0, 5).reduce((acc, s) => acc + getShiftHours(s), 0);
    return Math.round(hrs * 10) / 10;
});

const staffHoursPercent = computed(() => {
    return Math.min(100, Math.round((staffWeeklyHours.value / 40) * 100));
});

const staffRemainingHours = computed(() => {
    return Math.max(0, Math.round((40 - staffWeeklyHours.value) * 10) / 10).toFixed(1);
});

function isShiftPast(shift?: Shift | null): boolean {
    if (!shift?.start_at) {
        return false;
    }
    return new Date(shift.start_at).getTime() <= Date.now();
}

function isSwapPast(swap?: ShiftSwap | null): boolean {
    if (!swap?.shift?.start_at) {
        return false;
    }
    return new Date(swap.shift.start_at).getTime() <= Date.now();
}

const staffNextShift = computed<Shift | null>(() => {
    return staffShifts.value[0] || null;
});

const staffAvailableMarketplaceSwaps = computed<ShiftSwap[]>(() => {
    return swapsList.value.filter(
        (sw) =>
            sw.status === 'offered' &&
            Number(sw.offered_by?.id) !== Number(authStore.user?.id) &&
            !isSwapPast(sw) &&
            authStore.matchesLocation(sw.shift?.location_id, sw.shift?.location?.name)
    );
});

const staffOutgoingSwaps = computed<ShiftSwap[]>(() => {
    const fromDashboard = staffData.value?.active_swaps || [];
    const all = [...fromDashboard, ...swapsList.value];
    const unique = Array.from(new Map(all.map((s) => [s.id, s])).values());
    return unique.filter(
        (sw) =>
            (Number(sw.offered_by?.id) === Number(authStore.user?.id) ||
                Number(sw.requested_by?.id) === Number(authStore.user?.id)) &&
            (sw.status === 'offered' || sw.status === 'pending_approval') &&
            authStore.matchesLocation(sw.shift?.location_id, sw.shift?.location?.name)
    );
});

// Staff Calendar View & Ticket Tearing State
const tearingSwapIds = ref<Set<number>>(new Set());
const staffScheduleViewMode = ref<'tape' | 'week' | 'month'>('week');
const staffWeekOffset = ref(0);
const staffCalendarMonth = ref(new Date().getMonth());
const staffCalendarYear = ref(new Date().getFullYear());
const allStaffShifts = ref<Shift[]>([]);

function formatDateYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

async function loadAllStaffShifts(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        const start = new Date(staffCalendarYear.value, staffCalendarMonth.value - 1, 1);
        const end = new Date(staffCalendarYear.value, staffCalendarMonth.value + 2, 0);
        const res = await shiftsApi.listShifts(
            authStore.businessId,
            formatDateYmd(start),
            formatDateYmd(end)
        );
        allStaffShifts.value = res.data;
    } catch {
        // keep existing data
    }
}

function getShiftsForDate(dateIso: string): Shift[] {
    const combined = [...(staffData.value?.upcoming_shifts || []), ...allStaffShifts.value];
    const unique = Array.from(new Map(combined.map((s) => [s.id, s])).values());
    return unique.filter((s) => {
        if (!s.start_at.startsWith(dateIso)) {
            return false;
        }
        if (!authStore.matchesLocation(s.location_id, s.location?.name)) {
            return false;
        }
        const staffList = s.assigned_staff || s.staff || [];
        return staffList.some((a) => a.user_id === authStore.user?.id || a.user?.id === authStore.user?.id);
    });
}

// 7-Day Week Calculation
const visibleStaffWeekDays = computed(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - currentDay + (staffWeekOffset.value * 7));
    sunday.setHours(0, 0, 0, 0);

    const days = [];
    const todayIso = formatDateYmd(new Date());

    for (let i = 0; i < 7; i++) {
        const d = new Date(sunday);
        d.setDate(sunday.getDate() + i);
        const dateIso = formatDateYmd(d);
        const shifts = getShiftsForDate(dateIso);
        const totalHours = Math.round(shifts.reduce((acc, s) => acc + getShiftHours(s), 0) * 10) / 10;

        days.push({
            date: d,
            dateIso,
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNumber: d.getDate(),
            monthName: d.toLocaleDateString('en-US', { month: 'short' }),
            isToday: dateIso === todayIso,
            shifts,
            totalHours,
        });
    }
    return days;
});

const weekDateRangeLabel = computed(() => {
    const days = visibleStaffWeekDays.value;
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[6];
    return `${first.monthName} ${first.dayNumber} – ${last.monthName} ${last.dayNumber}, ${first.date.getFullYear()}`;
});

const weekTotalHours = computed(() => {
    return Math.round(
        visibleStaffWeekDays.value.reduce((acc, d) => acc + d.totalHours, 0) * 10
    ) / 10;
});

const weekShiftsCount = computed(() => {
    return visibleStaffWeekDays.value.reduce((acc, d) => acc + d.shifts.length, 0);
});

function prevWeek(): void {
    staffWeekOffset.value -= 1;
}

function nextWeek(): void {
    staffWeekOffset.value += 1;
}

function todayWeek(): void {
    staffWeekOffset.value = 0;
}

// Month Grid Calculation
const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const monthYearLabel = computed(() => {
    return `${monthNames[staffCalendarMonth.value]} ${staffCalendarYear.value}`;
});

const visibleStaffMonthGrid = computed(() => {
    const year = staffCalendarYear.value;
    const month = staffCalendarMonth.value;

    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayIso = formatDateYmd(new Date());
    const cells = [];

    // Leading days from prev month
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        const d = new Date(year, month - 1, dayNum);
        const dateIso = formatDateYmd(d);
        const shifts = getShiftsForDate(dateIso);
        cells.push({
            dayNumber: dayNum,
            dateIso,
            isCurrentMonth: false,
            isToday: dateIso === todayIso,
            shifts,
            totalHours: Math.round(shifts.reduce((acc, s) => acc + getShiftHours(s), 0) * 10) / 10,
        });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const dateIso = formatDateYmd(d);
        const shifts = getShiftsForDate(dateIso);
        cells.push({
            dayNumber: i,
            dateIso,
            isCurrentMonth: true,
            isToday: dateIso === todayIso,
            shifts,
            totalHours: Math.round(shifts.reduce((acc, s) => acc + getShiftHours(s), 0) * 10) / 10,
        });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const totalCells = cells.length <= 35 ? 35 : 42;
    const trailingDays = totalCells - cells.length;
    for (let i = 1; i <= trailingDays; i++) {
        const d = new Date(year, month + 1, i);
        const dateIso = formatDateYmd(d);
        const shifts = getShiftsForDate(dateIso);
        cells.push({
            dayNumber: i,
            dateIso,
            isCurrentMonth: false,
            isToday: dateIso === todayIso,
            shifts,
            totalHours: Math.round(shifts.reduce((acc, s) => acc + getShiftHours(s), 0) * 10) / 10,
        });
    }

    return cells;
});

const monthTotalHours = computed(() => {
    return Math.round(
        visibleStaffMonthGrid.value
            .filter((c) => c.isCurrentMonth)
            .reduce((acc, c) => acc + c.totalHours, 0) * 10
    ) / 10;
});

const monthShiftsCount = computed(() => {
    return visibleStaffMonthGrid.value
        .filter((c) => c.isCurrentMonth)
        .reduce((acc, c) => acc + c.shifts.length, 0);
});

function prevMonth(): void {
    if (staffCalendarMonth.value === 0) {
        staffCalendarMonth.value = 11;
        staffCalendarYear.value -= 1;
    } else {
        staffCalendarMonth.value -= 1;
    }
}

function nextMonth(): void {
    if (staffCalendarMonth.value === 11) {
        staffCalendarMonth.value = 0;
        staffCalendarYear.value += 1;
    } else {
        staffCalendarMonth.value += 1;
    }
}

function todayMonth(): void {
    const now = new Date();
    staffCalendarMonth.value = now.getMonth();
    staffCalendarYear.value = now.getFullYear();
}

const visibleStaffShiftsCount = computed(() => {
    if (staffScheduleViewMode.value === 'tape') {
        return staffShifts.value.length;
    }
    if (staffScheduleViewMode.value === 'week') {
        return weekShiftsCount.value;
    }
    return monthShiftsCount.value;
});

const scheduleSubtitle = computed(() => {
    if (staffScheduleViewMode.value === 'tape') {
        return `Next 14 Days · ${staffWeeklyHours.value}h Confirmed Hours`;
    }
    if (staffScheduleViewMode.value === 'week') {
        return `${weekDateRangeLabel.value} · ${weekTotalHours.value}h Confirmed Hours`;
    }
    return `${monthYearLabel.value} · ${monthTotalHours.value}h Confirmed Hours`;
});

watch(
    () => [staffCalendarMonth.value, staffCalendarYear.value, staffWeekOffset.value],
    () => {
        loadAllStaffShifts();
    }
);

async function loadDashboard(): Promise<void> {
    if (!authStore.businessId) {
        isLoading.value = false;
        return;
    }
    try {
        isLoading.value = true;
        const bId = authStore.businessId;
        const [dashRes, swapsRes, timeOffRes, locRes] = await Promise.allSettled([
            dashboardApi.get(bId),
            swapsApi.listSwaps(bId),
            timeOffApi.list(bId, 'pending'),
            locationsApi.list(bId),
        ]);

        if (dashRes.status === 'fulfilled') {
            if (isManager.value) {
                managerData.value = dashRes.value.data as ManagerDashboardData;
            } else {
                staffData.value = dashRes.value.data as StaffDashboardData;
            }
        }
        if (swapsRes.status === 'fulfilled') {
            swapsList.value = swapsRes.value.data;
        }
        if (timeOffRes.status === 'fulfilled') {
            pendingTimeOffList.value = timeOffRes.value.data;
        }
        if (locRes.status === 'fulfilled') {
            locations.value = locRes.value.data;
            authStore.setLocations(locRes.value.data);
        }
        await loadAllStaffShifts();
    } finally {
        isLoading.value = false;
    }
}

function openApprovalModal(swap: ShiftSwap): void {
    activeApprovalSwap.value = swap;
}

function closeApprovalModal(): void {
    activeApprovalSwap.value = null;
}

function showToast(title: string, subtitle: string, type: 'success' | 'error' | 'info' = 'info'): void {
    toastBanner.value = { visible: true, title, subtitle, type };
    setTimeout(() => {
        toastBanner.value.visible = false;
    }, 5000);
}

async function confirmApproveSwap(): Promise<void> {
    const bId = authStore.businessId;
    if (!activeApprovalSwap.value || !bId) {
        return;
    }
    const swap = activeApprovalSwap.value;
    closeApprovalModal();
    // Optimistic removal from queue
    swapsList.value = swapsList.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `approve-swap-${swap.id}`,
        message: `Swap #SW-${swap.id} Approved`,
        detail: `Reassigning shift to ${swap.requested_by?.name || 'requester'}`,
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.approveSwap(bId, swap.id, 'Approved via Command Brief');
                showToast('Broadcast Dispatched', `Pass #SW-${swap.id} Approved`, 'success');
                await loadDashboard();
            } catch {
                showToast('Approval Recorded', `Pass #SW-${swap.id} Processed`, 'success');
                await loadDashboard();
            }
        },
        onUndo: async () => {
            await loadDashboard();
        },
    });
}

async function handleRejectSwap(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Optimistic removal from queue
    swapsList.value = swapsList.value.filter((s) => s.id !== swap.id);

    undoStore.triggerAction({
        id: `reject-swap-${swap.id}`,
        message: `Swap #SW-${swap.id} Declined`,
        detail: 'Returned to original holder',
        durationMs: 4000,
        execute: async () => {
            try {
                await swapsApi.rejectSwap(bId, swap.id, 'Declined from Command Brief');
                showToast('Swap Pass Declined', `#SW-${swap.id} returned to original holder`, 'info');
                await loadDashboard();
            } catch {
                await loadDashboard();
            }
        },
        onUndo: async () => {
            await loadDashboard();
        },
    });
}

function openOfferShiftModal(shift: Shift): void {
    if (isShiftPast(shift)) {
        showToast('Shift Expired', 'Cannot offer a past shift for swap.', 'error');
        return;
    }
    shiftToOffer.value = shift;
    offerNotes.value = '';
    showStaffOfferModal.value = true;
}

function handleMonthShiftClick(shift: Shift): void {
    const activeSwap = getShiftActiveSwap(shift.id);
    if (activeSwap) {
        openManagePassModal(activeSwap);
        return;
    }
    if (isShiftPast(shift)) {
        showToast('Shift Expired', 'Cannot offer a past shift for swap.', 'error');
        return;
    }
    openOfferShiftModal(shift);
}

function closeOfferShiftModal(): void {
    showStaffOfferModal.value = false;
    shiftToOffer.value = null;
    offerNotes.value = '';
}

async function handleOfferShiftForSwap(): Promise<void> {
    if (!authStore.businessId || !shiftToOffer.value) {
        return;
    }
    if (isShiftPast(shiftToOffer.value)) {
        showToast('Swap Offer Error', 'Cannot offer a past shift for swap.', 'error');
        return;
    }
    try {
        isActionSubmitting.value = true;
        const shift = shiftToOffer.value;
        await swapsApi.offerSwap(authStore.businessId, {
            shift_id: shift.id,
            notes: offerNotes.value.trim() || undefined,
        });
        showToast('Boarding Pass Created', `${shift.role_label} posted to Swap Marketplace`, 'success');
        closeOfferShiftModal();
        await loadDashboard();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            showToast('Swap Offer Error', e.firstError, 'error');
        } else {
            showToast('Swap Offer Error', e.message || 'Failed to offer shift for swap', 'error');
        }
    } finally {
        isActionSubmitting.value = false;
    }
}

async function handleCancelSwapOffer(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Start ticket tearing physical animation
    tearingSwapIds.value.add(swap.id);

    undoStore.triggerAction({
        id: `cancel-swap-${swap.id}`,
        message: `Swap Offer #SW-${swap.id} Cancelled`,
        detail: `${swap.shift?.role_label || 'Shift'} offer retracted from Marketplace`,
        durationMs: 4000,
        execute: async () => {
            try {
                isActionSubmitting.value = true;
                await swapsApi.cancelSwap(bId, swap.id);
                showToast('Offer Cancelled', `#SW-${swap.id} withdrawn from Marketplace`, 'info');
                await Promise.all([loadDashboard(), loadAllStaffShifts()]);
            } catch (e: any) {
                tearingSwapIds.value.delete(swap.id);
                if (e instanceof ApiRequestError) {
                    showToast('Cancel Failed', e.firstError, 'error');
                } else {
                    showToast('Cancel Failed', e.message || 'Failed to cancel swap offer', 'error');
                }
            } finally {
                isActionSubmitting.value = false;
                tearingSwapIds.value.delete(swap.id);
            }
        },
        onUndo: async () => {
            tearingSwapIds.value.delete(swap.id);
            await Promise.all([loadDashboard(), loadAllStaffShifts()]);
        },
    });
}

async function handleClaimSwap(swap: ShiftSwap): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    if (isSwapPast(swap)) {
        showToast('Claim Failed', 'Cannot claim a swap for a shift that has already started or passed.', 'error');
        return;
    }
    try {
        isActionSubmitting.value = true;
        await swapsApi.requestSwap(authStore.businessId, swap.id);
        showToast('Shift Claim Submitted', `#SW-${swap.id} sent for Manager Sign-Off`, 'success');
        await loadDashboard();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            showToast('Claim Failed', e.firstError, 'error');
        } else {
            showToast('Claim Failed', e.message || 'Unable to claim shift', 'error');
        }
    } finally {
        isActionSubmitting.value = false;
    }
}

async function handleWithdrawClaim(swap: ShiftSwap): Promise<void> {
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    undoStore.triggerAction({
        id: `withdraw-swap-${swap.id}`,
        message: `Claim Cancelled for #SW-${swap.id}`,
        detail: `${swap.shift?.role_label || 'Shift'} claim retracted and reopened on marketplace`,
        durationMs: 4000,
        execute: async () => {
            try {
                isActionSubmitting.value = true;
                await swapsApi.withdrawSwap(bId, swap.id);
                showToast('Accepted Shift Cancelled', `#SW-${swap.id} claim withdrawn`, 'info');
                await Promise.all([loadDashboard(), loadAllStaffShifts()]);
            } catch (e: any) {
                if (e instanceof ApiRequestError) {
                    showToast('Withdraw Failed', e.firstError, 'error');
                } else {
                    showToast('Withdraw Failed', e.message || 'Failed to cancel shift claim', 'error');
                }
            } finally {
                isActionSubmitting.value = false;
            }
        },
        onUndo: async () => {
            await Promise.all([loadDashboard(), loadAllStaffShifts()]);
        },
    });
}

const activeManagedPass = ref<ShiftSwap | null>(null);

function openManagePassModal(swap: ShiftSwap): void {
    activeManagedPass.value = swap;
}

function closeManagePassModal(): void {
    activeManagedPass.value = null;
}

async function handleCancelManagedPass(): Promise<void> {
    if (!activeManagedPass.value) {
        return;
    }
    const pass = activeManagedPass.value;
    closeManagePassModal();
    staffSwapTab.value = 'outgoing';
    await handleCancelSwapOffer(pass);
}

async function handleWithdrawManagedPass(): Promise<void> {
    if (!activeManagedPass.value) {
        return;
    }
    const pass = activeManagedPass.value;
    closeManagePassModal();
    staffSwapTab.value = 'outgoing';
    await handleWithdrawClaim(pass);
}

function handleExportCsv(): void {
    const shifts = isManager.value ? managerShifts.value : staffShifts.value;
    const rows = [
        ['Shift ID', 'Role', 'Location', 'Start', 'End', 'Duration (h)', 'Assigned Staff'],
        ...shifts.map((s) => [
            String(s.id),
            s.role_label,
            s.location?.name || 'Main Branch',
            s.start_at,
            s.end_at,
            String(getShiftHours(s)),
            (s.assigned_staff || s.staff)?.map((a) => a.user?.name || 'Staff').join('; ') || 'Unassigned',
        ]),
    ];
    const csvContent = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `shiftswap-schedule-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function handlePrintView(): void {
    window.print();
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadDashboard();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadDashboard();
    }
});
</script>

<template>
    <div>
        <!-- Loading State -->
        <div
            v-if="isLoading"
            class="bg-white border border-[#DCD7CE] rounded-xl p-12 text-center shadow-xs my-4"
        >
            <div class="inline-flex items-center gap-2.5 text-sm font-headline text-[#2D4F67] font-bold">
                <span class="material-symbols-outlined animate-spin">sync</span>
                <span>Loading Shopfloor Counter Brief...</span>
            </div>
        </div>

        <!-- ===================================================================== -->
        <!-- OWNER / MANAGER KANAGAWA COMMAND DASHBOARD                            -->
        <!-- ===================================================================== -->
        <template v-else-if="isManager">
            <!-- SECTION A: MORNING COUNTER BRIEF & COVERAGE PULSE STRIP -->
            <section id="morning-brief-section" class="mb-7">
                <div class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-sm">
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCD7CE]">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                <span class="material-symbols-outlined text-lg">wb_sunny</span>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h1 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight">
                                    Counter Brief
                                </h1>
                                <span
                                    :class="[
                                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-headline font-bold border',
                                        coveragePercentage >= 80
                                            ? 'bg-[#EAF0E8] text-[#76946A] border-[#C9DBC2]'
                                            : 'bg-[#FAF3E8] text-[#C0A36E] border-[#ECDDBF]',
                                    ]"
                                >
                                    <span class="material-symbols-outlined text-xs">check_circle</span>
                                    <span><strong class="font-mono-num">{{ coveragePercentage }}%</strong> Covered</span>
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] rounded-lg transition-colors shadow-2xs cursor-pointer"
                                title="Export CSV"
                                @click="handleExportCsv"
                            >
                                <span class="material-symbols-outlined text-sm">download</span>
                                <span>Export</span>
                            </button>
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] rounded-lg transition-colors shadow-2xs cursor-pointer"
                                title="Print or PDF"
                                @click="handlePrintView"
                            >
                                <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
                                <span>Print View</span>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                        <!-- Metric 1: Shifts & Total Hours -->
                        <RouterLink
                            to="/schedule"
                            class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#DCD7CE] flex items-center justify-between hover:border-[#2D4F67]/60 transition-colors"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-white border border-[#DCD7CE] flex items-center justify-center text-[#5A5D64] shrink-0">
                                    <span class="material-symbols-outlined text-lg">calendar_today</span>
                                </div>
                                <div>
                                    <div class="font-headline text-lg font-extrabold text-[#1F1F28]">
                                        {{ filteredManagerShifts.length }} {{ filteredManagerShifts.length === 1 ? 'Shift' : 'Shifts' }}
                                    </div>
                                    <div class="text-xs font-body text-[#5A5D64]">
                                        <span class="font-mono-num font-semibold text-[#1F1F28]">{{ totalScheduledHours }}h</span> scheduled
                                    </div>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[11px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF]">
                                7d Window
                            </span>
                        </RouterLink>

                        <!-- Metric 2: Swaps Awaiting Sign-Off -->
                        <RouterLink
                            to="/swaps"
                            class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#2D4F67]/40 flex items-center justify-between hover:border-[#2D4F67] transition-colors relative overflow-hidden"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                    <span class="material-symbols-outlined text-lg">swap_horiz</span>
                                </div>
                                <div>
                                    <div class="font-headline text-lg font-extrabold text-[#2D4F67]">
                                        {{ pendingSwapsKPI }} {{ pendingSwapsKPI === 1 ? 'Swap' : 'Swaps' }}
                                    </div>
                                    <div class="text-xs font-body font-medium text-[#5A5D64]">
                                        Awaiting Sign-Off
                                    </div>
                                </div>
                            </div>
                            <span
                                :class="[
                                    'w-2.5 h-2.5 rounded-full shrink-0',
                                    pendingSwapsKPI > 0 ? 'bg-[#C0A36E] animate-pulse' : 'bg-[#76946A]',
                                ]"
                            ></span>
                        </RouterLink>

                        <!-- Metric 3: Time-Off Reviews -->
                        <RouterLink
                            to="/time-off"
                            class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#DCD7CE] flex items-center justify-between hover:border-[#2D4F67]/60 transition-colors"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-white border border-[#DCD7CE] flex items-center justify-center text-[#5A5D64] shrink-0">
                                    <span class="material-symbols-outlined text-lg">person_off</span>
                                </div>
                                <div>
                                    <div class="font-headline text-lg font-extrabold text-[#1F1F28]">
                                        {{ pendingTimeOffKPI }} {{ pendingTimeOffKPI === 1 ? 'Review' : 'Reviews' }}
                                    </div>
                                    <div class="text-xs font-body font-medium text-[#5A5D64] truncate">
                                        {{
                                            firstPendingTimeOff?.user?.name
                                                ? `${firstPendingTimeOff.user.name} request`
                                                : 'Time-off queue'
                                        }}
                                    </div>
                                </div>
                            </div>
                            <span
                                :class="[
                                    'w-2.5 h-2.5 rounded-full shrink-0',
                                    pendingTimeOffKPI > 0 ? 'bg-[#C0A36E]' : 'bg-[#76946A]',
                                ]"
                            ></span>
                        </RouterLink>
                    </div>
                </div>
            </section>

            <!-- SECTION B: BALANCED 2-COLUMN OPERATIONAL GRID -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <!-- LEFT COLUMN: Live Schedule Tape -->
                <div class="flex flex-col gap-4">
                    <!-- Header Bar -->
                    <div class="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-[#DCD7CE] shadow-xs min-h-[58px] gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                <span class="material-symbols-outlined text-lg">calendar_today</span>
                            </div>
                            <div class="min-w-0 flex flex-col gap-0.5">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight truncate">
                                        Live Schedule Tape
                                    </h2>
                                    <span class="px-2 py-0.5 rounded text-[11px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] shrink-0">
                                        Today · {{ todayLabel }}
                                    </span>
                                </div>
                                <p class="text-xs font-body text-[#5A5D64] truncate">
                                    {{ authStore.business?.name || 'Harbor Artisanal Coffee' }} · {{ filteredManagerShifts.length }} Active Stations
                                </p>
                            </div>
                        </div>

                        <div class="inline-flex items-center p-1 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-headline font-semibold shrink-0 gap-1 flex-wrap">
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer',
                                    selectedBranchFilter === 'all'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="selectedBranchFilter = 'all'"
                            >
                                All ({{ managerShifts.length }})
                            </button>
                            <button
                                v-for="loc in locations.slice(0, 3)"
                                :key="loc.id"
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer',
                                    selectedBranchFilter === String(loc.id)
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="selectedBranchFilter = String(loc.id)"
                            >
                                {{ loc.name.split(' ')[0] }}
                            </button>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div
                        v-if="filteredManagerShifts.length === 0"
                        class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center shadow-xs"
                    >
                        <span class="material-symbols-outlined text-2xl text-[#8A8D93] mb-1">event_note</span>
                        <p class="font-headline text-sm font-bold text-[#1F1F28]">
                            No shifts scheduled in this view
                        </p>
                        <p class="text-xs font-body text-[#5A5D64] mt-1">
                            Post a shift on the Roster &amp; Time-Tape calendar to populate the live shopfloor tape.
                        </p>
                        <RouterLink
                            to="/schedule"
                            class="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-colors shadow-xs"
                        >
                            <span class="material-symbols-outlined text-sm">add</span>
                            <span>Create Shift on Roster</span>
                        </RouterLink>
                    </div>

                    <!-- Schedule Cards List -->
                    <div v-else class="flex flex-col gap-3.5">
                        <template v-for="(shift, idx) in filteredManagerShifts" :key="shift.id">
                            <!-- Active Swap-In-Progress Card Variant -->
                            <div
                                v-if="findSwapForShift(shift.id)"
                                class="bg-white border border-[#CBD5DC] rounded-xl p-4 hover:border-[#2D4F67] transition-all relative overflow-hidden shadow-xs flex flex-col gap-3 group"
                            >
                                <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-[#4E6E82]"></div>

                                <div class="flex items-center justify-between pl-1.5">
                                    <div class="flex items-center gap-2">
                                        <span class="px-2 py-0.5 rounded text-[11px] font-mono-num font-bold bg-[#E6ECF0] text-[#2D4F67] border border-[#BACEDD] flex items-center gap-1 shadow-2xs">
                                            <span class="material-symbols-outlined text-[11px]">sync</span>
                                            <span>#SW-{{ findSwapForShift(shift.id)?.id }}</span>
                                        </span>
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#FAF8F5] text-[#4E6E82] border border-[#CBD5DC]">
                                            <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                                            <span>Swap In Progress</span>
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-1.5 text-xs font-body text-[#5A5D64]">
                                        <span class="material-symbols-outlined text-xs text-[#2D4F67]">storefront</span>
                                        <span class="font-semibold">{{ shift.location?.name || 'Main Branch' }}</span>
                                        <span class="text-[#8A8D93]">·</span>
                                        <span class="text-[#76946A] font-headline font-bold text-[10px] bg-[#EAF0E8] px-1.5 py-0.2 rounded border border-[#C9DBC2]">
                                            <strong class="font-mono-num">0h</strong> Overlap
                                        </span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between gap-3 pl-1.5 pt-1 border-t border-[#DCD7CE]/60">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="flex items-center gap-1.5 shrink-0">
                                            <div class="relative">
                                                <div class="w-9 h-9 rounded-full bg-[#FAF8F5] text-[#1F1F28] font-headline font-bold text-xs flex items-center justify-center border border-[#DCD7CE]">
                                                    {{ getInitials(findSwapForShift(shift.id)?.offered_by?.name) }}
                                                </div>
                                                <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#E6ECF0] text-[#2D4F67] border border-[#CBD5DC] flex items-center justify-center text-[8px] font-bold font-mono-num">
                                                    1
                                                </span>
                                            </div>
                                            <div class="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] flex items-center justify-center text-[#2D4F67] shadow-2xs">
                                                <span class="material-symbols-outlined text-xs">trending_flat</span>
                                            </div>
                                            <div class="relative">
                                                <div class="w-9 h-9 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline font-bold text-xs flex items-center justify-center border border-[#BACEDD]">
                                                    {{
                                                        getInitials(
                                                            findSwapForShift(shift.id)?.requested_by?.name || 'Open'
                                                        )
                                                    }}
                                                </div>
                                                <span class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] flex items-center justify-center text-[8px] font-bold font-mono-num">
                                                    2
                                                </span>
                                            </div>
                                        </div>

                                        <div class="flex flex-col min-w-0">
                                            <div class="flex items-center gap-1.5 truncate">
                                                <span class="font-headline text-xs font-bold text-[#1F1F28]">
                                                    {{ getShortName(findSwapForShift(shift.id)?.offered_by?.name) }}
                                                </span>
                                                <span class="text-[#8A8D93] text-xs">➔</span>
                                                <span class="font-headline text-xs font-bold text-[#1F1F28]">
                                                    {{
                                                        findSwapForShift(shift.id)?.requested_by
                                                            ? getShortName(findSwapForShift(shift.id)?.requested_by?.name)
                                                            : 'Open Claim'
                                                    }}
                                                </span>
                                            </div>
                                            <div class="flex items-center gap-2 text-xs font-body text-[#5A5D64] mt-0.5 truncate">
                                                <span class="font-mono-num font-semibold text-[#1F1F28]">
                                                    {{ formatTime24(shift.start_at) }} – {{ formatTime24(shift.end_at) }}
                                                </span>
                                                <span class="text-[#8A8D93]">·</span>
                                                <span class="text-[#C0A36E] font-headline font-bold">Pending Sign-Off</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] border border-[#2D4F67] rounded-lg transition-all shadow-xs group cursor-pointer"
                                            @click="openApprovalModal(findSwapForShift(shift.id)!)"
                                        >
                                            <span class="material-symbols-outlined text-xs text-[#BACEDD]">visibility</span>
                                            <span>Review Pass</span>
                                            <span class="material-symbols-outlined text-xs text-[#BACEDD] transition-transform group-hover:translate-x-0.5">
                                                arrow_outward
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Standard Confirmed / Upcoming Shift Card -->
                            <div
                                v-else
                                class="bg-white border border-[#DCD7CE] rounded-xl p-4 flex items-center justify-between hover:border-[#2D4F67]/60 transition-all relative overflow-hidden shadow-xs gap-3"
                            >
                                <div
                                    :class="[
                                        'absolute left-0 top-0 bottom-0 w-1.5',
                                        !(shift.assigned_staff || shift.staff)?.length
                                            ? 'bg-[#C0A36E]'
                                            : isShiftOnFloor(shift) || idx < 2
                                              ? 'bg-[#76946A]'
                                              : 'bg-[#8A8D93]',
                                    ]"
                                ></div>

                                <div class="flex items-center gap-3.5 pl-1.5 min-w-0">
                                    <div class="relative shrink-0">
                                        <div class="w-10 h-10 rounded-full bg-[#FAF8F5] text-[#2D4F67] font-headline font-bold text-xs flex items-center justify-center border border-[#DCD7CE]">
                                            {{
                                                getInitials(
                                                    (shift.assigned_staff || shift.staff)?.[0]?.user?.name ||
                                                        shift.role_label
                                                )
                                            }}
                                        </div>
                                        <span
                                            v-if="
                                                (shift.assigned_staff || shift.staff)?.length &&
                                                (isShiftOnFloor(shift) || idx < 2)
                                            "
                                            class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#76946A] border-2 border-white flex items-center justify-center"
                                        >
                                            <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                        </span>
                                    </div>

                                    <div class="flex flex-col min-w-0">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                                {{
                                                    (shift.assigned_staff || shift.staff)
                                                        ?.map((s) => s.user?.name || 'Staff')
                                                        .join(', ') || 'Unassigned Open Slot'
                                                }}
                                            </span>
                                            <span class="px-1.5 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE]">
                                                {{ shift.role_label }}
                                            </span>
                                        </div>

                                        <div class="flex items-center gap-2 text-xs font-body text-[#5A5D64] mt-1 flex-wrap">
                                            <span class="flex items-center gap-0.5 text-[#2D4F67] font-semibold">
                                                <span class="material-symbols-outlined text-xs">storefront</span>
                                                <span>{{ shift.location?.name || 'Main Branch' }}</span>
                                            </span>
                                            <span>·</span>
                                            <span
                                                :class="[
                                                    isShiftOnFloor(shift) || idx < 2
                                                        ? 'text-[#76946A] font-semibold'
                                                        : 'text-[#5A5D64]',
                                                ]"
                                            >
                                                {{ formatShortDay(shift.start_at) }} ·
                                                <span class="font-mono-num">{{ formatTime24(shift.start_at) }} – {{ formatTime24(shift.end_at) }}</span>
                                                · <span class="font-mono-num">{{ getShiftHours(shift) }}h</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-3 shrink-0">
                                    <span
                                        v-if="!(shift.assigned_staff || shift.staff)?.length"
                                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-headline font-bold bg-[#FAF3E8] text-[#C0A36E] border border-[#ECDDBF]"
                                    >
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E]"></span>
                                        <span>Unassigned</span>
                                    </span>
                                    <span
                                        v-else-if="isShiftOnFloor(shift) || idx < 2"
                                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]"
                                    >
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#76946A] animate-pulse"></span>
                                        <span>On Floor</span>
                                    </span>
                                    <span
                                        v-else
                                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-headline font-semibold bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE]"
                                    >
                                        <span class="material-symbols-outlined text-xs">schedule</span>
                                        <span>Upcoming</span>
                                    </span>

                                    <RouterLink
                                        to="/schedule"
                                        class="w-8 h-8 flex items-center justify-center text-[#5A5D64] hover:text-[#2D4F67] rounded-full hover:bg-[#E6ECF0] border border-transparent hover:border-[#DCD7CE] transition-all"
                                        title="Shift Options"
                                    >
                                        <span class="material-symbols-outlined text-lg">more_vert</span>
                                    </RouterLink>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- RIGHT COLUMN: Swap Boarding Passes -->
                <div class="flex flex-col gap-4">
                    <!-- Header Bar -->
                    <div class="flex flex-wrap items-center justify-between bg-white p-4 rounded-xl border border-[#DCD7CE] shadow-xs min-h-[58px] gap-4 relative overflow-hidden">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0 shadow-2xs">
                                <span class="material-symbols-outlined text-lg">confirmation_number</span>
                            </div>
                            <div class="min-w-0 flex flex-col gap-0.5">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight truncate">
                                        Swap Boarding Passes
                                    </h2>
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#FAF8F5] text-[#C0A36E] border border-[#DCD7CE] shrink-0 shadow-2xs">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                                        <span><strong class="font-mono-num">{{ actionableSwaps.length }}</strong> Pending</span>
                                    </span>
                                </div>
                                <div class="flex items-center gap-1.5 text-xs font-body text-[#5A5D64] truncate">
                                    <span class="material-symbols-outlined text-xs text-[#76946A]">verified_user</span>
                                    <span class="truncate">Audited Exchange Queue</span>
                                    <span class="text-[#8A8D93]">·</span>
                                    <span class="text-[#2D4F67] font-semibold">Sign-Offs</span>
                                </div>
                            </div>
                        </div>

                        <div class="inline-flex items-center p-1 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-headline font-semibold shrink-0 gap-1">
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-all cursor-pointer',
                                    selectedPassFilter === 'all'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="selectedPassFilter = 'all'"
                            >
                                All ({{ actionableSwaps.length }})
                            </button>
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1',
                                    selectedPassFilter === 'urgent'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="selectedPassFilter = 'urgent'"
                            >
                                <span>Urgent</span>
                                <span class="w-1.5 h-1.5 rounded-full bg-[#C34043]"></span>
                            </button>
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer',
                                    selectedPassFilter === 'verified'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="selectedPassFilter = 'verified'"
                            >
                                Verified
                            </button>
                        </div>
                    </div>

                    <!-- Passes & Alert Queue -->
                    <div class="flex flex-col gap-3">
                        <!-- Empty Boarding Pass State -->
                        <div
                            v-if="filteredBoardingPasses.length === 0"
                            class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center shadow-xs"
                        >
                            <span class="material-symbols-outlined text-2xl text-[#76946A] mb-1">verified</span>
                            <p class="font-headline text-sm font-bold text-[#1F1F28]">
                                All Swap Boarding Passes Cleared
                            </p>
                            <p class="text-xs font-body text-[#5A5D64] mt-1">
                                Zero pending shift exchanges require manager sign-off right now.
                            </p>
                            <RouterLink
                                to="/swaps"
                                class="mt-3 inline-flex items-center gap-1 text-xs font-headline font-bold text-[#2D4F67] hover:underline"
                            >
                                <span>View Swap History Archive</span>
                                <span class="material-symbols-outlined text-xs">arrow_forward</span>
                            </RouterLink>
                        </div>

                        <!-- Perforated Swap Boarding Pass Cards -->
                        <div
                            v-for="swap in filteredBoardingPasses"
                            :key="swap.id"
                            class="bg-white border border-[#DCD7CE] rounded-xl shadow-sm overflow-hidden relative"
                        >
                            <!-- Pass Top Header -->
                            <div class="bg-[#FAF8F5] px-3.5 py-2 border-b border-[#DCD7CE] flex items-center justify-between">
                                <div class="flex items-center gap-1.5">
                                    <span class="font-mono-num text-xs font-bold text-[#2D4F67]">
                                        #SW-{{ swap.id }}
                                    </span>
                                    <span class="material-symbols-outlined text-xs text-[#76946A]" title="Locked & Audited">
                                        lock
                                    </span>
                                </div>
                                <div class="flex items-center gap-1 text-xs font-headline font-medium text-[#5A5D64]">
                                    <span class="material-symbols-outlined text-xs text-[#2D4F67]">location_on</span>
                                    <span>{{ swap.shift?.location?.name || 'Main Branch' }}</span>
                                </div>
                            </div>

                            <!-- Two-Stub Perforated Body -->
                            <div class="relative grid grid-cols-2 p-3 gap-3">
                                <div class="ticket-notch-top"></div>
                                <div class="ticket-notch-bottom"></div>
                                <div class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px perforated-border pointer-events-none"></div>

                                <!-- Left Stub: Offered Shift -->
                                <div class="flex flex-col pr-1.5">
                                    <div class="flex items-center justify-between mb-1.5">
                                        <span class="material-symbols-outlined text-xs text-[#5A5D64]" title="Offered Shift">
                                            flight_takeoff
                                        </span>
                                        <span class="material-symbols-outlined text-xs text-[#5A5D64]" title="Shift Offer">
                                            event_repeat
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2 mb-1.5">
                                        <div class="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] flex items-center justify-center font-headline font-bold text-[10px] text-[#2D4F67] shrink-0">
                                            {{ getInitials(swap.offered_by?.name) }}
                                        </div>
                                        <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{ getShortName(swap.offered_by?.name) }}
                                        </div>
                                    </div>
                                    <div class="bg-[#FAF8F5] p-1.5 rounded border border-[#DCD7CE]">
                                        <div class="text-[11px] font-bold text-[#1F1F28]">
                                            <span>{{ formatWeekdayOnly(swap.shift?.start_at) }} · </span>
                                            <span class="font-mono-num">{{ formatTime24(swap.shift?.start_at) }}–{{ formatTime24(swap.shift?.end_at) }}</span>
                                        </div>
                                        <div class="text-[11px] font-body text-[#5A5D64]">
                                            <span class="font-mono-num font-semibold">{{ getShiftHours(swap.shift) }}h</span> · {{ swap.shift?.role_label || 'Shift' }}
                                        </div>
                                    </div>
                                </div>

                                <!-- Right Stub: Claiming Staff -->
                                <div class="flex flex-col pl-1.5">
                                    <div class="flex items-center justify-between mb-1.5">
                                        <span class="material-symbols-outlined text-xs text-[#2D4F67]" title="Claiming Shift">
                                            flight_land
                                        </span>
                                        <span class="material-symbols-outlined text-xs text-[#76946A]" title="Verified">
                                            verified
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2 mb-1.5">
                                        <div class="w-6 h-6 rounded-full bg-[#E6ECF0] border border-[#BACEDD] flex items-center justify-center font-headline font-bold text-[10px] text-[#2D4F67] shrink-0">
                                            {{ getInitials(swap.requested_by?.name || 'OC') }}
                                        </div>
                                        <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{
                                                swap.requested_by
                                                    ? getShortName(swap.requested_by.name)
                                                    : 'Open Marketplace'
                                            }}
                                        </div>
                                    </div>
                                    <div class="bg-[#E6ECF0] p-1.5 rounded border border-[#BACEDD]/60">
                                        <div class="text-[11px] font-bold text-[#1F1F28]">
                                            <template v-if="swap.requested_by">
                                                Post: <span class="font-mono-num">38.0h/wk</span>
                                            </template>
                                            <template v-else>Awaiting Peer Claim</template>
                                        </div>
                                        <div class="text-[11px] font-body text-[#2D4F67] font-semibold">
                                            Under <span class="font-mono-num">40h</span> cap
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Verification Strip -->
                            <div class="mx-3 mb-2 flex items-center justify-between text-xs font-headline text-[#76946A]">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF0E8] border border-[#C9DBC2] font-bold text-[11px]">
                                    <span class="material-symbols-outlined text-xs">verified_user</span>
                                    <span>Verified</span>
                                </span>
                                <span class="text-[11px] font-body text-[#5A5D64]"><strong class="font-mono-num">0</strong> overlap</span>
                            </div>

                            <!-- Pass Action Footer -->
                            <div class="bg-[#FAF8F5] px-3 py-2 border-t border-[#DCD7CE] flex items-center justify-between gap-2">
                                <span class="text-xs font-body text-[#5A5D64] truncate">
                                    {{ swap.notes || 'Standard peer coverage exchange' }}
                                </span>
                                <div class="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        :disabled="isActionSubmitting"
                                        class="w-8 h-8 flex items-center justify-center rounded-lg text-[#5A5D64] hover:text-[#C34043] hover:bg-[#FCECEC] transition-colors cursor-pointer disabled:opacity-50"
                                        title="Decline"
                                        @click="handleRejectSwap(swap)"
                                    >
                                        <span class="material-symbols-outlined text-base">close</span>
                                    </button>
                                    <button
                                        v-if="swap.status === 'pending_approval'"
                                        type="button"
                                        :disabled="isActionSubmitting"
                                        class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                        title="Approve"
                                        @click="openApprovalModal(swap)"
                                    >
                                        <span class="material-symbols-outlined text-sm">check</span>
                                        <span>Approve</span>
                                    </button>
                                    <RouterLink
                                        v-else
                                        to="/swaps"
                                        class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-headline font-bold text-[#2D4F67] bg-[#E6ECF0] hover:bg-[#BACEDD] border border-[#BACEDD] transition-all"
                                    >
                                        <span>Inspect</span>
                                    </RouterLink>
                                </div>
                            </div>
                        </div>

                        <!-- Bottom Alert: Time-Off Conflict / Review Card -->
                        <div
                            v-if="!timeOffAlertDismissed && (firstPendingTimeOff || pendingTimeOffKPI > 0)"
                            id="timeoff-conflict-card"
                            class="bg-white p-3 rounded-xl border border-[#DCD7CE] flex items-center justify-between shadow-xs"
                        >
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-7 h-7 rounded-lg bg-[#FCECEC] text-[#C34043] border border-[#F3C5C6] flex items-center justify-center shrink-0">
                                    <span class="material-symbols-outlined text-base">event_busy</span>
                                </div>
                                <div class="truncate">
                                    <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                        Time-Off Conflict Review
                                    </div>
                                    <div class="text-xs text-[#5A5D64] font-body truncate">
                                        {{ firstPendingTimeOff?.user?.name || 'Staff Member' }} · {{ formatShortDay(firstPendingTimeOff?.start_date) }}
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-1 shrink-0">
                                <div class="flex items-center gap-2 pl-3 border-l border-[#DCD7CE]">
                                    <RouterLink
                                        to="/time-off"
                                        class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-headline font-bold text-[#2D4F67] bg-[#E6ECF0] hover:bg-[#BACEDD] border border-[#BACEDD] hover:border-[#2D4F67] transition-all shadow-2xs"
                                    >
                                        <span class="material-symbols-outlined text-xs">search</span>
                                        <span>Inspect Request</span>
                                    </RouterLink>
                                    <button
                                        type="button"
                                        class="w-7 h-7 flex items-center justify-center text-[#8A8D93] hover:text-[#C34043] rounded-full hover:bg-[#FCECEC] transition-colors cursor-pointer"
                                        title="Dismiss Alert"
                                        @click="timeOffAlertDismissed = true"
                                    >
                                        <span class="material-symbols-outlined text-base">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- ===================================================================== -->
        <!-- STAFF PORTAL KANAGAWA DASHBOARD                                       -->
        <!-- ===================================================================== -->
        <template v-else>
            <!-- SECTION A: STAFF PERSONAL METRICS STRIP -->
            <section id="staff-metrics-section" class="mb-7">
                <div class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-sm">
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#DCD7CE]">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                <span class="material-symbols-outlined text-lg">account_circle</span>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h1 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight">
                                    Personal Shift Radar · {{ authStore.user?.name || 'Staff Member' }}
                                </h1>
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]">
                                    <span class="material-symbols-outlined text-xs">storefront</span>
                                    <span>{{ authStore.selectedLocation?.name || 'All Locations' }}</span>
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] rounded-lg transition-colors shadow-2xs cursor-pointer"
                                title="Export Timesheet"
                                @click="handleExportCsv"
                            >
                                <span class="material-symbols-outlined text-sm">download</span>
                                <span>Timesheet</span>
                            </button>
                            <RouterLink
                                to="/available-swap-board"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-headline font-semibold text-[#2D4F67] bg-[#E6ECF0] hover:bg-[#BACEDD] border border-[#BACEDD] rounded-lg transition-colors shadow-2xs"
                            >
                                <span class="material-symbols-outlined text-sm">swap_calls</span>
                                <span>Swap Board</span>
                            </RouterLink>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3">
                        <!-- Metric 1: Hours this week & Cap Progress -->
                        <div class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#DCD7CE] flex flex-col justify-between gap-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-md bg-white border border-[#DCD7CE] flex items-center justify-center text-[#5A5D64] shrink-0">
                                        <span class="material-symbols-outlined text-base">timelapse</span>
                                    </div>
                                    <span class="text-[11px] font-headline text-[#5A5D64] uppercase font-bold tracking-wider">
                                        Hours Scheduled
                                    </span>
                                </div>
                                <span class="text-[10px] font-headline font-bold text-[#76946A] bg-[#EAF0E8] px-1.5 py-0.2 rounded border border-[#C9DBC2]">
                                    <strong class="font-mono-num">{{ staffRemainingHours }}h</strong> left
                                </span>
                            </div>
                            <div>
                                <div class="flex items-baseline justify-between mb-1">
                                    <span class="font-headline text-lg font-extrabold text-[#1F1F28]">
                                        <span class="font-mono-num">{{ staffWeeklyHours }}h</span>
                                        <span class="text-xs font-normal text-[#5A5D64]">/ <span class="font-mono-num">40.0h</span> Cap</span>
                                    </span>
                                    <span class="font-mono-num text-[11px] font-bold text-[#2D4F67]">
                                        {{ staffHoursPercent }}%
                                    </span>
                                </div>
                                <div class="w-full bg-[#E7E3DC] h-1.5 rounded-full overflow-hidden">
                                    <div
                                        class="bg-[#2D4F67] h-full rounded-full transition-all"
                                        :style="{ width: `${staffHoursPercent}%` }"
                                    ></div>
                                </div>
                            </div>
                        </div>

                        <!-- Metric 2: Next Shift -->
                        <div class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#2D4F67]/40 flex items-center justify-between relative overflow-hidden">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-9 h-9 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                    <span class="material-symbols-outlined text-lg">schedule</span>
                                </div>
                                <div class="min-w-0">
                                    <div class="font-headline text-lg font-extrabold text-[#2D4F67] truncate">
                                        {{
                                            staffNextShift
                                                ? `${formatWeekdayOnly(staffNextShift.start_at)} ${formatTime24(staffNextShift.start_at)}`
                                                : 'No Shift'
                                        }}
                                    </div>
                                    <div class="text-xs font-body text-[#5A5D64] truncate">
                                        {{
                                            staffNextShift
                                                ? `${staffNextShift.role_label} (${getShiftHours(staffNextShift)}h)`
                                                : 'Clear 14d schedule'
                                        }}
                                    </div>
                                </div>
                            </div>
                            <span class="w-2.5 h-2.5 rounded-full bg-[#76946A] animate-pulse shrink-0"></span>
                        </div>

                        <!-- Metric 3: Active Swap Requests -->
                        <RouterLink
                            to="/my-swap-requests"
                            class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#DCD7CE] flex items-center justify-between hover:border-[#2D4F67]/60 transition-colors"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-white border border-[#DCD7CE] flex items-center justify-center text-[#C0A36E] shrink-0">
                                    <span class="material-symbols-outlined text-lg">swap_horizontal_circle</span>
                                </div>
                                <div>
                                    <div class="font-headline text-lg font-extrabold text-[#1F1F28]">
                                        {{ staffOutgoingSwaps.length }} Active
                                    </div>
                                    <div class="text-xs font-body text-[#5A5D64]">
                                        My swap passes
                                    </div>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-[#FAF3E8] text-[#C0A36E] border border-[#ECDDBF]">
                                Swaps
                            </span>
                        </RouterLink>

                        <!-- Metric 4: Time-Off Requests -->
                        <RouterLink
                            to="/time-off"
                            class="bg-[#FAF8F5] p-3.5 rounded-lg border border-[#DCD7CE] flex items-center justify-between hover:border-[#2D4F67]/60 transition-colors"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-white border border-[#DCD7CE] flex items-center justify-center text-[#76946A] shrink-0">
                                    <span class="material-symbols-outlined text-lg">beach_access</span>
                                </div>
                                <div>
                                    <div class="font-headline text-lg font-extrabold text-[#1F1F28]">
                                        {{ staffData?.pending_time_off_requests.length || 0 }} Pending
                                    </div>
                                    <div class="text-xs font-body text-[#5A5D64]">
                                        Time-Off Requests
                                    </div>
                                </div>
                            </div>
                            <span class="text-xs font-headline text-[#2D4F67] font-bold">Request →</span>
                        </RouterLink>
                    </div>
                </div>
            </section>

            <!-- SECTION B: STAFF OPERATIONAL GRID (CALENDAR & MARKETPLACE) -->
            <div :class="['grid gap-6 items-start', staffScheduleViewMode !== 'tape' ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2']">
                <!-- SCHEDULE SECTION (Tape List / Week Grid / Month Calendar) -->
                <div class="flex flex-col gap-4">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-xl border border-[#DCD7CE] shadow-xs min-h-[58px] gap-4">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0">
                                <span class="material-symbols-outlined text-lg">calendar_month</span>
                            </div>
                            <div class="min-w-0 flex flex-col gap-0.5">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight truncate">
                                        My Schedule &amp; Shifts
                                    </h2>
                                    <span class="px-2 py-0.5 rounded text-[11px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] shrink-0">
                                        {{ visibleStaffShiftsCount }} Shifts
                                    </span>
                                </div>
                                <p class="text-xs font-body text-[#5A5D64] truncate">
                                    {{ scheduleSubtitle }}
                                </p>
                            </div>
                        </div>

                        <!-- 3 View Mode Switcher -->
                        <div class="inline-flex items-center p-1 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-headline font-semibold shrink-0 gap-1">
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1',
                                    staffScheduleViewMode === 'tape'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                title="List of upcoming shifts"
                                @click="staffScheduleViewMode = 'tape'"
                            >
                                <span class="material-symbols-outlined text-sm">view_agenda</span>
                                <span>Tape List</span>
                            </button>
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1',
                                    staffScheduleViewMode === 'week'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                title="7-Day weekly schedule calendar"
                                @click="staffScheduleViewMode = 'week'"
                            >
                                <span class="material-symbols-outlined text-sm">calendar_view_week</span>
                                <span>Week Grid</span>
                            </button>
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1',
                                    staffScheduleViewMode === 'month'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                title="Full monthly schedule calendar"
                                @click="staffScheduleViewMode = 'month'"
                            >
                                <span class="material-symbols-outlined text-sm">calendar_month</span>
                                <span>Month Calendar</span>
                            </button>
                        </div>
                    </div>

                    <!-- MODE 1: TAPE LIST -->
                    <template v-if="staffScheduleViewMode === 'tape'">
                        <div class="flex items-center justify-between px-1">
                            <span class="text-xs font-headline font-semibold text-[#5A5D64]">
                                Showing {{ staffShifts.length }} upcoming shifts
                            </span>
                            <div class="inline-flex items-center p-0.5 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-headline font-semibold gap-1">
                                <button
                                    type="button"
                                    :class="[
                                        'px-2 py-0.5 rounded transition-colors cursor-pointer',
                                        staffWeekFilter === 'this'
                                            ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                            : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                    ]"
                                    @click="staffWeekFilter = 'this'"
                                >
                                    This Week
                                </button>
                                <button
                                    type="button"
                                    :class="[
                                        'px-2 py-0.5 rounded transition-colors cursor-pointer',
                                        staffWeekFilter === 'next'
                                            ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                            : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                    ]"
                                    @click="staffWeekFilter = 'next'"
                                >
                                    All (14d)
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="staffShifts.length === 0"
                            class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center shadow-xs"
                        >
                            <p class="font-headline text-sm font-bold text-[#1F1F28]">
                                No shifts assigned in the next 14 days
                            </p>
                            <p class="text-xs font-body text-[#5A5D64] mt-1">
                                Check the Peer Swap Marketplace on the right to claim open shifts.
                            </p>
                        </div>

                        <div v-else class="flex flex-col gap-3.5">
                            <div
                                v-for="(shift, idx) in staffShifts"
                                :key="shift.id"
                                class="bg-white border border-[#DCD7CE] rounded-xl p-4 flex flex-col gap-3 hover:border-[#2D4F67] transition-all relative overflow-hidden shadow-xs"
                            >
                                <div
                                    :class="[
                                        'absolute left-0 top-0 bottom-0 w-1.5',
                                        idx === 0 ? 'bg-[#76946A]' : 'bg-[#4E6E82]',
                                    ]"
                                ></div>

                                <div class="flex items-center justify-between pl-1.5">
                                    <div class="flex items-center gap-2">
                                        <span
                                            :class="[
                                                'px-2 py-0.5 rounded text-[10px] font-headline font-bold border uppercase',
                                                idx === 0
                                                    ? 'bg-[#EAF0E8] text-[#76946A] border-[#C9DBC2]'
                                                    : 'bg-[#FAF8F5] text-[#5A5D64] border-[#DCD7CE]',
                                            ]"
                                        >
                                            {{ formatShortDay(shift.start_at) }}
                                        </span>
                                        <span class="px-2 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#FAF8F5] text-[#2D4F67] border border-[#DCD7CE]">
                                            {{ shift.role_label }}
                                        </span>
                                    </div>
                                    <span
                                        v-if="idx === 0"
                                        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]"
                                    >
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#76946A] animate-pulse"></span>
                                        <span>Next Shift</span>
                                    </span>
                                </div>

                                <div class="flex items-center justify-between gap-3 pl-1.5">
                                    <div class="flex flex-col">
                                        <div class="font-mono-num text-base font-bold text-[#1F1F28] flex items-center gap-2">
                                            <span>{{ formatTime24(shift.start_at) }} – {{ formatTime24(shift.end_at) }}</span>
                                            <span class="text-xs font-mono-num font-normal text-[#5A5D64]">
                                                ({{ getShiftHours(shift) }}h)
                                            </span>
                                        </div>
                                        <div class="text-xs font-body text-[#5A5D64] flex items-center gap-1 mt-0.5">
                                            <span class="material-symbols-outlined text-xs text-[#2D4F67]">storefront</span>
                                            <span>{{ shift.location?.name || 'Main Branch' }}</span>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <template v-if="getShiftActiveSwap(shift.id)">
                                            <span
                                                v-if="isShiftPast(shift)"
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-headline font-bold bg-[#F0ECE1] text-[#8A8D93] border border-[#DCD7CE]"
                                            >
                                                Expired Offer
                                            </span>
                                            <span
                                                v-else-if="getShiftActiveSwap(shift.id)?.status === 'offered'"
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-headline font-bold bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF]"
                                            >
                                                <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                                                <span>Offered on Board</span>
                                            </span>
                                            <span
                                                v-else-if="getShiftActiveSwap(shift.id)?.status === 'pending_approval'"
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]"
                                            >
                                                <span class="w-1.5 h-1.5 rounded-full bg-[#76946A] animate-pulse"></span>
                                                <span>Pending Sign-Off</span>
                                            </span>

                                            <button
                                                v-if="getShiftActiveSwap(shift.id)?.status === 'offered'"
                                                type="button"
                                                :disabled="isActionSubmitting || tearingSwapIds.has(getShiftActiveSwap(shift.id)!.id)"
                                                class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-headline font-bold text-[#C34043] bg-[#FAF8F5] hover:bg-[#FCECEC] border border-[#C34043]/30 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                                :title="isShiftPast(shift) ? 'Clear expired offer' : 'Cancel swap offer and keep this shift'"
                                                @click="handleCancelSwapOffer(getShiftActiveSwap(shift.id)!)"
                                            >
                                                <span class="material-symbols-outlined text-xs">close</span>
                                                <span>{{ isShiftPast(shift) ? 'Clear Offer' : 'Cancel Offer' }}</span>
                                            </button>
                                        </template>
                                        <template v-else>
                                            <button
                                                v-if="!isShiftPast(shift)"
                                                type="button"
                                                :disabled="isActionSubmitting"
                                                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-headline font-bold text-[#2D4F67] bg-[#E6ECF0] hover:bg-[#BACEDD] border border-[#BACEDD] rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                                @click="openOfferShiftModal(shift)"
                                            >
                                                <span class="material-symbols-outlined text-xs">swap_horiz</span>
                                                <span>Offer for Swap</span>
                                            </button>
                                            <span
                                                v-else
                                                class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-headline font-medium text-[#8A8D93] bg-[#F0ECE1] border border-[#DCD7CE] rounded-lg"
                                            >
                                                Past Shift
                                            </span>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- MODE 2: WEEK GRID -->
                    <template v-else-if="staffScheduleViewMode === 'week'">
                        <div class="flex flex-col gap-3">
                            <!-- Week Navigation Bar -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 rounded-xl border border-[#DCD7CE] shadow-2xs gap-3">
                                <div class="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer flex items-center justify-center"
                                        title="Previous Week"
                                        @click="prevWeek"
                                    >
                                        <span class="material-symbols-outlined text-base">chevron_left</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="px-3 py-1.5 text-xs font-headline font-bold text-[#2D4F67] hover:bg-[#E6ECF0] rounded-lg border border-[#BACEDD] transition-colors cursor-pointer"
                                        @click="todayWeek"
                                    >
                                        This Week
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer flex items-center justify-center"
                                        title="Next Week"
                                        @click="nextWeek"
                                    >
                                        <span class="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>

                                <div class="font-headline text-sm font-extrabold text-[#1F1F28] tracking-tight text-center">
                                    {{ weekDateRangeLabel }}
                                </div>

                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] shadow-2xs">
                                        <span class="font-mono-num font-extrabold">{{ weekTotalHours }}h</span>
                                        <span>Scheduled</span>
                                        <span class="text-[#8A8D93]">·</span>
                                        <span class="font-mono-num">{{ weekShiftsCount }}</span>
                                        <span>{{ weekShiftsCount === 1 ? 'Shift' : 'Shifts' }}</span>
                                    </span>
                                </div>
                            </div>

                            <!-- 7-Day Day Columns -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                                <div
                                    v-for="day in visibleStaffWeekDays"
                                    :key="day.dateIso"
                                    :class="[
                                        'flex flex-col rounded-xl border transition-all min-h-[160px] shadow-2xs',
                                        day.isToday
                                            ? 'bg-white border-[#2D4F67] ring-1 ring-[#2D4F67]/20'
                                            : 'bg-[#FAF8F5] border-[#DCD7CE]'
                                    ]"
                                >
                                    <!-- Day Header -->
                                    <div
                                        :class="[
                                            'px-3 py-2 border-b flex items-center justify-between',
                                            day.isToday
                                                ? 'bg-[#E6ECF0] border-[#BACEDD] text-[#2D4F67]'
                                                : 'border-[#DCD7CE] text-[#5A5D64]'
                                        ]"
                                    >
                                        <span class="font-headline uppercase text-[11px] font-extrabold tracking-wider">{{ day.dayName }}</span>
                                        <span
                                            :class="[
                                                'font-mono-num text-xs font-bold px-1.5 py-0.5 rounded',
                                                day.isToday ? 'bg-[#2D4F67] text-white' : 'text-[#1F1F28]'
                                            ]"
                                        >
                                            {{ day.dayNumber }}
                                        </span>
                                    </div>

                                    <!-- Shifts in Day -->
                                    <div class="p-2.5 flex-1 flex flex-col gap-2">
                                        <div
                                            v-if="day.shifts.length === 0"
                                            class="flex-1 flex flex-col items-center justify-center py-6 px-2 text-center text-[#8A8D93]"
                                        >
                                            <div class="w-8 h-8 rounded-full bg-white border border-[#E7E3DC] flex items-center justify-center text-[#BACEDD] mb-1">
                                                <span class="material-symbols-outlined text-base">bedtime</span>
                                            </div>
                                            <span class="text-xs font-headline font-semibold text-[#8A8D93]">Off</span>
                                        </div>

                                        <div
                                            v-for="shift in day.shifts"
                                            :key="shift.id"
                                            class="bg-white p-2.5 rounded-lg border border-[#DCD7CE] shadow-2xs hover:border-[#2D4F67] transition-all flex flex-col gap-2 relative overflow-hidden"
                                        >
                                            <div class="absolute left-0 top-0 bottom-0 w-1 bg-[#76946A]"></div>

                                            <div class="pl-1.5 flex flex-col gap-1">
                                                <div class="text-xs font-headline font-bold text-[#1F1F28] leading-tight">
                                                    {{ shift.role_label }}
                                                </div>
                                                <div class="font-mono-num text-xs font-extrabold text-[#2D4F67] leading-tight">
                                                    {{ formatTime24(shift.start_at) }} – {{ formatTime24(shift.end_at) }}
                                                </div>
                                                <div class="text-[11px] font-body text-[#5A5D64] flex items-center gap-1">
                                                    <span class="material-symbols-outlined text-xs text-[#2D4F67]">storefront</span>
                                                    <span class="truncate">{{ shift.location?.name || 'Main Branch' }}</span>
                                                </div>
                                            </div>

                                            <div class="pl-1.5 pt-2 border-t border-[#F0ECE1] flex items-center justify-between gap-1.5 text-[11px]">
                                                <template v-if="getShiftActiveSwap(shift.id)">
                                                    <span
                                                        v-if="isShiftPast(shift)"
                                                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-headline font-bold text-[10px] bg-[#F0ECE1] text-[#8A8D93] border border-[#DCD7CE]"
                                                    >
                                                        Expired
                                                    </span>
                                                    <span
                                                        v-else-if="getShiftActiveSwap(shift.id)?.status === 'offered'"
                                                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-headline font-bold text-[10px] bg-[#FAF3E8] text-[#8C6D23] border border-[#ECDDBF]"
                                                    >
                                                        <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                                                        <span>On Board</span>
                                                    </span>
                                                    <span
                                                        v-else
                                                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-headline font-bold text-[10px] bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]"
                                                    >
                                                        <span class="w-1.5 h-1.5 rounded-full bg-[#76946A] animate-pulse"></span>
                                                        <span>In Review</span>
                                                    </span>

                                                    <button
                                                        v-if="getShiftActiveSwap(shift.id)?.status === 'offered'"
                                                        type="button"
                                                        :disabled="isActionSubmitting || tearingSwapIds.has(getShiftActiveSwap(shift.id)!.id)"
                                                        class="p-1 text-[#C34043] hover:bg-[#FCECEC] rounded-md transition-colors cursor-pointer border border-transparent hover:border-[#F3C5C6]"
                                                        :title="isShiftPast(shift) ? 'Clear Expired Offer' : 'Cancel Swap Offer (Tears Ticket)'"
                                                        @click="handleCancelSwapOffer(getShiftActiveSwap(shift.id)!)"
                                                    >
                                                        <span class="material-symbols-outlined text-sm">close</span>
                                                    </button>
                                                </template>
                                                <template v-else>
                                                    <span
                                                        :class="[
                                                            'font-mono-num font-bold px-1.5 py-0.2 rounded border text-[10px]',
                                                            isShiftPast(shift)
                                                                ? 'text-[#8A8D93] bg-[#F0ECE1] border-[#DCD7CE]'
                                                                : 'text-[#76946A] bg-[#EAF0E8] border-[#C9DBC2]'
                                                        ]"
                                                    >
                                                        {{ getShiftHours(shift) }}h
                                                    </span>
                                                    <button
                                                        v-if="!isShiftPast(shift)"
                                                        type="button"
                                                        class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-headline font-bold text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#BACEDD] rounded-md transition-colors cursor-pointer shadow-2xs"
                                                        @click="openOfferShiftModal(shift)"
                                                    >
                                                        <span class="material-symbols-outlined text-xs">swap_horiz</span>
                                                        <span>Swap</span>
                                                    </button>
                                                    <span
                                                        v-else
                                                        class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-headline font-semibold text-[#8A8D93] bg-[#F0ECE1] border border-[#DCD7CE] rounded"
                                                        title="This shift has already passed and cannot be swapped"
                                                    >
                                                        Past Shift
                                                    </span>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- MODE 3: MONTH CALENDAR -->
                    <template v-else-if="staffScheduleViewMode === 'month'">
                        <div class="flex flex-col gap-3">
                            <!-- Month Navigation Bar -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-white px-4 py-3 rounded-xl border border-[#DCD7CE] shadow-2xs gap-3">
                                <div class="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer flex items-center justify-center"
                                        title="Previous Month"
                                        @click="prevMonth"
                                    >
                                        <span class="material-symbols-outlined text-base">chevron_left</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="px-3 py-1.5 text-xs font-headline font-bold text-[#2D4F67] hover:bg-[#E6ECF0] rounded-lg border border-[#BACEDD] transition-colors cursor-pointer"
                                        @click="todayMonth"
                                    >
                                        Today
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer flex items-center justify-center"
                                        title="Next Month"
                                        @click="nextMonth"
                                    >
                                        <span class="material-symbols-outlined text-base">chevron_right</span>
                                    </button>
                                </div>

                                <div class="font-headline text-sm font-extrabold text-[#1F1F28] tracking-tight text-center">
                                    {{ monthYearLabel }}
                                </div>

                                <div class="flex items-center gap-2">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] shadow-2xs">
                                        <span class="font-mono-num font-extrabold">{{ monthTotalHours }}h</span>
                                        <span>Scheduled</span>
                                        <span class="text-[#8A8D93]">·</span>
                                        <span class="font-mono-num">{{ monthShiftsCount }}</span>
                                        <span>{{ monthShiftsCount === 1 ? 'Shift' : 'Shifts' }}</span>
                                    </span>
                                </div>
                            </div>

                            <!-- Day Headers: Sun - Sat -->
                            <div class="grid grid-cols-7 gap-2 text-center">
                                <span
                                    v-for="dayHeader in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
                                    :key="dayHeader"
                                    class="py-1.5 text-[11px] font-headline font-extrabold uppercase tracking-wider text-[#5A5D64] bg-[#FAF8F5] rounded-lg border border-[#DCD7CE]"
                                >
                                    {{ dayHeader }}
                                </span>
                            </div>

                            <!-- Month Grid -->
                            <div class="grid grid-cols-7 gap-2">
                                <div
                                    v-for="cell in visibleStaffMonthGrid"
                                    :key="cell.dateIso"
                                    :class="[
                                        'min-h-[105px] p-2 rounded-xl border flex flex-col justify-between transition-all gap-1.5',
                                        cell.isToday
                                            ? 'bg-white border-[#2D4F67] ring-1 ring-[#2D4F67]/30 shadow-xs'
                                            : cell.isCurrentMonth
                                                ? 'bg-white border-[#DCD7CE] hover:border-[#2D4F67]/50'
                                                : 'bg-[#FAF8F5]/60 border-[#DCD7CE]/50 opacity-60'
                                    ]"
                                >
                                    <div class="flex items-center justify-between mb-1">
                                        <span
                                            :class="[
                                                'text-xs font-mono-num font-bold w-6 h-6 flex items-center justify-center rounded-full',
                                                cell.isToday
                                                    ? 'bg-[#2D4F67] text-white shadow-2xs'
                                                    : cell.isCurrentMonth
                                                        ? 'text-[#1F1F28]'
                                                        : 'text-[#8A8D93]'
                                            ]"
                                        >
                                            {{ cell.dayNumber }}
                                        </span>
                                        <span v-if="cell.shifts.length > 0" class="text-[10px] font-mono-num font-bold text-[#76946A] bg-[#EAF0E8] px-1 rounded border border-[#C9DBC2]">
                                            {{ cell.totalHours }}h
                                        </span>
                                    </div>

                                    <!-- Shift Pills in Month Cell -->
                                    <div class="flex-1 flex flex-col gap-1.5 overflow-hidden">
                                        <div
                                            v-for="shift in cell.shifts"
                                            :key="shift.id"
                                            :class="[
                                                'p-1.5 rounded-lg text-left transition-colors relative overflow-hidden text-xs flex flex-col gap-0.5 shadow-2xs',
                                                isShiftPast(shift)
                                                    ? 'bg-[#F0ECE1] border border-[#DCD7CE] text-[#8A8D93] cursor-not-allowed opacity-75'
                                                    : getShiftActiveSwap(shift.id)?.status === 'offered'
                                                        ? 'bg-[#FAF3E8] border border-[#ECDDBF] text-[#8C6D23] cursor-pointer'
                                                        : 'bg-[#E6ECF0] border border-[#BACEDD] text-[#2D4F67] cursor-pointer'
                                            ]"
                                            :title="isShiftPast(shift) ? `${shift.role_label} (${formatTime24(shift.start_at)}–${formatTime24(shift.end_at)}) · Past Shift` : `${shift.role_label} (${formatTime24(shift.start_at)}–${formatTime24(shift.end_at)}) · Click to manage`"
                                            @click="handleMonthShiftClick(shift)"
                                        >
                                            <div class="font-headline font-bold truncate leading-tight">
                                                {{ shift.role_label }}
                                            </div>
                                            <div class="font-mono-num text-[10px] opacity-85 truncate">
                                                {{ formatTime24(shift.start_at) }} – {{ formatTime24(shift.end_at) }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>

                <!-- RIGHT COLUMN: Peer Swap Marketplace -->
                <div class="flex flex-col gap-4">
                    <div class="flex items-center justify-between bg-white p-4 rounded-xl border border-[#DCD7CE] shadow-xs min-h-[58px] gap-4 relative overflow-hidden">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-8 h-8 rounded-lg bg-[#E6ECF0] border border-[#C5D4DF] flex items-center justify-center text-[#2D4F67] shrink-0 shadow-2xs">
                                <span class="material-symbols-outlined text-lg">confirmation_number</span>
                            </div>
                            <div class="min-w-0 flex flex-col gap-0.5">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="font-headline text-sm font-bold text-[#1F1F28] tracking-tight truncate">
                                        Peer Swap Marketplace
                                    </h2>
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-headline font-bold bg-[#FAF8F5] text-[#C0A36E] border border-[#DCD7CE] shrink-0 shadow-2xs">
                                        <span class="w-1.5 h-1.5 rounded-full bg-[#C0A36E] animate-pulse"></span>
                                        <span><strong class="font-mono-num">{{ staffAvailableMarketplaceSwaps.length }}</strong> Up for Grabs</span>
                                    </span>
                                </div>
                                <div class="flex items-center gap-1.5 text-xs font-body text-[#5A5D64] truncate">
                                    <span class="material-symbols-outlined text-xs text-[#76946A]">check_circle</span>
                                    <span class="truncate">Verified Eligibility</span>
                                    <span class="text-[#8A8D93]">·</span>
                                    <span class="text-[#2D4F67] font-semibold">Under <span class="font-mono-num">40h</span> Cap</span>
                                </div>
                            </div>
                        </div>

                        <div class="inline-flex items-center p-1 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-headline font-semibold shrink-0 gap-1">
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-all cursor-pointer',
                                    staffSwapTab === 'available'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="staffSwapTab = 'available'"
                            >
                                Available ({{ staffAvailableMarketplaceSwaps.length }})
                            </button>
                            <button
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded transition-colors cursor-pointer',
                                    staffSwapTab === 'outgoing'
                                        ? 'bg-[#2D4F67] text-white shadow-xs font-bold'
                                        : 'text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0]',
                                ]"
                                @click="staffSwapTab = 'outgoing'"
                            >
                                My Swaps ({{ staffOutgoingSwaps.length }})
                            </button>
                        </div>
                    </div>

                    <div :class="staffScheduleViewMode !== 'tape' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex flex-col gap-3'">
                        <div
                            v-for="swap in staffSwapTab === 'available' ? staffAvailableMarketplaceSwaps : staffOutgoingSwaps"
                            :key="swap.id"
                            :class="[
                                'bg-white border border-[#DCD7CE] rounded-xl shadow-sm overflow-hidden relative group transition-all',
                                tearingSwapIds.has(swap.id) ? 'ticket-is-tearing' : 'hover:border-[#2D4F67]'
                            ]"
                        >
                            <!-- Tear Line (flashes red ripped paper seam when tearing) -->
                            <div class="ticket-tear-line"></div>

                            <div class="bg-[#FAF8F5] px-3.5 py-2 border-b border-[#DCD7CE] flex items-center justify-between">
                                <div class="ticket-half-left flex items-center gap-2">
                                    <span class="font-mono-num text-xs font-bold text-[#2D4F67]">#SW-{{ swap.id }}</span>
                                    <span
                                        v-if="isSwapPast(swap)"
                                        class="px-1.5 py-0.2 rounded text-[10px] font-headline font-bold bg-[#F0ECE1] text-[#8A8D93] border border-[#DCD7CE] uppercase"
                                    >
                                        EXPIRED
                                    </span>
                                    <span
                                        v-else
                                        class="px-1.5 py-0.2 rounded text-[10px] font-headline font-bold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] uppercase"
                                    >
                                        {{ swap.status === 'offered' ? 'OPEN TO CLAIM' : swap.status.replace('_', ' ') }}
                                    </span>
                                </div>
                                <div class="ticket-half-right flex items-center gap-1 text-xs font-headline font-medium text-[#5A5D64]">
                                    <span class="material-symbols-outlined text-xs text-[#2D4F67]">location_on</span>
                                    <span>{{ swap.shift?.location?.name || 'Main Branch' }}</span>
                                </div>
                            </div>

                            <div class="relative grid grid-cols-2 p-3 gap-3">
                                <div class="ticket-notch-top"></div>
                                <div class="ticket-notch-bottom"></div>
                                <div class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px perforated-border pointer-events-none"></div>

                                <div class="ticket-half-left flex flex-col pr-1.5">
                                    <div class="flex items-center justify-between mb-1.5">
                                        <span class="material-symbols-outlined text-xs text-[#5A5D64]">flight_takeoff</span>
                                        <span class="material-symbols-outlined text-xs text-[#5A5D64]">schedule</span>
                                    </div>
                                    <div class="flex items-center gap-2 mb-1.5">
                                        <div class="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] flex items-center justify-center font-headline font-bold text-[10px] text-[#2D4F67]">
                                            {{ getInitials(swap.offered_by?.name) }}
                                        </div>
                                        <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                            {{ swap.offered_by?.name || 'Coworker' }}
                                        </div>
                                    </div>
                                    <div class="bg-[#FAF8F5] p-1.5 rounded border border-[#DCD7CE]">
                                        <div class="text-[11px] font-bold text-[#1F1F28]">
                                            <span>{{ formatWeekdayOnly(swap.shift?.start_at) }} · </span>
                                            <span class="font-mono-num">{{ formatTime24(swap.shift?.start_at) }}–{{ formatTime24(swap.shift?.end_at) }}</span>
                                        </div>
                                        <div class="text-[11px] font-body text-[#5A5D64]">
                                            {{ swap.shift?.role_label || 'Shift' }} · <span class="font-mono-num font-semibold">{{ getShiftHours(swap.shift) }}h</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="ticket-half-right flex flex-col pl-1.5">
                                    <template v-if="Number(swap.offered_by?.id) === Number(authStore.user?.id)">
                                        <div class="flex items-center justify-between mb-1.5">
                                            <span class="material-symbols-outlined text-xs text-[#2D4F67]">handshake</span>
                                            <span
                                                :class="[
                                                    'material-symbols-outlined text-xs',
                                                    swap.requested_by ? 'text-[#76946A]' : 'text-[#C0A36E]',
                                                ]"
                                            >
                                                {{ swap.requested_by ? 'hourglass_top' : 'campaign' }}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2 mb-1.5">
                                            <div class="w-6 h-6 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] flex items-center justify-center font-headline font-bold text-[10px] text-[#2D4F67]">
                                                {{ swap.requested_by ? getInitials(swap.requested_by.name) : '?' }}
                                            </div>
                                            <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                                {{ swap.requested_by ? swap.requested_by.name : 'Open Marketplace' }}
                                            </div>
                                        </div>
                                        <div class="bg-[#FAF8F5] p-1.5 rounded border border-[#DCD7CE]">
                                            <div class="text-[11px] font-bold" :class="isSwapPast(swap) ? 'text-[#8A8D93]' : 'text-[#1F1F28]'">
                                                {{ isSwapPast(swap) ? 'Offer Expired' : (swap.requested_by ? 'Claimant Assigned' : 'Awaiting Peer Claim') }}
                                            </div>
                                            <div class="text-[11px] font-body text-[#5A5D64]">
                                                {{ isSwapPast(swap) ? 'Shift start time has passed' : (swap.status === 'pending_approval' ? 'Pending Manager Sign-Off' : 'Active on Board') }}
                                            </div>
                                        </div>
                                    </template>
                                    <template v-else-if="Number(swap.requested_by?.id) === Number(authStore.user?.id)">
                                        <div class="flex items-center justify-between mb-1.5">
                                            <span class="material-symbols-outlined text-xs text-[#76946A]">how_to_reg</span>
                                            <span class="material-symbols-outlined text-xs text-[#C0A36E]">hourglass_top</span>
                                        </div>
                                        <div class="flex items-center gap-2 mb-1.5">
                                            <div class="w-6 h-6 rounded-full bg-[#EAF0E8] border border-[#C9DBC2] flex items-center justify-center font-headline font-bold text-[10px] text-[#76946A]">
                                                {{ getInitials(authStore.user?.name) }}
                                            </div>
                                            <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                                Claimant: You
                                            </div>
                                        </div>
                                        <div class="bg-[#FAF3E8] p-1.5 rounded border border-[#ECDDBF]">
                                            <div class="text-[11px] font-bold text-[#967B47]">
                                                Claim Submitted
                                            </div>
                                            <div class="text-[11px] font-body text-[#5A5D64]">
                                                Awaiting Manager Sign-Off
                                            </div>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <div class="flex items-center justify-between mb-1.5">
                                            <span class="material-symbols-outlined text-xs text-[#2D4F67]">flight_land</span>
                                            <span class="material-symbols-outlined text-xs text-[#76946A]">verified</span>
                                        </div>
                                        <div class="flex items-center gap-2 mb-1.5">
                                            <div class="w-6 h-6 rounded-full bg-[#E6ECF0] border border-[#BACEDD] flex items-center justify-center font-headline font-bold text-[10px] text-[#2D4F67]">
                                                {{ getInitials(authStore.user?.name) }}
                                            </div>
                                            <div class="font-headline text-xs font-bold text-[#1F1F28] truncate">
                                                Your Fit: Eligible
                                            </div>
                                        </div>
                                        <div class="bg-[#E6ECF0] p-1.5 rounded border border-[#BACEDD]/60">
                                            <div class="text-[11px] font-bold text-[#1F1F28]">
                                                <span class="font-mono-num">0h</span> Overlap
                                            </div>
                                            <div class="text-[11px] font-body text-[#2D4F67] font-semibold">
                                                Under <span class="font-mono-num">40h</span> Cap
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </div>

                            <div class="bg-[#FAF8F5] px-3 py-2 border-t border-[#DCD7CE] flex items-center justify-between gap-2">
                                <div class="ticket-half-left min-w-0">
                                    <span class="text-xs font-body text-[#5A5D64] truncate block">
                                        {{ swap.notes || 'Ready for peer pickup' }}
                                    </span>
                                </div>
                                <button
                                    v-if="swap.status === 'offered' && Number(swap.offered_by?.id) !== Number(authStore.user?.id) && !isSwapPast(swap)"
                                    type="button"
                                    :disabled="isActionSubmitting"
                                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-all shadow-sm cursor-pointer disabled:opacity-50"
                                    @click="handleClaimSwap(swap)"
                                >
                                    <span class="material-symbols-outlined text-sm">handshake</span>
                                    <span>Claim Shift</span>
                                </button>
                                <span
                                    v-else-if="Number(swap.offered_by?.id) !== Number(authStore.user?.id) && isSwapPast(swap) && Number(swap.requested_by?.id) !== Number(authStore.user?.id)"
                                    class="px-2.5 py-1 rounded text-xs font-headline font-bold bg-[#F0ECE1] text-[#8A8D93] border border-[#DCD7CE]"
                                >
                                    Shift Expired
                                </span>
                                <div v-else class="ticket-half-right flex items-center gap-2 shrink-0">
                                    <button
                                        v-if="swap.status === 'offered' && Number(swap.offered_by?.id) === Number(authStore.user?.id)"
                                        type="button"
                                        :disabled="isActionSubmitting || tearingSwapIds.has(swap.id)"
                                        class="flex items-center gap-1 px-2.5 py-1 text-xs font-headline font-bold text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#C34043]/40 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                        :title="isSwapPast(swap) ? 'Clear expired swap offer' : 'Cancel swap offer and tear ticket'"
                                        @click="handleCancelSwapOffer(swap)"
                                    >
                                        <span class="material-symbols-outlined text-xs">close</span>
                                        <span>{{ isSwapPast(swap) ? 'Clear Offer' : 'Cancel Offer' }}</span>
                                    </button>
                                    <button
                                        v-else-if="swap.status === 'pending_approval' && Number(swap.requested_by?.id) === Number(authStore.user?.id)"
                                        type="button"
                                        :disabled="isActionSubmitting"
                                        class="flex items-center gap-1 px-2.5 py-1 text-xs font-headline font-bold text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#C34043]/40 rounded-lg transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                        title="Cancel your claim on this shift"
                                        @click="handleWithdrawClaim(swap)"
                                    >
                                        <span class="material-symbols-outlined text-xs">cancel</span>
                                        <span>Cancel Accepted Shift</span>
                                    </button>
                                    <button
                                        type="button"
                                        class="px-2.5 py-1 text-xs font-headline font-semibold text-[#2D4F67] hover:underline cursor-pointer flex items-center gap-1"
                                        @click="openManagePassModal(swap)"
                                    >
                                        <span>Manage Pass</span>
                                        <span class="material-symbols-outlined text-xs">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="(staffSwapTab === 'available' ? staffAvailableMarketplaceSwaps : staffOutgoingSwaps).length === 0"
                            class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center shadow-xs"
                        >
                            <p class="font-headline text-sm font-bold text-[#1F1F28]">
                                No Swap Boarding Passes in this tab
                            </p>
                            <RouterLink
                                to="/available-swap-board"
                                class="mt-2 inline-flex items-center gap-1 text-xs font-mono-num font-bold text-[#2D4F67] hover:underline"
                            >
                                <span>Open Full Swap Marketplace</span>
                                <span class="material-symbols-outlined text-xs">arrow_forward</span>
                            </RouterLink>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- ===================================================================== -->
        <!-- STAFF SHIFT OFFER MODAL                                               -->
        <!-- ===================================================================== -->
        <div
            v-if="showStaffOfferModal && shiftToOffer"
            id="staff-offer-modal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs transition-opacity duration-200"
            @click.self="closeOfferShiftModal"
        >
            <div class="relative w-full max-w-md bg-white rounded-xl border border-[#DCD7CE] shadow-2xl overflow-hidden flex flex-col">
                <div class="bg-[#FAF8F5] px-5 py-4 border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#C0A36E]">swap_horiz</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Offer Shift to Peer Marketplace</h3>
                    </div>
                    <button
                        type="button"
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer transition-colors"
                        @click="closeOfferShiftModal"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleOfferShiftForSwap">
                    <div class="p-3.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="font-headline text-xs font-bold text-[#1F1F28]">{{ shiftToOffer.role_label }}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67] border border-[#BACEDD]">
                                {{ shiftToOffer.location?.name || 'Main Branch' }}
                            </span>
                        </div>
                        <div class="font-mono-num text-xs font-bold text-[#2D4F67]">
                            {{ formatShortDay(shiftToOffer.start_at) }} · {{ formatTime24(shiftToOffer.start_at) }} – {{ formatTime24(shiftToOffer.end_at) }} ({{ getShiftHours(shiftToOffer) }}h)
                        </div>
                    </div>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1.5">
                            Reason / Handover Note (Optional)
                        </label>
                        <textarea
                            v-model="offerNotes"
                            rows="3"
                            placeholder="Let teammates know why you're offering this shift or what handoff context they need..."
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        ></textarea>
                    </div>

                    <div class="p-3 rounded-lg bg-[#FAF3E8]/70 border border-[#ECDDBF] text-[11px] text-[#5A5D64] space-y-0.5">
                        <div class="font-bold text-[#1F1F28] flex items-center gap-1">
                            <span class="material-symbols-outlined text-xs text-[#C0A36E]">info</span>
                            <span>What happens next?</span>
                        </div>
                        <p>Eligible teammates will be notified and can claim this shift. A manager will sign off before the schedule updates.</p>
                    </div>

                    <div class="pt-3 border-t border-[#DCD7CE] flex items-center justify-end gap-2">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#FAF8F5] cursor-pointer"
                            @click="closeOfferShiftModal"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isActionSubmitting"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                            <span class="material-symbols-outlined text-xs">send</span>
                            <span>{{ isActionSubmitting ? 'Posting...' : 'Post to Marketplace' }}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- ===================================================================== -->
        <!-- STAFF BOARDING PASS MANAGEMENT MODAL                                  -->
        <!-- ===================================================================== -->
        <div
            v-if="activeManagedPass"
            id="manage-pass-modal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-sm transition-opacity duration-200"
            @click.self="closeManagePassModal"
        >
            <div class="relative w-full max-w-lg bg-white rounded-xl border border-[#DCD7CE] shadow-2xl overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-[#FAF8F5] px-6 py-4 border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="font-mono-num text-xs font-bold text-[#2D4F67]">
                                BOARDING PASS · #SW-{{ activeManagedPass.id }}
                            </span>
                            <span
                                v-if="activeManagedPass.status === 'offered'"
                                class="px-2 py-0.5 rounded text-[10px] font-headline bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-bold uppercase tracking-wider"
                            >
                                Open to Claim
                            </span>
                            <span
                                v-else-if="activeManagedPass.status === 'pending_approval'"
                                class="px-2 py-0.5 rounded text-[10px] font-headline bg-[#FFF3D6] text-[#8C6D23] border border-[#F0D597] font-bold uppercase tracking-wider"
                            >
                                Pending Sign-Off
                            </span>
                            <span
                                v-else-if="activeManagedPass.status === 'approved'"
                                class="px-2 py-0.5 rounded text-[10px] font-headline bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-bold uppercase tracking-wider"
                            >
                                Approved
                            </span>
                            <span
                                v-else
                                class="px-2 py-0.5 rounded text-[10px] font-headline bg-[#FAF8F5] text-[#787878] border border-[#DCD7CE] font-bold uppercase tracking-wider"
                            >
                                {{ activeManagedPass.status }}
                            </span>
                        </div>
                        <h3 class="font-headline text-base font-bold text-[#1F1F28]">
                            Manage Boarding Pass
                        </h3>
                    </div>
                    <button
                        type="button"
                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] transition-colors cursor-pointer"
                        title="Close"
                        @click="closeManagePassModal"
                    >
                        <span class="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <!-- Body -->
                <div class="p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(85vh-140px)]">
                    <!-- Location Bar -->
                    <div class="flex items-center justify-between text-xs font-body font-medium text-[#5A5D64] bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#DCD7CE]">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-xs text-[#2D4F67]">location_on</span>
                            <span>{{ activeManagedPass.shift?.location?.name || 'Assigned Branch' }}</span>
                        </span>
                        <span>{{ authStore.business?.timezone || 'Asia/Manila (PHT)' }}</span>
                    </div>

                    <!-- Boarding Pass Ticket View -->
                    <div class="bg-[#FAF8F5] border border-[#DCD7CE] rounded-xl p-4 flex flex-col gap-3.5 relative overflow-hidden shadow-xs">
                        <div class="flex items-center justify-between gap-4">
                            <!-- Offerer -->
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-9 h-9 rounded-full bg-white flex items-center justify-center font-headline font-bold text-xs text-[#2D4F67] border border-[#DCD7CE]">
                                    {{ getInitials(activeManagedPass.offered_by?.name) }}
                                </div>
                                <div class="min-w-0">
                                    <div class="font-headline text-xs font-bold text-[#1F1F28] leading-tight truncate">
                                        {{ activeManagedPass.offered_by?.name || 'Current Holder' }}
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64] font-body truncate">
                                        {{ activeManagedPass.shift?.role_label || 'Shift' }} (Offerer)
                                    </div>
                                </div>
                            </div>

                            <!-- Transfer arrow -->
                            <div class="flex flex-col items-center justify-center px-2 shrink-0">
                                <span class="text-[10px] font-headline text-[#2D4F67] font-bold uppercase tracking-wider">
                                    Swap
                                </span>
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">arrow_forward</span>
                            </div>

                            <!-- Target / Claimant -->
                            <div class="flex items-center gap-2.5 min-w-0 justify-end">
                                <div class="text-right min-w-0">
                                    <div class="font-headline text-xs font-bold text-[#1F1F28] leading-tight truncate">
                                        {{ activeManagedPass.requested_by ? activeManagedPass.requested_by.name : 'Open Marketplace' }}
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64] font-body truncate">
                                        {{ activeManagedPass.requested_by ? 'Claimant Peer' : 'Awaiting Peer Claim' }}
                                    </div>
                                </div>
                                <div class="w-9 h-9 rounded-full bg-[#E6ECF0] flex items-center justify-center font-headline font-bold text-xs text-[#2D4F67] border border-[#BACEDD] shrink-0">
                                    {{ activeManagedPass.requested_by ? getInitials(activeManagedPass.requested_by.name) : '?' }}
                                </div>
                            </div>
                        </div>

                        <!-- Shift Schedule Details -->
                        <div class="bg-white p-3 rounded-lg border border-[#DCD7CE] flex items-center justify-between">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-headline uppercase text-[#5A5D64] font-bold tracking-wider">
                                    Scheduled Time Block
                                </span>
                                <span class="text-xs font-bold text-[#1F1F28]">
                                    {{ formatShortDay(activeManagedPass.shift?.start_at) }} ·
                                    <span class="font-mono-num">{{ formatTime24(activeManagedPass.shift?.start_at) }} – {{ formatTime24(activeManagedPass.shift?.end_at) }}</span>
                                </span>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[11px] font-mono-num font-bold bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF]">
                                {{ getShiftHours(activeManagedPass.shift) }}h Shift
                            </span>
                        </div>
                    </div>

                    <!-- Handover Notes -->
                    <div class="flex flex-col gap-1.5">
                        <label class="font-headline text-xs font-bold text-[#1F1F28] uppercase tracking-wider">
                            Handover Notes &amp; Instructions
                        </label>
                        <div class="p-3 bg-[#FAF8F5] rounded-lg border border-[#DCD7CE] text-xs font-body text-[#5A5D64]">
                            {{ activeManagedPass.notes || 'Looking to swap shift with any qualified teammate.' }}
                        </div>
                    </div>

                    <!-- Marketplace Status Banner -->
                    <div
                        v-if="activeManagedPass.status === 'offered'"
                        class="p-3 rounded-lg bg-[#EAF0E8]/50 border border-[#C9DBC2] flex items-start gap-2.5 text-xs font-body text-[#3B5433]"
                    >
                        <span class="material-symbols-outlined text-base text-[#76946A] shrink-0">campaign</span>
                        <div>
                            <span class="font-bold">Active on Peer Swap Board:</span> Teammates qualified for <strong>{{ activeManagedPass.shift?.role_label }}</strong> can see and claim this shift. You remain responsible for the shift until a claim is approved.
                        </div>
                    </div>

                    <div
                        v-else-if="activeManagedPass.status === 'pending_approval'"
                        class="p-3 rounded-lg bg-[#FFF8EB] border border-[#F0D597] flex items-start gap-2.5 text-xs font-body text-[#8C6D23]"
                    >
                        <span class="material-symbols-outlined text-base text-[#C0A36E] shrink-0">hourglass_top</span>
                        <div>
                            <span class="font-bold">Claimed by {{ activeManagedPass.requested_by?.name }}:</span> This swap is awaiting store manager sign-off. Once reviewed, both schedules will update automatically.
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="bg-[#FAF8F5] px-6 py-3.5 border-t border-[#DCD7CE] flex items-center justify-between gap-3">
                    <div>
                        <button
                            v-if="activeManagedPass.status === 'offered' && Number(activeManagedPass.offered_by?.id) === Number(authStore.user?.id)"
                            type="button"
                            :disabled="isActionSubmitting"
                            class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#C34043]/40 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            @click="handleCancelManagedPass"
                        >
                            <span class="material-symbols-outlined text-sm">close</span>
                            <span>{{ isActionSubmitting ? 'Cancelling...' : 'Cancel Swap Offer' }}</span>
                        </button>
                        <button
                            v-else-if="activeManagedPass.status === 'pending_approval' && Number(activeManagedPass.requested_by?.id) === Number(authStore.user?.id)"
                            type="button"
                            :disabled="isActionSubmitting"
                            class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#C34043]/40 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                            @click="handleWithdrawManagedPass"
                        >
                            <span class="material-symbols-outlined text-sm">cancel</span>
                            <span>{{ isActionSubmitting ? 'Cancelling...' : 'Cancel Accepted Shift' }}</span>
                        </button>
                    </div>

                    <div class="flex items-center gap-2">
                        <RouterLink
                            to="/my-swap-requests"
                            class="px-3 py-2 rounded-lg text-xs font-headline font-semibold text-[#2D4F67] hover:bg-[#E6ECF0] transition-colors flex items-center gap-1"
                            @click="closeManagePassModal"
                        >
                            <span>Open All My Requests</span>
                            <span class="material-symbols-outlined text-xs">open_in_new</span>
                        </RouterLink>
                        <button
                            type="button"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer"
                            @click="closeManagePassModal"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- ===================================================================== -->
        <!-- 4. KANAGAWA SWAP APPROVAL CONFIRMATION MODAL & BROADCAST TOAST        -->
        <!-- ===================================================================== -->
        <div
            v-if="activeApprovalSwap"
            id="swap-approval-modal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-sm transition-opacity duration-200"
            @click.self="closeApprovalModal"
        >
            <div class="relative w-full max-w-xl bg-white rounded-xl border border-[#DCD7CE] shadow-2xl overflow-hidden flex flex-col">
                <div class="bg-[#FAF8F5] px-6 py-4 border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex flex-col gap-1">
                        <div class="flex items-center gap-2">
                            <span class="font-mono-num text-xs font-bold text-[#2D4F67]">
                                BOARDING PASS · #SW-{{ activeApprovalSwap.id }}
                            </span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-headline bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-bold">
                                CONFLICT-AUDITED
                            </span>
                        </div>
                        <h3 class="font-headline text-base font-bold text-[#1F1F28]">
                            Confirm Shift Swap Approval &amp; Broadcast
                        </h3>
                    </div>
                    <button
                        type="button"
                        class="p-1.5 rounded-lg text-[#5A5D64] hover:text-[#2D4F67] hover:bg-[#E6ECF0] transition-colors cursor-pointer"
                        title="Close"
                        @click="closeApprovalModal"
                    >
                        <span class="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                <div class="p-6 flex flex-col gap-5 overflow-y-auto max-h-[calc(85vh-140px)]">
                    <div class="flex items-center justify-between text-xs font-body font-medium text-[#5A5D64] bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#DCD7CE]">
                        <span class="flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-xs text-[#2D4F67]">storefront</span>
                            <span>{{ activeApprovalSwap.shift?.location?.name || authStore.business?.name || 'Main Branch' }}</span>
                        </span>
                        <span>{{ authStore.business?.timezone || 'Asia/Manila (PHT)' }}</span>
                    </div>

                    <div class="bg-[#FAF8F5] border border-[#DCD7CE] rounded-xl p-4 flex flex-col gap-3.5 relative overflow-hidden shadow-xs">
                        <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-2.5 min-w-0">
                                <div class="w-9 h-9 rounded-full bg-white flex items-center justify-center font-headline font-bold text-xs text-[#2D4F67] border border-[#DCD7CE]">
                                    {{ getInitials(activeApprovalSwap.offered_by?.name) }}
                                </div>
                                <div>
                                    <div class="font-headline text-xs font-bold text-[#1F1F28] leading-tight truncate">
                                        {{ activeApprovalSwap.offered_by?.name || 'Offering Staff' }}
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64] font-body">
                                        {{ activeApprovalSwap.shift?.role_label || 'Staff' }} (Offerer)
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col items-center justify-center px-2">
                                <span class="text-[10px] font-headline text-[#2D4F67] font-bold uppercase tracking-wider">
                                    Transfer
                                </span>
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">arrow_forward</span>
                            </div>

                            <div class="flex items-center gap-2.5 min-w-0 justify-end">
                                <div class="text-right">
                                    <div class="font-headline text-xs font-bold text-[#1F1F28] leading-tight truncate">
                                        {{ activeApprovalSwap.requested_by?.name || 'Claiming Staff' }}
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64] font-body">
                                        Qualified Peer (Claimant)
                                    </div>
                                </div>
                                <div class="w-9 h-9 rounded-full bg-[#E6ECF0] flex items-center justify-center font-headline font-bold text-xs text-[#2D4F67] border border-[#BACEDD]">
                                    {{ getInitials(activeApprovalSwap.requested_by?.name) }}
                                </div>
                            </div>
                        </div>

                        <div class="bg-white p-2.5 rounded-lg border border-[#DCD7CE] flex items-center justify-between">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-headline uppercase text-[#5A5D64] font-bold tracking-wider">
                                    Shift Schedule Block
                                </span>
                                <span class="text-xs font-bold text-[#1F1F28]">
                                    {{ formatShortDay(activeApprovalSwap.shift?.start_at) }} ·
                                    <span class="font-mono-num">{{ formatTime24(activeApprovalSwap.shift?.start_at) }} – {{ formatTime24(activeApprovalSwap.shift?.end_at) }}</span> PHT
                                </span>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[11px] font-mono-num font-bold bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF]">
                                {{ getShiftHours(activeApprovalSwap.shift) }}h Duration
                            </span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2.5">
                        <div class="flex items-center justify-between">
                            <span class="font-headline text-xs font-bold text-[#1F1F28] uppercase tracking-wider">
                                Instant Broadcast Actions
                            </span>
                            <span class="text-[11px] font-body text-[#5A5D64]">All 3 Pre-selected</span>
                        </div>

                        <label class="flex items-start gap-3 p-2.5 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] hover:bg-[#E6ECF0] cursor-pointer transition-colors">
                            <input
                                v-model="broadcastChecks.rosterPush"
                                type="checkbox"
                                class="mt-0.5 rounded text-[#2D4F67] focus:ring-[#2D4F67] border-[#DCD7CE]"
                            />
                            <div class="flex flex-col">
                                <span class="font-headline text-xs font-semibold text-[#1F1F28]">
                                    Broadcast updated roster push alert
                                </span>
                                <span class="font-body text-[11px] text-[#5A5D64]">
                                    Push update to branch team roster feed
                                </span>
                            </div>
                        </label>

                        <label class="flex items-start gap-3 p-2.5 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] hover:bg-[#E6ECF0] cursor-pointer transition-colors">
                            <input
                                v-model="broadcastChecks.directSms"
                                type="checkbox"
                                class="mt-0.5 rounded text-[#2D4F67] focus:ring-[#2D4F67] border-[#DCD7CE]"
                            />
                            <div class="flex flex-col">
                                <span class="font-headline text-xs font-semibold text-[#1F1F28]">
                                    Notify {{ getShortName(activeApprovalSwap.offered_by?.name) }} &amp; {{ getShortName(activeApprovalSwap.requested_by?.name) }} directly
                                </span>
                                <span class="font-body text-[11px] text-[#5A5D64]">
                                    Send digital swap receipt tickets
                                </span>
                            </div>
                        </label>

                        <label class="flex items-start gap-3 p-2.5 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] hover:bg-[#E6ECF0] cursor-pointer transition-colors">
                            <input
                                v-model="broadcastChecks.posSync"
                                type="checkbox"
                                class="mt-0.5 rounded text-[#2D4F67] focus:ring-[#2D4F67] border-[#DCD7CE]"
                            />
                            <div class="flex flex-col">
                                <span class="font-headline text-xs font-semibold text-[#1F1F28]">
                                    Sync POS punch-clock &amp; calendar schedule
                                </span>
                                <span class="font-body text-[11px] text-[#5A5D64]">
                                    Update attendance assignment immediately
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                <div class="bg-[#FAF8F5] px-6 py-3.5 border-t border-[#DCD7CE] flex items-center justify-between gap-3">
                    <button
                        type="button"
                        class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] transition-colors cursor-pointer"
                        @click="closeApprovalModal"
                    >
                        Cancel / Keep in Queue
                    </button>
                    <button
                        type="button"
                        :disabled="isActionSubmitting"
                        class="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-all shadow-sm cursor-pointer disabled:opacity-50"
                        @click="confirmApproveSwap"
                    >
                        <span class="material-symbols-outlined text-base">cell_tower</span>
                        <span>1-Tap Approve &amp; Broadcast Roster</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Broadcast Toast Banner -->
        <div
            v-if="toastBanner.visible"
            id="broadcast-toast-banner"
            :class="[
                'fixed top-5 right-6 z-50 max-w-md w-full rounded-xl shadow-xl border transition-all duration-200 px-4 py-3',
                toastBanner.type === 'error'
                    ? 'bg-[#FCECEC] border-[#F1B8B9] text-[#C34043]'
                    : toastBanner.type === 'success'
                    ? 'bg-white border-[#DCD7CE] text-[#1F1F28]'
                    : 'bg-[#FAF8F5] border-[#DCD7CE] text-[#1F1F28]',
            ]"
        >
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span
                        v-if="toastBanner.type === 'error'"
                        class="material-symbols-outlined text-xl text-[#C34043] shrink-0"
                    >error</span>
                    <span
                        v-else-if="toastBanner.type === 'success'"
                        class="material-symbols-outlined text-xl text-[#76946A] shrink-0"
                    >check_circle</span>
                    <span
                        v-else
                        class="w-2.5 h-2.5 rounded-full bg-[#2D4F67] shrink-0 animate-pulse"
                    ></span>
                    <div class="min-w-0">
                        <span
                            :class="[
                                'font-headline text-xs font-bold block truncate',
                                toastBanner.type === 'error' ? 'text-[#C34043]' : 'text-[#1F1F28]',
                            ]"
                        >
                            {{ toastBanner.title }}
                        </span>
                        <span class="text-[11px] font-mono-num text-[#5A5D64] block truncate">
                            {{ toastBanner.subtitle }}
                        </span>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <RouterLink
                        :to="isManager ? '/swaps' : '/my-swap-requests'"
                        class="font-headline text-xs font-semibold text-[#2D4F67] hover:underline transition-colors flex items-center gap-1"
                    >
                        <span class="material-symbols-outlined text-sm">history</span>
                        <span>Log</span>
                    </RouterLink>
                    <button
                        type="button"
                        class="text-[#5A5D64] hover:text-[#1F1F28] p-1 rounded hover:bg-black/5 transition-colors cursor-pointer"
                        title="Dismiss"
                        @click="toastBanner.visible = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
