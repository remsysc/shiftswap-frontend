<script setup lang="ts">
import { computed, ref } from "vue";

type RequestStatus = "Pending" | "Approved" | "Declined";
type RequestFilter = "All" | RequestStatus;

const props = defineProps<{ page: string }>();
const emit = defineEmits<{ "create-shift": [] }>();

const requestFilter = ref<RequestFilter>("All");
const teamSearch = ref("");
const selectedLocation = ref("All locations");
const settingsSaved = ref(false);

const swapRequests = ref([
    {
        id: 1,
        name: "Jules Tan",
        initials: "JT",
        tone: "violet",
        shift: "Bar support",
        date: "Tue, Sep 29",
        time: "12:00 PM – 4:00 PM",
        reason: "I have a class that afternoon and would appreciate the coverage.",
        status: "Pending" as RequestStatus,
    },
    {
        id: 2,
        name: "Mia Santos",
        initials: "MS",
        tone: "indigo",
        shift: "Morning shift",
        date: "Fri, Oct 2",
        time: "9:00 AM – 5:00 PM",
        reason: "Looking to trade for a weekend shift.",
        status: "Pending" as RequestStatus,
    },
    {
        id: 3,
        name: "Sam Uy",
        initials: "SU",
        tone: "amber",
        shift: "Weekend cover",
        date: "Sat, Oct 3",
        time: "9:00 AM – 1:00 PM",
        reason: "Can anyone take this shift? Happy to pick up another day.",
        status: "Approved" as RequestStatus,
    },
]);

const timeOffRequests = ref([
    {
        id: 1,
        name: "Aya Lim",
        initials: "AL",
        tone: "rose",
        type: "Personal leave",
        dates: "Oct 5 – Oct 7, 2026",
        days: "3 days",
        note: "Family commitment",
        status: "Pending" as RequestStatus,
    },
    {
        id: 2,
        name: "Nico Reyes",
        initials: "NR",
        tone: "sky",
        type: "Vacation",
        dates: "Oct 12 – Oct 16, 2026",
        days: "5 days",
        note: "Planned annual leave",
        status: "Pending" as RequestStatus,
    },
    {
        id: 3,
        name: "Paolo Cruz",
        initials: "PC",
        tone: "emerald",
        type: "Personal leave",
        dates: "Sep 24, 2026",
        days: "1 day",
        note: "Appointment",
        status: "Approved" as RequestStatus,
    },
]);

const teamMembers = [
    {
        name: "Mia Santos",
        initials: "MS",
        role: "Shift lead",
        location: "Makati Central",
        status: "Active",
        tone: "indigo",
    },
    {
        name: "Paolo Cruz",
        initials: "PC",
        role: "Barista",
        location: "Makati Central",
        status: "Active",
        tone: "emerald",
    },
    {
        name: "Jules Tan",
        initials: "JT",
        role: "Barista",
        location: "Makati Central",
        status: "On leave",
        tone: "violet",
    },
    {
        name: "Nico Reyes",
        initials: "NR",
        role: "Shift lead",
        location: "BGC Store",
        status: "Active",
        tone: "sky",
    },
    {
        name: "Aya Lim",
        initials: "AL",
        role: "Barista",
        location: "BGC Store",
        status: "Active",
        tone: "rose",
    },
    {
        name: "Ren Dela Cruz",
        initials: "RD",
        role: "Barista",
        location: "BGC Store",
        status: "Active",
        tone: "amber",
    },
];

const schedule = [
    {
        day: "Mon, Sep 28",
        start: "9:00 AM",
        end: "5:00 PM",
        title: "Morning shift",
        person: "Mia Santos",
        location: "Makati Central",
        tone: "indigo",
    },
    {
        day: "Tue, Sep 29",
        start: "10:00 AM",
        end: "6:00 PM",
        title: "Front of house",
        person: "Paolo Cruz",
        location: "Makati Central",
        tone: "emerald",
    },
    {
        day: "Tue, Sep 29",
        start: "12:00 PM",
        end: "4:00 PM",
        title: "Bar support",
        person: "Jules Tan",
        location: "Makati Central",
        tone: "amber",
    },
    {
        day: "Wed, Sep 30",
        start: "8:00 AM",
        end: "4:00 PM",
        title: "Opening team",
        person: "Nico Reyes",
        location: "BGC Store",
        tone: "rose",
    },
    {
        day: "Thu, Oct 1",
        start: "9:00 AM",
        end: "5:00 PM",
        title: "Morning shift",
        person: "Aya Lim",
        location: "BGC Store",
        tone: "indigo",
    },
    {
        day: "Fri, Oct 2",
        start: "11:00 AM",
        end: "7:00 PM",
        title: "Closing shift",
        person: "Ren Dela Cruz",
        location: "Makati Central",
        tone: "emerald",
    },
];

