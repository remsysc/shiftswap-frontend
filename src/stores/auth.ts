import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type LoginPayload, type RegisterPayload, type AcceptInvitePayload } from '../api/auth';
import { registerUnauthorizedHandler } from '../api/client';
import type { User, Business, UserRole } from '../types/api';

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(localStorage.getItem('shiftswap_token'));
    const user = ref<User | null>(null);
    const isLoading = ref<boolean>(false);
    const isInitialized = ref<boolean>(false);

    const business = computed<Business | null>(() => user.value?.business || null);
    const businessId = computed<number | null>(() => business.value?.id || null);
    const role = computed<UserRole>(() => user.value?.role || 'staff');
    const isManagerOrOwner = computed<boolean>(() => role.value === 'owner' || role.value === 'manager');
    const isOwner = computed<boolean>(() => role.value === 'owner');
    const isAuthenticated = computed<boolean>(() => !!token.value);

    function setToken(newToken: string | null): void {
        token.value = newToken;
        if (newToken) {
            localStorage.setItem('shiftswap_token', newToken);
        } else {
            localStorage.removeItem('shiftswap_token');
        }
    }

    async function fetchUser(): Promise<User | null> {
        if (!token.value) {
            user.value = null;
            isInitialized.value = true;
            return null;
        }

        try {
            isLoading.value = true;
            const response = await authApi.getCurrentUser();
            const userData = (response as any)?.data || (response as any);
            user.value = userData;
            return userData;
        } catch (error) {
            setToken(null);
            user.value = null;
            return null;
        } finally {
            isLoading.value = false;
            isInitialized.value = true;
        }
    }

    async function login(payload: LoginPayload): Promise<void> {
        isLoading.value = true;
        try {
            const response = await authApi.login(payload);
            setToken(response.token);
            user.value = (response as any)?.data || (response as any);
        } finally {
            isLoading.value = false;
        }
    }

    async function register(payload: RegisterPayload): Promise<void> {
        isLoading.value = true;
        try {
            const response = await authApi.register(payload);
            setToken(response.token);
            user.value = (response as any)?.data || (response as any);
        } finally {
            isLoading.value = false;
        }
    }

    async function acceptInvite(inviteToken: string, payload: AcceptInvitePayload): Promise<void> {
        isLoading.value = true;
        try {
            const response = await authApi.acceptInvitation(inviteToken, payload);
            setToken(response.token);
            user.value = (response as any)?.data || (response as any);
        } finally {
            isLoading.value = false;
        }
    }

    async function logout(): Promise<void> {
        try {
            if (token.value) {
                await authApi.logout();
            }
        } catch {
            // ignore cleanup errors on logout
        } finally {
            setToken(null);
            user.value = null;
        }
    }

    registerUnauthorizedHandler(() => {
        setToken(null);
        user.value = null;
    });

    return {
        token,
        user,
        business,
        businessId,
        role,
        isManagerOrOwner,
        isOwner,
        isAuthenticated,
        isLoading,
        isInitialized,
        setToken,
        fetchUser,
        login,
        register,
        acceptInvite,
        logout,
    };
});
