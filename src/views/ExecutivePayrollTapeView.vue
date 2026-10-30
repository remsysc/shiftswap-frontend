<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { staffApi } from '../api/staff';

const authStore = useAuthStore();
const actionMessage = ref('');
const payrollLocked = ref(false);

interface StaffPayrollRow {
    id: string;
    initials: string;
    name: string;
    role: string;
    branchIndex: number;
    defaultBranch: string;
    regularHrs: string;
    overtimeHrs: string;
    stipend: string;
    totalPay: string;
    status: 'Verified' | 'Review OT';
}

const staffRows = ref<StaffPayrollRow[]>([]);

function initialsFrom(name?: string | null): string {
    if (!name) return 'MB';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'MB').slice(0, 2).toUpperCase();
}

async function loadStaffPayroll(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        const res = await staffApi.list(authStore.businessId);
        if (res.data && res.data.length > 0) {
            staffRows.value = res.data.map((m: any, idx: number) => {
                const name = m.name || m.user?.name || `Staff Member ${idx + 1}`;
                return {
                    id: `emp-${m.user?.id || m.id}`,
                    initials: initialsFrom(name),
                    name,
                    role: m.role ? (m.role === 'owner' ? 'Owner / Lead' : m.role === 'manager' ? 'Store Manager' : 'Staff Member') : 'Staff Member',
                    branchIndex: idx % Math.max(1, authStore.locations.length),
                    defaultBranch: authStore.branchNameAt(idx % Math.max(1, authStore.locations.length), 'Primary Branch'),
                    regularHrs: '80.0h',
                    overtimeHrs: idx % 3 === 0 ? '2.5h' : '0.0h',
                    stipend: '₱500',
                    totalPay: `₱${(16000 + (idx * 650)).toLocaleString()}`,
                    status: idx % 3 === 0 ? 'Review OT' : 'Verified',
                };
            });
        }
    } catch {
        // fallback
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadStaffPayroll();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadStaffPayroll();
    }
});

const branchOptions = computed(() => {
    if (authStore.locations.length > 0) {
        return [
            { id: 'all', label: 'All' },
            ...authStore.locations.map((loc) => ({ id: String(loc.id), label: loc.name })),
        ];
    }
    return [
        { id: 'all', label: 'All' },
        { id: 'makati', label: 'Makati' },
        { id: 'bgc', label: 'BGC' },
        { id: 'ortigas', label: 'Ortigas' },
    ];
});

function rowBranchName(row: StaffPayrollRow): string {
    return authStore.branchNameAt(row.branchIndex, row.defaultBranch);
}

const filteredRows = computed(() => {
    return staffRows.value.filter((row) =>
        authStore.matchesLocation(null, rowBranchName(row), row.branchIndex)
    );
});

function notify(msg: string): void {
    actionMessage.value = msg;
    setTimeout(() => {
        if (actionMessage.value === msg) {
            actionMessage.value = '';
        }
    }, 3500);
}

function approveRowOt(row: StaffPayrollRow): void {
    row.status = 'Verified';
    notify(`Approved overtime hours for ${row.name}.`);
}

function finalizePayroll(): void {
    payrollLocked.value = true;
    staffRows.value.forEach((r) => {
        r.status = 'Verified';
    });
    notify('Payroll cycle Jun 01 – Jun 15 approved and locked for disbursement.');
}
</script>

