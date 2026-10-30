<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ApiRequestError } from '../api/client';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

async function handleLogin(): Promise<void> {
    errorMessage.value = '';
    isSubmitting.value = true;

    try {
        await authStore.login({
            email: email.value,
            password: password.value,
        });

        const redirect = (route.query.redirect as string) || '/dashboard';
        router.push(redirect);
    } catch (err: any) {
        if (err instanceof ApiRequestError) {
            errorMessage.value = err.firstError;
        } else {
            errorMessage.value = err.message || 'Login failed. Please check your credentials.';
        }
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen relative isolate bg-[#F2EFE9] text-[#1F1F28] font-body flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">
        <!-- Kanagawa Dotted Ocean Wave Background -->
        <div class="pointer-events-none fixed inset-0 overflow-hidden select-none z-0">
            <svg
                class="absolute inset-0 w-full h-full pointer-events-none select-none"
                fill="none"
                preserveAspectRatio="none"
                viewBox="0 0 1440 900"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <pattern id="loginTopoDots" width="28" height="28" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.2" fill="#2D4F67" fill-opacity="0.11" />
                    </pattern>
                    <linearGradient id="loginWaveGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#2D4F67" stop-opacity="0.14" />
                        <stop offset="50%" stop-color="#426E8B" stop-opacity="0.48" />
                        <stop offset="100%" stop-color="#BACEDD" stop-opacity="0.28" />
                    </linearGradient>
                    <linearGradient id="loginWaveGrad2" x1="0%" y1="100%" x2="100%" y2="10%">
                        <stop offset="0%" stop-color="#2D4F67" stop-opacity="0.18" />
                        <stop offset="60%" stop-color="#3E6583" stop-opacity="0.52" />
                        <stop offset="100%" stop-color="#76946A" stop-opacity="0.34" />
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#loginTopoDots)" />
                <g stroke="url(#loginWaveGrad1)" stroke-dasharray="2.5 6.5" stroke-linecap="round" stroke-width="1.8">
                    <path d="M-40,860 C320,870 560,780 840,810 C1080,835 1280,740 1480,760" />
                    <path d="M-40,820 C320,830 570,740 850,770 C1090,795 1290,695 1480,715" />
                    <path d="M-40,780 C310,790 580,700 860,730 C1100,755 1300,650 1480,670" />
                </g>
                <g stroke="url(#loginWaveGrad2)" stroke-dasharray="3 7" stroke-linecap="round" stroke-width="2.2">
                    <path d="M-40,660 C280,670 610,575 890,605 C1130,630 1330,515 1480,535" />
                    <path d="M-40,620 C270,630 620,530 900,560 C1140,585 1340,470 1480,490" />
                </g>
            </svg>
        </div>

        <div class="relative z-10 sm:mx-auto sm:w-full sm:max-w-md px-4">
            <div class="flex items-center justify-center gap-2.5 mb-2">
                <div class="w-10 h-10 rounded-lg bg-[#2D4F67] border border-[#3E6583] flex items-center justify-center text-white font-headline font-extrabold text-base shadow-sm">
                    SS
                </div>
                <div>
                    <h2 class="text-xl font-headline font-extrabold tracking-tight text-[#1F1F28] leading-none">
                        ShiftSwap
                    </h2>
                    <span class="text-[11px] font-headline font-semibold text-[#5A5D64]">
                        Shopfloor Atelier
                    </span>
                </div>
            </div>
            <p class="text-center text-xs text-[#5A5D64] mt-1">
                Sign in to your team schedule and shift boarding pass marketplace
            </p>
        </div>

        <div class="relative z-10 mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4">
            <div class="bg-white shadow-sm border border-[#DCD7CE] rounded-xl overflow-hidden">
                <div class="px-6 py-3.5 bg-[#FAF8F5] border-b border-[#DCD7CE] flex items-center justify-between">
                    <span class="font-headline text-xs font-bold text-[#1F1F28] flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-base text-[#2D4F67]">lock</span>
                        Operator Sign-In
                    </span>
                    <span class="text-[10px] font-headline font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#EAF0E8] text-[#76946A] border border-[#C9DBC2]">
                        Secure Session
                    </span>
                </div>

                <div class="p-6 sm:p-8">
                    <div
                        v-if="errorMessage"
                        class="mb-5 p-3.5 rounded-lg bg-[#FCECEC] border border-[#F3C5C6] text-[#C34043] text-xs font-medium flex items-center gap-2"
                    >
                        <span class="material-symbols-outlined text-base">error</span>
                        <span>{{ errorMessage }}</span>
                    </div>

                    <form class="space-y-4" @submit.prevent="handleLogin">
                        <div>
                            <label for="email" class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                                Work Email Address
                            </label>
                            <input
                                id="email"
                                v-model="email"
                                type="email"
                                autocomplete="email"
                                required
                                placeholder="you@company.com"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] placeholder-[#8A8D93] focus:outline-none focus:ring-2 focus:ring-[#2D4F67] transition text-xs"
                            />
                        </div>

                        <div>
                            <label for="password" class="block text-[11px] font-headline font-bold uppercase tracking-wider text-[#5A5D64] mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                v-model="password"
                                type="password"
                                autocomplete="current-password"
                                required
                                placeholder="••••••••"
                                class="w-full px-3.5 py-2.5 rounded-lg border border-[#DCD7CE] bg-white text-[#1F1F28] placeholder-[#8A8D93] focus:outline-none focus:ring-2 focus:ring-[#2D4F67] transition text-xs"
                            />
                        </div>

                        <div class="pt-1">
                            <button
                                type="submit"
                                :disabled="isSubmitting"
                                class="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg shadow-xs text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] focus:outline-none focus:ring-2 focus:ring-[#2D4F67] disabled:opacity-60 transition cursor-pointer"
                            >
                                <span v-if="isSubmitting">Signing in...</span>
                                <span v-else>Sign In to Workspace</span>
                            </button>
                        </div>
                    </form>

                    <div class="mt-6 pt-5 border-t border-[#DCD7CE] text-center text-xs text-[#5A5D64]">
                        Are you a business owner?
                        <RouterLink to="/register" class="font-headline font-bold text-[#2D4F67] hover:text-[#1F384C] ml-1">
                            Create a business workspace
                        </RouterLink>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
