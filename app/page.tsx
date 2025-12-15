"use client";

import { validateAndNormalizePhone } from "@/lib/phone";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type MySubmission = {
  agentId: string;
  createdAt: string;
  rating: number;
  notes: string;
  countryRegion: string;
  quickTags: string[];
  focusTags: string[];
};

type Agent = {
  id: string;
  name: string;
  location: string;
  linkedin: string;
  phoneCountryCode: string;
  phone: string;
  summary: string;
  tags: string[];
  createdAt: Date;
};

type Experience = {
  rating: number;
  notes: string;
  tags: string[];
  countryRegion: string;
  ghosted: boolean;
  fakeJob: boolean;
  noResponse: boolean;
  createdAt: Date;
};

function normalizeLinkedin(value: string) {
  return value.trim().toLowerCase().replace(/\/+$/, "");
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDisplayName(value: string) {
  const normalized = normalizeName(value);
  if (!normalized) return "";

  const titleCaseSegment = (segment: string) =>
    segment
      .split("'")
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ""))
      .join("'");

  return normalized
    .split(" ")
    .map((word) => word.split("-").map(titleCaseSegment).join("-"))
    .join(" ");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function normalizeCountryCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : "";
}

function formatMaskedPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length !== 10) return "";
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 6);
  const third = digits.slice(6, 7);
  const last = digits.slice(9, 10);
  return `${first}-${second}-${third}xx${last}`;
}

function submissionTags(item: Experience) {
  const tags = new Set<string>(item.tags || []);
  if (item.ghosted) tags.add("Ghosted");
  if (item.fakeJob) tags.add("Fake job");
  if (item.noResponse) tags.add("No response");
  return Array.from(tags);
}

function tagCountsFor(items: Experience[]) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const tag of submissionTags(item)) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return counts;
}

function quickTagCountsFor(items: Experience[], quickTags: string[]) {
  const allowed = new Set(quickTags.map((tag) => tag.toLowerCase()));
  const counts = tagCountsFor(items);
  const filtered: Record<string, number> = {};

  for (const [tag, count] of Object.entries(counts)) {
    if (allowed.has(tag.toLowerCase())) filtered[tag] = count;
  }

  return filtered;
}

function quickTagVoteCountFor(items: Experience[], quickTags: string[]) {
  const counts = quickTagCountsFor(items, quickTags);
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}

function normalizeCountryRegion(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  if (trimmed === "--") return "unknown";
  if (trimmed.toLowerCase() === "unknown") return "unknown";
  return trimmed;
}

const quickTags = ["Ghosted", "Resume taker", "Slow response", "Good experience", "Got interview/job"];
const quickTagSet = new Set(quickTags.map(normalizeTag));

function filterQuickTags(tags: string[]) {
  return tags.filter((tag) => quickTagSet.has(normalizeTag(tag)));
}

