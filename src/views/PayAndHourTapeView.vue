<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const showDisputeModal = ref(false);
const disputeShiftDate = ref('Thu, Jun 12 (06:00 – 14:30)');
const disputeReason = ref('');
const bannerNotice = ref('');

function submitTapeDispute(): void {
    showDisputeModal.value = false;
    bannerNotice.value = `Dispute ticket logged for ${disputeShiftDate.value} on Payroll ID #MS-77402.`;
    disputeReason.value = '';
}
</script>

<template>
    <div class="space-y-6 max-w-7xl mx-auto pb-12">
        <!-- Feedback Banner -->
        <div
            v-if="bannerNotice"
            class="p-4 sm:p-5 rounded-2xl bg-[#EAF0E8] border border-[#C9DBC2] text-[#76946A] text-xs sm:text-sm font-medium flex items-center justify-between shadow-2xs"
        >
            <div class="flex items-center gap-2.5">
                <span class="material-symbols-outlined text-lg">check_circle</span>
                <span>{{ bannerNotice }}</span>
            </div>
            <button class="text-xs font-bold underline cursor-pointer hover:text-[#58734F] transition" @click="bannerNotice = ''">
                Dismiss
            </button>
        </div>

        <!-- Header Bar -->
        <div class="bg-white border border-[#DCD7CE] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2.5">
                    <h1 class="text-lg sm:text-xl font-headline font-bold text-[#1F1F28] tracking-tight">
                        Pay &amp; Hour Tape · Cycle: Jun 1–15
                    </h1>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-headline font-semibold bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]">
                        <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                        Schedule Verified
                    </span>
                </div>
                <p class="text-xs sm:text-sm text-[#5A5D64] leading-relaxed">
                    {{ authStore.user?.name || 'Staff Member' }} · {{ authStore.user?.role === 'manager' ? 'Branch Manager' : 'Staff' }} · Base Rate <span class="font-bold text-[#1F1F28] tabular-nums">₱365.00/hr</span> · Payroll ID <span class="font-semibold text-[#1F1F28]">#EMP-{{ authStore.user?.id || '001' }}</span>
                </p>
            </div>
            <div class="flex items-center gap-2.5 shrink-0">
                <button
                    class="px-4 py-2 text-xs font-headline font-semibold rounded-xl border border-[#DCD7CE] bg-[#FAF8F5] text-[#1F1F28] hover:bg-[#E6ECF0] transition-colors shadow-2xs cursor-pointer"
                    @click="showDisputeModal = true"
                >
                    Dispute Tape
                </button>
                <button
                    class="px-4 py-2 text-xs font-headline font-bold rounded-xl bg-[#2D4F67] text-white hover:bg-[#1F384C] transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
                    @click="bannerNotice = `Official Payslip PDF (#EMP-${authStore.user?.id || '001'}) downloaded.`"
                >
                    <span class="material-symbols-outlined text-base">download</span>
                    Export PDF
                </button>
            </div>
        </div>

        <!-- 4-Card KPI Strip -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <div class="bg-white p-5 rounded-2xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-[#5A5D64] mb-2">
                        <span class="font-headline font-bold uppercase tracking-wider text-[11px]">Net Projected Pay</span>
                        <span class="text-[11px] text-[#76946A] font-semibold bg-[#EAF0E8] px-2 py-0.5 rounded-full">Disbursing Jun 15</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-extrabold text-[#1F1F28] tabular-nums tracking-tight">₱24,650.00</div>
                </div>
                <div class="text-xs text-[#5A5D64] mt-3 pt-2.5 border-t border-[#F2EFE9]">
                    Gross <span class="font-semibold text-[#1F1F28] tabular-nums">₱26,100.00</span> · Ded. <span class="font-semibold text-[#C34043] tabular-nums">-₱1,450.00</span>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-[#5A5D64] mb-2">
                        <span class="font-headline font-bold uppercase tracking-wider text-[11px]">Hours Logged</span>
                        <span class="text-[11px] text-[#2D4F67] font-semibold bg-[#E6ECF0] px-2 py-0.5 rounded-full">80.6% of Cap</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-extrabold text-[#1F1F28] tabular-nums tracking-tight">
                        64.5 <span class="text-sm font-normal text-[#5A5D64]">/ 80.0h</span>
                    </div>
                </div>
                <div class="mt-3 pt-2.5 border-t border-[#F2EFE9]">
                    <div class="w-full h-2 bg-[#FAF8F5] rounded-full overflow-hidden border border-[#DCD7CE]">
                        <div class="h-full bg-[#2D4F67] rounded-full" style="width: 80.6%"></div>
                    </div>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-[#5A5D64] mb-2">
                        <span class="font-headline font-bold uppercase tracking-wider text-[11px]">Overtime (1.25x)</span>
                        <span class="text-[11px] text-[#8F6A24] font-semibold bg-[#F9F3E8] px-2 py-0.5 rounded-full tabular-nums">+₱228.13</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-extrabold text-[#1F1F28] tabular-nums tracking-tight">0.5 Hours</div>
                </div>
                <div class="text-xs text-[#5A5D64] mt-3 pt-2.5 border-t border-[#F2EFE9]">
                    Night Diff (10%): <span class="font-semibold text-[#1F1F28] tabular-nums">4.0h (+₱146.00)</span>
                </div>
            </div>

            <div class="bg-white p-5 rounded-2xl border border-[#DCD7CE] shadow-xs flex flex-col justify-between">
                <div>
                    <div class="flex items-center justify-between text-xs text-[#5A5D64] mb-2">
                        <span class="font-headline font-bold uppercase tracking-wider text-[11px]">Travel &amp; Meal Stipends</span>
                        <span class="text-[11px] text-[#76946A] font-semibold bg-[#EAF0E8] px-2 py-0.5 rounded-full">Tax-Exempt</span>
                    </div>
                    <div class="text-2xl sm:text-3xl font-extrabold text-[#1F1F28] tabular-nums tracking-tight">₱1,250.00</div>
                </div>
                <div class="text-xs text-[#5A5D64] mt-3 pt-2.5 border-t border-[#F2EFE9]">
                    Harbor Floater <span class="font-semibold text-[#1F1F28] tabular-nums">₱450</span> · Meals <span class="font-semibold text-[#1F1F28] tabular-nums">₱800</span>
                </div>
            </div>
        </div>

        <!-- 12-Col Main Split (8 Cols Shift Punch Audit + 4 Cols Summary) -->
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <!-- Left 8 Cols: Itemized Shift Punch Audit -->
            <div class="xl:col-span-8 bg-white rounded-2xl border border-[#DCD7CE] overflow-hidden shadow-xs">
                <div class="px-6 py-4.5 border-b border-[#DCD7CE] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF8F5]">
                    <div>
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">
                            Shift Punch Audit (8 Verified Shifts)
                        </h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">
                            Chronological biometric punch log &amp; shift swap trail
                        </p>
                    </div>
                    <span class="text-xs font-semibold text-[#5A5D64] bg-white px-3 py-1 rounded-full border border-[#DCD7CE] shadow-2xs self-start sm:self-auto">
                        Showing 6 of 8 shifts
                    </span>
                </div>

                <div class="divide-y divide-[#DCD7CE]">
                    <!-- Shift 1 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">THU</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">12</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Downtown Makati Flagship
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#FAF8F5] text-[#5A5D64] font-medium border border-[#DCD7CE]">
                                        Opening Espresso Bar
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">06:00 – 14:30</span>
                                    <span>·</span>
                                    <span>30m unpaid break</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">
                                    8.0h Reg <span class="text-[#8F6A24] font-semibold">+ 0.5h OT</span>
                                </div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAF3E8] text-[#8C6D36] border border-[#ECDDBF] mt-0.5">
                                    1.25x Overtime Approved
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱3,148.13</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Shift 2 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">WED</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">11</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Harbor View Roastery
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#E6ECF0] text-[#2D4F67] font-semibold border border-[#2D4F67]/25">
                                        Floater Swap #SW-882
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#2D4F67]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">14:00 – 22:00</span>
                                    <span>·</span>
                                    <span>Covered for J. Reyes</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">8.0h Reg</div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF0E8] text-[#475F3E] border border-[#C9DBC2] mt-0.5">
                                    +₱225.00 Travel Stipend
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱3,145.00</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Shift 3 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">MON</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">09</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Downtown Makati Flagship
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#FAF8F5] text-[#5A5D64] font-medium border border-[#DCD7CE]">
                                        Closing Lead
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">16:00 – 00:00</span>
                                    <span>·</span>
                                    <span>Includes 2.0h Night Shift</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">
                                    8.0h Reg <span class="text-[#2D4F67] font-semibold">+ 2.0h ND</span>
                                </div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D3DE] mt-0.5">
                                    +₱73.00 Night Diff 10%
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱2,993.00</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Shift 4 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">SUN</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">08</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Downtown Makati Flagship
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#FAF8F5] text-[#5A5D64] font-medium border border-[#DCD7CE]">
                                        Morning Calibration
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">06:00 – 14:00</span>
                                    <span>·</span>
                                    <span class="text-[#76946A] font-semibold">16h Rest Gap Verified</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">8.0h Reg</div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAF3E8] text-[#8C6D36] border border-[#ECDDBF] mt-0.5">
                                    +₱100.00 Meal Stipend
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱3,020.00</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Shift 5 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">FRI</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">06</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Harbor View Roastery
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#E6ECF0] text-[#2D4F67] font-semibold border border-[#2D4F67]/25">
                                        Floater Dispatch
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#2D4F67]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">10:00 – 18:00</span>
                                    <span>·</span>
                                    <span>Peak Pour-Over Bar</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">8.0h Reg</div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EAF0E8] text-[#475F3E] border border-[#C9DBC2] mt-0.5">
                                    +₱225.00 Travel Stipend
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱3,145.00</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Shift 6 -->
                    <div class="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-[#FAF8F5]/80 transition-colors">
                        <div class="flex items-center gap-3.5">
                            <div class="w-12 h-12 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col items-center justify-center shrink-0">
                                <span class="text-[10px] font-headline font-bold uppercase text-[#5A5D64] tracking-wider leading-none">WED</span>
                                <span class="text-base font-headline font-extrabold text-[#1F1F28] leading-none mt-1">04</span>
                            </div>
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                                        Downtown Makati Flagship
                                    </h3>
                                    <span class="px-2 py-0.5 text-[11px] rounded-md bg-[#FAF8F5] text-[#5A5D64] font-medium border border-[#DCD7CE]">
                                        Opening Espresso Bar
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-[#5A5D64] mt-1">
                                    <span class="material-symbols-outlined text-sm text-[#76946A]">schedule</span>
                                    <span class="font-bold text-[#1F1F28] tabular-nums">06:00 – 14:00</span>
                                    <span>·</span>
                                    <span>Plus 2 prior shifts (16.0h)</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex items-center justify-between sm:justify-end gap-6 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F2EFE9]">
                            <div class="text-left sm:text-right">
                                <div class="text-xs font-bold text-[#1F1F28] tabular-nums">24.0h Combined</div>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE] mt-0.5">
                                    Jun 01–04 Verified
                                </span>
                            </div>
                            <div class="text-right min-w-[95px]">
                                <div class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱10,648.87</div>
                                <div class="text-[11px] font-semibold text-[#76946A] flex items-center justify-end gap-1 mt-0.5">
                                    <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                                    Verified
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="px-6 py-4.5 bg-[#FAF8F5] border-t border-[#DCD7CE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2 text-[#5A5D64]">
                        <span class="material-symbols-outlined text-base text-[#76946A]">verified</span>
                        <span>All 8 shifts verified by Store Manager (R. Lim)</span>
                    </div>
                    <div class="flex items-center gap-2.5">
                        <span class="text-xs font-bold uppercase tracking-wider text-[#5A5D64]">Tape Total:</span>
                        <span class="text-base font-extrabold text-[#1F1F28] tabular-nums">₱24,650.00</span>
                        <span class="text-xs font-bold text-[#76946A] bg-[#EAF0E8] border border-[#C9DBC2] px-2 py-0.5 rounded-md">
                            Net Verified
                        </span>
                    </div>
                </div>
            </div>

            <!-- Right 4 Cols: Deductions & Weekly Cap Guardrail -->
            <div class="xl:col-span-4 space-y-6">
                <!-- Weekly Cap Guardrail -->
                <div class="bg-white p-5 sm:p-6 rounded-2xl border border-[#DCD7CE] shadow-xs space-y-3.5">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xs font-headline font-bold uppercase tracking-wider text-[#1F1F28]">
                            Weekly Cap Guardrail
                        </h3>
                        <span class="text-xs font-bold text-[#76946A] bg-[#EAF0E8] px-2.5 py-0.5 rounded-full tabular-nums">
                            15.5h Remaining
                        </span>
                    </div>
                    <div class="text-xs sm:text-sm text-[#5A5D64] leading-relaxed">
                        Week 2 Progress: <span class="font-bold text-[#1F1F28] tabular-nums">32.5 / 40.0h</span> before 1.25x OT threshold.
                    </div>
                    <div class="w-full h-2.5 bg-[#FAF8F5] rounded-full overflow-hidden border border-[#DCD7CE] my-1">
                        <div class="h-full bg-[#76946A] rounded-full" style="width: 81.25%"></div>
                    </div>
                    <div class="pt-2 border-t border-[#F2EFE9] flex items-center justify-between text-xs text-[#5A5D64]">
                        <span>Min Rest: <strong class="font-bold text-[#1F1F28] tabular-nums">14.0h</strong></span>
                        <span class="text-[#76946A] font-semibold bg-[#EAF0E8] px-2 py-0.5 rounded-md">Eligible for 1 Swap</span>
                    </div>
                </div>

                <!-- Shift & Swap Summary (Deductions) -->
                <div class="bg-white p-5 sm:p-6 rounded-2xl border border-[#DCD7CE] shadow-xs space-y-4">
                    <div class="flex items-center justify-between border-b border-[#DCD7CE] pb-3">
                        <h3 class="text-xs font-headline font-bold uppercase tracking-wider text-[#1F1F28]">
                            Shift &amp; Swap Summary
                        </h3>
                        <span class="text-xs font-semibold text-[#5A5D64] bg-[#FAF8F5] px-2.5 py-0.5 rounded-md border border-[#DCD7CE]">
                            Current Period
                        </span>
                    </div>
                    <div class="space-y-3 text-xs sm:text-sm">
                        <div class="flex justify-between items-center">
                            <span class="text-[#5A5D64]">SSS Contribution (Employee)</span>
                            <span class="font-semibold text-[#1F1F28] tabular-nums">-₱675.00</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[#5A5D64]">PhilHealth Universal Care</span>
                            <span class="font-semibold text-[#1F1F28] tabular-nums">-₱375.00</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[#5A5D64]">Pag-IBIG HDMF Fund</span>
                            <span class="font-semibold text-[#1F1F28] tabular-nums">-₱100.00</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-[#5A5D64]">BIR Withholding Tax (TRAIN)</span>
                            <span class="font-semibold text-[#1F1F28] tabular-nums">-₱300.00</span>
                        </div>
                        <div class="pt-3.5 mt-1 border-t border-[#DCD7CE] flex justify-between items-center font-bold text-sm">
                            <span class="text-[#1F1F28]">Total Deductions</span>
                            <span class="text-[#C34043] font-extrabold tabular-nums">-₱1,450.00</span>
                        </div>
                    </div>
                </div>

                <!-- Deposit Account Card -->
                <div class="bg-[#FAF8F5] p-5 rounded-2xl border border-[#DCD7CE] flex items-center justify-between gap-4 shadow-2xs">
                    <div class="space-y-0.5">
                        <div class="font-headline font-bold text-sm text-[#1F1F28]">Deposit Account · BPI •••• 4829</div>
                        <div class="text-xs text-[#5A5D64]">Auto-credit scheduled Jun 15, 14:00 PST</div>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-white border border-[#DCD7CE] flex items-center justify-center shrink-0 shadow-2xs">
                        <span class="material-symbols-outlined text-[#2D4F67] text-xl">account_balance</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dispute Pay Tape Modal -->
        <div
            v-if="showDisputeModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-6 py-4.5 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-xl text-[#2D4F67]">fact_check</span>
                        <h3 class="font-headline text-base font-bold text-[#1F1F28]">
                            File Shift Punch / Pay Tape Inquiry
                        </h3>
                    </div>
                    <button
                        class="w-8 h-8 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center transition cursor-pointer"
                        @click="showDisputeModal = false"
                    >
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <form class="p-6 space-y-5" @submit.prevent="submitTapeDispute">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-headline font-bold uppercase tracking-wider text-[#5A5D64]">
                            Shift Entry
                        </label>
                        <select
                            v-model="disputeShiftDate"
                            class="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#DCD7CE] bg-white text-[#1F1F28] focus:border-[#2D4F67] focus:ring-1 focus:ring-[#2D4F67] outline-none transition"
                        >
                            <option value="Thu, Jun 12 (06:00 – 14:30)">Thu, Jun 12 · Makati Flagship (8.0h Reg + 0.5h OT)</option>
                            <option value="Wed, Jun 11 (14:00 – 22:00)">Wed, Jun 11 · Harbor View Roastery (#SW-882)</option>
                            <option value="Mon, Jun 09 (16:00 – 00:00)">Mon, Jun 09 · Closing Lead (8.0h Reg + 2.0h ND)</option>
                        </select>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-headline font-bold uppercase tracking-wider text-[#5A5D64]">
                            Discrepancy Note
                        </label>
                        <textarea
                            v-model="disputeReason"
                            rows="4"
                            required
                            placeholder="Describe the punch time, overtime, or stipend adjustment needed..."
                            class="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-[#DCD7CE] bg-white text-[#1F1F28] focus:border-[#2D4F67] focus:ring-1 focus:ring-[#2D4F67] outline-none transition"
                        ></textarea>
                    </div>

                    <div class="pt-4 border-t border-[#DCD7CE] flex items-center justify-end gap-3">
                        <button
                            type="button"
                            class="px-4 py-2.5 rounded-xl text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#FAF8F5] border border-[#DCD7CE] transition cursor-pointer"
                            @click="showDisputeModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="px-5 py-2.5 rounded-xl text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-xs transition cursor-pointer"
                        >
                            Submit Inquiry
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
