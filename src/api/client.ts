import type { ApiError } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

export class ApiRequestError extends Error {
    constructor(
        public status: number,
        public errorData: ApiError
    ) {
        super(errorData.message || `Request failed with status ${status}`);
        this.name = 'ApiRequestError';
    }

    get errors(): Record<string, string[]> | undefined {
        return this.errorData.errors;
    }

    get firstError(): string {
        if (this.errorData.errors) {
            const firstKey = Object.keys(this.errorData.errors)[0];
            if (firstKey && this.errorData.errors[firstKey]?.length) {
                return this.errorData.errors[firstKey][0];
            }
        }
        return this.message;
    }
}

let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(callback: () => void): void {
    onUnauthorizedCallback = callback;
}

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = localStorage.getItem('shiftswap_token');

    const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http')
        ? endpoint
        : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 204) {
        return {} as T;
    }

    let data: any = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { message: text };
    }

    if (!response.ok) {
        if (response.status === 401) {
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
        }

        throw new ApiRequestError(response.status, {
            message: data?.message || `Request failed with status ${response.status}`,
            errors: data?.errors,
        });
    }

    return data;
}
