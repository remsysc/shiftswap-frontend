<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspacePage from "./components/WorkspacePage.vue";

type ShiftTone = "indigo" | "amber" | "rose" | "emerald";

type Shift = {
    id: number;
    day: number;
    start: string;
    end: string;
    top: number;
    height: number;
    title: string;
    location: string;
    person: string;
    initials: string;
    tone: ShiftTone;
};

const activeNav = ref("Dashboard");
const activeView = ref<"week" | "list">("week");
const weekOffset = ref(0);
const mobileMenuOpen = ref(false);
const notificationsOpen = ref(false);
const accountMenuOpen = ref(false);
const showCreateShift = ref(false);
const showAllActivity = ref(false);
const selectedLocation = ref("All locations");
const selectedTeam = ref("Everyone");
const shiftTitle = ref("");
const shiftDate = ref("2026-09-29");
const shiftStart = ref("09:00");
const shiftEnd = ref("17:00");

const navItems = [
    { label: "Dashboard", icon: "grid" },
    { label: "Schedule", icon: "calendar" },
    { label: "Shift swaps", icon: "repeat", count: 3 },
    { label: "Time off", icon: "clock", count: 2 },
    { label: "Team", icon: "users" },
];

const managementItems = [
    { label: "Locations", icon: "pin" },
    { label: "Settings", icon: "settings" },
];

const baseWeek = new Date(2026, 8, 28);
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
const hours = [
    "8 AM",
    "9 AM",
    "10 AM",
    "11 AM",
    "12 PM",
    "1 PM",
    "2 PM",
    "3 PM",
    "4 PM",
    "5 PM",
    "6 PM",
];

const weekDays = computed(() => {
    const start = new Date(baseWeek);
    start.setDate(start.getDate() + weekOffset.value * 7);

    return dayNames.map((name, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);

        return {
            name,
            date: date.getDate(),
            fullDate: date.toISOString().slice(0, 10),
            isToday: weekOffset.value === 0 && index === 1,
        };
    });
});