const visibleTeam = computed(() => {
    const query = teamSearch.value.trim().toLowerCase();

    return teamMembers.filter((member) => {
        const matchesQuery =
            !query ||
            member.name.toLowerCase().includes(query) ||
            member.role.toLowerCase().includes(query);
        const matchesLocation =
            selectedLocation.value === "All locations" ||
            member.location === selectedLocation.value;

        return matchesQuery && matchesLocation;
    });
});

const filteredSwaps = computed(() => filterRequests(swapRequests.value));
const filteredTimeOff = computed(() => filterRequests(timeOffRequests.value));

const pageContent: Record<
    string,
    { eyebrow: string; title: string; description: string }
> = {
    Schedule: {
        eyebrow: "Workforce",
        title: "Team schedule",
        description: "Plan coverage and keep every shift in sync.",
    },
    "Shift swaps": {
        eyebrow: "Requests",
        title: "Shift swaps",
        description: "Review shift trades and offers from your team.",
    },
    "Time off": {
        eyebrow: "Requests",
        title: "Time off",
        description: "Review upcoming leave and keep your schedule covered.",
    },
    Team: {
        eyebrow: "People",
        title: "Your team",
        description: "Manage your people, roles, and team locations.",
    },
    Locations: {
        eyebrow: "Workspace",
        title: "Locations",
        description: "View the locations connected to your workspace.",
    },
    Settings: {
        eyebrow: "Workspace",
        title: "Settings",
        description: "Manage your workspace details and preferences.",
    },
};

const pageInfo = computed(
    () => pageContent[props.page] ?? pageContent.Schedule,
);

function filterRequests<T extends { status: RequestStatus }>(
    requests: T[],
): T[] {
    if (requestFilter.value === "All") return requests;
    return requests.filter((request) => request.status === requestFilter.value);
}

function updateRequestStatus(
    requests: { id: number; status: RequestStatus }[],
    id: number,
    status: RequestStatus,
): void {
    const request = requests.find((item) => item.id === id);
    if (request) request.status = status;
}

function shiftBarClasses(tone: string): string {
    const tones: Record<string, string> = {
        indigo: "bg-indigo-500",
        amber: "bg-amber-500",
        rose: "bg-rose-500",
        emerald: "bg-emerald-500",
    };
    return tones[tone] ?? "bg-slate-500";
}

function statusClasses(status: RequestStatus): string {
    if (status === "Approved") return "bg-emerald-50 text-emerald-700";
    if (status === "Declined") return "bg-rose-50 text-rose-700";
    return "bg-amber-50 text-amber-700";
}

function avatarClasses(tone: string): string {
    const tones: Record<string, string> = {
        violet: "bg-violet-100 text-violet-700",
        indigo: "bg-indigo-100 text-indigo-700",
        amber: "bg-amber-100 text-amber-700",
        emerald: "bg-emerald-100 text-emerald-700",
        sky: "bg-sky-100 text-sky-700",
        rose: "bg-rose-100 text-rose-700",
    };
    return tones[tone] ?? "bg-slate-100 text-slate-700";
}

function saveSettings(): void {
    settingsSaved.value = true;
    window.setTimeout(() => {
        settingsSaved.value = false;
    }, 2500);
}
</script>

