<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { staffApi } from '../api/staff';

const authStore = useAuthStore();
const actionMessage = ref('');
const maxOtHours = ref(4);
const maxStipendPhp = ref(500);

interface ManagerCard {
    id: string;
    initials: string;
    name: string;
    branchIndex: number;
    defaultBranch: string;
    tier: 'Full Autonomy' | 'Standard';
    canApproveSwaps: boolean;
    canDispatchFloaters: boolean;
    canApproveOvertime: boolean;
}

const managersList = ref<ManagerCard[]>([]);

function initialsFrom(name?: string | null): string {
    if (!name) return 'MG';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'MG').slice(0, 2).toUpperCase();
}

async function loadManagers(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        const res = await staffApi.list(authStore.businessId);
        if (res.data) {
            const list = res.data.filter((m: any) => m.role === 'manager' || m.role === 'owner');
            if (list.length > 0) {
                managersList.value = list.map((m: any, idx: number) => {
                    const name = m.name || m.user?.name || `Manager ${idx + 1}`;
                    return {
                        id: `mgr-${m.user?.id || m.id}`,
                        initials: initialsFrom(name),
                        name,
                        branchIndex: idx % Math.max(1, authStore.locations.length),
                        defaultBranch: authStore.branchNameAt(idx % Math.max(1, authStore.locations.length), 'Primary Branch'),
                        tier: m.role === 'owner' ? 'Full Autonomy' : 'Standard',
                        canApproveSwaps: true,
                        canDispatchFloaters: true,
                        canApproveOvertime: m.role === 'owner',
                    };
                });
            } else if (authStore.user) {
                managersList.value = [
                    {
                        id: `mgr-${authStore.user.id}`,
                        initials: initialsFrom(authStore.user.name),
                        name: authStore.user.name,
                        branchIndex: 0,
                        defaultBranch: authStore.branchNameAt(0, 'Primary Branch'),
                        tier: 'Full Autonomy',
                        canApproveSwaps: true,
                        canDispatchFloaters: true,
                        canApproveOvertime: true,
                    },
                ];
            }
        }
    } catch {
        // fallback
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) loadManagers();
    }
);

onMounted(() => {
    if (authStore.businessId) loadManagers();
});

const managers = computed(() => {
    return managersList.value.map((m) => ({
        ...m,
        branch: authStore.branchNameAt(m.branchIndex, m.defaultBranch),
    })).filter((m) => authStore.matchesLocation(null, m.branch, m.branchIndex));
});

function notify(msg: string): void {
    actionMessage.value = msg;
    setTimeout(() => {
        if (actionMessage.value === msg) {
            actionMessage.value = '';
        }
    }, 3500);
}

function toggleTier(mgr: { id: string }): void {
    const target = managersList.value.find((m) => m.id === mgr.id);
    if (!target) {
        return;
    }
    if (target.tier === 'Standard') {
        target.tier = 'Full Autonomy';
        target.canApproveOvertime = true;
        notify(`Upgraded ${target.name} to Full Autonomy.`);
    } else {
        target.tier = 'Standard';
        target.canApproveOvertime = false;
        notify(`Set ${target.name} to Standard delegation.`);
    }
}

