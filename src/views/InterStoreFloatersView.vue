<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { staffApi } from '../api/staff';

const authStore = useAuthStore();
const actionMessage = ref('');
const floaterDispatched = ref(false);
const liveMembers = ref<any[]>([]);

function initialsFrom(name?: string | null): string {
    if (!name) return 'FL';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'FL').slice(0, 2).toUpperCase();
}

async function loadMembers(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        const res = await staffApi.list(authStore.businessId);
        if (res.data) {
            liveMembers.value = res.data;
        }
    } catch {
        // fallback
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) loadMembers();
    }
);

onMounted(() => {
    if (authStore.businessId) loadMembers();
});

const primaryFloaterName = computed(() => {
    return liveMembers.value[0]?.name || liveMembers.value[0]?.user?.name || authStore.user?.name || 'Staff Floater';
});

function notify(msg: string): void {
    actionMessage.value = msg;
    setTimeout(() => {
        if (actionMessage.value === msg) {
            actionMessage.value = '';
        }
    }, 3500);
}

function assignFloaterToBgc(): void {
    floaterDispatched.value = true;
    notify(`Assigned ${primaryFloaterName.value} (${authStore.branchNameAt(0, 'Primary')} → ${authStore.branchNameAt(1, 'Secondary')}) for today 14:00–22:00 (+₱250 transit stipend).`);
}

const floaterPool = computed(() => {
    if (liveMembers.value.length > 0) {
        return liveMembers.value.map((m, idx) => {
            const name = m.name || m.user?.name || `Floater ${idx + 1}`;
            return {
                initials: initialsFrom(name),
                name,
                branchIndex: idx % Math.max(1, authStore.locations.length),
                homeBranch: authStore.branchNameAt(idx % Math.max(1, authStore.locations.length), 'Primary Branch'),
                station: m.role === 'manager' ? 'Shift Supervisor' : 'General Duty Barista',
                hours: `${28 + (idx * 4)}h / 40h`,
                available: idx % 4 !== 3,
            };
        }).filter((f) => authStore.matchesLocation(null, f.homeBranch, f.branchIndex));
    }
    return [
        {
            initials: 'FL',
            name: primaryFloaterName.value,
            branchIndex: 0,
            homeBranch: authStore.branchNameAt(0, 'Primary'),
            station: 'Cross-Store Support',
            hours: '32h / 40h',
            available: true,
        },
    ];
});

