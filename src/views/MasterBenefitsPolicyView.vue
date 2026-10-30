<script setup lang="ts">
import { ref } from 'vue';

const actionMessage = ref('');

interface BenefitPolicy {
    id: string;
    name: string;
    category: string;
    rate: string;
    unit: string;
    description: string;
    enrolled: string;
    enabled: boolean;
}

const policies = ref<BenefitPolicy[]>([
    {
        id: 'health',
        name: 'Health & Dental Care (HMO)',
        category: 'Core Benefit',
        rate: '₱1,850',
        unit: '/ staff / mo',
        description: 'Full medical and dental coverage for regular baristas and shift leads after 3 months.',
        enrolled: '36 Staff',
        enabled: true,
    },
    {
        id: 'floater',
        name: 'Cross-Branch Floater Stipend',
        category: 'Travel Allowance',
        rate: '₱250',
        unit: '/ shift',
        description: 'Automatic transit allowance whenever a barista covers a shift outside their home branch.',
        enrolled: '14 Floaters',
        enabled: true,
    },
    {
        id: 'meal',
        name: 'Shift Meal & Beverage Credit',
        category: 'Daily Perk',
        rate: '₱120',
        unit: '/ shift',
        description: 'Two complimentary espresso drinks and one meal allowance per 8-hour shopfloor shift.',
        enrolled: '42 Staff',
        enabled: true,
    },
    {
        id: 'closing',
        name: 'Late Closing Ride Allowance',
        category: 'Safety Perk',
        rate: '₱180',
        unit: '/ closing',
        description: 'Ride-share reimbursement for closing crew clocking out after 22:00.',
        enrolled: '18 Staff',
        enabled: true,
    },
]);

const selectedPolicyId = ref('floater');
const stipendAmount = ref(250);
const minShiftHours = ref(4);
const autoIncludePayroll = ref(true);

function notify(msg: string): void {
    actionMessage.value = msg;
    setTimeout(() => {
        if (actionMessage.value === msg) {
            actionMessage.value = '';
        }
    }, 3500);
}

function togglePolicy(policy: BenefitPolicy): void {
    policy.enabled = !policy.enabled;
    notify(`${policy.name} ${policy.enabled ? 'enabled' : 'paused'}.`);
}

function savePolicySettings(): void {
    const target = policies.value.find((p) => p.id === selectedPolicyId.value);
    if (target) {
        target.rate = `₱${stipendAmount.value}`;
        notify(`Saved changes to ${target.name} (₱${stipendAmount.value}).`);
    }
}
</script>

