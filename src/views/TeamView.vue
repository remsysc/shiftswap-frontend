<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { staffApi } from '../api/staff';
import { ApiRequestError } from '../api/client';
import type { BusinessMember, UserRole } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);
const isOwner = computed(() => authStore.isOwner);

// Mode switcher for the two Stitch Team/Authority screens
const activeMode = ref<'directory' | 'delegation'>('directory');
const selectedRoleFilter = ref<'all' | 'staff' | 'manager'>('all');
const selectedBenefitPackage = ref('all');

// Configure Employment Package inline drawer state
const activeConfigPartner = ref('');
const allowPto = ref(true);
const floaterStipendEnabled = ref(true);
const mealAllowanceEnabled = ref(true);
const nightDiffEnabled = ref(true);
const weekendSurgeEnabled = ref(false);

// Delegation sliders (From stitch_368.html)
const weeklyHoursCeiling = ref(44);
const otCostThreshold = ref(1500);

const members = ref<BusinessMember[]>([]);
const searchQuery = ref('');
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Modals
const showInviteModal = ref(false);
const showTransferModal = ref(false);
const inviteEmail = ref('');
const generatedInviteToken = ref('');
const successorEmail = ref('');
const isSubmitting = ref(false);

const totalMembersCount = computed(() => members.value.length);
const managersCount = computed(() => members.value.filter((m) => m.role === 'manager').length);
const staffCount = computed(() => members.value.filter((m) => m.role === 'staff').length);
const ownersCount = computed(() => members.value.filter((m) => m.role === 'owner').length);

const managersList = computed(() => {
    const list = members.value.filter((m) => m.role === 'manager' || m.role === 'owner');
    if (list.length > 0) {
        return list;
    }
    if (authStore.user) {
        return [
            {
                id: authStore.user.id,
                name: authStore.user.name,
                email: authStore.user.email,
                role: authStore.user.role,
                created_at: new Date().toISOString(),
            },
        ];
    }
    return [];
});

const filteredMembers = computed(() => {
    let result = members.value;
    if (selectedRoleFilter.value !== 'all') {
        result = result.filter((m) => m.role === selectedRoleFilter.value);
    }
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(
            (m) =>
                (m.name?.toLowerCase() || '').includes(q) ||
                (m.email?.toLowerCase() || '').includes(q)
        );
    }
    return result;
});

function initialsFrom(name?: string | null): string {
    if (!name) {
        return 'MB';
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
        return ((parts[0][0] ?? '') + (parts[1][0] ?? '')).toUpperCase();
    }
    return (parts[0] ?? 'MB').slice(0, 2).toUpperCase();
}

async function loadMembers(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await staffApi.list(authStore.businessId);
        members.value = res.data.map((m: any) => ({
            id: m.user?.id || m.id,
            name: m.name || m.user?.name || '',
            email: m.email || m.user?.email || '',
            role: m.role || m.user?.role || 'staff',
            created_at: m.created_at,
        }));
        if (!activeConfigPartner.value && members.value.length > 0) {
            activeConfigPartner.value = members.value[0].name;
        } else if (!activeConfigPartner.value && authStore.user?.name) {
            activeConfigPartner.value = authStore.user.name;
        }
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load team members.';
    } finally {
        isLoading.value = false;
    }
}

async function handleInvite(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
    errorAlert.value = '';
    generatedInviteToken.value = '';
    isSubmitting.value = true;

    try {
        const res = await staffApi.invite(authStore.businessId, inviteEmail.value);
        generatedInviteToken.value = res.data.token || '';
        successAlert.value = `Invitation sent to ${inviteEmail.value}.`;
        inviteEmail.value = '';
        await loadMembers();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to send invitation.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleRoleChange(member: BusinessMember, newRole: UserRole): Promise<void> {
    if (!authStore.businessId || member.role === newRole) {
        return;
    }
    errorAlert.value = '';

    try {
        await staffApi.updateRole(authStore.businessId, member.id, newRole);
        member.role = newRole;
        successAlert.value = `Updated role for ${member.name} to ${newRole}.`;
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to change role.';
        }
    }
}

async function handleTransferOwnership(): Promise<void> {
    if (!authStore.businessId || !successorEmail.value) {
        return;
    }
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        await staffApi.initiateOwnershipTransfer(authStore.businessId, successorEmail.value);
        showTransferModal.value = false;
        successorEmail.value = '';
        successAlert.value = 'Ownership transfer initiated. Successor will receive an acceptance link.';
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to initiate transfer.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadMembers();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadMembers();
    }
});
</script>

