import { apiFetch } from './client';
import type { Location } from '../types/api';

export interface CreateLocationPayload {
    name: string;
    address?: string | null;
}

export interface UpdateLocationPayload {
    name: string;
    address?: string | null;
}

export const locationsApi = {
    async list(businessId: number): Promise<{ data: Location[] }> {
        return apiFetch<{ data: Location[] }>(`/businesses/${businessId}/locations`);
    },

    async create(businessId: number, payload: CreateLocationPayload): Promise<{ data: Location }> {
        return apiFetch<{ data: Location }>(`/businesses/${businessId}/locations`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    async update(businessId: number, locationId: number, payload: UpdateLocationPayload): Promise<{ data: Location }> {
        return apiFetch<{ data: Location }>(`/businesses/${businessId}/locations/${locationId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    async delete(businessId: number, locationId: number): Promise<void> {
        await apiFetch<void>(`/businesses/${businessId}/locations/${locationId}`, {
            method: 'DELETE',
        });
    },
};
