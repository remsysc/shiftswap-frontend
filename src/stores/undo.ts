import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface UndoableAction {
    id: string;
    message: string;
    detail?: string;
    durationMs?: number; // default 4000ms (recommended over 3s for cognitive/motor margin)
    execute: () => Promise<void> | void;
    onUndo?: () => Promise<void> | void;
}

export const useUndoStore = defineStore('undo', () => {
    const currentAction = ref<UndoableAction | null>(null);
    const timeRemainingSeconds = ref<number>(4);
    const progressPercent = ref<number>(100);
    const isUndoing = ref<boolean>(false);
    const toastFeedback = ref<string | null>(null);

    let timerInterval: ReturnType<typeof setInterval> | null = null;
    let timerTimeout: ReturnType<typeof setTimeout> | null = null;

    function clearTimers(): void {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        if (timerTimeout) {
            clearTimeout(timerTimeout);
            timerTimeout = null;
        }
    }

    /**
     * Trigger a critical action with an undo grace period (default 4 seconds).
     * If another action is already pending, commit the previous one first.
     */
    async function triggerAction(action: UndoableAction): Promise<void> {
        if (currentAction.value) {
            await commitCurrent();
        }

        const duration = action.durationMs ?? 4000;
        const totalSeconds = Math.ceil(duration / 1000);
        currentAction.value = action;
        timeRemainingSeconds.value = totalSeconds;
        progressPercent.value = 100;

        const startTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, duration - elapsed);
            timeRemainingSeconds.value = Math.max(1, Math.ceil(remaining / 1000));
            progressPercent.value = Math.max(0, (remaining / duration) * 100);
        }, 50);

        timerTimeout = setTimeout(async () => {
            await commitCurrent();
        }, duration);
    }

    async function commitCurrent(): Promise<void> {
        clearTimers();
        const actionToCommit = currentAction.value;
        currentAction.value = null;
        if (actionToCommit) {
            try {
                await actionToCommit.execute();
            } catch (err) {
                console.error('Failed to commit deferred action:', err);
                if (actionToCommit.onUndo) {
                    await actionToCommit.onUndo();
                }
            }
        }
    }

    async function undo(): Promise<void> {
        clearTimers();
        const actionToUndo = currentAction.value;
        currentAction.value = null;
        if (actionToUndo) {
            isUndoing.value = true;
            try {
                if (actionToUndo.onUndo) {
                    await actionToUndo.onUndo();
                }
                toastFeedback.value = `Undone: ${actionToUndo.message}`;
                setTimeout(() => {
                    if (toastFeedback.value?.includes(actionToUndo.message)) {
                        toastFeedback.value = null;
                    }
                }, 3000);
            } finally {
                isUndoing.value = false;
            }
        }
    }

    function dismiss(): void {
        commitCurrent();
    }

    return {
        currentAction,
        timeRemainingSeconds,
        progressPercent,
        isUndoing,
        toastFeedback,
        triggerAction,
        undo,
        dismiss,
        commitCurrent,
    };
});
