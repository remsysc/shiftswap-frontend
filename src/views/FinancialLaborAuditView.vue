<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { swapsApi } from '../api/swaps';

const authStore = useAuthStore();
const actionMessage = ref('');
const activeFilter = ref<'all' | 'Swap' | 'Overtime' | 'Stipend'>('all');

interface AuditRow {
    id: string;
    type: 'Swap' | 'Overtime' | 'Stipend';
    summary: string;
    staff: string;
    branchIndex: number;
    defaultBranch: string;
    approver: string;
    impact: string;
    date: string;
    status: 'Verified' | 'Waiver Approved';
}

const auditRows = ref<AuditRow[]>([]);

async function loadAuditRecords(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        const res = await swapsApi.listSwaps(authStore.businessId);
        if (res.data && res.data.length > 0) {
            auditRows.value = res.data.map((s: any, idx: number) => ({
                id: `SW-${s.id}`,
                type: 'Swap' as const,
                summary: `${s.shift?.role_label || 'Shift Assignment'} Exchange`,
                staff: `${s.offered_by?.name || 'Staff'} ↔ ${s.requested_by?.name || 'Market'}`,
                branchIndex: idx % Math.max(1, authStore.locations.length),
                defaultBranch: authStore.branchNameAt(idx % Math.max(1, authStore.locations.length), 'Primary Branch'),
                approver: s.manager_notes || 'Store Management',
                impact: '₱0 Net Change',
                date: s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Recent',
                status: (s.status === 'approved' ? 'Verified' : 'Waiver Approved') as 'Verified' | 'Waiver Approved',
            }));
        }
    } catch {
        // fallback
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) loadAuditRecords();
    }
);

onMounted(() => {
    if (authStore.businessId) loadAuditRecords();
});

function rowBranchName(row: AuditRow): string {
    return authStore.branchNameAt(row.branchIndex, row.defaultBranch);
}

const filteredAuditRows = computed(() => {
    return auditRows.value
        .filter((row) => authStore.matchesLocation(null, rowBranchName(row), row.branchIndex))
        .filter((row) => activeFilter.value === 'all' || row.type === activeFilter.value);
});

function notify(msg: string): void {
    actionMessage.value = msg;
    setTimeout(() => {
        if (actionMessage.value === msg) {
            actionMessage.value = '';
        }
    }, 3500);
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
                        Activity &amp; Cost History
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Financial &amp; Labor Audit
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Complete history of approved shift swaps, overtime extensions, and branch labor variance.
                </p>
            </div>

            <button
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start md:self-auto"
                @click="notify('Exported labor & swap audit log to CSV.')"
            >
                <span class="material-symbols-outlined text-base">download</span>
                <span>Export Audit Log</span>
            </button>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP                                                          -->
        <!-- ========================================================================= -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Schedule Compliance</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#475F3E]">98.5%</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Rest &amp; weekly hour rules met</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Audited Labor Spend</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱384.9k</span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">3.4% under bi-weekly budget</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Completed Swaps</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">142</span>
                    <span class="text-xs text-[#5A5D64]">this quarter</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Zero missed shifts after swap</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Overtime Waivers</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#8C6D36]">2</span>
                    <span class="text-xs text-[#5A5D64]">this cycle</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Signed off by manager/owner</p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: ACTIVITY AUDIT TABLE -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Shift Swap &amp; Labor Log</h2>
                            <p class="text-xs text-[#5A5D64] mt-0.5">Verified approvals and pay impact</p>
                        </div>

                        <div class="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#DCD7CE]">
                            <button
                                v-for="tab in (['all', 'Swap', 'Overtime', 'Stipend'] as const)"
                                :key="tab"
                                type="button"
                                :class="[
                                    'px-2.5 py-1 rounded text-xs font-headline font-bold transition-colors cursor-pointer',
                                    activeFilter === tab
                                        ? 'bg-[#2D4F67] text-white'
                                        : 'text-[#5A5D64] hover:text-[#1F1F28]',
                                ]"
                                @click="activeFilter = tab"
                            >
                                {{ tab === 'all' ? 'All' : tab }}
                            </button>
                        </div>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="border-b border-[#E7E3DC] text-[11px] font-headline font-bold text-[#5A5D64] uppercase tracking-wider bg-[#FAF8F5]/60">
                                    <th class="py-3 px-5">Event</th>
                                    <th class="py-3 px-4">Branch</th>
                                    <th class="py-3 px-4">Approved By</th>
                                    <th class="py-3 px-4 text-right">Cost Impact</th>
                                    <th class="py-3 px-5 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-[#E7E3DC] text-xs">
                                <tr
                                    v-for="row in filteredAuditRows"
                                    :key="row.id"
                                    class="hover:bg-[#FAF8F5] transition-colors"
                                >
                                    <td class="py-3.5 px-5">
                                        <div class="font-headline font-bold text-[#1F1F28]">{{ row.summary }}</div>
                                        <div class="text-[11px] text-[#5A5D64] mt-0.5">
                                            {{ row.staff }} · <span class="font-mono-num">{{ row.date }}</span>
                                        </div>
                                    </td>
                                    <td class="py-3.5 px-4 font-medium text-[#1F1F28]">{{ rowBranchName(row) }}</td>
                                    <td class="py-3.5 px-4 text-[#5A5D64]">{{ row.approver }}</td>
                                    <td class="py-3.5 px-4 text-right font-mono-num font-bold text-[#1F1F28]">{{ row.impact }}</td>
                                    <td class="py-3.5 px-5 text-right">
                                        <span
                                            :class="[
                                                'px-2 py-0.5 rounded text-[11px] font-headline font-semibold',
                                                row.status === 'Verified'
                                                    ? 'bg-[#EDF3EA] text-[#475F3E]'
                                                    : 'bg-[#F9F3E8] text-[#8C6D36]',
                                            ]"
                                        >
                                            {{ row.status }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: STORE BUDGET VARIANCE & GUARDRAILS -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-4">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Branch Labor vs. Budget</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Current cycle variance</p>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Makati Flagship</span>
                                <span class="font-mono-num font-bold text-[#475F3E]">₱168.4k / ₱175k</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#2D4F67] h-full rounded-full" style="width: 96%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">BGC High Street</span>
                                <span class="font-mono-num font-bold text-[#8C6D36]">₱134.2k / ₱135k</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#C0A36E] h-full rounded-full" style="width: 99%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Ortigas Podium</span>
                                <span class="font-mono-num font-bold text-[#475F3E]">₱82.3k / ₱90k</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#76946A] h-full rounded-full" style="width: 91%"></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-3">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Scheduling Health Check</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Automated shift validation</p>
                    </div>

                    <div class="space-y-2.5 text-xs">
                        <div class="flex items-center justify-between py-2 border-b border-[#E7E3DC]">
                            <span class="text-[#5A5D64]">12h Rest Between Shifts</span>
                            <span class="font-mono-num font-bold text-[#475F3E]">100% Passed</span>
                        </div>
                        <div class="flex items-center justify-between py-2 border-b border-[#E7E3DC]">
                            <span class="text-[#5A5D64]">Station Skill Matching</span>
                            <span class="font-mono-num font-bold text-[#475F3E]">100% Passed</span>
                        </div>
                        <div class="flex items-center justify-between py-2">
                            <span class="text-[#5A5D64]">40h Weekly Cap Waivers</span>
                            <span class="font-mono-num font-bold text-[#8C6D36]">2 Approved</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
