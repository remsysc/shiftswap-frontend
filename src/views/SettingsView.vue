<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const bannerNotice = ref('');

const businessName = ref(authStore.business?.name || 'Kape Artisan Roasters PH');
const timezone = ref(authStore.business?.timezone || 'Asia/Manila');

const preventShiftOverlap = ref(true);
const preventTimeOffConflict = ref(true);
const requireManagerSwapApproval = ref(true);
const lockSinglePendingSwapRequest = ref(true);

const notifyShiftAssigned = ref(true);
const notifySwapRequested = ref(true);
const notifySwapResolved = ref(true);
const notifyTimeOffStatus = ref(true);

function saveSettings(): void {
    bannerNotice.value = 'Workspace and shift conflict settings saved.';
    setTimeout(() => {
        bannerNotice.value = '';
    }, 3500);
}
</script>

<template>
    <div class="space-y-6 max-w-5xl mx-auto pb-10">
        <!-- Toast -->
        <div
            v-if="bannerNotice"
            class="rounded-xl border border-[#76946A]/40 bg-[#EDF3EA] px-4 py-3 text-xs text-[#475F3E] flex items-center justify-between"
        >
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-base text-[#76946A]">check_circle</span>
                <span class="font-semibold">{{ bannerNotice }}</span>
            </div>
            <button type="button" class="font-bold underline cursor-pointer" @click="bannerNotice = ''">Dismiss</button>
        </div>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#DCD7CE]">
            <div>
                <span class="px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67] uppercase tracking-wider">
                    Tenant Configuration
                </span>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight mt-1.5">
                    Company Settings
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Configure workspace timezone, shift overlap rules, swap approval workflow, and notifications.
                </p>
            </div>

            <button
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                @click="saveSettings"
            >
                <span class="material-symbols-outlined text-base">save</span>
                <span>Save Settings</span>
            </button>
        </div>

        <!-- Tenant Profile -->
        <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6 space-y-4">
            <div class="pb-3 border-b border-[#DCD7CE]">
                <h2 class="text-base font-headline font-bold text-[#1F1F28]">Workspace Profile</h2>
                <p class="text-xs text-[#5A5D64] mt-0.5">All shift dates and overnight boundaries are evaluated in your business timezone</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                    <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1.5">Business Name</label>
                    <input
                        v-model="businessName"
                        type="text"
                        class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] text-xs font-semibold text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                    />
                </div>
                <div>
                    <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1.5">Default Timezone</label>
                    <select
                        v-model="timezone"
                        class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] text-xs font-mono-num font-semibold text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                    >
                        <option value="Asia/Manila">Asia/Manila (UTC+08:00)</option>
                        <option value="Asia/Singapore">Asia/Singapore (UTC+08:00)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (UTC+09:00)</option>
                        <option value="UTC">UTC</option>
                    </select>
                </div>
            </div>
        </section>

        <!-- Core Scheduling & Swap Conflict Rules (PRD FR-12, FR-17, FR-18, FR-22) -->
        <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6 space-y-4">
            <div class="pb-3 border-b border-[#DCD7CE]">
                <h2 class="text-base font-headline font-bold text-[#1F1F28]">Scheduling &amp; Shift Swap Rules</h2>
                <p class="text-xs text-[#5A5D64] mt-0.5">Core conflict checks enforced when assigning or swapping shifts across locations</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                        <div class="text-xs font-headline font-bold text-[#1F1F28]">Block Overlapping Shifts</div>
                        <p class="text-[11px] text-[#5A5D64] mt-0.5">
                            Prevent a staff member from being assigned or swapped into overlapping shifts across any branch.
                        </p>
                    </div>
                    <input v-model="preventShiftOverlap" type="checkbox" class="w-4 h-4 accent-[#2D4F67] mt-0.5 shrink-0" />
                </label>

                <label class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                        <div class="text-xs font-headline font-bold text-[#1F1F28]">Block Approved Time-Off Conflicts</div>
                        <p class="text-[11px] text-[#5A5D64] mt-0.5">
                            Disallow shift assignments and swap requests on dates where the staff member has approved time off.
                        </p>
                    </div>
                    <input v-model="preventTimeOffConflict" type="checkbox" class="w-4 h-4 accent-[#2D4F67] mt-0.5 shrink-0" />
                </label>

                <label class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                        <div class="text-xs font-headline font-bold text-[#1F1F28]">Require Manager Approval on Swaps</div>
                        <p class="text-[11px] text-[#5A5D64] mt-0.5">
                            Peer swap requests remain in pending approval until a manager or owner approves the assignment change.
                        </p>
                    </div>
                    <input v-model="requireManagerSwapApproval" type="checkbox" class="w-4 h-4 accent-[#2D4F67] mt-0.5 shrink-0" />
                </label>

                <label class="p-4 rounded-xl bg-[#FAF8F5] border border-[#DCD7CE] flex items-start justify-between gap-3 cursor-pointer">
                    <div>
                        <div class="text-xs font-headline font-bold text-[#1F1F28]">Single Pending Request Lock</div>
                        <p class="text-[11px] text-[#5A5D64] mt-0.5">
                            Lock an offered shift while one swap request is pending approval; reopen if rejected.
                        </p>
                    </div>
                    <input v-model="lockSinglePendingSwapRequest" type="checkbox" class="w-4 h-4 accent-[#2D4F67] mt-0.5 shrink-0" />
                </label>
            </div>
        </section>

        <!-- Queued Notifications (PRD FR-27, FR-28) -->
        <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs p-6 space-y-4">
            <div class="pb-3 border-b border-[#DCD7CE]">
                <h2 class="text-base font-headline font-bold text-[#1F1F28]">Email &amp; In-App Notifications</h2>
                <p class="text-xs text-[#5A5D64] mt-0.5">Automatic notifications dispatched when schedules or requests change</p>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label class="flex items-center justify-between p-3.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">New Shift Assigned</span>
                    <input v-model="notifyShiftAssigned" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                </label>
                <label class="flex items-center justify-between p-3.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Shift Offered or Requested for Swap</span>
                    <input v-model="notifySwapRequested" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                </label>
                <label class="flex items-center justify-between p-3.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Swap Approved or Rejected</span>
                    <input v-model="notifySwapResolved" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                </label>
                <label class="flex items-center justify-between p-3.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer">
                    <span class="text-xs font-headline font-semibold text-[#1F1F28]">Time-Off Submitted or Reviewed</span>
                    <input v-model="notifyTimeOffStatus" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                </label>
            </div>
        </section>
    </div>
</template>
