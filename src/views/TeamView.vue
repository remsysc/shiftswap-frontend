<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { staffApi } from '../api/staff';
import { ApiRequestError } from '../api/client';
import type { BusinessMember, UserRole } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);
const isOwner = computed(() => authStore.isOwner);

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

const filteredMembers = computed(() => {
    if (!searchQuery.value) return members.value;
    const q = searchQuery.value.toLowerCase();
    return members.value.filter(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
});

async function loadMembers(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await staffApi.list(authStore.businessId);
        members.value = res.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load team members.';
    } finally {
        isLoading.value = false;
    }
}

async function handleInvite(): Promise<void> {
    if (!authStore.businessId) return;
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
    if (!authStore.businessId || member.role === newRole) return;
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
    if (!authStore.businessId || !successorEmail.value) return;
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
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Team Members</h1>
                <p class="text-sm text-slate-500 mt-0.5">Manage permissions, invite staff, and administer business roles</p>
            </div>

            <div class="flex items-center gap-2">
                <button
                    v-if="isOwner"
                    class="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs"
                    @click="showTransferModal = true"
                >
                    Transfer Ownership
                </button>
                <button
                    v-if="isManager"
                    class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                    @click="showInviteModal = true"
                >
                    + Invite Member
                </button>
            </div>
        </div>

        <!-- Alerts -->
        <div v-if="errorAlert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {{ errorAlert }}
        </div>
        <div v-if="successAlert" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {{ successAlert }}
        </div>

        <!-- Search Bar -->
        <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
            <input
                v-model="searchQuery"
                type="text"
                placeholder="Search team members by name or email..."
                class="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
        </div>

        <!-- Members Table -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div v-if="isLoading" class="p-8 text-center text-sm text-slate-500">
                Loading team members...
            </div>

            <div v-else-if="filteredMembers.length === 0" class="p-8 text-center text-sm text-slate-500">
                No team members found.
            </div>

            <div v-else class="divide-y divide-slate-100">
                <div
                    v-for="member in filteredMembers"
                    :key="member.id"
                    class="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                >
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {{ member.name.slice(0, 2).toUpperCase() }}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-slate-900">{{ member.name }}</p>
                            <p class="text-xs text-slate-500">{{ member.email }}</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <!-- Role Selector / Badge -->
                        <div v-if="isOwner && member.id !== authStore.user?.id">
                            <select
                                :value="member.role"
                                class="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                                @change="handleRoleChange(member, ($event.target as HTMLSelectElement).value as UserRole)"
                            >
                                <option value="staff">Staff</option>
                                <option value="manager">Manager</option>
                            </select>
                        </div>

                        <span
                            v-else
                            class="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700"
                        >
                            {{ member.role }}
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Invite Modal -->
        <div v-if="showInviteModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Invite Staff Member</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showInviteModal = false">✕</button>
                </div>

                <form class="space-y-4" @submit.prevent="handleInvite">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email Address</label>
                        <input
                            v-model="inviteEmail"
                            type="email"
                            required
                            placeholder="colleague@store.com"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div v-if="generatedInviteToken" class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <p class="font-bold text-slate-700">Invitation Link Generated:</p>
                        <code class="block mt-1 p-2 rounded bg-white border border-slate-200 text-slate-800 text-[11px] break-all">
                            /invitations/{{ generatedInviteToken }}/accept
                        </code>
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showInviteModal = false"
                        >
                            Close
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            {{ isSubmitting ? 'Sending...' : 'Send Invitation' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Transfer Ownership Modal -->
        <div v-if="showTransferModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">Transfer Business Ownership</h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showTransferModal = false">✕</button>
                </div>

                <p class="text-xs text-slate-500 leading-relaxed">
                    This will send a secure transfer invitation to an active team member. When accepted, you will be demoted to manager and they will become the sole business owner.
                </p>

                <form class="space-y-4" @submit.prevent="handleTransferOwnership">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Successor Email</label>
                        <input
                            v-model="successorEmail"
                            type="email"
                            required
                            placeholder="manager@store.com"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showTransferModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700"
                        >
                            Initiate Transfer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