function filterOutQuickTags(tags: string[]) {
  return tags.filter((tag) => !quickTagSet.has(normalizeTag(tag)));
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [experiences, setExperiences] = useState<Record<string, Experience[]>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [detailsOpenByAgentId, setDetailsOpenByAgentId] = useState<Record<string, boolean>>({});
  const [authUser, setAuthUser] = useState<{ id: string; email?: string; name?: string; picture?: string } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [isMySubmissionsLoading, setIsMySubmissionsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState<
    "latest" | "rating-desc" | "rating-asc" | "tags-desc" | "name-asc" | "name-desc"
  >("latest");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    linkedin: "",
    phoneCountryCode: "+1",
    phone: "",
    summary: "",
    tags: "",
    rating: 5,
  });
  const [selectedQuickTags, setSelectedQuickTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const refreshFromApi = useCallback(async () => {
    const safeDate = (value: unknown) => {
      if (typeof value !== "string") return new Date();
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date() : date;
    };

    setIsLoading(true);
    setLoadError(null);

    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load agents (${res.status})`);

      const data = (await res.json()) as {
        agents?: Array<{
          id: string;
          name: string;
          location: string;
          linkedin: string;
          phoneCountryCode?: string;
          phone?: string;
          summary?: string;
          tags: string[];
          createdAt: string;
        }>;
        experiencesByAgentId?: Record<
          string,
          Array<{
            rating: number;
            notes: string;
            tags?: string[];
            countryRegion?: string;
            ghosted: boolean;
            fakeJob: boolean;
            noResponse: boolean;
            createdAt: string;
          }>
        >;
      };

      if (!Array.isArray(data.agents)) throw new Error("Unexpected response from API");

      const nextAgents: Agent[] = data.agents.map((agent) => ({
        id: agent.id,
        name: normalizeName(agent.name),
        location: agent.location,
        linkedin: agent.linkedin,
        phoneCountryCode: normalizeCountryCode(agent.phoneCountryCode ?? "+1") || "+1",
        phone: normalizePhone(typeof agent.phone === "string" ? agent.phone : ""),
        summary: typeof agent.summary === "string" ? agent.summary : "",
        tags: Array.isArray(agent.tags) ? filterOutQuickTags(agent.tags) : [],
        createdAt: safeDate(agent.createdAt),
      }));

      const nextExperiences: Record<string, Experience[]> = {};
      const exp = data.experiencesByAgentId ?? {};
      for (const [agentId, items] of Object.entries(exp)) {
        if (!Array.isArray(items)) continue;
        nextExperiences[agentId] = items.map((item) => ({
          rating: Number(item.rating ?? 0),
          notes: item.notes ?? "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          countryRegion: normalizeCountryRegion(item.countryRegion || ""),
          ghosted: Boolean(item.ghosted),
          fakeJob: Boolean(item.fakeJob),
          noResponse: Boolean(item.noResponse),
          createdAt: safeDate(item.createdAt),
        }));
      }

      setAgents(nextAgents);
      setExperiences(nextExperiences);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agents";
      setLoadError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshMySubmissions = useCallback(async () => {
    if (!authUser) {
      setMySubmissions([]);
      return true;
    }

    setIsMySubmissionsLoading(true);
    try {
      const res = await fetch("/api/profile/submissions", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load your submissions (${res.status})`);

      const data = (await res.json()) as {
        submissions?: Array<{
          agentId?: string;
          createdAt?: string;
          rating?: number;
          notes?: string;
          countryRegion?: string;
          quickTags?: string[];
          focusTags?: string[];
        }>;
      };

      const next: MySubmission[] = [];
      for (const item of data.submissions ?? []) {
        const agentId = typeof item.agentId === "string" ? item.agentId : "";
        const createdAt = typeof item.createdAt === "string" ? item.createdAt : "";
        if (!agentId || !createdAt) continue;
        next.push({
          agentId,
          createdAt,
          rating: Number(item.rating ?? 0),
          notes: typeof item.notes === "string" ? item.notes : "",
          countryRegion: typeof item.countryRegion === "string" ? item.countryRegion : "",
          quickTags: Array.isArray(item.quickTags) ? item.quickTags.filter((t) => typeof t === "string") : [],
          focusTags: Array.isArray(item.focusTags) ? item.focusTags.filter((t) => typeof t === "string") : [],
        });
      }

      setMySubmissions(next);
      return true;
    } catch {
      setMySubmissions([]);
      return false;
    } finally {
      setIsMySubmissionsLoading(false);
    }
  }, [authUser]);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshFromApi(), refreshMySubmissions()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFromApi, refreshMySubmissions]);

  useEffect(() => {
    void refreshFromApi();
  }, [refreshFromApi]);

  useEffect(() => {
    void refreshMySubmissions();
  }, [refreshMySubmissions]);

  useEffect(() => {
    const authErr = new URLSearchParams(window.location.search).get("authError");
    if (authErr) {
      setAuthError(authErr === "state_mismatch" ? "LinkedIn sign-in failed. Please try again." : "LinkedIn sign-in failed.");
    }

    const load = async () => {
      setIsAuthLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load auth state");
        const data = (await res.json()) as {
          user?: { id: string; email?: string; name?: string; picture?: string } | null;
        };
        setAuthUser(data.user ?? null);
      } catch {
        setAuthUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const apply = () => setSystemTheme(media.matches ? "dark" : "light");
    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  const filteredAgents = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) =>
      [agent.name, agent.location, agent.summary, agent.tags.join(" "), agent.phone]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [agents, search]);

  const handleInput =
    (key: "name" | "location" | "linkedin" | "phoneCountryCode" | "phone" | "summary" | "tags") =>
      (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [key]: e.target.value }));
      };

  const handleRating = (value: number) => {
    setFormData((prev) => ({ ...prev, rating: value }));
  };

  const toggleQuickTag = (tag: string) => {
    setSelectedQuickTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const effectiveTheme = themeMode === "system" ? systemTheme : themeMode;
  const isDark = effectiveTheme === "dark";
  const pageBg = isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const panelClass = isDark
    ? "rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/40"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";
  const inputBaseClass = isDark
    ? "rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:bg-slate-900"
    : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white";
  const inputClass = `w-full ${inputBaseClass}`;
  const chipClass = isDark
    ? "rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100"
    : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700";
  const cardClass = isDark
    ? "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/40 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg";
  const labelClass = isDark ? "text-sm text-slate-200" : "text-sm text-slate-700";

  const mySubmissionByAgentId = useMemo(() => {
    const map = new Map<string, MySubmission>();
    for (const submission of mySubmissions) {
      if (!submission.agentId) continue;
      const existing = map.get(submission.agentId);
      if (!existing) {
        map.set(submission.agentId, submission);
        continue;
      }
      const nextTime = new Date(submission.createdAt).getTime();
      const existingTime = new Date(existing.createdAt).getTime();
      if (Number.isFinite(nextTime) && Number.isFinite(existingTime)) {
        if (nextTime > existingTime) map.set(submission.agentId, submission);
      } else if (submission.createdAt > existing.createdAt) {
        map.set(submission.agentId, submission);
      }
    }
    return map;
  }, [mySubmissions]);

  const selectedAgent = selectedAgentId ? agents.find((agent) => agent.id === selectedAgentId) : undefined;
  const selectedMySubmission = selectedAgentId ? (mySubmissionByAgentId.get(selectedAgentId) ?? null) : null;
  const isEditingMySubmission = Boolean(selectedAgent && selectedMySubmission);

  const selectAgentForSubmission = (agent: Agent) => {
    setSelectedAgentId(agent.id);
    const mySubmission = mySubmissionByAgentId.get(agent.id) ?? null;
    setSelectedQuickTags(mySubmission ? mySubmission.quickTags : []);
    setFormData((prev) => ({
      ...prev,
      name: formatDisplayName(agent.name),
      location: mySubmission
        ? mySubmission.countryRegion === "unknown"
          ? ""
          : mySubmission.countryRegion
        : agent.location === "unknown"
          ? ""
          : agent.location,
      linkedin: agent.linkedin,
      phoneCountryCode: normalizeCountryCode(agent.phoneCountryCode) || "+1",
      phone: normalizePhone(agent.phone),
      tags: (mySubmission ? filterOutQuickTags(mySubmission.focusTags) : (agent.tags ?? [])).join(", "),
      summary: mySubmission ? mySubmission.notes : "",
      rating: mySubmission ? mySubmission.rating : prev.rating,
    }));

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    if (!authUser) {
      setSaveError("Please sign in with LinkedIn to submit.");
      return;
    }
    if (selectedAgent && isMySubmissionsLoading) {
      setSaveError("Loading your submissions. Please try again in a moment.");
      return;
    }

    setSaveError(null);
    const name = normalizeName(formData.name);
    if (!name) return;

    const createdAt = new Date();
    const ratingValue = Number(formData.rating);
    const phoneCountryCode = normalizeCountryCode(formData.phoneCountryCode) || "+1";
    const phone = normalizePhone(formData.phone);
    const phoneRaw = formData.phone.trim();
    let validatedPhoneCountryCode = phoneCountryCode;
    let validatedPhone = phone;
    if (phoneRaw) {
      const validated = validateAndNormalizePhone(phoneCountryCode, phone);
      if (!validated) {
        setSaveError("Invalid mobile phone for country code.");
        return;
      }
      validatedPhoneCountryCode = validated.phoneCountryCode;
      validatedPhone = validated.phone;
    }
    const locationInput = formData.location.trim();
    const countryRegion = normalizeCountryRegion(locationInput);
    const focusAreaTags = filterOutQuickTags(
      formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    const commentTags = selectedQuickTags;

    const linkedinInput = formData.linkedin.trim();
    const linkedin = linkedinInput ? normalizeLinkedin(linkedinInput) : "";
    const existingAgent = selectedAgent;
    const existingSubmission = selectedMySubmission;

    setIsSaving(true);

    try {
      const res = existingAgent && existingSubmission
        ? await fetch("/api/profile/submissions", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              agentId: existingAgent.id,
              createdAt: existingSubmission.createdAt,
              agentName: name,
              rating: ratingValue,
              notes: formData.summary.trim(),
              countryRegion,
              quickTags: commentTags,
              focusTags: focusAreaTags,
              phoneCountryCode: validatedPhone ? validatedPhoneCountryCode : undefined,
              phone: validatedPhone,
            }),
          })
        : await fetch("/api/agents", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              existingAgent
                ? {
                    id: existingAgent.id,
                    name,
                    location: locationInput ? countryRegion : existingAgent.location,
                    linkedin: linkedin || existingAgent.linkedin,
                    phoneCountryCode: validatedPhone ? validatedPhoneCountryCode : undefined,
                    phone: validatedPhone,
                    tags: focusAreaTags,
                    rating: ratingValue,
                    notes: formData.summary.trim(),
                    experienceTags: commentTags,
                    countryRegion,
                    createdAt: createdAt.toISOString(),
                  }
                : {
                    name,
                    location: countryRegion,
                    linkedin,
                    phoneCountryCode: validatedPhone ? validatedPhoneCountryCode : phoneCountryCode,
                    phone: validatedPhone,
                    tags: focusAreaTags,
                    rating: ratingValue,
                    notes: formData.summary.trim(),
                    experienceTags: commentTags,
                    countryRegion,
                    createdAt: createdAt.toISOString(),
                  }
            ),
          });

      if (!res.ok) {
        let errorMessage = `Failed to save (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) errorMessage = data.error;
        } catch {}
        throw new Error(errorMessage);
      }

      await refreshFromApi();
      await refreshMySubmissions();

      setFormData({
        name: "",
        location: "",
        linkedin: "",
        phoneCountryCode: "+1",
        phone: "",
        summary: "",
        tags: "",
        rating: 5,
      });
      setSelectedAgentId(null);
      setSelectedQuickTags([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }

  };

  const averageRating = (items: Experience[]) => {
    if (!items.length) return 0;
    const total = items.reduce((sum, item) => sum + item.rating, 0);
    return Math.round((total / items.length) * 10) / 10;
  };

  const sortedAgents = useMemo(() => {
    const list = [...filteredAgents];
    list.sort((a, b) => {
      const aAvg = averageRating(experiences[a.id] || []);
      const bAvg = averageRating(experiences[b.id] || []);
      const aTagVotes = quickTagVoteCountFor(experiences[a.id] || [], quickTags);
      const bTagVotes = quickTagVoteCountFor(experiences[b.id] || [], quickTags);
      if (sortOption === "latest") return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortOption === "tags-desc") return bTagVotes - aTagVotes || b.createdAt.getTime() - a.createdAt.getTime();
      if (sortOption === "rating-desc") return bAvg - aAvg || a.name.localeCompare(b.name);
      if (sortOption === "rating-asc") return aAvg - bAvg || a.name.localeCompare(b.name);
      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
    return list;
  }, [filteredAgents, sortOption, experiences]);

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="flex justify-end px-4 pt-6 sm:px-6 lg:px-10">
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (themeMode === "system") {
                setThemeMode(isDark ? "light" : "dark");
                return;
              }
              if (themeMode === "dark") {
                setThemeMode("light");
                return;
              }
              setThemeMode("system");
            }}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
                ? "border-slate-700 bg-slate-800 text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
                : "border-slate-200 bg-slate-50 text-slate-800 hover:border-emerald-300 hover:text-emerald-700"
              }`}
          >
            {themeMode === "system"
              ? `Theme: System (${isDark ? "Dark" : "Light"})`
              : `Theme: ${themeMode === "dark" ? "Dark" : "Light"}`}
          </button>
          <div className="flex items-center gap-3">
            {!isAuthLoading && !authUser && (
              <a
                href="/api/auth/linkedin/start"
                className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
                  ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
                  : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:text-emerald-700"
                  }`}
              >
                Sign in with LinkedIn
              </a>
            )}
            {!isAuthLoading && authUser && (
              <div className="flex flex-col items-end gap-2">
                <a
                  href="/profile"
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
                    ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
                    : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:text-emerald-700"
                    }`}
                >
                  My Profile
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                    } finally {
                      setAuthUser(null);
                    }
                  }}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
                    ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-slate-500"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                    }`}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:gap-10 sm:px-6 lg:px-8">
        <header className={`${panelClass} p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500">HR Agent Directory</p>
          <h1
            className={`mt-3 text-3xl font-semibold leading-tight sm:text-4xl ${isDark ? "text-slate-50" : "text-slate-900"
              }`}
          >
            Share HR agents, then see how others experienced them.
          </h1>
          <p
            className={`mt-3 max-w-3xl text-base leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"
              }`}
          >
            Layered like a social feed: add a profile with your own comments, search quickly, and browse cards that feel
            familiar to Facebook/LinkedIn.
          </p>
        </header>

        <form onSubmit={handleSubmit} className={panelClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">User input</p>
              <h2 className={`text-xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>
                {selectedAgent ? (isEditingMySubmission ? "Edit your review" : "Add your review") : "Add an HR agent"}
              </h2>
            </div>
            {selectedAgent ? (
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {isEditingMySubmission ? "Editing your submission: " : "Adding submission: "}
                  {formatDisplayName(selectedAgent.name)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAgentId(null)}
                  className={`text-xs font-semibold underline underline-offset-4 transition ${
                    isDark ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Clear
                </button>
              </div>
            ) : (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isDark ? "bg-emerald-900/40 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                New
              </span>
            )}
          </div>
          {authError && (
            <div
              role="alert"
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${isDark ? "border-rose-900/50 bg-rose-950/40 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-800"
                }`}
            >
              {authError}
            </div>
          )}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
              {isAuthLoading ? (
                "Checking sign-in…"
              ) : authUser ? (
                <span>
                  Signed in with LinkedIn{authUser.email ? ` (${authUser.email})` : ""}.
                </span>
              ) : (
                "Sign in with LinkedIn to add submissions."
              )}
            </div>
          </div>
          <fieldset disabled={!authUser || isSaving} className={!authUser ? "opacity-60" : ""}>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="name">
                Full name *
              </label>
              <input
                id="name"
                value={formData.name}
                onChange={handleInput("name")}
                required
                className={inputClass}
                placeholder="e.g. Jamie Park"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="location">
                Country/Region
              </label>
              <input
                id="location"
                value={formData.location}
                onChange={handleInput("location")}
                className={inputClass}
                placeholder="Remote, NYC, EMEA…"
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="linkedin">
                LinkedIn profile
              </label>
              <input
                id="linkedin"
                type="url"
                value={formData.linkedin}
                onChange={handleInput("linkedin")}
                className={inputClass}
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="phone">
                Mobile phone
              </label>
              <div className="flex gap-2">
                <input
                  id="phoneCountryCode"
                  aria-label="Mobile phone country code"
                  inputMode="numeric"
                  value={formData.phoneCountryCode}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setFormData((prev) => ({ ...prev, phoneCountryCode: digits ? `+${digits}` : "" }));
                  }}
                  className={`${inputBaseClass} w-20 shrink-0`}
                  placeholder="+1"
                />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  value={formData.phone}
                  maxLength={15}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
                    setFormData((prev) => ({ ...prev, phone: digits }));
                  }}
                  className={`${inputBaseClass} flex-1`}
                  placeholder="1234567890"
                />
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <label className={labelClass} htmlFor="summary">
                Comment
              </label>
              <textarea
                id="summary"
                value={formData.summary}
                onChange={handleInput("summary")}
                rows={3}
                className={`${inputClass} min-h-[120px]`}
                placeholder="Share your experience or assessment—responsiveness, honesty, process…"
              />
              <label className={labelClass} htmlFor="quickTags">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {quickTags.map((tag) => {
                  const active = selectedQuickTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleQuickTag(tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active
                          ? isDark
                            ? "border-emerald-400 bg-emerald-900/30 text-emerald-100"
                            : "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : isDark
                            ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-emerald-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200"
                        }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Quick tags under your comment: Ghosted, Slow response, Good experience, Got interview/job.
              </p>
            </div>
            <div className="space-y-2">
              <label className={labelClass} htmlFor="areatags">
                Focus areas (comma separated)
              </label>
              <input
                id="tags"
                value={formData.tags}
                onChange={handleInput("tags")}
                className={inputClass}
                placeholder="recruiting, HRBP, onboarding"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className={labelClass} htmlFor="rating">
                First rating (1-5)
              </label>
              <div className="flex flex-wrap gap-2" id="rating">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = formData.rating === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-sm font-semibold transition ${active
                          ? isDark
                            ? "border-emerald-400 bg-emerald-900/30 text-emerald-100"
                            : "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : isDark
                            ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200"
                        }`}
                    >
                      <input
                        type="radio"
                        name="rating"
                        value={value}
                        checked={active}
                        onChange={() => handleRating(value)}
                        className="sr-only"
                      />
                      <span>★</span>
                      <span>{value}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <button
              type="submit"
              disabled={isSaving || !authUser}
              className={`inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 ${
                isSaving ? "cursor-not-allowed opacity-70 hover:translate-y-0 hover:shadow-sm" : ""
              }`}
            >
              {isSaving && (
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              )}
              {isSaving ? "Saving..." : isEditingMySubmission ? "Update your review" : "Add to directory"}
            </button>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Saved to the database.
            </p>
          </div>
          </fieldset>
          {saveError && (
            <div
              role="alert"
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                isDark ? "border-rose-900/50 bg-rose-950/40 text-rose-100" : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              {saveError}
            </div>
          )}
        </form>

        <section className={panelClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Search</p>
              <h2 className={`text-xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>
                Find an agent quickly
              </h2>
              <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                Filter by name, focus, region, or keywords.
              </p>
            </div>
            <span
              className={`rounded-full px-4 py-2 text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                }`}
            >
              {isLoading ? "Loading..." : `${filteredAgents.length} match${filteredAgents.length === 1 ? "" : "es"}`}
            </span>
          </div>
          <div className="mt-4">
            <input
              id="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, focus, region, or keywords"
              className={inputClass}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Listing</p>
              <h2 className={`text-2xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>
                List of HR agents
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] ${isDark ? "text-slate-300" : "text-slate-500"
                  }`}
              >
                Sort
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold outline-none transition ${isDark
                      ? "border-slate-700 bg-slate-900 text-slate-100 focus:border-emerald-400"
                      : "border-slate-200 bg-slate-50 text-slate-800 focus:border-emerald-400"
                    }`}
                >
                  <option value="latest">Latest submit</option>
                  <option value="tags-desc">Most tag votes</option>
                  <option value="rating-desc">Rating: high to low</option>
                  <option value="rating-asc">Rating: low to high</option>
                  <option value="name-asc">Name: A → Z</option>
                  <option value="name-desc">Name: Z → A</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={isRefreshing || isLoading}
                className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  isDark
                    ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                }`}
              >
                {isRefreshing || isLoading ? "Refreshing…" : "Refresh"}
              </button>
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                  }`}
              >
                {isLoading ? "Loading..." : `${filteredAgents.length} match${filteredAgents.length === 1 ? "" : "es"}`}
              </span>
            </div>
          </div>
          {loadError && (
            <div
              role="alert"
              className={`rounded-3xl border px-6 py-4 text-sm ${isDark
                ? "border-rose-900/50 bg-rose-950/40 text-rose-100"
                : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold">Could not load agents from the database.</p>
                  <p className={`${isDark ? "text-rose-200/90" : "text-rose-700"}`}>{loadError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshFromApi()}
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
                    ? "border-rose-800/60 bg-rose-950/30 text-rose-100 hover:border-rose-600"
                    : "border-rose-200 bg-white text-rose-800 hover:border-rose-300"
                  }`}
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} aria-hidden className={`${cardClass} animate-pulse`}>
                  <div className="flex gap-4">
                    <div className={`h-12 w-12 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                    <div className="flex-1 space-y-3">
                      <div className={`h-5 w-44 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                      <div className={`h-4 w-72 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                      <div className={`h-4 w-56 rounded ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              sortedAgents.map((agent) => {
              const entries = experiences[agent.id] || [];
              const avg = averageRating(entries);
              const tagCounts = quickTagCountsFor(entries, quickTags);
              const tagPairs = Object.entries(tagCounts).sort(
                (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
              );
              const tagVotes = tagPairs.reduce((sum, [, count]) => sum + count, 0);
              const areaTags = filterOutQuickTags(agent.tags || []);
              const maskedPhone = formatMaskedPhone(agent.phone);
              const maskedMobile = maskedPhone
                ? `${normalizeCountryCode(agent.phoneCountryCode) || "+1"} ${maskedPhone}`
                : "";
              const crTags = entries.reduce<Record<string, number>>((acc, entry) => {
                const key = normalizeCountryRegion(entry.countryRegion || "");
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {});
              if (!Object.keys(crTags).length) crTags.unknown = 1;
              const crPairs = Object.entries(crTags).sort(
                (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
              );
              const hasKnownCrTags = crPairs.some(([tag]) => tag !== "unknown");
              const displayCrPairs = hasKnownCrTags
                ? crPairs.filter(([tag]) => tag !== "unknown")
                : crPairs;
              const initials =
                agent.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "HR";

              return (
                <article key={agent.id} className={cardClass}>
                  <div className="flex gap-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${isDark ? "bg-emerald-900/40 text-emerald-100" : "bg-emerald-100 text-emerald-800"
                        }`}
                    >
                      {initials}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={`text-lg font-semibold ${isDark ? "text-slate-50" : "text-slate-900"
                                }`}
                            >
                              {formatDisplayName(agent.name)}
                            </h3>
                          </div>
                          {areaTags.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Focus areas
                              </span>
                              {areaTags.map((tag) => (
                                <span key={tag} className={chipClass}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wide ${
                                isDark ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              Country/Region:
                            </span>
                            {!hasKnownCrTags ? (
                              <span className={chipClass}>unknown</span>
                            ) : (
                              displayCrPairs.slice(0, 4).map(([tag, count]) => (
                                <span key={tag} className={chipClass}>
                                  {tag} x{count}
                                </span>
                              ))
                            )}
                          </div>
                          {maskedMobile && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Mobile:
                              </span>
                              <span className={chipClass}>{maskedMobile}</span>
                            </div>
                          )}
                          {tagPairs.length > 0 && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide ${
                                  isDark ? "text-slate-400" : "text-slate-500"
                                }`}
                              >
                                Quick tags
                              </span>
                              {tagPairs.slice(0, 8).map(([tag, count]) => (
                                <span key={tag} className={chipClass}>
                                  {tag} x{count}
                                </span>
                              ))}
                            </div>
                          )}

                          <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                            {entries.length} submission{entries.length === 1 ? "" : "s"}
                            {tagVotes ? ` · ${tagVotes} tag vote${tagVotes === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {authUser && (
                            <button
                              type="button"
                              onClick={() => selectAgentForSubmission(agent)}
                              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                isDark
                                  ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
                              }`}
                            >
                              {mySubmissionByAgentId.has(agent.id) ? "Edit comment" : "Add submission"}
                            </button>
                          )}
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-800"
                              }`}
                          >
                            {avg ? `★ ${avg} / 5` : "No ratings yet"}
                          </div>
                          <a
                            href={agent.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className={
                              agent.linkedin
                                ? `inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 transition ${
                                    isDark ? "text-emerald-200 hover:text-emerald-100" : "text-emerald-700 hover:text-emerald-800"
                                  }`
                                : "hidden"
                            }
                          >
                            View LinkedIn
                            <span aria-hidden>↗</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <details
                    open={detailsOpenByAgentId[agent.id] ?? true}
                    onToggle={(event) => {
                      const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                      setDetailsOpenByAgentId((prev) => ({ ...prev, [agent.id]: nextOpen }));
                    }}
                    className={`mt-6 space-y-3 rounded-2xl border p-4 ${isDark ? "border-slate-800 bg-slate-900/70" : "border-slate-200 bg-slate-50"
                      }`}
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between">
                      <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                        More details
                      </p>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                        {entries.length} submission{entries.length === 1 ? "" : "s"}
                        {tagVotes ? ` · ${tagVotes} tag vote${tagVotes === 1 ? "" : "s"}` : ""}
                      </p>
                    </summary>
                    {entries.length > 0 ? (
                      <div className={`space-y-3 border-t pt-3 ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                        {entries.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`rounded-xl px-4 py-3 shadow-[0_4px_10px_-8px_rgba(0,0,0,0.4)] ${isDark ? "bg-slate-900/80" : "bg-white"
                              }`}
                          >
                            <div className={`flex items-center gap-2 text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                              <span className={`font-semibold ${isDark ? "text-emerald-200" : "text-emerald-700"}`}>
                                ★ {entry.rating}
                              </span>
                              <span>·</span>
                              <span>{entry.createdAt.toLocaleDateString()}</span>
                            </div>
                            <p className={`mt-1 text-sm ${isDark ? "text-slate-100" : "text-slate-800"}`}>
                              {entry.notes || "No additional notes provided."}
                            </p>
                            {filterQuickTags(submissionTags(entry)).length > 0 && (
                              <div
                                className={`mt-2 flex flex-wrap gap-2 text-xs ${isDark ? "text-slate-400" : "text-slate-600"
                                  }`}
                              >
                                {filterQuickTags(submissionTags(entry)).map((tag) => (
                                  <span
                                    key={tag}
                                    className={`rounded-full px-2 py-1 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`rounded-xl border border-dashed px-4 py-3 text-sm ${isDark
                            ? "border-slate-800 bg-slate-900/50 text-slate-400"
                            : "border-slate-200 bg-white text-slate-600"
                          }`}
                      >
                        No experiences shared yet for this agent.
                      </div>
                    )}
                  </details>
                </article>
              );
              })
            )}
            {!isLoading && !loadError && !filteredAgents.length && (
              <div
                className={`rounded-3xl border border-dashed p-8 text-center text-sm ${isDark
                    ? "border-slate-800 bg-slate-900/60 text-slate-400"
                    : "border-slate-300 bg-white text-slate-600"
                  }`}
              >
                No matching agents yet. Add a profile or adjust your search.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
