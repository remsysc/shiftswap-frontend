<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { locationsApi } from '../api/locations';
import { ApiRequestError } from '../api/client';
import type { Location } from '../types/api';

const authStore = useAuthStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const locations = ref<Location[]>([]);
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

// Modals
const showModal = ref(false);
const editingLocation = ref<Location | null>(null);
const locationName = ref('');
const locationAddress = ref('');
const isSubmitting = ref(false);

async function loadLocations(): Promise<void> {
    if (!authStore.businessId) return;
    try {
        isLoading.value = true;
        errorAlert.value = '';
        const res = await locationsApi.list(authStore.businessId);
        locations.value = res.data;
    } catch (e: any) {
        errorAlert.value = e.message || 'Failed to load locations.';
    } finally {
        isLoading.value = false;
    }
}

function openCreateModal(): void {
    editingLocation.value = null;
    locationName.value = '';
    locationAddress.value = '';
    showModal.value = true;
}

function openEditModal(loc: Location): void {
    editingLocation.value = loc;
    locationName.value = loc.name;
    locationAddress.value = loc.address || '';
    showModal.value = true;
}

async function handleSaveLocation(): Promise<void> {
    if (!authStore.businessId) return;
    errorAlert.value = '';
    isSubmitting.value = true;

    try {
        if (editingLocation.value) {
            await locationsApi.update(authStore.businessId, editingLocation.value.id, {
                name: locationName.value,
                address: locationAddress.value || null,
            });
            successAlert.value = 'Location updated successfully.';
        } else {
            await locationsApi.create(authStore.businessId, {
                name: locationName.value,
                address: locationAddress.value || null,
            });
            successAlert.value = 'Location created successfully.';
        }

        showModal.value = false;
        await loadLocations();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to save location.';
        }
    } finally {
        isSubmitting.value = false;
    }
}

async function handleDeleteLocation(loc: Location): Promise<void> {
    if (!authStore.businessId || !confirm(`Delete location "${loc.name}"?`)) return;
    errorAlert.value = '';

    try {
        await locationsApi.delete(authStore.businessId, loc.id);
        successAlert.value = 'Location deleted.';
        await loadLocations();
    } catch (e: any) {
        if (e instanceof ApiRequestError) {
            errorAlert.value = e.firstError;
        } else {
            errorAlert.value = e.message || 'Failed to delete location.';
        }
    }
}

onMounted(() => {
    loadLocations();
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">Locations</h1>
                <p class="text-sm text-slate-500 mt-0.5">Manage branches, stores, or kitchen facilities</p>
            </div>

            <button
                v-if="isManager"
                class="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                @click="openCreateModal"
            >
                + Add Location
            </button>
        </div>

        <!-- Alerts -->
        <div v-if="errorAlert" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {{ errorAlert }}
        </div>
        <div v-if="successAlert" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
            {{ successAlert }}
        </div>

        <!-- Locations Grid -->
        <div v-if="isLoading" class="py-12 text-center text-sm text-slate-500">
            Loading locations...
        </div>

        <div v-else-if="locations.length === 0" class="bg-white p-10 text-center rounded-2xl border border-slate-200/80 shadow-sm">
            <p class="text-sm font-semibold text-slate-700">No locations added yet</p>
            <p class="text-xs text-slate-400 mt-1">Add your first branch or work location above.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
                v-for="loc in locations"
                :key="loc.id"
                class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-4"
            >
                <div class="space-y-1">
                    <h3 class="text-base font-bold text-slate-900">{{ loc.name }}</h3>
                    <p class="text-xs text-slate-500">{{ loc.address || 'No physical address provided' }}</p>
                </div>

                <div v-if="isManager" class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                    <button
                        class="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                        @click="openEditModal(loc)"
                    >
                        Edit
                    </button>
                    <button
                        class="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 font-semibold"
                        @click="handleDeleteLocation(loc)"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>

        <!-- Location Modal -->
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div class="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-100 space-y-4">
                <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 class="text-base font-bold text-slate-900">
                        {{ editingLocation ? 'Edit Location' : 'Add Location' }}
                    </h3>
                    <button class="text-slate-400 hover:text-slate-600" @click="showModal = false">✕</button>
                </div>

                <form class="space-y-3" @submit.prevent="handleSaveLocation">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Location Name</label>
                        <input
                            v-model="locationName"
                            type="text"
                            required
                            placeholder="e.g. Downtown Roastery"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Address (Optional)</label>
                        <input
                            v-model="locationAddress"
                            type="text"
                            placeholder="e.g. 100 Main St, Suite 4"
                            class="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                    </div>

                    <div class="pt-3 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                            @click="showModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            {{ isSubmitting ? 'Saving...' : 'Save Location' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