const weeklyDispatches = computed(() => {
    return [
        {
            day: 'Today · 14:00–22:00',
            floater: primaryFloaterName.value,
            branchIndex: 1,
            route: `${authStore.branchNameAt(0, 'Primary Branch')} → ${authStore.branchNameAt(1, 'Secondary Branch')}`,
            station: 'Closing Espresso Bar',
            stipend: '+₱250',
            status: floaterDispatched.value ? 'Active' : 'Scheduled',
        },
    ];
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
                        Cross-Branch Staffing
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Inter-Store Floaters
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Balance branch staffing gaps using cross-trained floaters from neighboring stores.
                </p>
            </div>

            <button
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start md:self-auto"
                @click="assignFloaterToBgc"
            >
                <span class="material-symbols-outlined text-base">swap_horiz</span>
                <span>Dispatch Floater</span>
            </button>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP                                                          -->
        <!-- ========================================================================= -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Connected Stores</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">{{ Math.max(1, authStore.locations.length) }}</span>
                    <span class="text-xs text-[#5A5D64]">branches</span>
                </div>
                <p class="text-xs text-[#5A5D64]">{{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations Active' }}</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Cross-Store Coverage</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">
                        {{ floaterDispatched ? '100%' : '96.4%' }}
                    </span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">
                    {{ floaterDispatched ? 'All branches balanced' : '1 open shift in coverage pool' }}
                </p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Floater Pool</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">5</span>
                    <span class="text-xs text-[#5A5D64]">baristas</span>
                </div>
                <p class="text-xs text-[#5A5D64]">3 available with open hours</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Transit Stipend</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#2D4F67]">₱250</span>
                    <span class="text-xs text-[#5A5D64]">/ dispatch</span>
                </div>
                <p class="text-xs text-[#5A5D64]">Auto-added to shift pay</p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: BRANCH BALANCE & WEEKLY DISPATCHES -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <!-- Branch Staffing Balance -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6 space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-[#DCD7CE]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Branch Staffing Balance</h2>
                            <p class="text-xs text-[#5A5D64] mt-0.5">Match surplus staff from one store to open shifts in another</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- Makati -->
                        <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col justify-between gap-3">
                            <div>
                                <div class="flex items-center justify-between">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">Makati Flagship</h3>
                                    <span class="px-2 py-0.5 rounded text-[11px] font-headline font-bold bg-[#EDF3EA] text-[#475F3E]">
                                        +2 Surplus
                                    </span>
                                </div>
                                <p class="text-xs text-[#5A5D64] mt-1">16 / 16 stations staffed</p>
                            </div>
                            <p class="text-xs text-[#5A5D64] border-t border-[#E7E3DC] pt-2.5">
                                <strong class="text-[#1F1F28]">{{ primaryFloaterName }}</strong> available for cross-store dispatch.
                            </p>
                        </div>

                        <!-- Secondary Branch -->
                        <div
                            :class="[
                                'p-4 rounded-xl border flex flex-col justify-between gap-3',
                                floaterDispatched
                                    ? 'bg-[#FAF8F5] border-[#DCD7CE]'
                                    : 'bg-[#F9F3E8]/40 border-[#C0A36E]',
                            ]"
                        >
                            <div>
                                <div class="flex items-center justify-between">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">{{ authStore.branchNameAt(1, 'Branch 2') }}</h3>
                                    <span
                                        :class="[
                                            'px-2 py-0.5 rounded text-[11px] font-headline font-bold',
                                            floaterDispatched ? 'bg-[#EDF3EA] text-[#475F3E]' : 'bg-[#F9F3E8] text-[#8C6D36]',
                                        ]"
                                    >
                                        {{ floaterDispatched ? 'Balanced' : '-1 Closing' }}
                                    </span>
                                </div>
                                <p class="text-xs text-[#5A5D64] mt-1">
                                    {{ floaterDispatched ? 'All stations staffed' : 'Needs Barista 14:00–22:00' }}
                                </p>
                            </div>
                            <button
                                v-if="!floaterDispatched"
                                type="button"
                                class="w-full py-1.5 px-3 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-colors cursor-pointer"
                                @click="assignFloaterToBgc"
                            >
                                Assign {{ primaryFloaterName }}
                            </button>
                            <p v-else class="text-xs text-[#475F3E] font-semibold border-t border-[#E7E3DC] pt-2.5">
                                Covered by {{ primaryFloaterName }}
                            </p>
                        </div>

                        <!-- Ortigas -->
                        <div class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex flex-col justify-between gap-3">
                            <div>
                                <div class="flex items-center justify-between">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">Ortigas Podium</h3>
                                    <span class="px-2 py-0.5 rounded text-[11px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67]">
                                        Balanced
                                    </span>
                                </div>
                                <p class="text-xs text-[#5A5D64] mt-1">10 / 10 stations staffed</p>
                            </div>
                            <p class="text-xs text-[#5A5D64] border-t border-[#E7E3DC] pt-2.5">
                                All express bar shifts covered through Sunday.
                            </p>
                        </div>
                    </div>
                </section>

                <!-- Weekly Floater Dispatches -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">This Week's Cross-Store Dispatches</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Scheduled cross-branch shift assignments</p>
                    </div>

                    <div class="divide-y divide-[#E7E3DC]">
                        <div
                            v-for="item in weeklyDispatches"
                            :key="item.day"
                            class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors"
                        >
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-headline font-bold text-[#1F1F28]">{{ item.floater }}</span>
                                    <span class="text-xs font-mono-num text-[#2D4F67] font-semibold">{{ item.route }}</span>
                                </div>
                                <p class="text-xs text-[#5A5D64] mt-0.5">
                                    {{ item.day }} · {{ item.station }}
                                </p>
                            </div>

                            <div class="flex items-center gap-4">
                                <span class="text-xs font-mono-num font-bold text-[#475F3E]">{{ item.stipend }}</span>
                                <span class="px-2.5 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#EDF3EA] text-[#475F3E]">
                                    {{ item.status }}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: FLOATER TALENT POOL -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Shared Floater Roster</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Baristas certified for multi-branch shifts</p>
                    </div>

                    <div class="divide-y divide-[#E7E3DC] mt-2">
                        <div
                            v-for="person in floaterPool"
                            :key="person.name"
                            class="py-3.5 flex items-center justify-between gap-3"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-[#E6ECF0] text-[#2D4F67] font-headline font-bold text-xs flex items-center justify-center shrink-0">
                                    {{ person.initials }}
                                </div>
                                <div>
                                    <div class="text-xs font-headline font-bold text-[#1F1F28]">
                                        {{ person.name }}
                                        <span class="font-normal text-[#5A5D64]">({{ person.homeBranch }})</span>
                                    </div>
                                    <div class="text-[11px] text-[#5A5D64]">{{ person.station }}</div>
                                </div>
                            </div>

                            <div class="text-right">
                                <div class="text-xs font-mono-num font-bold text-[#1F1F28]">{{ person.hours }}</div>
                                <span
                                    :class="[
                                        'text-[10px] font-headline font-bold',
                                        person.available ? 'text-[#475F3E]' : 'text-[#8C6D36]',
                                    ]"
                                >
                                    {{ person.available ? 'Available' : 'At Cap' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