<template>
    <div class="space-y-6 max-w-7xl mx-auto pb-10">
        <!-- Feedback Toast -->
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
                        Company Perks &amp; Rules
                    </span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight">
                    Master Benefits &amp; Policy
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Manage staff benefits, shift allowances, and standard scheduling guardrails.
                </p>
            </div>

            <button
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start md:self-auto"
                @click="notify('Ready to create a new benefit policy.')"
            >
                <span class="material-symbols-outlined text-base">add</span>
                <span>Add Benefit Policy</span>
            </button>
        </div>

        <!-- ========================================================================= -->
        <!-- 4-CARD KPI STRIP                                                          -->
        <!-- ========================================================================= -->
        <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Monthly Benefits Spend</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱42,850</span>
                    <span class="text-xs font-mono-num text-[#5A5D64]">/ ₱50k</span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">Within monthly budget</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Enrolled Staff</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">42 / 46</span>
                    <span class="text-xs text-[#5A5D64]">team members</span>
                </div>
                <p class="text-xs text-[#5A5D64]">4 new hires in onboarding</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Floater Transit Pool</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#1F1F28]">₱4,680</span>
                    <span class="text-xs text-[#5A5D64]">this cycle</span>
                </div>
                <p class="text-xs text-[#5A5D64]">18 cross-branch shifts covered</p>
            </div>

            <div class="bg-white p-5 rounded-xl border border-[#DCD7CE] shadow-xs">
                <span class="text-xs font-headline font-bold text-[#5A5D64] uppercase tracking-wider">Minimum Rest Window</span>
                <div class="my-2.5 flex items-baseline gap-2">
                    <span class="text-3xl font-mono-num font-extrabold text-[#2D4F67]">12 hrs</span>
                    <span class="text-xs text-[#5A5D64]">between shifts</span>
                </div>
                <p class="text-xs text-[#475F3E] font-semibold">Blocks clopening swaps</p>
            </div>
        </section>

        <!-- ========================================================================= -->
        <!-- MAIN 12-COLUMN WORKSPACE                                                  -->
        <!-- ========================================================================= -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- LEFT 8 COLUMNS: BENEFIT CATALOG & CONFIGURATION -->
            <div class="lg:col-span-8 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
                    <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5] flex items-center justify-between">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Active Benefits &amp; Stipends</h2>
                            <p class="text-xs text-[#5A5D64] mt-0.5">Click any policy to adjust rates or eligibility</p>
                        </div>
                        <span class="text-xs font-mono-num text-[#5A5D64]">{{ policies.length }} Policies</span>
                    </div>

                    <div class="divide-y divide-[#E7E3DC]">
                        <div
                            v-for="policy in policies"
                            :key="policy.id"
                            :class="[
                                'p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer',
                                selectedPolicyId === policy.id ? 'bg-[#E6ECF0]/35' : 'hover:bg-[#FAF8F5]',
                            ]"
                            @click="selectedPolicyId = policy.id"
                        >
                            <div class="space-y-1 max-w-xl">
                                <div class="flex items-center gap-2.5">
                                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">{{ policy.name }}</h3>
                                    <span class="px-2 py-0.5 rounded text-[11px] font-headline font-semibold bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE]">
                                        {{ policy.category }}
                                    </span>
                                </div>
                                <p class="text-xs text-[#5A5D64] font-body leading-relaxed">
                                    {{ policy.description }}
                                </p>
                            </div>

                            <div class="flex items-center gap-5 shrink-0">
                                <div class="text-right">
                                    <div class="text-sm font-mono-num font-bold text-[#1F1F28]">
                                        {{ policy.rate }} <span class="text-[11px] font-normal text-[#5A5D64]">{{ policy.unit }}</span>
                                    </div>
                                    <div class="text-[11px] font-mono-num text-[#5A5D64]">{{ policy.enrolled }}</div>
                                </div>

                                <button
                                    type="button"
                                    :class="[
                                        'px-3 py-1 rounded-full text-xs font-headline font-bold transition-colors cursor-pointer',
                                        policy.enabled
                                            ? 'bg-[#EDF3EA] text-[#475F3E]'
                                            : 'bg-[#E7E3DC] text-[#5A5D64]',
                                    ]"
                                    @click.stop="togglePolicy(policy)"
                                >
                                    {{ policy.enabled ? 'Active' : 'Paused' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Quick Edit Panel -->
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6 space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-[#DCD7CE]">
                        <div>
                            <h2 class="text-base font-headline font-bold text-[#1F1F28]">Edit Allowance Rate</h2>
                            <p class="text-xs text-[#5A5D64]">Adjust payout amount and minimum shift length</p>
                        </div>
                        <button
                            type="button"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] transition-colors cursor-pointer"
                            @click="savePolicySettings"
                        >
                            Save Changes
                        </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                        <div>
                            <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1.5">
                                Allowance Amount (PHP)
                            </label>
                            <input
                                v-model.number="stipendAmount"
                                type="number"
                                class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] text-sm font-mono-num font-bold text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1.5">
                                Min Shift Duration (Hours)
                            </label>
                            <input
                                v-model.number="minShiftHours"
                                type="number"
                                class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] text-sm font-mono-num font-bold text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                            />
                        </div>
                        <div class="flex flex-col justify-end">
                            <label class="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] cursor-pointer">
                                <input
                                    v-model="autoIncludePayroll"
                                    type="checkbox"
                                    class="w-4 h-4 accent-[#2D4F67] rounded"
                                />
                                <span class="text-xs font-headline font-semibold text-[#1F1F28]">Auto-add to payroll tape</span>
                            </label>
                        </div>
                    </div>
                </section>
            </div>

            <!-- RIGHT 4 COLUMNS: BUDGET & SCHEDULING GUARDRAILS -->
            <div class="lg:col-span-4 flex flex-col gap-6">
                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-4">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Budget Allocation</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Current month utilization</p>
                    </div>

                    <div class="space-y-3.5">
                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Health &amp; Dental (HMO)</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱26,600</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#2D4F67] h-full rounded-full" style="width: 62%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Shift Meals &amp; Drinks</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱11,570</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#76946A] h-full rounded-full" style="width: 27%"></div>
                            </div>
                        </div>

                        <div>
                            <div class="flex justify-between text-xs mb-1">
                                <span class="font-headline font-semibold text-[#1F1F28]">Floater &amp; Closing Transit</span>
                                <span class="font-mono-num font-bold text-[#1F1F28]">₱4,680</span>
                            </div>
                            <div class="w-full h-2 bg-[#E7E3DC] rounded-full overflow-hidden">
                                <div class="bg-[#C0A36E] h-full rounded-full" style="width: 11%"></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-5 space-y-3">
                    <div class="pb-3 border-b border-[#DCD7CE]">
                        <h2 class="text-base font-headline font-bold text-[#1F1F28]">Shift Guardrails</h2>
                        <p class="text-xs text-[#5A5D64] mt-0.5">Applied automatically during shift swaps</p>
                    </div>

                    <div class="space-y-2.5 text-xs">
                        <div class="flex items-center justify-between py-2 border-b border-[#E7E3DC]">
                            <span class="text-[#5A5D64]">Standard Weekly Cap</span>
                            <span class="font-mono-num font-bold text-[#1F1F28]">40 Hours</span>
                        </div>
                        <div class="flex items-center justify-between py-2 border-b border-[#E7E3DC]">
                            <span class="text-[#5A5D64]">Rest Between Shifts</span>
                            <span class="font-mono-num font-bold text-[#1F1F28]">12 Hours Min</span>
                        </div>
                        <div class="flex items-center justify-between py-2 border-b border-[#E7E3DC]">
                            <span class="text-[#5A5D64]">Max Consecutive Days</span>
                            <span class="font-mono-num font-bold text-[#1F1F28]">6 Days</span>
                        </div>
                        <div class="flex items-center justify-between py-2">
                            <span class="text-[#5A5D64]">Peer Swap Notice</span>
                            <span class="font-mono-num font-bold text-[#1F1F28]">24 Hours Ahead</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>
</template>
