<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useUndoStore } from '../stores/undo';
import { locationsApi } from '../api/locations';
import { ApiRequestError } from '../api/client';
import type { Location } from '../types/api';

const authStore = useAuthStore();
const undoStore = useUndoStore();
const isManager = computed(() => authStore.isManagerOrOwner);

const locations = ref<Location[]>([]);
const isLoading = ref(false);
const errorAlert = ref('');
const successAlert = ref('');

const showModal = ref(false);
const editingLocation = ref<Location | null>(null);
const locationName = ref('');
const locationAddress = ref('');
const isSubmitting = ref(false);

async function loadLocations(): Promise<void> {
    if (!authStore.businessId) {
        return;
    }
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
    if (!authStore.businessId) {
        return;
    }
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
    const bId = authStore.businessId;
    if (!bId) {
        return;
    }
    // Optimistic removal from UI
    const originalLocations = [...locations.value];
    locations.value = locations.value.filter((l) => l.id !== loc.id);

    undoStore.triggerAction({
        id: `delete-location-${loc.id}`,
        message: `Location "${loc.name}" Deleted`,
        detail: loc.address || 'Branch removed',
        durationMs: 4000,
        execute: async () => {
            try {
                await locationsApi.delete(bId, loc.id);
                successAlert.value = `Location "${loc.name}" deleted.`;
                await loadLocations();
            } catch (e: any) {
                locations.value = originalLocations;
                errorAlert.value = e.message || 'Failed to delete location.';
            }
        },
        onUndo: async () => {
            locations.value = originalLocations;
            await loadLocations();
        },
    });
}

watch(
    () => authStore.businessId,
    (id) => {
        if (id) {
            loadLocations();
        }
    }
);

onMounted(() => {
    if (authStore.businessId) {
        loadLocations();
    }
});
</script>

<template>
    <div class="space-y-6 max-w-7xl mx-auto pb-10">
        <!-- Alerts -->
        <div
            v-if="errorAlert"
            class="rounded-xl border border-[#C34043]/30 bg-[#FCECEC] px-4 py-3 text-xs text-[#C34043] flex items-center justify-between"
        >
            <span>{{ errorAlert }}</span>
            <button type="button" class="font-bold underline cursor-pointer" @click="errorAlert = ''">Dismiss</button>
        </div>
        <div
            v-if="successAlert"
            class="rounded-xl border border-[#76946A]/40 bg-[#EDF3EA] px-4 py-3 text-xs text-[#475F3E] flex items-center justify-between"
        >
            <span>{{ successAlert }}</span>
            <button type="button" class="font-bold underline cursor-pointer" @click="successAlert = ''">Dismiss</button>
        </div>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#DCD7CE]">
            <div>
                <span class="px-2 py-0.5 rounded text-[10px] font-headline font-bold bg-[#E6ECF0] text-[#2D4F67] uppercase tracking-wider">
                    Branch Management
                </span>
                <h1 class="text-2xl sm:text-3xl font-headline font-extrabold text-[#1F1F28] tracking-tight mt-1.5">
                    Store Locations
                </h1>
                <p class="text-xs sm:text-sm text-[#5A5D64] font-body mt-1">
                    Manage branches where shifts are scheduled and evaluated for overlap conflicts.
                </p>
            </div>

            <button
                v-if="isManager"
                type="button"
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] shadow-sm transition-all cursor-pointer self-start sm:self-auto"
                @click="openCreateModal"
            >
                <span class="material-symbols-outlined text-base">add_business</span>
                <span>Add Location</span>
            </button>
        </div>

        <!-- Locations List -->
        <section class="bg-white rounded-xl border border-[#DCD7CE] shadow-xs overflow-hidden">
            <div class="px-6 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5] flex items-center justify-between">
                <h2 class="text-base font-headline font-bold text-[#1F1F28]">Active Branches</h2>
                <span class="text-xs font-mono-num text-[#5A5D64]">{{ locations.length }} Locations</span>
            </div>

            <div v-if="isLoading" class="p-8 text-center text-xs text-[#5A5D64]">
                Loading locations...
            </div>

            <div v-else-if="locations.length === 0" class="p-8 text-center space-y-2">
                <p class="text-sm font-headline font-bold text-[#1F1F28]">No locations added yet</p>
                <p class="text-xs text-[#5A5D64]">Create your first branch to start assigning location-specific shifts.</p>
            </div>

            <div v-else class="divide-y divide-[#E7E3DC]">
                <div
                    v-for="loc in locations"
                    :key="loc.id"
                    class="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF8F5] transition-colors"
                >
                    <div class="flex items-start gap-3">
                        <div class="w-9 h-9 rounded-lg bg-[#E6ECF0] text-[#2D4F67] flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-lg">storefront</span>
                        </div>
                        <div>
                            <h3 class="text-sm font-headline font-bold text-[#1F1F28]">{{ loc.name }}</h3>
                            <p class="text-xs text-[#5A5D64] mt-0.5">{{ loc.address || 'No street address specified' }}</p>
                        </div>
                    </div>

                    <div v-if="isManager" class="flex items-center gap-2">
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-lg text-xs font-headline font-semibold text-[#1F1F28] bg-[#FAF8F5] hover:bg-[#E6ECF0] border border-[#DCD7CE] transition-colors cursor-pointer"
                            @click="openEditModal(loc)"
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            class="px-3 py-1.5 rounded-lg text-xs font-headline font-semibold text-[#C34043] bg-white hover:bg-[#FCECEC] border border-[#DCD7CE] transition-colors cursor-pointer"
                            @click="handleDeleteLocation(loc)"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Create / Edit Modal -->
        <div
            v-if="showModal"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16181D]/60 backdrop-blur-xs"
            @click.self="showModal = false"
        >
            <div class="bg-white rounded-xl max-w-md w-full border border-[#DCD7CE] shadow-xl overflow-hidden">
                <div class="px-5 py-4 border-b border-[#DCD7CE] bg-[#FAF8F5] flex items-center justify-between">
                    <h3 class="text-sm font-headline font-bold text-[#1F1F28]">
                        {{ editingLocation ? 'Edit Location' : 'New Location' }}
                    </h3>
                    <button type="button" class="text-[#5A5D64] hover:text-[#1F1F28] cursor-pointer" @click="showModal = false">
                        <span class="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                <form class="p-5 space-y-4" @submit.prevent="handleSaveLocation">
                    <div>
                        <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1">Branch Name</label>
                        <input
                            v-model="locationName"
                            type="text"
                            required
                            placeholder="e.g., Makati Flagship"
                            class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-headline font-bold text-[#1F1F28] mb-1">Address (Optional)</label>
                        <input
                            v-model="locationAddress"
                            type="text"
                            placeholder="e.g., 112 Legazpi St, Makati"
                            class="w-full px-3 py-2 rounded-lg border border-[#DCD7CE] text-xs text-[#1F1F28] focus:outline-none focus:border-[#2D4F67]"
                        />
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-3 border-t border-[#E7E3DC]">
                        <button
                            type="button"
                            class="px-3.5 py-2 rounded-lg text-xs font-headline font-semibold text-[#5A5D64] border border-[#DCD7CE] cursor-pointer"
                            @click="showModal = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            :disabled="isSubmitting"
                            class="px-4 py-2 rounded-lg text-xs font-headline font-bold text-white bg-[#2D4F67] hover:bg-[#1F384C] cursor-pointer"
                        >
                            {{ isSubmitting ? 'Saving...' : 'Save Location' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
