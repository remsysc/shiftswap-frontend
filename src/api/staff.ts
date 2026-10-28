import { apiFetch } from './client';
import type { BusinessMember, UserRole } from '../types/api';

export interface InviteStaffResponse {
    message: string;
    data: {
        token?: string;
        email: string;
        expires_at: string;
    };
}

export const staffApi = {
    async list(businessId: number): Promise<{ data: BusinessMember[] }> {
        return apiFetch<{ data: BusinessMember[] }>(`/businesses/${businessId}/staff`);
    },

    async invite(businessId: number, email: string): Promise<InviteStaffResponse> {
        return apiFetch<InviteStaffResponse>(`/businesses/${businessId}/staff`, {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    async updateRole(businessId: number, userId: number, role: UserRole): Promise<{ data: BusinessMember }> {
        return apiFetch<{ data: BusinessMember }>(`/businesses/${businessId}/staff/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role }),
        });
    },

    async initiateOwnershipTransfer(businessId: number, successorEmail: string): Promise<{ data: { token?: string } }> {
        return apiFetch<{ data: { token?: string } }>(`/businesses/${businessId}/ownership-transfer`, {
            method: 'POST',
            body: JSON.stringify({ successor_email: successorEmail }),
        });
    },

    async acceptOwnershipTransfer(token: string): Promise<void> {
        await apiFetch<void>(`/ownership-transfers/${token}/accept`, {
            method: 'POST',
        });
    },
};
