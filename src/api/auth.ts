import { apiFetch } from './client';
import type { User, Business } from '../types/api';

export interface AuthResponse {
    data: User;
    token: string;
}

export interface RegisterPayload {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    business_name: string;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AcceptInvitePayload {
    name: string;
    password: string;
    password_confirmation: string;
}

export const authApi = {
    async register(payload: RegisterPayload): Promise<AuthResponse> {
        return apiFetch<AuthResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async login(payload: LoginPayload): Promise<AuthResponse> {
        return apiFetch<AuthResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async logout(): Promise<void> {
        await apiFetch<void>('/auth/logout', {
            method: 'POST',
        });
    },

    async getCurrentUser(): Promise<{ data: User }> {
        return apiFetch<{ data: User }>('/auth/user');
    },

    async acceptInvitation(token: string, payload: AcceptInvitePayload): Promise<AuthResponse> {
        return apiFetch<AuthResponse>(`/invitations/${token}/accept`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};
