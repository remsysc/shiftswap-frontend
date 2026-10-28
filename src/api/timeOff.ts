import { apiFetch } from './client';
import type { TimeOffRequest, Shift } from '../types/api';

export interface CreateTimeOffPayload {
    start_date: string;
    end_date: string;
    reason?: string;
}

export interface TimeOffDetailResponse {
    data: TimeOffRequest;
    conflicts: Shift[];
}

export const timeOffApi = {
    async list(businessId: number, status?: string, userId?: number): Promise<{ data: TimeOffRequest[] }> {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (userId) params.append('user_id', String(userId));
        const query = params.toString() ? `?${params.toString()}` : '';

        return apiFetch<{ data: TimeOffRequest[] }>(`/businesses/${businessId}/time-off-requests${query}`);
    },

    async create(businessId: number, payload: CreateTimeOffPayload): Promise<{ data: TimeOffRequest }> {
        return apiFetch<{ data: TimeOffRequest }>(`/businesses/${businessId}/time-off-requests`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async get(businessId: number, requestId: number): Promise<TimeOffDetailResponse> {
        return apiFetch<TimeOffDetailResponse>(`/businesses/${businessId}/time-off-requests/${requestId}`);
    },

    async approve(businessId: number, requestId: number, managerNotes?: string): Promise<{ data: TimeOffRequest }> {
        return apiFetch<{ data: TimeOffRequest }>(`/businesses/${businessId}/time-off-requests/${requestId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ manager_notes: managerNotes }),
        });
    },

    async reject(businessId: number, requestId: number, managerNotes?: string): Promise<{ data: TimeOffRequest }> {
        return apiFetch<{ data: TimeOffRequest }>(`/businesses/${businessId}/time-off-requests/${requestId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ manager_notes: managerNotes }),
        });
    },
};