<template>
    <div class="space-y-6 max-w-7xl mx-auto pb-10">
        <!-- Toast -->
        <div
            v-if="actionMessage"
            class="rounded-xl border border-[#76946A]/40 bg-[#EDF3EA] px-4 py-3 text-xs font-body text-[#475F3E] flex items-center justify-between shadow-xs"
        >
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base text-[#76946A]">check_circle</span>
                <span class="font-semibold">{{ actionMessage }}</span>
            </div>
            <button type="button" class="text-[11px] font-headline font-bold underline cursor-pointer" @click="actionMessage = ''">
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
                        Cycle: Jun 01 – Jun 15
                    </span>
                    <span
                        :class="[
                            'px-2 py-0.5 rounded text-[10px] font-headline font-bold uppercase',
                            payrollLocked ? 'bg-[#EDF3EA] text-[#475F3E]' : 'bg-[#F9F3E8] text-[#8C6D36]',
                        ]"
                    >
                        {{ payrollLocked ? 'Approved' : 'Open for Review' }}
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Executive Payroll Tape
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Consolidated shift hours, overtime reserve, and floater stipends across all stores.
                </p>
            </div>

            <div class="flex items-center gap-2.5 shrink-0">
                <button
                    type="button"
                    class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#1F1F28] bg-white hover:bg-[#FAF8F5] border border-[#DCD7CE] shadow-2xs transition-all cursor-pointer"
                    @click="notify('Exported payroll CSV for Jun 01 – Jun 15.')"
                >
                    <span class="material-symbols-outlined text-base text-[#2D4F67]">download</span>
                    <span>Export CSV</span>
                </button>
                <button
                    type="button"
                    :disabled="payrollLocked"
                    :class="[
                        'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white shadow-sm transition-all cursor-pointer',
                        payrollLocked ? 'bg-[#76946A] opacity-80 cursor-default' : 'bg-[#2D4F67] hover:bg-[#1F384C]',
                    ]"
                    @click="finalizePayroll"
                >
                    <span class="material-symbols-outlined text-base">check_circle</span>
                    <span>{{ payrollLocked ? 'Payroll Approved' : 'Approve Payroll Run' }}</span>
                </button>
            </div>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP                                                          -->
        <!-- ========================================================================= -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Total Payroll Run</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱384,920</span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">42 staff across 3 branches</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Logged Shift Hours</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">1,420.5</span>
                    <span class="text-xs text-[#5A5D64]">hrs</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Synced from completed shifts</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Overtime Used</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱14,680</span>
                    <span class="text-xs font-mono-num text-[#5A5D64]">/ ₱18k</span>
                </div>
                <p class="text-xs text-[#5A5D64]">81% of cycle OT reserve</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Stipends &amp; Allowances</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#2D4F67]">₱8,420</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Floater transit &amp; shift meals</p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: STAFF LEDGER TABLE -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Staff Time &amp; Pay Ledger</h2>
                            <p class="text-xs text-[#5A5D64] mt-0.5">Hours calculated from verified clock-ins and approved swaps</p>
                        </div>

                        <div class="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#DCD7CE]">
                            <button
                                v-for="opt in branchOptions"
                                :key="opt.id"
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded text-xs font-headline font-bold transition-colors cursor-pointer',
                                    authStore.selectedLocationId === opt.id
                                        ? 'bg-[#2D4F67] text-white'
                                        : 'text-[#5A5D64] hover:text-[#1F1F28]',
                                ]"
                                @click="authStore.selectedLocationId = opt.id"
                            >
                                {{ opt.label }}
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-[#E7E3DC] text-[11px] font-headline font-bold text-[#5A5D64] uppercase tracking-wider bg-[#FAF8F5]/60">
                                    <th class="py-3 px-5">Staff Member</th>
                                    <th class="py-3 px-4">Branch</th>
                                    <th class="py-3 px-4 text-right">Reg Hrs</th>
                                    <th class="py-3 px-4 text-right">Overtime</th>
                                    <th class="py-3 px-4 text-right">Stipends</th>
                                    <th class="py-3 px-4 text-right">Total Pay</th>
                                    <th class="py-3 px-5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[#E7E3DC] text-xs">
                                <tr
                                    v-for="row in filteredRows"
                                    :key="row.id"
                                    class="hover:bg-[#FAF8F5] transition-colors"
                                >
                                    <td class="py-3.5 px-5">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-8 h-8 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline font-bold text-xs flex items-center justify-center shrink-0">
                                                {{ row.initials }}
                                            </div>
                                            <div>
                                                <div class="font-headline font-bold text-[#1F1F28]">{{ row.name }}</div>
                                                <div class="text-[11px] text-[#5A5D64]">{{ row.role }}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-3.5 px-4 text-[#1F1F28] font-medium">{{ rowBranchName(row) }}</td>
                                    <td class="py-3.5 px-4 text-right font-mono-num text-[#1F1F28]">{{ row.regularHrs }}</td>
                                    <td class="py-3.5 px-4 text-right font-mono-num text-[#1F1F28]">{{ row.overtimeHrs }}</td>
                                    <td class="py-3.5 px-4 text-right font-mono-num text-[#475F3E]">{{ row.stipend }}</td>
                                    <td class="py-3.5 px-4 text-right font-mono-num font-bold text-[#1F1F28]">{{ row.totalPay }}</td>
                                    <td class="py-3.5 px-5 text-right">
                                        <button
                                            v-if="row.status === 'Review OT'"
                                            type="button"
                                            class="px-2.5 py-1 rounded text-[11px] font-headline font-bold bg-[#F9F3E8] text-[#8C6D36] hover:bg-[#2D4F67] hover:text-white transition-colors cursor-pointer"
                                            @click="approveRowOt(row)"
                                        >
                                            Approve OT
                                        </button>
                                        <span
                                            v-else
                                            class="px-2 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#EDF3EA] text-[#475F3E]"
                                        >
                                            Verified
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: BRANCH TOTALS & OVERTIME RESERVE -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-4">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Branch Payroll Split</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Jun 01 – Jun 15 allocation</p>
                    </div>

                    <div class="space-y-3.5">
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Makati Flagship (18 staff)</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱168,400</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#2D4F67] h-full rounded-full" style="width: 44%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">BGC High Street (14 staff)</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱134,200</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#C0A36E] h-full rounded-full" style="width: 35%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Ortigas Podium (10 staff)</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱82,320</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#76946A] h-full rounded-full" style="width: 21%"></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-3">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Overtime Reserve Pool</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Remaining buffer for weekend rush</p>
                    </div>

                    <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] space-y-2">
                        <div class="flex items-baseline justify-between">
                            <span class="text-xs text-[#5A5D64]">Remaining Reserve</span>
                            <span class="text-lg font-mono-num font-extrabold text-[#475F3E]">₱3,320</span>
                        </div>
                        <div class="w-full h-1.5 bg-[#E7E3DC] rounded-full overflow-hidden">
                            <div class="bg-[#C0A36E] h-full rounded-full" style="width: 81%"></div>
                        </div>
                        <p class="text-[11px] text-[#5A5D64]">
                            ₱14,680 used of ₱18,000 bi-weekly overtime budget.
                        </p>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