const recentActions = computed(() => {
    if (managersList.value.length === 0) return [];
    return managersList.value.map((mgr, idx) => ({
        manager: mgr.name,
        branchIndex: mgr.branchIndex,
        branch: authStore.branchNameAt(mgr.branchIndex, mgr.defaultBranch),
        action: idx === 0 ? 'Verified peer swap compliance and zero schedule overlap.' : 'Updated weekly station coverage and approved shift requests.',
        time: idx === 0 ? '18m ago' : '1h ago',
    })).filter((a) => authStore.matchesLocation(null, a.branch, a.branchIndex));
});
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
                        Access &amp; Permissions
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Managers &amp; Delegation
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Control what branch managers can approve directly versus what escalates to you.
                </p>
            </div>

            <button
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start md:self-auto"
                @click="notify('Saved delegation permissions across all 3 branches.')"
            >
                <span class="material-symbols-outlined text-base">save</span>
                <span>Save Permissions</span>
            </button>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP                                                          -->
        <!-- ========================================================================= -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Branch Managers</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">3 / 3</span>
                    <span class="text-xs text-[#5A5D64]">assigned</span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">All stores have a lead</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Handled at Branch</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">94%</span>
                    <span class="text-xs text-[#5A5D64]">of swaps</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Resolved without escalation</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Overtime Limit</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#2D4F67]">{{ maxOtHours }} hrs</span>
                    <span class="text-xs text-[#5A5D64]">/ week</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Above this requires Owner sign-off</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Stipend Limit</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱{{ maxStipendPhp }}</span>
                    <span class="text-xs text-[#5A5D64]">/ shift</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Max manager transit approval</p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: MANAGER AUTHORITY MATRIX -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Branch Manager Permissions</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Toggle scheduling and approval capabilities per store manager</p>
                    </div>

                    <div class="divide-y divide-[#E7E3DC]">
                        <div
                            v-for="mgr in managers"
                            :key="mgr.id"
                            class="p-5 space-y-4"
                        >
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline font-bold text-sm flex items-center justify-center shrink-0">
                                        {{ mgr.initials }}
                                    </div>
                                    <div>
                                        <div class="flex items-center gap-2">
                                            <h3 class="text-sm font-headline font-bold text-[#1F1F28]">{{ mgr.name }}</h3>
                                            <span
                                                :class="[
                                                    'px-2 py-0.5 rounded text-[11px] font-headline font-semibold',
                                                    mgr.tier === 'Full Autonomy'
                                                        ? 'bg-[#EDF3EA] text-[#475F3E]'
                                                        : 'bg-[#F9F3E8] text-[#8C6D36]',
                                                ]"
                                            >
                                                {{ mgr.tier }}
                                            </span>
                                        </div>
                                        <p class="text-xs text-[#5A5D64] mt-0.5">{{ mgr.branch }}</p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    class="px-3 py-1.5 rounded-lg text-xs font-headline font-semibold text-[#1F1F28] bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer self-start sm:self-auto"
                                    @click="toggleTier(mgr)"
                                >
                                    {{ mgr.tier === 'Standard' ? 'Upgrade to Full Autonomy' : 'Set to Standard' }}
                                </button>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                <label class="flex items-center justify-between p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Approve Shift Swaps</span>
                                    <input v-model="mgr.canApproveSwaps" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Dispatch Floaters</span>
                                    <input v-model="mgr.canDispatchFloaters" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Approve Overtime</span>
                                    <input v-model="mgr.canApproveOvertime" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: ESCALATION THRESHOLDS & RECENT LOG -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-4">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Escalation Thresholds</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">When requests require Owner approval</p>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-headline font-semibold text-[#1F1F28]">Max Weekly Overtime</span>
                                <span class="font-mono-num font-bold text-[#2D4F67]">{{ maxOtHours }} hrs</span>
                            </div>
                            <input
                                v-model.number="maxOtHours"
                                type="range"
                                min="1"
                                max="10"
                                class="w-full accent-[#2D4F67] cursor-pointer"
                            />
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1.5">
                                <span class="font-headline font-semibold text-[#1F1F28]">Max Transit Stipend</span>
                                <span class="font-mono-num font-bold text-[#2D4F67]">₱{{ maxStipendPhp }}</span>
                            </div>
                            <input
                                v-model.number="maxStipendPhp"
                                type="range"
                                min="150"
                                max="1000"
                                step="50"
                                class="w-full accent-[#2D4F67] cursor-pointer"
                            />
                        </div>
                    </div>
                </section>

                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-3">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Recent Manager Activity</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Latest branch approvals</p>
                    </div>

                    <div class="divide-y divide-[#E7E3DC]">
                        <div
                            v-for="item in recentActions"
                            :key="item.time"
                            class="py-3 space-y-1"
                        >
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-headline font-bold text-[#1F1F28]">{{ item.manager }} ({{ item.branch }})</span>
                                <span class="font-mono-num text-[11px] text-[#5A5D64]">{{ item.time }}</span>
                            </div>
                            <p class="text-xs text-[#5A5D64] leading-relaxed">{{ item.action }}</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
