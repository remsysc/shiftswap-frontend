import { apiFetch } from './client';
import type { Shift, ShiftStaffAssignment } from '../types/api';

export interface CreateShiftPayload {
    location_id?: number | null;
    role_label: string;
    start_at: string;
    end_at: string;
}

export interface UpdateShiftPayload {
    location_id?: number | null;
    role_label?: string;
    start_at?: string;
    end_at?: string;
}

export const shiftsApi = {
    async listShifts(businessId: number, startDate: string, endDate: string): Promise<{ data: Shift[] }> {
        return apiFetch<{ data: Shift[] }>(
            `/businesses/${businessId}/shifts?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
        );
    },

    async createShift(businessId: number, payload: CreateShiftPayload): Promise<{ data: Shift }> {
        return apiFetch<{ data: Shift }>(`/businesses/${businessId}/shifts`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async updateShift(businessId: number, shiftId: number, payload: UpdateShiftPayload): Promise<{ data: Shift }> {
        return apiFetch<{ data: Shift }>(`/businesses/${businessId}/shifts/${shiftId}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },

    async deleteShift(businessId: number, shiftId: number): Promise<void> {
        await apiFetch<void>(`/businesses/${businessId}/shifts/${shiftId}`, {
            method: 'DELETE',
        });
    },

    async assignStaff(businessId: number, shiftId: number, userId: number): Promise<{ data: ShiftStaffAssignment }> {
        return apiFetch<{ data: ShiftStaffAssignment }>(`/businesses/${businessId}/shifts/${shiftId}/staff`, {
            method: 'POST',
            body: JSON.stringify({ user_id: userId }),
        });
    },

    async removeStaff(businessId: number, shiftId: number, userId: number): Promise<void> {
        await apiFetch<void>(`/businesses/${businessId}/shifts/${shiftId}/staff/${userId}`, {
            method: 'DELETE',
        });
    },
};
