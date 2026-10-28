export type UserRole = 'owner' | 'manager' | 'staff';

export interface User {
    id: number;
    name: string;
    email: string;
    created_at?: string;
    role?: UserRole;
    business?: Business;
}

export interface Business {
    id: number;
    name: string;
    timezone: string;
    created_at?: string;
}

export interface BusinessMember {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    joined_at?: string;
}

export interface Location {
    id: number;
    business_id: number;
    name: string;
    address?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface ShiftStaffAssignment {
    id: number;
    user_id: number;
    status: 'assigned' | 'removed';
    user?: User;
}

export interface Shift {
    id: number;
    business_id: number;
    location_id: number | null;
    location?: Location | null;
    role_label: string;
    start_at: string;
    end_at: string;
    created_by: number;
    assigned_staff?: ShiftStaffAssignment[];
    created_at?: string;
    updated_at?: string;
}

export type SwapStatus = 'offered' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';

export interface ShiftSwap {
    id: number;
    business_id: number;
    shift_id: number;
    shift?: Shift;
    offered_by: User;
    requested_by?: User | null;
    status: SwapStatus;
    cancellation_reason?: string | null;
    notes?: string | null;
    manager_notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export type TimeOffStatus = 'pending' | 'approved' | 'rejected';

export interface TimeOffRequest {
    id: number;
    business_id: number;
    user?: User;
    start_date: string;
    end_date: string;
    reason?: string | null;
    status: TimeOffStatus;
    manager_notes?: string | null;
    conflicts?: Shift[];
    created_at?: string;
    updated_at?: string;
}

export interface AppNotification {
    id: string;
    type: string;
    data: Record<string, any>;
    read_at: string | null;
    created_at: string;
}

export interface ManagerDashboardData {
    upcoming_shifts: Shift[];
    pending_swaps_count: number;
    pending_time_off_count: number;
}

export interface StaffDashboardData {
    upcoming_shifts: Shift[];
    pending_time_off_requests: TimeOffRequest[];
    active_swaps: ShiftSwap[];
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
}