const weekLabel = computed(() => {
    const start = new Date(baseWeek);
    start.setDate(start.getDate() + weekOffset.value * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    if (start.getMonth() === end.getMonth()) {
        return `${monthNames[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    }

    return `${monthNames[start.getMonth()]} ${start.getDate()} – ${monthNames[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
});

const shifts = ref<Shift[]>([
    {
        id: 1,
        day: 0,
        start: "09:00",
        end: "17:00",
        top: 68,
        height: 182,
        title: "Morning shift",
        location: "Makati Central",
        person: "Mia Santos",
        initials: "MS",
        tone: "indigo",
    },
    {
        id: 2,
        day: 1,
        start: "10:00",
        end: "18:00",
        top: 136,
        height: 182,
        title: "Front of house",
        location: "Makati Central",
        person: "Paolo Cruz",
        initials: "PC",
        tone: "emerald",
    },
    {
        id: 3,
        day: 1,
        start: "12:00",
        end: "16:00",
        top: 272,
        height: 108,
        title: "Bar support",
        location: "Makati Central",
        person: "Jules Tan",
        initials: "JT",
        tone: "amber",
    },
    {
        id: 4,
        day: 2,
        start: "08:00",
        end: "16:00",
        top: 0,
        height: 182,
        title: "Opening team",
        location: "BGC Store",
        person: "Nico Reyes",
        initials: "NR",
        tone: "rose",
    },
    {
        id: 5,
        day: 3,
        start: "09:00",
        end: "17:00",
        top: 68,
        height: 182,
        title: "Morning shift",
        location: "BGC Store",
        person: "Aya Lim",
        initials: "AL",
        tone: "indigo",
    },
    {
        id: 6,
        day: 4,
        start: "11:00",
        end: "19:00",
        top: 204,
        height: 182,
        title: "Closing shift",
        location: "Makati Central",
        person: "Ren Dela Cruz",
        initials: "RD",
        tone: "emerald",
    },
    {
        id: 7,
        day: 5,
        start: "09:00",
        end: "13:00",
        top: 68,
        height: 108,
        title: "Weekend cover",
        location: "Makati Central",
        person: "Sam Uy",
        initials: "SU",
        tone: "amber",
    },
]);

const activities = [
    {
        initials: "JT",
        name: "Jules Tan",
        action: "requested to swap",
        detail: "Tue, Sep 29 · 12:00–4:00 PM",
        time: "12 min ago",
        tone: "violet",
    },
    {
        initials: "AL",
        name: "Aya Lim",
        action: "submitted time off",
        detail: "Oct 5 – Oct 7 · Personal leave",
        time: "34 min ago",
        tone: "orange",
    },
    {
        initials: "NR",
        name: "Nico Reyes",
        action: "accepted a shift",
        detail: "Wed, Sep 30 · Opening team",
        time: "1 hr ago",
        tone: "blue",
    },
    {
        initials: "MS",
        name: "Mia Santos",
        action: "offered a shift",
        detail: "Fri, Oct 2 · Morning shift",
        time: "2 hrs ago",
        tone: "pink",
    },
];

const visibleActivities = computed(() =>
    showAllActivity.value ? activities : activities.slice(0, 3),
);

function toneClasses(tone: ShiftTone): string {
    const tones: Record<ShiftTone, string> = {
        indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
        amber: "border-amber-200 bg-amber-50 text-amber-950",
        rose: "border-rose-200 bg-rose-50 text-rose-950",
        emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    };

    return tones[tone];
}

function avatarClasses(tone: string): string {
    const tones: Record<string, string> = {
        violet: "bg-violet-100 text-violet-700",
        orange: "bg-orange-100 text-orange-700",
        blue: "bg-sky-100 text-sky-700",
        pink: "bg-pink-100 text-pink-700",
    };

    return tones[tone] ?? "bg-slate-100 text-slate-700";
}

function changeWeek(amount: number): void {
    weekOffset.value += amount;
}

function selectNav(label: string): void {
    activeNav.value = label;
    mobileMenuOpen.value = false;
}

function toggleAccountMenu(): void {
    accountMenuOpen.value = !accountMenuOpen.value;
    notificationsOpen.value = false;
}

function openNotificationPage(page: string): void {
    selectNav(page);
    notificationsOpen.value = false;
}

function openAccountSettings(): void {
    selectNav("Settings");
    accountMenuOpen.value = false;
}

function addShift(): void {
    const selectedDate = new Date(`${shiftDate.value}T00:00:00`);
    const selectedDay = (selectedDate.getDay() + 6) % 7;
    const startHour = Number(shiftStart.value.split(":")[0]);
    const endHour = Number(shiftEnd.value.split(":")[0]);

    shifts.value.push({
        id: Date.now(),
        day: selectedDay,
        start: shiftStart.value,
        end: shiftEnd.value,
        top: Math.max(0, startHour - 8) * 68,
        height: Math.max(68, endHour - startHour) * 22.75,
        title: shiftTitle.value || "New shift",
        location:
            selectedLocation.value === "All locations"
                ? "Makati Central"
                : selectedLocation.value,
        person: "Unassigned",
        initials: "—",
        tone: "indigo",
    });

    shiftTitle.value = "";
    showCreateShift.value = false;
}
</script>

<template>
    <link
        href="https://fonts.bunny.net/css?family=dm-sans:400,500,600,700|plus-jakarta-sans:500,600,700"
        rel="stylesheet"
    />

    <div class="min-h-screen bg-[#f7f8fc] text-slate-900">
        <div
            v-if="mobileMenuOpen"
            class="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
            @click="mobileMenuOpen = false"
        />

        <aside
            class="fixed inset-y-0 left-0 z-40 flex w-[248px] -translate-x-full flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-200 lg:translate-x-0"
            :class="{ 'translate-x-0': mobileMenuOpen }"
        >
            <div class="flex items-center gap-3 px-3">
                <div
                    class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                >
                    <svg
                        class="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                    >
                        <path
                            d="M5 8h14M5 16h14M8 5l-3 3 3 3M16 13l3 3-3 3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </div>
                <span
                    class="font-['Plus_Jakarta_Sans'] text-[17px] font-bold tracking-[-0.04em] text-slate-900"
                    >Shift<span class="text-indigo-600">Swap</span></span
                >
            </div>

            <div class="mt-9 px-2">
                <p
                    class="mb-3 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase"
                >
                    Workspace
                </p>
                <nav class="space-y-1">
                    <button
                        v-for="item in navItems"
                        :key="item.label"
                        class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition"
                        :class="
                            activeNav === item.label
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        "
                        @click="selectNav(item.label)"
                    >
                        <svg
                            v-if="item.icon === 'grid'"
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <rect x="4" y="4" width="6" height="6" rx="1" />
                            <rect x="14" y="4" width="6" height="6" rx="1" />
                            <rect x="4" y="14" width="6" height="6" rx="1" />
                            <rect x="14" y="14" width="6" height="6" rx="1" />
                        </svg>
                        <svg
                            v-else-if="item.icon === 'calendar'"
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <rect x="4" y="5" width="16" height="15" rx="2" />
                            <path
                                d="M8 3v4M16 3v4M4 10h16"
                                stroke-linecap="round"
                            />
                        </svg>
                        <svg
                            v-else-if="item.icon === 'repeat'"
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <path
                                d="M17 3l3 3-3 3M4 6h16M7 21l-3-3 3-3M20 18H4"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <svg
                            v-else-if="item.icon === 'clock'"
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <circle cx="12" cy="12" r="8" />
                            <path
                                d="M12 8v4l2.5 2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <svg
                            v-else
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <path
                                d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5A3.5 3.5 0 1 0 10 4a3.5 3.5 0 0 0 0 7.5ZM16 4.5a3 3 0 0 1 0 5.9M19.5 15a3.5 3.5 0 0 1 2.5 3.3V20"
                                stroke-linecap="round"
                            />
                        </svg>
                        <span class="flex-1">{{ item.label }}</span>
                        <span
                            v-if="item.count"
                            class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            :class="
                                activeNav === item.label
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-slate-100 text-slate-500'
                            "
                            >{{ item.count }}</span
                        >
                    </button>
                </nav>
            </div>

            <div class="mt-8 px-2">
                <p
                    class="mb-3 px-2 text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase"
                >
                    Manage
                </p>
                <nav class="space-y-1">
                    <button
                        v-for="item in managementItems"
                        :key="item.label"
                        class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition"
                        :class="
                            activeNav === item.label
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        "
                        @click="selectNav(item.label)"
                    >
                        <svg
                            v-if="item.icon === 'pin'"
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <path
                                d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
                            />
                            <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        <svg
                            v-else
                            class="h-[18px] w-[18px]"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >
                            <path
                                d="M12 3v2M12 19v2M4.2 5.2l1.4 1.4M18.4 17.4l1.4 1.4M3 12h2M19 12h2M4.2 18.8l1.4-1.4M18.4 6.6l1.4-1.4"
                                stroke-linecap="round"
                            />
                            <circle cx="12" cy="12" r="3.5" />
                        </svg>
                        <span>{{ item.label }}</span>
                    </button>
                </nav>
            </div>

            <div class="relative mt-auto">
                <button
                    class="flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
                    aria-label="Open account menu"
                    :aria-expanded="accountMenuOpen"
                    aria-haspopup="menu"
                    @click="toggleAccountMenu"
                >
                    <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white"
                        >JD</span
                    >
                    <span class="min-w-0 flex-1">
                        <span
                            class="block truncate text-xs font-bold text-slate-800"
                            >Jordan Dela Cruz</span
                        >
                        <span class="mt-0.5 block text-[10px] text-slate-500"
                            >Owner · ShiftSwap</span
                        >
                    </span>
                    <svg
                        class="h-4 w-4 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path
                            d="M6 9l6 6 6-6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </button>
                <div
                    v-if="accountMenuOpen"
                    class="absolute right-0 bottom-full z-50 mb-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60"
                    role="menu"
                >
                    <div class="border-b border-slate-100 px-3 py-2.5">
                        <p class="text-xs font-bold text-slate-900">
                            Jordan Dela Cruz
                        </p>
                        <p class="mt-1 text-[10px] text-slate-500">
                            jordan@shiftswap.co
                        </p>
                    </div>
                    <button
                        class="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-700"
                        role="menuitem"
                        @click="openAccountSettings"
                    >
                        Account settings
                    </button>
                </div>
            </div>
        </aside>

        <main class="min-h-screen lg:pl-[248px]">
            <header
                class="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-[#f7f8fc]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10"
            >
                <div class="flex items-center gap-3">
                    <button
                        class="rounded-xl p-2 text-slate-500 hover:bg-white lg:hidden"
                        aria-label="Open navigation"
                        @click="mobileMenuOpen = true"
                    >
                        <svg
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M4 6h16M4 12h16M4 18h16"
                                stroke-linecap="round"
                            />
                        </svg>
                    </button>
                    <div class="relative hidden sm:block">
                        <svg
                            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <circle cx="11" cy="11" r="6.5" />
                            <path d="M16 16l4 4" stroke-linecap="round" />
                        </svg>
                        <input
                            class="h-10 w-56 rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                            placeholder="Search anything..."
                        />
                        <span
                            class="absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 md:block"
                            >⌘ K</span
                        >
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative">
                        <button
                            class="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white"
                            aria-label="Notifications"
                            :aria-expanded="notificationsOpen"
                            aria-haspopup="dialog"
                            @click="
                                notificationsOpen = !notificationsOpen;
                                accountMenuOpen = false;
                            "
                        >
                            <svg
                                class="h-[19px] w-[19px]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >
                                <path
                                    d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                            <span
                                class="absolute top-2 right-2 h-2 w-2 rounded-full border-2 border-[#f7f8fc] bg-rose-500"
                            />
                        </button>
                        <div
                            v-if="notificationsOpen"
                            class="absolute top-12 right-0 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50"
                            role="dialog"
                            aria-label="Notifications"
                        >
                            <div
                                class="flex items-center justify-between border-b border-slate-100 px-4 py-3"
                            >
                                <p class="text-sm font-bold text-slate-900">
                                    Notifications
                                </p>
                                <span
                                    class="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600"
                                    >3 new</span
                                >
                            </div>
                            <div class="space-y-1 p-2">
                                <button
                                    class="flex w-full gap-3 rounded-xl p-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500"
                                    @click="openNotificationPage('Shift swaps')"
                                >
                                    <span
                                        class="mt-1 h-2 w-2 rounded-full bg-violet-500"
                                    /><span
                                        ><span
                                            class="block text-xs font-semibold text-slate-800"
                                            >Jules requested a shift swap</span
                                        ><span
                                            class="mt-1 block text-[10px] text-slate-400"
                                            >12 minutes ago</span
                                        ></span
                                    ></button
                                ><button
                                    class="flex w-full gap-3 rounded-xl p-2.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500"
                                    @click="openNotificationPage('Time off')"
                                >
                                    <span
                                        class="mt-1 h-2 w-2 rounded-full bg-orange-500"
                                    /><span
                                        ><span
                                            class="block text-xs font-semibold text-slate-800"
                                            >New time-off request from Aya</span
                                        ><span
                                            class="mt-1 block text-[10px] text-slate-400"
                                            >34 minutes ago</span
                                        ></span
                                    >
                                </button>
                            </div>
                            <button
                                class="w-full border-t border-slate-100 px-4 py-3 text-center text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                                @click="notificationsOpen = false"
                            >
                                Dismiss notifications
                            </button>
                        </div>
                    </div>
                    <div class="hidden h-7 w-px bg-slate-200 sm:block" />
                    <div class="relative">
                        <button
                            class="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-500"
                            aria-label="Open account menu"
                            :aria-expanded="accountMenuOpen"
                            aria-haspopup="menu"
                            @click="toggleAccountMenu"
                        >
                            <span
                                class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 text-[10px] font-bold text-white"
                                >JD</span
                            >
                            <span
                                class="hidden text-xs font-bold text-slate-700 sm:block"
                                >Jordan</span
                            >
                            <svg
                                class="hidden h-3.5 w-3.5 text-slate-400 sm:block"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    d="M6 9l6 6 6-6"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                        <div
                            v-if="accountMenuOpen"
                            class="absolute top-12 right-0 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60"
                            role="menu"
                        >
                            <div class="border-b border-slate-100 px-3 py-2.5">
                                <p class="text-xs font-bold text-slate-900">
                                    Jordan Dela Cruz
                                </p>
                                <p class="mt-1 text-[10px] text-slate-500">
                                    jordan@shiftswap.co · Owner
                                </p>
                            </div>
                            <button
                                class="mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-indigo-700"
                                role="menuitem"
                                @click="openAccountSettings"
                            >
                                Account settings
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div
                v-if="activeNav === 'Dashboard'"
                class="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9"
            >
                <section
                    class="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
                >
                    <div>
                        <p class="mb-2 text-xs font-semibold text-slate-500">
                            Monday, September 28, 2026
                        </p>
                        <h1
                            class="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-[30px]"
                        >
                            Good morning, Jordan
                            <span
                                class="inline-block origin-bottom-right animate-[wave_2s_ease-in-out_infinite]"
                                >👋</span
                            >
                        </h1>
                        <p class="mt-2 text-sm text-slate-500">
                            Here’s what’s happening across your team today.
                        </p>
                    </div>
                    <button
                        class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 hover:bg-indigo-700"
                        @click="showCreateShift = true"
                    >
                        <svg
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.3"
                        >
                            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
                        </svg>
                        Create a shift
                    </button>
                </section>

                <section class="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div
                        class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                    >
                        <div class="flex items-start justify-between">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
                            >
                                <svg
                                    class="h-[19px] w-[19px]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                >
                                    <path
                                        d="M7 5v14M17 5v14M4 8h16M4 16h16"
                                        stroke-linecap="round"
                                    />
                                </svg>
                            </div>
                            <span
                                class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600"
                                ><span>↑</span> 8.2%</span
                            >
                        </div>
                        <p class="mt-5 text-xs font-semibold text-slate-500">
                            Hours scheduled
                        </p>
                        <p
                            class="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-900"
                        >
                            184.5
                            <span
                                class="text-xs font-semibold tracking-normal text-slate-400"
                                >hrs</span
                            >
                        </p>
                        <p class="mt-1 text-[10px] text-slate-400">
                            vs. 170 hrs last week
                        </p>
                    </div>
                    <div
                        class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                    >
                        <div class="flex items-start justify-between">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"
                            >
                                <svg
                                    class="h-[19px] w-[19px]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                >
                                    <path
                                        d="M17 3v4M7 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM8 13h2M14 13h2M8 17h2"
                                        stroke-linecap="round"
                                    />
                                </svg>
                            </div>
                            <span
                                class="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-600"
                                >Needs review</span
                            >
                        </div>
                        <p class="mt-5 text-xs font-semibold text-slate-500">
                            Pending requests
                        </p>
                        <p
                            class="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-900"
                        >
                            5
                            <span
                                class="text-xs font-semibold tracking-normal text-slate-400"
                                >requests</span
                            >
                        </p>
                        <p class="mt-1 text-[10px] text-slate-400">
                            3 swaps · 2 time off
                        </p>
                    </div>
                    <div
                        class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                    >
                        <div class="flex items-start justify-between">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
                            >
                                <svg
                                    class="h-[19px] w-[19px]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                >
                                    <path
                                        d="M4 16.5V19h16v-2.5M7 13l3 3 7-8"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                    />
                                </svg>
                            </div>
                            <span
                                class="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600"
                                >On track</span
                            >
                        </div>
                        <p class="mt-5 text-xs font-semibold text-slate-500">
                            Team coverage
                        </p>
                        <p
                            class="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-900"
                        >
                            96.4<span class="text-sm">%</span>
                        </p>
                        <p class="mt-1 text-[10px] text-slate-400">
                            Across 2 locations
                        </p>
                    </div>
                    <div
                        class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                    >
                        <div class="flex items-start justify-between">
                            <div
                                class="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"
                            >
                                <svg
                                    class="h-[19px] w-[19px]"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.8"
                                >
                                    <path
                                        d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5A3.5 3.5 0 1 0 10 4a3.5 3.5 0 0 0 0 7.5ZM16 4.5a3 3 0 0 1 0 5.9M19.5 15a3.5 3.5 0 0 1 2.5 3.3V20"
                                        stroke-linecap="round"
                                    />
                                </svg>
                            </div>
                            <span
                                class="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600"
                                ><span>↑</span> 2 new</span
                            >
                        </div>
                        <p class="mt-5 text-xs font-semibold text-slate-500">
                            Active team members
                        </p>
                        <p
                            class="mt-1 font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-900"
                        >
                            24
                            <span
                                class="text-xs font-semibold tracking-normal text-slate-400"
                                >people</span
                            >
                        </p>
                        <p class="mt-1 text-[10px] text-slate-400">
                            Up from 22 last month
                        </p>
                    </div>
                </section>

                <section
                    class="mt-7 grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.72fr)]"
                >
                    <div
                        class="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                    >
                        <div
                            class="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <div class="flex items-center gap-2">
                                    <h2
                                        class="font-['Plus_Jakarta_Sans'] text-base font-bold tracking-[-0.03em] text-slate-900"
                                    >
                                        Team schedule
                                    </h2>
                                    <span
                                        class="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500"
                                        >{{ selectedLocation }}</span
                                    >
                                </div>
                                <p class="mt-1 text-xs text-slate-400">
                                    See who’s working and where this week.
                                </p>
                            </div>
                            <div class="flex items-center gap-2">
                                <div
                                    class="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                                >
                                    <button
                                        class="rounded-md px-3 py-1.5 text-[10px] font-bold transition"
                                        :class="
                                            activeView === 'week'
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-400'
                                        "
                                        @click="activeView = 'week'"
                                    >
                                        Week</button
                                    ><button
                                        class="rounded-md px-3 py-1.5 text-[10px] font-bold transition"
                                        :class="
                                            activeView === 'list'
                                                ? 'bg-white text-slate-800 shadow-sm'
                                                : 'text-slate-400'
                                        "
                                        @click="activeView = 'list'"
                                    >
                                        List
                                    </button>
                                </div>
                                <button
                                    class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                                >
                                    <svg
                                        class="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                    >
                                        <path
                                            d="M4 5h16M7 12h10M10 19h4"
                                            stroke-linecap="round"
                                        />
                                    </svg>
                                    Filter
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="activeView === 'week'"
                            class="calendar-scroll overflow-x-auto"
                        >
                            <div class="min-w-[770px]">
                                <div
                                    class="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-100"
                                >
                                    <div class="border-r border-slate-100" />
                                    <div
                                        v-for="day in weekDays"
                                        :key="day.fullDate"
                                        class="px-2 py-3 text-center"
                                        :class="
                                            day.isToday ? 'bg-indigo-50/50' : ''
                                        "
                                    >
                                        <p
                                            class="text-[10px] font-bold tracking-wider uppercase"
                                            :class="
                                                day.isToday
                                                    ? 'text-indigo-600'
                                                    : 'text-slate-400'
                                            "
                                        >
                                            {{ day.name }}
                                        </p>
                                        <p
                                            class="mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                                            :class="
                                                day.isToday
                                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                                    : 'text-slate-700'
                                            "
                                        >
                                            {{ day.date }}
                                        </p>
                                    </div>
                                </div>
                                <div
                                    class="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
                                >
                                    <div class="relative">
                                        <div
                                            v-for="(hour, index) in hours"
                                            :key="hour"
                                            class="h-[68px] pr-3 text-right text-[10px] font-medium text-slate-400"
                                            :class="
                                                index === 0 ? 'pt-3' : 'pt-1'
                                            "
                                        >
                                            {{ hour }}
                                        </div>
                                    </div>
                                    <div
                                        v-for="day in weekDays"
                                        :key="`${day.fullDate}-column`"
                                        class="relative border-l border-slate-100"
                                        :class="
                                            day.isToday ? 'bg-indigo-50/20' : ''
                                        "
                                    >
                                        <div
                                            v-for="index in hours.length"
                                            :key="index"
                                            class="pointer-events-none h-[68px] border-b border-dashed border-slate-100"
                                        />
                                        <button
                                            v-for="shift in shifts.filter(
                                                (item) =>
                                                    item.day ===
                                                    dayNames.indexOf(day.name),
                                            )"
                                            :key="shift.id"
                                            class="absolute right-1.5 left-1.5 overflow-hidden rounded-lg border-l-[3px] p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                            :class="toneClasses(shift.tone)"
                                            :style="{
                                                top: `${shift.top + 1}px`,
                                                height: `${shift.height - 4}px`,
                                            }"
                                            @click="showCreateShift = true"
                                        >
                                            <p
                                                class="truncate text-[10px] font-bold"
                                            >
                                                {{ shift.title }}
                                            </p>
                                            <p
                                                class="mt-1 truncate text-[9px] opacity-70"
                                            >
                                                {{ shift.start }}–{{
                                                    shift.end
                                                }}
                                            </p>
                                            <div
                                                class="mt-2 flex items-center gap-1.5"
                                            >
                                                <span
                                                    class="flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[7px] font-bold"
                                                    >{{ shift.initials }}</span
                                                ><span
                                                    class="truncate text-[9px] font-semibold opacity-80"
                                                    >{{ shift.person }}</span
                                                >
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-else class="divide-y divide-slate-100">
                            <div
                                v-for="shift in shifts"
                                :key="shift.id"
                                class="flex items-center gap-4 px-5 py-4"
                            >
                                <div class="w-16 text-center">
                                    <p
                                        class="text-[10px] font-bold text-slate-400 uppercase"
                                    >
                                        {{ dayNames[shift.day] }}
                                    </p>
                                    <p class="text-sm font-bold text-slate-800">
                                        {{ weekDays[shift.day]?.date }}
                                    </p>
                                </div>
                                <div
                                    class="h-10 w-1 rounded-full"
                                    :class="
                                        shift.tone === 'indigo'
                                            ? 'bg-indigo-500'
                                            : shift.tone === 'amber'
                                              ? 'bg-amber-500'
                                              : shift.tone === 'rose'
                                                ? 'bg-rose-500'
                                                : 'bg-emerald-500'
                                    "
                                />
                                <div class="min-w-0 flex-1">
                                    <p class="text-xs font-bold text-slate-800">
                                        {{ shift.title }}
                                    </p>
                                    <p class="mt-1 text-[10px] text-slate-400">
                                        {{ shift.start }}–{{ shift.end }} ·
                                        {{ shift.location }}
                                    </p>
                                </div>
                                <span
                                    class="hidden text-xs font-semibold text-slate-500 sm:block"
                                    >{{ shift.person }}</span
                                ><button
                                    class="text-slate-400 hover:text-indigo-600"
                                >
                                    <svg
                                        class="h-4 w-4"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M9 18l6-6-6-6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div
                            class="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div
                                class="flex items-center gap-2 text-[10px] text-slate-400"
                            >
                                <span
                                    class="h-2 w-2 rounded-full bg-indigo-500"
                                />
                                Your schedule is 96% covered this week
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    class="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-700"
                                    @click="changeWeek(-1)"
                                >
                                    <svg
                                        class="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M15 18l-6-6 6-6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg>
                                    Previous</button
                                ><span
                                    class="text-[10px] font-bold text-slate-700"
                                    >{{ weekLabel }}</span
                                ><button
                                    class="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                    @click="changeWeek(1)"
                                >
                                    Next
                                    <svg
                                        class="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M9 18l6-6-6-6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-5">
                        <div
                            class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                        >
                            <div class="flex items-start justify-between">
                                <div>
                                    <h2
                                        class="font-['Plus_Jakarta_Sans'] text-base font-bold tracking-[-0.03em] text-slate-900"
                                    >
                                        Needs your attention
                                    </h2>
                                    <p class="mt-1 text-xs text-slate-400">
                                        A few things are waiting for you.
                                    </p>
                                </div>
                                <span
                                    class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-orange-600"
                                    >5</span
                                >
                            </div>
                            <div class="mt-5 space-y-2.5">
                                <button
                                    class="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-indigo-100 hover:bg-indigo-50/40"
                                >
                                    <span
                                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"
                                        ><svg
                                            class="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.8"
                                        >
                                            <path
                                                d="M17 3l3 3-3 3M4 6h16M7 21l-3-3 3-3M20 18H4"
                                                stroke-linecap="round"
                                                stroke-linejoin="round"
                                            /></svg></span
                                    ><span class="min-w-0 flex-1"
                                        ><span
                                            class="block text-xs font-bold text-slate-800"
                                            >Shift swap requests</span
                                        ><span
                                            class="mt-0.5 block text-[10px] text-slate-400"
                                            >3 requests to review</span
                                        ></span
                                    ><svg
                                        class="h-4 w-4 text-slate-300"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M9 18l6-6-6-6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg></button
                                ><button
                                    class="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-indigo-100 hover:bg-indigo-50/40"
                                >
                                    <span
                                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700"
                                        ><svg
                                            class="h-4 w-4"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="1.8"
                                        >
                                            <rect
                                                x="4"
                                                y="5"
                                                width="16"
                                                height="15"
                                                rx="2"
                                            />
                                            <path
                                                d="M8 3v4M16 3v4M4 10h16"
                                                stroke-linecap="round"
                                            /></svg></span
                                    ><span class="min-w-0 flex-1"
                                        ><span
                                            class="block text-xs font-bold text-slate-800"
                                            >Time-off requests</span
                                        ><span
                                            class="mt-0.5 block text-[10px] text-slate-400"
                                            >2 requests to review</span
                                        ></span
                                    ><svg
                                        class="h-4 w-4 text-slate-300"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M9 18l6-6-6-6"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div
                            class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.02)]"
                        >
                            <div class="flex items-start justify-between">
                                <div>
                                    <h2
                                        class="font-['Plus_Jakarta_Sans'] text-base font-bold tracking-[-0.03em] text-slate-900"
                                    >
                                        Recent activity
                                    </h2>
                                    <p class="mt-1 text-xs text-slate-400">
                                        Latest updates from your team.
                                    </p>
                                </div>
                                <button
                                    class="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                    @click="showAllActivity = !showAllActivity"
                                >
                                    {{
                                        showAllActivity
                                            ? "Show less"
                                            : "View all"
                                    }}
                                </button>
                            </div>
                            <div class="mt-5 space-y-4">
                                <div
                                    v-for="activity in visibleActivities"
                                    :key="`${activity.name}-${activity.time}`"
                                    class="flex gap-3"
                                >
                                    <div
                                        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold"
                                        :class="avatarClasses(activity.tone)"
                                    >
                                        {{ activity.initials }}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <p
                                            class="text-[11px] leading-4 text-slate-600"
                                        >
                                            <span
                                                class="font-bold text-slate-800"
                                                >{{ activity.name }}</span
                                            >
                                            {{ activity.action }}
                                        </p>
                                        <p
                                            class="mt-0.5 truncate text-[10px] text-slate-400"
                                        >
                                            {{ activity.detail }}
                                        </p>
                                        <p
                                            class="mt-1 text-[9px] font-semibold text-slate-300"
                                        >
                                            {{ activity.time }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    class="mt-5 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white shadow-lg shadow-indigo-100 sm:p-6"
                >
                    <div
                        class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                        <div>
                            <div class="mb-2 flex items-center gap-2">
                                <span
                                    class="flex h-6 w-6 items-center justify-center rounded-lg bg-white/15"
                                    ><svg
                                        class="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M12 3v18M17 7.5c0-1.7-2.2-3-5-3s-5 1.3-5 3 2.2 3 5 3 5 1.3 5 3-2.2 3-5 3-5-1.3-5-3"
                                            stroke-linecap="round"
                                        /></svg></span
                                ><span
                                    class="text-[10px] font-bold tracking-[0.12em] text-indigo-100 uppercase"
                                    >Weekly snapshot</span
                                >
                            </div>
                            <h3
                                class="font-['Plus_Jakarta_Sans'] text-lg font-bold tracking-[-0.03em]"
                            >
                                Your team is running smoothly.
                            </h3>
                            <p
                                class="mt-1.5 max-w-xl text-xs leading-5 text-indigo-100"
                            >
                                Coverage is up 4.8% from last week, and there
                                are no staffing gaps for the next 3 days.
                            </p>
                        </div>
                        <button
                            class="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"
                        >
                            View report
                            <svg
                                class="h-3.5 w-3.5"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                            >
                                <path
                                    d="M5 12h14M13 6l6 6-6 6"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>
                        </button>
                    </div>
                </section>
            </div>
            <WorkspacePage
                v-else
                :page="activeNav"
                @create-shift="showCreateShift = true"
            />
        </main>

        <div
            v-if="showCreateShift"
            class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
            @click.self="showCreateShift = false"
        >
            <div
                class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
            >
                <div class="flex items-start justify-between">
                    <div>
                        <p
                            class="text-[10px] font-bold tracking-[0.14em] text-indigo-600 uppercase"
                        >
                            Schedule management
                        </p>
                        <h2
                            class="mt-2 font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-[-0.04em] text-slate-950"
                        >
                            Create a new shift
                        </h2>
                        <p class="mt-1 text-xs text-slate-500">
                            Add a shift to your team schedule.
                        </p>
                    </div>
                    <button
                        class="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                        aria-label="Close"
                        @click="showCreateShift = false"
                    >
                        <svg
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <path
                                d="M6 6l12 12M18 6L6 18"
                                stroke-linecap="round"
                            />
                        </svg>
                    </button>
                </div>
                <form class="mt-6 space-y-4" @submit.prevent="addShift">
                    <label class="block"
                        ><span
                            class="mb-1.5 block text-[11px] font-bold text-slate-700"
                            >Shift name</span
                        ><input
                            v-model="shiftTitle"
                            required
                            placeholder="e.g. Morning shift"
                            class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
                    /></label>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="block"
                            ><span
                                class="mb-1.5 block text-[11px] font-bold text-slate-700"
                                >Date</span
                            ><input
                                v-model="shiftDate"
                                type="date"
                                required
                                class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/70" /></label
                        ><label class="block"
                            ><span
                                class="mb-1.5 block text-[11px] font-bold text-slate-700"
                                >Location</span
                            ><select
                                v-model="selectedLocation"
                                class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
                            >
                                <option>All locations</option>
                                <option>Makati Central</option>
                                <option>BGC Store</option>
                            </select></label
                        >
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label class="block"
                            ><span
                                class="mb-1.5 block text-[11px] font-bold text-slate-700"
                                >Start time</span
                            ><input
                                v-model="shiftStart"
                                type="time"
                                required
                                class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/70" /></label
                        ><label class="block"
                            ><span
                                class="mb-1.5 block text-[11px] font-bold text-slate-700"
                                >End time</span
                            ><input
                                v-model="shiftEnd"
                                type="time"
                                required
                                class="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/70"
                        /></label>
                    </div>
                    <div
                        class="flex justify-end gap-3 border-t border-slate-100 pt-5"
                    >
                        <button
                            type="button"
                            class="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-50"
                            @click="showCreateShift = false"
                        >
                            Cancel</button
                        ><button
                            type="submit"
                            class="h-10 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                        >
                            Add to schedule
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<style>
:root {
    font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
}

@keyframes wave {
    0%,
    100% {
        transform: rotate(0deg);
    }
    15% {
        transform: rotate(13deg);
    }
    30% {
        transform: rotate(-7deg);
    }
    45% {
        transform: rotate(10deg);
    }
    60% {
        transform: rotate(0deg);
    }
}

.calendar-scroll {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
}

.calendar-scroll::-webkit-scrollbar {
    height: 6px;
}

.calendar-scroll::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #cbd5e1;
}
</style>
