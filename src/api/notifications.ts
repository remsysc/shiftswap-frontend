import { apiFetch } from './client';
import type { AppNotification } from '../types/api';

export const notificationsApi = {
    async list(businessId: number): Promise<{ data: AppNotification[] }> {
        return apiFetch<{ data: AppNotification[] }>(`/businesses/${businessId}/notifications`);
    },

    async markRead(businessId: number, notificationId: string): Promise<void> {
        await apiFetch<void>(`/businesses/${businessId}/notifications/${notificationId}/read`, {
            method: 'POST',
        });
    },

    async markAllRead(businessId: number): Promise<void> {
        await apiFetch<void>(`/businesses/${businessId}/notifications/read-all`, {
            method: 'POST',
        });
    },
};
