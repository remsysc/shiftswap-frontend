import { apiFetch } from './client';
import type { ShiftSwap, SwapStatus } from '../types/api';

export interface OfferSwapPayload {
    shift_id: number;
    notes?: string;
}

export const swapsApi = {
    async listSwaps(businessId: number, status?: SwapStatus): Promise<{ data: ShiftSwap[] }> {
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return apiFetch<{ data: ShiftSwap[] }>(`/businesses/${businessId}/shift-swaps${query}`);
    },

    async offerSwap(businessId: number, payload: OfferSwapPayload): Promise<{ data: ShiftSwap }> {
        return apiFetch<{ data: ShiftSwap }>(`/businesses/${businessId}/shift-swaps`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async requestSwap(businessId: number, swapId: number): Promise<{ data: ShiftSwap }> {
        return apiFetch<{ data: ShiftSwap }>(`/businesses/${businessId}/shift-swaps/${swapId}/request`, {
            method: 'POST',
        });
    },

    async approveSwap(businessId: number, swapId: number, managerNotes?: string): Promise<{ data: ShiftSwap }> {
        return apiFetch<{ data: ShiftSwap }>(`/businesses/${businessId}/shift-swaps/${swapId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ manager_notes: managerNotes }),
        });
    },

    async rejectSwap(businessId: number, swapId: number, managerNotes?: string): Promise<{ data: ShiftSwap }> {
        return apiFetch<{ data: ShiftSwap }>(`/businesses/${businessId}/shift-swaps/${swapId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ manager_notes: managerNotes }),
        });
    },

    async cancelSwap(businessId: number, swapId: number, reason?: string): Promise<{ data: ShiftSwap }> {
        return apiFetch<{ data: ShiftSwap }>(`/businesses/${businessId}/shift-swaps/${swapId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ cancellation_reason: reason }),
        });
    },
};