<template>
    <div class="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <header
            class="mb-7 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
        >
            <div>
                <p class="mb-2 text-xs font-semibold text-slate-500">
                    {{ pageInfo.eyebrow }}
                </p>
                <h1
                    class="font-['Plus_Jakarta_Sans'] text-2xl font-bold tracking-[-0.04em] text-slate-950 sm:text-[30px]"
                >
                    {{ pageInfo.title }}
                </h1>
                <p class="mt-2 text-sm text-slate-500">
                    {{ pageInfo.description }}
                </p>
            </div>
            <button
                v-if="page === 'Schedule'"
                class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                @click="emit('create-shift')"
            >
                <span class="text-lg leading-none">+</span> Create a shift
            </button>
            <button
                v-else-if="page === 'Team'"
                class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                @click="teamSearch = ''"
            >
                <span class="text-lg leading-none">+</span> Add team member
            </button>
        </header>

        <template v-if="page === 'Schedule'">
            <section class="mb-5 grid gap-4 sm:grid-cols-3">
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Shifts this week
                    </p>
                    <p
                        class="mt-2 font-['Plus_Jakarta_Sans'] text-2xl font-bold text-slate-900"
                    >
                        18
                    </p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        Across 2 locations
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Scheduled hours
                    </p>
                    <p
                        class="mt-2 font-['Plus_Jakarta_Sans'] text-2xl font-bold text-slate-900"
                    >
                        184.5 <span class="text-sm">hrs</span>
                    </p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        8.2% more than last week
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">Coverage</p>
                    <p
                        class="mt-2 font-['Plus_Jakarta_Sans'] text-2xl font-bold text-emerald-600"
                    >
                        96.4%
                    </p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        No gaps in the next 3 days
                    </p>
                </div>
            </section>
            <section
                class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
            >
                <div
                    class="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div>
                        <h2
                            class="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900"
                        >
                            Week of September 28
                        </h2>
                        <p class="mt-1 text-xs text-slate-400">
                            Review assigned shifts by team member and location.
                        </p>
                    </div>
                    <select
                        v-model="selectedLocation"
                        aria-label="Filter schedule by location"
                        class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                    >
                        <option>All locations</option>
                        <option>Makati Central</option>
                        <option>BGC Store</option>
                    </select>
                </div>
                <div class="divide-y divide-slate-100">
                    <article
                        v-for="(shift, index) in schedule.filter(
                            (item) =>
                                selectedLocation === 'All locations' ||
                                item.location === selectedLocation,
                        )"
                        :key="`${shift.title}-${index}`"
                        class="flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap"
                    >
                        <p
                            class="w-28 shrink-0 text-xs font-bold text-slate-500"
                        >
                            {{ shift.day }}
                        </p>
                        <span
                            class="h-10 w-1 shrink-0 rounded-full"
                            :class="shiftBarClasses(shift.tone)"
                        />
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-bold text-slate-800">
                                {{ shift.title }}
                            </p>
                            <p class="mt-1 text-xs text-slate-400">
                                {{ shift.start }} – {{ shift.end }} ·
                                {{ shift.location }}
                            </p>
                        </div>
                        <span class="text-xs font-semibold text-slate-600">{{
                            shift.person
                        }}</span>
                    </article>
                </div>
            </section>
        </template>

        <template v-else-if="page === 'Shift swaps' || page === 'Time off'">
            <section class="mb-5 grid gap-4 sm:grid-cols-3">
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Total requests
                    </p>
                    <p class="mt-2 text-2xl font-bold text-slate-900">
                        {{
                            page === "Shift swaps"
                                ? swapRequests.length
                                : timeOffRequests.length
                        }}
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Awaiting review
                    </p>
                    <p class="mt-2 text-2xl font-bold text-amber-600">
                        {{
                            (page === "Shift swaps"
                                ? swapRequests
                                : timeOffRequests
                            ).filter((item) => item.status === "Pending").length
                        }}
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">Resolved</p>
                    <p class="mt-2 text-2xl font-bold text-emerald-600">
                        {{
                            (page === "Shift swaps"
                                ? swapRequests
                                : timeOffRequests
                            ).filter((item) => item.status !== "Pending").length
                        }}
                    </p>
                </div>
            </section>
            <section
                class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
            >
                <div
                    class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5"
                >
                    <div>
                        <h2
                            class="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900"
                        >
                            {{
                                page === "Shift swaps"
                                    ? "Swap requests"
                                    : "Time-off requests"
                            }}
                        </h2>
                        <p class="mt-1 text-xs text-slate-400">
                            {{
                                page === "Shift swaps"
                                    ? "Review offers and shift coverage details."
                                    : "Review leave requests from your team."
                            }}
                        </p>
                    </div>
                    <div
                        class="flex rounded-lg border border-slate-200 bg-slate-50 p-1"
                        aria-label="Filter requests"
                    >
                        <button
                            v-for="filter in [
                                'All',
                                'Pending',
                                'Approved',
                                'Declined',
                            ] as RequestFilter[]"
                            :key="filter"
                            class="rounded-md px-3 py-1.5 text-[10px] font-bold"
                            :class="
                                requestFilter === filter
                                    ? 'bg-white text-indigo-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                            "
                            @click="requestFilter = filter"
                        >
                            {{ filter }}
                        </button>
                    </div>
                </div>
                <div
                    v-if="page === 'Shift swaps'"
                    class="divide-y divide-slate-100"
                >
                    <article
                        v-for="request in filteredSwaps"
                        :key="request.id"
                        class="p-5 sm:p-6"
                    >
                        <div class="flex flex-wrap items-start gap-3">
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                                :class="avatarClasses(request.tone)"
                            >
                                {{ request.initials }}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3
                                        class="text-sm font-bold text-slate-900"
                                    >
                                        {{ request.name }}
                                    </h3>
                                    <span
                                        class="rounded-full px-2 py-1 text-[10px] font-bold"
                                        :class="statusClasses(request.status)"
                                        >{{ request.status }}</span
                                    >
                                </div>
                                <p class="mt-1 text-xs text-slate-500">
                                    {{ request.shift }} · {{ request.date }} ·
                                    {{ request.time }}
                                </p>
                                <p
                                    class="mt-3 text-xs leading-5 text-slate-500"
                                >
                                    {{ request.reason }}
                                </p>
                            </div>
                            <div
                                v-if="request.status === 'Pending'"
                                class="flex w-full gap-2 sm:w-auto"
                            >
                                <button
                                    class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:flex-none"
                                    @click="
                                        updateRequestStatus(
                                            swapRequests,
                                            request.id,
                                            'Declined',
                                        )
                                    "
                                >
                                    Decline</button
                                ><button
                                    class="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 sm:flex-none"
                                    @click="
                                        updateRequestStatus(
                                            swapRequests,
                                            request.id,
                                            'Approved',
                                        )
                                    "
                                >
                                    Approve swap
                                </button>
                            </div>
                        </div>
                    </article>
                    <p
                        v-if="filteredSwaps.length === 0"
                        class="p-8 text-center text-sm text-slate-500"
                    >
                        No swap requests match this filter.
                    </p>
                </div>
                <div v-else class="divide-y divide-slate-100">
                    <article
                        v-for="request in filteredTimeOff"
                        :key="request.id"
                        class="p-5 sm:p-6"
                    >
                        <div class="flex flex-wrap items-start gap-3">
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold"
                                :class="avatarClasses(request.tone)"
                            >
                                {{ request.initials }}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <h3
                                        class="text-sm font-bold text-slate-900"
                                    >
                                        {{ request.name }}
                                    </h3>
                                    <span
                                        class="rounded-full px-2 py-1 text-[10px] font-bold"
                                        :class="statusClasses(request.status)"
                                        >{{ request.status }}</span
                                    >
                                </div>
                                <p class="mt-1 text-xs text-slate-500">
                                    {{ request.type }} · {{ request.dates }} ·
                                    {{ request.days }}
                                </p>
                                <p class="mt-3 text-xs text-slate-500">
                                    Note: {{ request.note }}
                                </p>
                            </div>
                            <div
                                v-if="request.status === 'Pending'"
                                class="flex w-full gap-2 sm:w-auto"
                            >
                                <button
                                    class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:flex-none"
                                    @click="
                                        updateRequestStatus(
                                            timeOffRequests,
                                            request.id,
                                            'Declined',
                                        )
                                    "
                                >
                                    Decline</button
                                ><button
                                    class="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 sm:flex-none"
                                    @click="
                                        updateRequestStatus(
                                            timeOffRequests,
                                            request.id,
                                            'Approved',
                                        )
                                    "
                                >
                                    Approve leave
                                </button>
                            </div>
                        </div>
                    </article>
                    <p
                        v-if="filteredTimeOff.length === 0"
                        class="p-8 text-center text-sm text-slate-500"
                    >
                        No time-off requests match this filter.
                    </p>
                </div>
            </section>
        </template>

        <template v-else-if="page === 'Team'">
            <section class="mb-5 grid gap-4 sm:grid-cols-3">
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Team members
                    </p>
                    <p class="mt-2 text-2xl font-bold text-slate-900">24</p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        Across all locations
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Shift leads
                    </p>
                    <p class="mt-2 text-2xl font-bold text-slate-900">4</p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        2 per location
                    </p>
                </div>
                <div
                    class="rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                    <p class="text-xs font-semibold text-slate-500">
                        Invitations
                    </p>
                    <p class="mt-2 text-2xl font-bold text-indigo-600">2</p>
                    <p class="mt-1 text-[11px] text-slate-400">
                        Waiting to be accepted
                    </p>
                </div>
            </section>
            <section
                class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
            >
                <div
                    class="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div>
                        <h2
                            class="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900"
                        >
                            Team directory
                        </h2>
                        <p class="mt-1 text-xs text-slate-400">
                            {{ visibleTeam.length }} team members shown
                        </p>
                    </div>
                    <div class="flex flex-col gap-2 sm:flex-row">
                        <input
                            v-model="teamSearch"
                            aria-label="Search team"
                            placeholder="Search team..."
                            class="h-10 rounded-xl border border-slate-200 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                        /><select
                            v-model="selectedLocation"
                            aria-label="Filter team by location"
                            class="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none focus:border-indigo-300"
                        >
                            <option>All locations</option>
                            <option>Makati Central</option>
                            <option>BGC Store</option>
                        </select>
                    </div>
                </div>
                <div class="divide-y divide-slate-100">
                    <article
                        v-for="member in visibleTeam"
                        :key="member.name"
                        class="flex items-center gap-3 px-5 py-4"
                    >
                        <div
                            class="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold"
                            :class="avatarClasses(member.tone)"
                        >
                            {{ member.initials }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-bold text-slate-800">
                                {{ member.name }}
                            </p>
                            <p class="mt-1 text-xs text-slate-400">
                                {{ member.role }} · {{ member.location }}
                            </p>
                        </div>
                        <span
                            class="rounded-full px-2.5 py-1 text-[10px] font-bold"
                            :class="
                                member.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500'
                            "
                            >{{ member.status }}</span
                        ><button
                            class="rounded-lg px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                        >
                            View
                        </button>
                    </article>
                    <p
                        v-if="visibleTeam.length === 0"
                        class="p-8 text-center text-sm text-slate-500"
                    >
                        No team members match your search.
                    </p>
                </div>
            </section>
        </template>

        <template v-else-if="page === 'Locations'">
            <section class="grid gap-5 lg:grid-cols-2">
                <article
                    v-for="(location, index) in [
                        {
                            name: 'Makati Central',
                            address: '6782 Ayala Avenue, Makati City',
                            members: 13,
                            shifts: 42,
                            tone: 'indigo',
                        },
                        {
                            name: 'BGC Store',
                            address: '5th Avenue, Bonifacio Global City',
                            members: 11,
                            shifts: 38,
                            tone: 'emerald',
                        },
                    ]"
                    :key="location.name"
                    class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
                >
                    <div
                        class="flex h-36 items-center justify-center bg-gradient-to-br"
                        :class="
                            index === 0
                                ? 'from-indigo-100 to-violet-50'
                                : 'from-emerald-100 to-teal-50'
                        "
                    >
                        <div
                            class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm"
                        >
                            <svg
                                class="h-6 w-6"
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
                        </div>
                    </div>
                    <div class="p-5">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <h2
                                    class="font-['Plus_Jakarta_Sans'] text-lg font-bold text-slate-900"
                                >
                                    {{ location.name }}
                                </h2>
                                <p class="mt-1 text-xs text-slate-500">
                                    {{ location.address }}
                                </p>
                            </div>
                            <span
                                class="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                >Active</span
                            >
                        </div>
                        <div
                            class="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4"
                        >
                            <div>
                                <p class="text-xs text-slate-400">
                                    Team members
                                </p>
                                <p
                                    class="mt-1 text-sm font-bold text-slate-800"
                                >
                                    {{ location.members }}
                                </p>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400">
                                    Shifts this week
                                </p>
                                <p
                                    class="mt-1 text-sm font-bold text-slate-800"
                                >
                                    {{ location.shifts }}
                                </p>
                            </div>
                        </div>
                        <button
                            class="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                            Manage location
                        </button>
                    </div>
                </article>
                <button
                    class="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center transition hover:border-indigo-300 hover:bg-white"
                >
                    <span
                        class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-2xl font-light text-indigo-600"
                        >+</span
                    ><span class="mt-3 text-sm font-bold text-slate-800"
                        >Add a location</span
                    ><span class="mt-1 text-xs text-slate-400"
                        >Set up another workspace location</span
                    >
                </button>
            </section>
        </template>

        <template v-else>
            <div
                class="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]"
            >
                <section
                    class="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6"
                >
                    <h2
                        class="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900"
                    >
                        Workspace details
                    </h2>
                    <p class="mt-1 text-xs text-slate-400">
                        Update the details your team sees.
                    </p>
                    <form class="mt-6 space-y-4" @submit.prevent="saveSettings">
                        <label class="block"
                            ><span
                                class="mb-1.5 block text-xs font-bold text-slate-700"
                                >Workspace name</span
                            ><input
                                value="ShiftSwap Coffee Co."
                                class="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                        /></label>
                        <label class="block"
                            ><span
                                class="mb-1.5 block text-xs font-bold text-slate-700"
                                >Business email</span
                            ><input
                                type="email"
                                value="hello@shiftswap.co"
                                class="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100/70"
                        /></label>
                        <label class="block"
                            ><span
                                class="mb-1.5 block text-xs font-bold text-slate-700"
                                >Timezone</span
                            ><select
                                class="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-300"
                            >
                                <option>Asia/Manila (GMT+8)</option>
                                <option>UTC</option>
                            </select></label
                        >
                        <div class="flex items-center gap-3">
                            <button
                                class="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                            >
                                Save changes</button
                            ><span
                                v-if="settingsSaved"
                                role="status"
                                class="text-xs font-semibold text-emerald-600"
                                >Settings saved.</span
                            >
                        </div>
                    </form>
                </section>
                <section
                    class="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6"
                >
                    <h2
                        class="font-['Plus_Jakarta_Sans'] text-base font-bold text-slate-900"
                    >
                        Preferences
                    </h2>
                    <p class="mt-1 text-xs text-slate-400">
                        Choose how your workspace behaves.
                    </p>
                    <label
                        class="mt-5 flex items-start gap-3 border-b border-slate-100 pb-4"
                        ><input
                            type="checkbox"
                            checked
                            class="mt-0.5 accent-indigo-600"
                        /><span
                            ><span
                                class="block text-xs font-bold text-slate-800"
                                >Email notifications</span
                            ><span
                                class="mt-1 block text-[11px] leading-5 text-slate-400"
                                >Get notified about new requests and schedule
                                changes.</span
                            ></span
                        ></label
                    ><label
                        class="mt-4 flex items-start gap-3 border-b border-slate-100 pb-4"
                        ><input
                            type="checkbox"
                            checked
                            class="mt-0.5 accent-indigo-600"
                        /><span
                            ><span
                                class="block text-xs font-bold text-slate-800"
                                >Weekly schedule reminders</span
                            ><span
                                class="mt-1 block text-[11px] leading-5 text-slate-400"
                                >Send the team their upcoming weekly
                                schedule.</span
                            ></span
                        ></label
                    >
                    <div class="mt-5 rounded-xl bg-rose-50 p-4">
                        <p class="text-xs font-bold text-rose-800">
                            Danger zone
                        </p>
                        <p class="mt-1 text-[11px] leading-5 text-rose-700/80">
                            Workspace deletion is permanent and removes access
                            for the entire team.
                        </p>
                        <button
                            class="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                        >
                            Delete workspace
                        </button>
                    </div>
                </section>
            </div>
        </template>
    </div>
</template>
