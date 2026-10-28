<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
</script>

<template>
    <div class="space-y-6 max-w-2xl">
        <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">Workspace Settings</h1>
            <p class="text-sm text-slate-500 mt-0.5">Account preferences, business configuration, and API state</p>
        </div>

        <!-- Business Configuration Card -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h2 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Business Profile</h2>

            <div class="space-y-3 text-xs">
                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Business Name</span>
                    <p class="text-sm font-semibold text-slate-900 mt-0.5">{{ authStore.business?.name }}</p>
                </div>

                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Timezone</span>
                    <p class="text-sm font-semibold text-slate-900 mt-0.5">{{ authStore.business?.timezone || 'Asia/Manila' }}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">Governs shift boundary calculations and time-off windows</p>
                </div>

                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Business Tenant ID</span>
                    <p class="text-sm font-semibold text-slate-900 mt-0.5">#{{ authStore.business?.id }}</p>
                </div>
            </div>
        </div>

        <!-- User Profile Card -->
        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h2 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Your Account</h2>

            <div class="space-y-3 text-xs">
                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Full Name</span>
                    <p class="text-sm font-semibold text-slate-900 mt-0.5">{{ authStore.user?.name }}</p>
                </div>

                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Email Address</span>
                    <p class="text-sm font-semibold text-slate-900 mt-0.5">{{ authStore.user?.email }}</p>
                </div>

                <div>
                    <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Organization Role</span>
                    <p class="mt-1">
                        <span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                            {{ authStore.role }}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
