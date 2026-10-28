<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ApiRequestError } from '../api/client';

const router = useRouter();
const authStore = useAuthStore();

const name = ref('');
const businessName = ref('');
const email = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const errorMessage = ref('');
const isSubmitting = ref(false);

async function handleRegister(): Promise<void> {
    errorMessage.value = '';

    if (password.value !== passwordConfirmation.value) {
        errorMessage.value = 'Passwords do not match.';
        return;
    }

    isSubmitting.value = true;

    try {
        await authStore.register({
            name: name.value,
            business_name: businessName.value,
            email: email.value,
            password: password.value,
            password_confirmation: passwordConfirmation.value,
        });

        router.push('/dashboard');
    } catch (err: any) {
        if (err instanceof ApiRequestError) {
            errorMessage.value = err.firstError;
        } else {
            errorMessage.value = err.message || 'Registration failed. Please try again.';
        }
    } finally {
        isSubmitting.value = false;
    }
}
</script>

<template>
    <div class="min-h-screen bg-[#f7f8fc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
            <div class="flex items-center justify-center gap-2 mb-2">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                    SS
                </div>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900 font-sans">ShiftSwap</h2>
            </div>
            <p class="text-center text-sm text-slate-600">Register your business and start scheduling in minutes</p>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
            <div class="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
                <div v-if="errorMessage" class="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                    {{ errorMessage }}
                </div>

                <form class="space-y-4" @submit.prevent="handleRegister">
                    <div>
                        <label for="name" class="block text-sm font-medium text-slate-700">Full name</label>
                        <div class="mt-1">
                            <input
                                id="name"
                                v-model="name"
                                type="text"
                                required
                                placeholder="Alice Santos"
                                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="business_name" class="block text-sm font-medium text-slate-700">Business / Store name</label>
                        <div class="mt-1">
                            <input
                                id="business_name"
                                v-model="businessName"
                                type="text"
                                required
                                placeholder="Artisan Bakery Co."
                                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="email" class="block text-sm font-medium text-slate-700">Work email</label>
                        <div class="mt-1">
                            <input
                                id="email"
                                v-model="email"
                                type="email"
                                required
                                placeholder="alice@artisanbakery.com"
                                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="password" class="block text-sm font-medium text-slate-700">Password</label>
                        <div class="mt-1">
                            <input
                                id="password"
                                v-model="password"
                                type="password"
                                required
                                minlength="8"
                                placeholder="••••••••"
                                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label for="password_confirmation" class="block text-sm font-medium text-slate-700">Confirm password</label>
                        <div class="mt-1">
                            <input
                                id="password_confirmation"
                                v-model="passwordConfirmation"
                                type="password"
                                required
                                minlength="8"
                                placeholder="••••••••"
                                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition text-sm"
                            />
                        </div>
                    </div>

                    <div class="pt-2">
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-60 transition"
                        >
                            <span v-if="isSubmitting">Creating business...</span>
                            <span v-else>Register Business</span>
                        </button>
                    </div>
                </form>

                <div class="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-600">
                    Already have an account?
                    <RouterLink to="/login" class="font-semibold text-indigo-600 hover:text-indigo-500">
                        Sign in
                    </RouterLink>
                </div>
            </div>
        </div>
    </div>
</template>