<template>
    <div class="space-y-5">
        <!-- Top Mode Switcher: Staff Directory & Contracts vs Managers & Delegation Controls -->
        <div class="bg-white border border-[#DCD7CE] rounded-xl p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 pl-1">
                <span class="material-symbols-outlined text-base text-[#2D4F67]">badge</span>
                <span class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#5A5D64]">
                    Workforce &amp; Governance:
                </span>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 bg-[#FAF8F5] p-1 rounded-lg border border-[#DCD7CE]">
                <button
                    type="button"
                    :class="[
                        activeMode === 'directory'
                            ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                            : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-headline transition-all cursor-pointer',
                    ]"
                    @click="activeMode = 'directory'"
                >
                    <span class="material-symbols-outlined text-sm">group</span>
                    <span>Staff Directory &amp; Contracts</span>
                </button>
                <button
                    type="button"
                    :class="[
                        activeMode === 'delegation'
                            ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                            : 'text-[#5A5D64] hover:text-[#1F1F28] font-semibold',
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-headline transition-all cursor-pointer',
                    ]"
                    @click="activeMode = 'delegation'"
                >
                    <span class="material-symbols-outlined text-sm">admin_panel_settings</span>
                    <span>Managers &amp; Delegation Authority</span>
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

        <!-- ========================================================================= -->
        <!-- MODE 1: STAFF DIRECTORY & CONTRACTS (From stitch_362.html)                -->
        <!-- ========================================================================= -->
        <div v-if="activeMode === 'directory'" class="space-y-5">
            <!-- Top Executive Metric Banner -->
            <section class="w-full bg-white border border-[#DCD7CE] rounded-xl p-5 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-2">
                        <span class="font-headline text-[10px] uppercase tracking-wider text-[#967B47] px-2.5 py-0.5 rounded-full bg-[#FAF3E8] border border-[#ECDDBF] font-bold">
                            Governance &amp; Compensation
                        </span>
                        <span class="text-[#8A8D93] text-xs">·</span>
                        <span class="text-xs font-headline text-[#5A5D64] font-semibold">{{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations' }}</span>
                    </div>
                    <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">
                        Staff Directory &amp; Contracts
                    </h1>
                    <div class="flex items-center gap-2 flex-wrap mt-1">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-xs font-headline text-[#1F1F28]">
                            <span class="w-2 h-2 rounded-full bg-[#2D4F67]"></span>
                            <strong class="font-mono-num">{{ totalMembersCount }}</strong> Active Workforce
                        </span>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-xs font-headline text-[#1F1F28]">
                            <span class="w-2 h-2 rounded-full bg-[#C0A36E]"></span>
                            <strong class="font-mono-num">{{ managersCount }}</strong> Managers
                        </span>
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-xs font-headline text-[#1F1F28]">
                            <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                            <strong class="font-mono-num">{{ staffCount }}</strong> Staff Members
                        </span>
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[11px] font-bold">
                            <span class="material-symbols-outlined text-xs">verified</span>
                            Database Synced
                        </span>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 self-start xl:self-center">
                    <button
                        v-if="isOwner"
                        type="button"
                        class="flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#FAF3E8] text-[#1F1F28] border border-[#DCD7CE] px-3.5 py-2 rounded-lg font-headline text-xs font-bold transition-all cursor-pointer"
                        @click="showTransferModal = true"
                    >
                        <span class="material-symbols-outlined text-base text-[#C0A36E]">admin_panel_settings</span>
                        <span>Transfer Ownership</span>
                    </button>
                    <button
                        type="button"
                        class="flex items-center gap-1.5 bg-[#FAF8F5] hover:bg-[#E6ECF0] text-[#1F1F28] border border-[#DCD7CE] px-3.5 py-2 rounded-lg font-headline text-xs font-bold transition-all cursor-pointer"
                        @click="successAlert = 'Staff Roster CSV exported.'"
                    >
                        <span class="material-symbols-outlined text-base text-[#2D4F67]">download</span>
                        <span>Export Policy</span>
                    </button>
                    <button
                        v-if="isManager"
                        type="button"
                        class="flex items-center gap-1.5 bg-[#2D4F67] hover:bg-[#1F384C] text-white px-4 py-2 rounded-lg font-headline text-xs font-bold shadow-xs transition-all cursor-pointer"
                        @click="showInviteModal = true"
                    >
                        <span class="material-symbols-outlined text-base">add</span>
                        <span>Add Staff</span>
                    </button>
                </div>
            </section>

            <!-- Filter & Search Strip -->
            <section class="w-full bg-white border border-[#DCD7CE] rounded-xl p-3.5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div class="flex items-center gap-1.5 overflow-x-auto">
                    <button
                        v-for="chip in [
                            { id: 'all', label: `All Workforce (${totalMembersCount})` },
                            { id: 'staff', label: `Staff (${staffCount})` },
                            { id: 'manager', label: `Managers (${managersCount})` },
                        ]"
                        :key="chip.id"
                        type="button"
                        :class="[
                            selectedRoleFilter === chip.id
                                ? 'bg-[#2D4F67] text-white font-bold shadow-2xs'
                                : 'bg-[#FAF8F5] text-[#5A5D64] hover:text-[#1F1F28] border border-[#DCD7CE] font-semibold',
                            'px-3 py-1.5 rounded-lg font-headline text-xs transition-all whitespace-nowrap cursor-pointer',
                        ]"
                        @click="selectedRoleFilter = chip.id as any"
                    >
                        {{ chip.label }}
                    </button>
                </div>

                <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div class="relative w-full sm:w-64">
                        <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5D64] text-base">search</span>
                        <input
                            v-model="searchQuery"
                            placeholder="Search staff by name or email..."
                            type="text"
                            class="w-full bg-[#FAF8F5] border border-[#DCD7CE] pl-8 pr-3 py-1.5 rounded-lg text-xs text-[#1F1F28] placeholder:text-[#8A8D93] focus:outline-none focus:bg-white focus:border-[#2D4F67]"
                        />
                    </div>
                    <select
                        v-model="selectedBenefitPackage"
                        class="bg-[#FAF8F5] border border-[#DCD7CE] text-[#1F1F28] font-headline text-xs font-semibold px-3 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                    >
                        <option value="all">All Benefit Packages</option>
                        <option value="standard">Standard Employment Package</option>
                        <option value="flex">Flexible Hour Package</option>
                    </select>
                    <button
                        type="button"
                        class="px-2.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] hover:text-[#1F1F28] cursor-pointer"
                        title="Reset"
                        @click="selectedRoleFilter = 'all'; searchQuery = ''"
                    >
                        <span class="material-symbols-outlined text-base">restart_alt</span>
                    </button>
                </div>
            </section>

            <!-- Split Grid: 8 Cols Main Matrix Deck + 4 Cols Guardrail Config Rail -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                <!-- Left 8 Cols: Employee Profile & Contract Matrix + Inline Configure Package Drawer -->
                <div class="lg:col-span-8 flex flex-col gap-4">
                    <!-- Live API Members (Synced with Backend) -->
                    <div v-if="filteredMembers.length === 0" class="bg-white border border-[#DCD7CE] rounded-xl p-8 text-center space-y-3">
                        <div class="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#DCD7CE] text-[#5A5D64] mx-auto flex items-center justify-center">
                            <span class="material-symbols-outlined text-2xl">group_off</span>
                        </div>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">No team members found</h3>
                        <p class="text-xs text-[#5A5D64] max-w-sm mx-auto">
                            {{ searchQuery ? 'Try adjusting your search filter or clear the query.' : 'There are currently no staff members registered in this business.' }}
                        </p>
                        <button
                            v-if="isManager"
                            type="button"
                            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2D4F67] text-white font-headline text-xs font-bold shadow-xs cursor-pointer"
                            @click="showInviteModal = true"
                        >
                            <span class="material-symbols-outlined text-sm">person_add</span>
                            <span>Invite Member</span>
                        </button>
                    </div>

                    <article
                        v-for="member in filteredMembers"
                        :key="member.id"
                        class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs hover:border-[#2D4F67] transition-all flex flex-col gap-3 relative overflow-hidden"
                    >
                        <div
                            :class="[
                                member.role === 'owner' ? 'bg-[#967B47]' : member.role === 'manager' ? 'bg-[#2D4F67]' : 'bg-[#76946A]',
                                'absolute left-0 top-0 bottom-0 w-1.5',
                            ]"
                        ></div>
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-2">
                            <div class="flex items-center gap-3">
                                <div
                                    :class="[
                                        member.role === 'owner'
                                            ? 'bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF]'
                                            : member.role === 'manager'
                                              ? 'bg-[#2D4F67] text-white'
                                              : 'bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]',
                                        'w-11 h-11 rounded-lg flex items-center justify-center font-headline text-sm font-extrabold shrink-0',
                                    ]"
                                >
                                    {{ initialsFrom(member.name) }}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <h3 class="font-headline text-sm font-extrabold text-[#1F1F28]">{{ member.name }}</h3>
                                        <span
                                            :class="[
                                                member.role === 'owner'
                                                    ? 'bg-[#FAF3E8] text-[#967B47] border border-[#ECDDBF]'
                                                    : member.role === 'manager'
                                                      ? 'bg-[#E6ECF0] text-[#2D4F67] border border-[#C5D4DF]'
                                                      : 'bg-[#FAF8F5] text-[#5A5D64] border border-[#DCD7CE]',
                                                'px-2 py-0.5 rounded font-headline text-[10px] font-bold uppercase',
                                            ]"
                                        >
                                            {{ member.role }}
                                        </span>
                                        <span class="font-mono-num text-[11px] text-[#8A8D93]">#EMP-{{ member.id }}</span>
                                    </div>
                                    <p class="text-xs text-[#5A5D64]">{{ member.email }}</p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <select
                                    v-if="isOwner && member.id !== authStore.user?.id"
                                    :value="member.role"
                                    class="text-xs font-headline font-bold px-3 py-1.5 rounded-lg border border-[#DCD7CE] bg-[#FAF8F5] text-[#1F1F28] cursor-pointer"
                                    @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value as UserRole)"
                                >
                                    <option value="staff">Staff</option>
                                    <option value="manager">Manager</option>
                                </select>
                                <button
                                    type="button"
                                    class="px-2.5 py-1 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] hover:bg-[#E6ECF0] text-[#2D4F67] font-headline text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                    @click="activeConfigPartner = member.name"
                                >
                                    <span class="material-symbols-outlined text-sm">tune</span>
                                    Configure Benefits
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#FAF8F5] border border-[#E7E3DC] p-3 rounded-lg ml-2">
                            <div>
                                <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Role Access</p>
                                <p class="font-headline text-xs font-extrabold capitalize text-[#1F1F28] mt-0.5">{{ member.role }}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Standard Cap</p>
                                <p class="font-mono-num text-sm font-extrabold text-[#1F1F28]">40.0h/wk</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Account Status</p>
                                <p class="font-headline text-xs font-extrabold text-[#76946A] mt-0.5">Active</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-headline uppercase text-[#5A5D64]">PTO Eligible</p>
                                <p class="font-mono-num text-sm font-extrabold text-[#2D4F67]">Standard</p>
                            </div>
                        </div>
                    </article>

                    <!-- Interactive Inline Drawer: Configure Employment Package (From stitch_362.html) -->
                    <section class="bg-white rounded-xl p-5 shadow-xs border border-[#2D4F67]/30 flex flex-col gap-4">
                        <div class="flex items-center justify-between pb-3 border-b border-[#DCD7CE]">
                            <div class="flex items-center gap-3">
                                <div class="w-9 h-9 rounded-lg bg-[#2D4F67] text-white flex items-center justify-center">
                                    <span class="material-symbols-outlined text-lg">tune</span>
                                </div>
                                <div>
                                    <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">
                                        Configure Employment Package · {{ activeConfigPartner }}
                                    </h2>
                                    <p class="text-xs text-[#5A5D64]">
                                        Customized leave, stipends, and differential overrides for contract
                                    </p>
                                </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[10px] font-bold">
                                Active FT Override
                            </span>
                        </div>

                        <!-- 1. Paid Leave Governance -->
                        <div class="bg-[#FAF8F5] border border-[#E7E3DC] p-4 rounded-xl space-y-3">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base text-[#2D4F67]">beach_access</span>
                                    <h3 class="font-headline text-xs font-extrabold text-[#1F1F28]">1. Paid Leave Governance &amp; Vacation Policy</h3>
                                </div>
                                <label class="inline-flex items-center gap-2 cursor-pointer">
                                    <input v-model="allowPto" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                    <span class="font-headline text-xs font-bold text-[#1F1F28]">Allow Paid Leave (PTO)</span>
                                </label>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="bg-white border border-[#DCD7CE] p-3 rounded-lg">
                                    <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Annual Vacation PTO</p>
                                    <p class="font-mono-num text-sm font-extrabold text-[#1F1F28] mt-0.5">12.0 Days / Year</p>
                                    <span class="text-[10px] text-[#76946A] font-semibold">Accrues 1.0d monthly</span>
                                </div>
                                <div class="bg-white border border-[#DCD7CE] p-3 rounded-lg">
                                    <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Paid Sick Leave Quota</p>
                                    <p class="font-mono-num text-sm font-extrabold text-[#1F1F28] mt-0.5">5.0 Days / Year</p>
                                    <span class="text-[10px] text-[#5A5D64]">Company standard</span>
                                </div>
                                <div class="bg-white border border-[#DCD7CE] p-3 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p class="text-[10px] font-headline uppercase text-[#5A5D64]">Unused PTO Rollover</p>
                                        <p class="font-mono-num text-sm font-extrabold text-[#1F1F28] mt-0.5">Up to 5 Days</p>
                                    </div>
                                    <span class="material-symbols-outlined text-[#76946A]">check_circle</span>
                                </div>
                            </div>
                        </div>

                        <!-- 2. Stipends & Shift Differentials -->
                        <div class="bg-[#FAF8F5] border border-[#E7E3DC] p-4 rounded-xl space-y-3">
                            <div class="flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">payments</span>
                                <h3 class="font-headline text-xs font-extrabold text-[#1F1F28]">2. Stipends &amp; Shift Differentials</h3>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <label class="p-3 bg-white border border-[#DCD7CE] rounded-lg flex items-center justify-between cursor-pointer">
                                    <div>
                                        <p class="font-headline text-xs font-bold text-[#1F1F28]">Cross-Branch Floater Stipend</p>
                                        <p class="font-mono-num text-[11px] text-[#5A5D64]">₱120 per cross-branch shift</p>
                                    </div>
                                    <input v-model="floaterStipendEnabled" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                                <label class="p-3 bg-white border border-[#DCD7CE] rounded-lg flex items-center justify-between cursor-pointer">
                                    <div>
                                        <p class="font-headline text-xs font-bold text-[#1F1F28]">Daily Meal Allowance</p>
                                        <p class="font-mono-num text-[11px] text-[#5A5D64]">₱150 per verified duty day</p>
                                    </div>
                                    <input v-model="mealAllowanceEnabled" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                                <label class="p-3 bg-white border border-[#DCD7CE] rounded-lg flex items-center justify-between cursor-pointer">
                                    <div>
                                        <p class="font-headline text-xs font-bold text-[#1F1F28]">Night Differential (ND)</p>
                                        <p class="font-mono-num text-[11px] text-[#5A5D64]">+10% during 22:00–06:00</p>
                                    </div>
                                    <input v-model="nightDiffEnabled" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                                <label class="p-3 bg-white border border-[#DCD7CE] rounded-lg flex items-center justify-between cursor-pointer">
                                    <div>
                                        <p class="font-headline text-xs font-bold text-[#1F1F28]">Weekend Surge Premium</p>
                                        <p class="font-mono-num text-[11px] text-[#5A5D64]">₱200/shift bonus</p>
                                    </div>
                                    <input v-model="weekendSurgeEnabled" type="checkbox" class="w-4 h-4 accent-[#2D4F67]" />
                                </label>
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <button
                                type="button"
                                class="text-xs font-headline font-semibold text-[#5A5D64] hover:text-[#C34043] cursor-pointer"
                                @click="allowPto = true; floaterStipendEnabled = true; mealAllowanceEnabled = true; nightDiffEnabled = true; weekendSurgeEnabled = false"
                            >
                                Reset to Default
                            </button>
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    class="px-3.5 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] font-headline text-xs font-bold text-[#1F1F28] cursor-pointer"
                                    @click="successAlert = 'Applied as FT Lead Standard Template.'"
                                >
                                    Apply as FT Lead Template
                                </button>
                                <button
                                    type="button"
                                    class="px-4 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold shadow-xs cursor-pointer"
                                    @click="successAlert = `Saved customized employment package for ${activeConfigPartner}.`"
                                >
                                    Save Employee Package
                                </button>
                            </div>
                        </div>
                    </section>
                </div>

                <!-- Right 4 Cols: Benefits Budget, Employment Rules, Certifications, Weekly Labor Health -->
                <aside class="lg:col-span-4 flex flex-col gap-4">
                    <section class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base text-[#2D4F67]">account_balance_wallet</span>
                                <h2 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">Benefits Budget</h2>
                            </div>
                            <span class="px-2 py-0.5 rounded-full bg-[#FAF3E8] text-[#967B47] font-mono-num text-[10px] font-bold">Cycle #24</span>
                        </div>
                        <div class="p-3 bg-[#FAF8F5] border border-[#E7E3DC] rounded-lg space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-[#5A5D64]">Monthly Allocated Pool</span>
                                <span class="font-mono-num text-sm font-extrabold text-[#2D4F67]">₱24,600 <span class="text-[11px] font-normal text-[#5A5D64]">/ ₱30k</span></span>
                            </div>
                            <div class="w-full bg-[#E7E3DC] h-2 rounded-full overflow-hidden">
                                <div class="bg-[#2D4F67] h-full rounded-full" style="width: 82%"></div>
                            </div>
                            <div class="flex items-center justify-between text-[11px] text-[#5A5D64]">
                                <span>PTO Allowed: <strong class="font-mono-num text-[#1F1F28]">8 / 15</strong></span>
                                <span>HMO Covered: <strong class="font-mono-num text-[#1F1F28]">11 / 15</strong></span>
                            </div>
                        </div>
                        <div class="space-y-1.5 text-xs text-[#5A5D64]">
                            <div class="flex justify-between"><span>Meal Allowances</span><span class="font-mono-num font-bold text-[#1F1F28]">₱12,750</span></div>
                            <div class="flex justify-between"><span>Floater Hopper Stipends</span><span class="font-mono-num font-bold text-[#1F1F28]">₱4,800</span></div>
                            <div class="flex justify-between"><span>Night Shift Differentials</span><span class="font-mono-num font-bold text-[#1F1F28]">₱7,050</span></div>
                        </div>
                    </section>

                    <section class="bg-white border border-[#DCD7CE] rounded-xl p-4 shadow-xs flex flex-col gap-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-base text-[#76946A]">verified</span>
                                <h2 class="font-headline text-xs font-extrabold uppercase tracking-wider text-[#1F1F28]">Certifications</h2>
                            </div>
                            <span class="px-2 py-0.5 rounded-full bg-[#EAF0E8] text-[#76946A] font-headline text-[10px] font-bold">100% Core</span>
                        </div>
                        <div class="space-y-1.5 text-xs text-[#5A5D64]">
                            <div class="flex justify-between"><span>Barista L1 / Register</span><span class="font-mono-num font-bold text-[#1F1F28]">15 / 15</span></div>
                            <div class="flex justify-between"><span>Espresso L2 Lead</span><span class="font-mono-num font-bold text-[#1F1F28]">7 / 15</span></div>
                            <div class="flex justify-between"><span>Q-Grader / Roaster</span><span class="font-mono-num font-bold text-[#1F1F28]">2 / 15</span></div>
                        </div>
                    </section>

                    <section class="bg-[#2D4F67] text-white rounded-xl p-4 shadow-xs flex flex-col justify-between gap-3">
                        <div>
                            <span class="text-[10px] font-headline font-bold uppercase tracking-widest text-[#A3B8C8]">Weekly Labor Health</span>
                            <h3 class="font-mono-num text-xl font-extrabold mt-0.5">540 Station Hours</h3>
                            <p class="text-xs text-[#DCD7BA]">0 Overtime Violations</p>
                        </div>
                        <div class="flex items-center justify-between pt-2 border-t border-white/15 text-xs">
                            <span class="flex items-center gap-1.5 font-headline font-bold">
                                <span class="w-2 h-2 rounded-full bg-[#76946A]"></span>
                                Safe Envelope
                            </span>
                            <span class="font-mono-num text-[#A3B8C8]">Cycle #24</span>
                        </div>
                    </section>
                </aside>
            </div>
        </div>

        <!-- ========================================================================= -->
        <!-- MODE 2: MANAGERS & DELEGATION AUTHORITY MATRIX (From stitch_368.html)     -->
        <!-- ========================================================================= -->
        <div v-else class="space-y-5">
            <!-- Header -->
            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-3 border-b border-[#DCD7CE]">
                <div>
                    <div class="flex items-center gap-2 text-[11px] font-headline font-bold uppercase tracking-widest text-[#5A5D64]">
                        <span>Executive Oversight</span>
                        <span>/</span>
                        <span class="text-[#2D4F67]">Delegation &amp; Governance Matrix</span>
                    </div>
                    <div class="flex items-center gap-2.5 mt-1">
                        <h1 class="font-headline text-xl font-extrabold text-[#1F1F28] tracking-tight">
                            Managers &amp; Delegation Controls
                        </h1>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2] font-headline text-[10px] font-bold uppercase">
                            <span class="w-1.5 h-1.5 rounded-full bg-[#76946A]"></span>
                            Governance Active
                        </span>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        class="px-3.5 py-1.5 rounded-lg bg-[#2D4F67] hover:bg-[#1F384C] text-white font-headline text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        @click="showInviteModal = true"
                    >
                        <span class="material-symbols-outlined text-sm">add_moderator</span>
                        <span>+ Grant Custom Authority</span>
                    </button>
                </div>
            </div>

            <!-- Dynamic Branch Manager Authority Cards -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div
                    v-for="mgr in managersList"
                    :key="mgr.id"
                    class="rounded-xl bg-white border border-[#DCD7CE] p-4 shadow-xs flex flex-col justify-between gap-4"
                >
                    <div class="space-y-3">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-11 h-11 rounded-lg bg-[#2D4F67] text-white flex items-center justify-center font-headline text-sm font-extrabold shrink-0">
                                    {{ initialsFrom(mgr.name) }}
                                </div>
                                <div>
                                    <div class="flex items-center gap-1">
                                        <span class="font-headline text-sm font-bold text-[#1F1F28]">{{ mgr.name }}</span>
                                        <span class="material-symbols-outlined text-sm text-[#76946A]">verified</span>
                                    </div>
                                    <span class="text-xs text-[#5A5D64] block">{{ mgr.role === 'owner' ? 'Owner / Primary' : 'Store Manager' }} · {{ authStore.selectedLocation ? authStore.selectedLocation.name : 'All Locations' }}</span>
                                </div>
                            </div>
                            <span class="px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] font-headline text-[10px] font-bold uppercase">
                                Active
                            </span>
                        </div>

                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between text-xs">
                            <span class="text-[#5A5D64]">OT Cap: <strong class="font-mono-num text-[#1F1F28]">₱5,000</strong></span>
                            <span class="font-mono-num font-bold text-[#967B47]">Standard Limit</span>
                        </div>

                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between py-1.5 px-2.5 rounded bg-[#FAF8F5] text-xs">
                                <span class="text-[#1F1F28]">Autonomous Swaps &amp; Coverage</span>
                                <span class="bg-[#EAF0E8] text-[#76946A] px-2 py-0.5 rounded font-headline text-[10px] font-bold">Granted</span>
                            </div>
                            <div class="flex items-center justify-between py-1.5 px-2.5 rounded bg-[#FAF8F5] text-xs">
                                <span class="text-[#1F1F28]">Time-Off &amp; Leave Approvals</span>
                                <span class="bg-[#EAF0E8] text-[#76946A] px-2 py-0.5 rounded font-headline text-[10px] font-bold">Granted</span>
                            </div>
                            <div class="flex items-center justify-between py-1.5 px-2.5 rounded bg-[#FAF8F5] text-xs">
                                <span class="text-[#1F1F28]">Overtime Cost Waiver</span>
                                <span class="bg-[#FAF3E8] text-[#967B47] px-2 py-0.5 rounded font-headline text-[10px] font-bold">Escalates</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 pt-2 border-t border-[#E7E3DC]">
                        <button
                            type="button"
                            class="flex-1 py-1.5 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] font-headline text-xs font-bold text-[#1F1F28] cursor-pointer"
                            @click="successAlert = `Viewing delegation history for ${mgr.name}.`"
                        >
                            History
                        </button>
                        <button
                            type="button"
                            class="flex-1 py-1.5 rounded-lg bg-[#2D4F67] text-white font-headline text-xs font-bold cursor-pointer"
                            @click="successAlert = `Delegation rules updated for ${mgr.name}.`"
                        >
                            Edit Rules
                        </button>
                    </div>
                </div>
            </div>

            <!-- Escalation Policy & Thresholds + Live Delegation Audit Log -->
            <div class="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div class="xl:col-span-7 bg-white border border-[#DCD7CE] rounded-xl p-5 shadow-xs space-y-4">
                    <div>
                        <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">Escalation Policy &amp; Shift Thresholds</h2>
                        <p class="text-xs text-[#5A5D64]">Hard stop triggers that mandate Owner 1-Tap sign-off or block manager override.</p>
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-headline text-xs font-bold text-[#1F1F28]">Weekly Hours Escalation Ceiling</span>
                            <span class="font-mono-num text-sm font-extrabold text-[#2D4F67]">{{ weeklyHoursCeiling }}.0 hrs/wk</span>
                        </div>
                        <input
                            v-model="weeklyHoursCeiling"
                            type="range"
                            min="36"
                            max="48"
                            step="1"
                            class="w-full accent-[#2D4F67] cursor-pointer"
                        />
                    </div>

                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span class="font-headline text-xs font-bold text-[#1F1F28]">Owner Sign-off OT Cost Threshold</span>
                            <span class="font-mono-num text-sm font-extrabold text-[#967B47]">₱{{ otCostThreshold }} / request</span>
                        </div>
                        <input
                            v-model="otCostThreshold"
                            type="range"
                            min="500"
                            max="3000"
                            step="100"
                            class="w-full accent-[#C0A36E] cursor-pointer"
                        />
                    </div>
                </div>

                <div class="xl:col-span-5 bg-white border border-[#DCD7CE] rounded-xl p-5 shadow-xs space-y-3">
                    <div class="flex items-center justify-between">
                        <h2 class="font-headline text-sm font-extrabold text-[#1F1F28]">Live Delegation Audit Log</h2>
                        <span class="font-mono-num text-xs text-[#5A5D64]">Cycle #24</span>
                    </div>
                    <div class="space-y-2 text-xs">
                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between">
                            <span><strong>{{ managersList[0]?.name || 'Store Manager' }}</strong> approved floater coverage • Recent</span>
                            <span class="px-2 py-0.5 rounded bg-white border border-[#DCD7CE] text-[10px] font-bold">Compliant</span>
                        </div>
                        <div class="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E7E3DC] flex items-center justify-between">
                            <span><strong>{{ managersList[1]?.name || managersList[0]?.name || 'Store Manager' }}</strong> updated delegation policy • Recent</span>
                            <span class="px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] text-[10px] font-bold">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Invite Modal -->
        <div
            v-if="showInviteModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#2D4F67]">person_add</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Invite Staff Member</h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showInviteModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleInvite">
                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Work Email Address
                        </label>
                        <input
                            v-model="inviteEmail"
                            type="email"
                            required
                            placeholder="colleague@store.com"
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        />
                    </div>

                    <div v-if="generatedInviteToken" class="p-3 rounded-lg bg-[#FAF8F5] border border-[#DCD7CE] text-xs space-y-1">
                        <p class="font-headline font-bold text-[#1F1F28]">Invitation Link Generated:</p>
                        <code class="block p-2 rounded bg-white border border-[#DCD7CE] text-[#2D4F67] font-mono-num text-[11px] break-all">
                            /invitations/{{ generatedInviteToken }}/accept
                        </code>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD7CE]">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer"
                            @click="showInviteModal = false"
                        >
                            Close
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-xs cursor-pointer"
                        >
                            {{ isSubmitting ? 'Sending...' : 'Send Invitation' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Transfer Ownership Modal -->
        <div
            v-if="showTransferModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/75 backdrop-blur-xs"
        >
            <div class="bg-white rounded-xl max-w-sm w-full shadow-2xl border border-[#DCD7CE] overflow-hidden">
                <div class="px-5 py-4 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined text-lg text-[#C0A36E]">admin_panel_settings</span>
                        <h3 class="font-headline text-sm font-bold text-[#1F1F28]">Transfer Business Ownership</h3>
                    </div>
                    <button
                        class="w-7 h-7 rounded-lg text-[#5A5D64] hover:text-[#1F1F28] hover:bg-[#E6ECF0] flex items-center justify-center cursor-pointer"
                        @click="showTransferModal = false"
                    >
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleTransferOwnership">
                    <p class="text-xs text-[#5A5D64] leading-relaxed bg-[#FAF3E8] p-3 rounded-lg border border-[#ECDDBF]">
                        This sends a secure transfer invitation to an active team member. When accepted, you will transition to Manager and they will become the sole Business Owner.
                    </p>

                    <div>
                        <label class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                            Successor Email
                        </label>
                        <input
                            v-model="successorEmail"
                            type="email"
                            required
                            placeholder="manager@store.com"
                            class="w-full text-xs px-3 py-2 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] focus:outline-none focus:ring-2 focus:ring-[#2D4F67]"
                        />
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#DCD7CE]">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] hover:bg-[#FAF8F5] border border-[#DCD7CE] cursor-pointer"
                            @click="showTransferModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#C34043] hover:bg-[#A33033] shadow-xs cursor-pointer"
                        >
                            Initiate Transfer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
