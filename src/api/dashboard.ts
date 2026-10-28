import { apiFetch } from './client';
import type { ManagerDashboardData, StaffDashboardData } from '../types/api';

export const dashboardApi = {
    async get(businessId: number): Promise<{ data: ManagerDashboardData | StaffDashboardData }> {
        return apiFetch<{ data: ManagerDashboardData | StaffDashboardData }>(`/businesses/${businessId}/dashboard`);
    },
};
