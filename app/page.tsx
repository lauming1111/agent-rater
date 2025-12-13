"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";

type Agent = {
  id: string;
  name: string;
  role: string;
  location: string;
  linkedin: string;
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

function mergeAgentsByLinkedin(inputAgents: Agent[], inputExperiences: Record<string, Experience[]>) {
  const groups = new Map<string, { agent: Agent; ids: string[] }>();

  for (const agent of inputAgents) {
    const key = normalizeLinkedin(agent.linkedin) || agent.id;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { agent, ids: [agent.id] });
      continue;
    }

    existing.ids.push(agent.id);

    const latest = agent.createdAt > existing.agent.createdAt ? agent : existing.agent;
    const createdAt = new Date(Math.max(existing.agent.createdAt.getTime(), agent.createdAt.getTime()));
    const tags = filterOutQuickTags(Array.from(new Set([...(existing.agent.tags ?? []), ...(agent.tags ?? [])])));

    existing.agent = { ...latest, createdAt, tags };
  }

  const mergedAgents: Agent[] = [];
  const mergedExperiences: Record<string, Experience[]> = {};

  for (const { agent, ids } of groups.values()) {
    mergedAgents.push(agent);
    const items = ids.flatMap((id) => inputExperiences[id] || []);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    mergedExperiences[agent.id] = items;
  }

  return { agents: mergedAgents, experiences: mergedExperiences };
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

const starterAgents: Agent[] = [
];

const seedExperiences: Record<string, Experience[]> = {};

const quickTags = ["Ghosted", "Resume taker", "Slow response", "Good experience", "Got interview/job"];
const quickTagSet = new Set(quickTags.map(normalizeTag));

function filterQuickTags(tags: string[]) {
  return tags.filter((tag) => quickTagSet.has(normalizeTag(tag)));
}

function filterOutQuickTags(tags: string[]) {
  return tags.filter((tag) => !quickTagSet.has(normalizeTag(tag)));
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(starterAgents);
  const [search, setSearch] = useState("");
  const [experiences, setExperiences] = useState<Record<string, Experience[]>>(seedExperiences);
  const [sortOption, setSortOption] = useState<
    "latest" | "rating-desc" | "rating-asc" | "tags-desc" | "name-asc" | "name-desc"
  >("latest");
  const [themeMode, setThemeMode] = useState<"system" | "light" | "dark">("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    location: "",
    linkedin: "",
    summary: "",
    tags: "",
    rating: 5,
  });
  const [selectedQuickTags, setSelectedQuickTags] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const safeDate = (value: unknown) => {
      if (typeof value !== "string") return new Date();
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date() : date;
    };

    async function loadFromApi() {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as {
          agents?: Array<{
            id: string;
            name: string;
            role: string;
            location: string;
            linkedin: string;
            summary: string;
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

        if (!Array.isArray(data.agents)) return;

        const nextAgents: Agent[] = data.agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          location: agent.location,
          linkedin: agent.linkedin,
          summary: agent.summary,
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

        if (cancelled) return;
        const merged = mergeAgentsByLinkedin(nextAgents, nextExperiences);
        setAgents(merged.agents);
        setExperiences(merged.experiences);
      } catch {
        // Fall back to seeded in-memory data when API is unavailable (e.g. no DynamoDB env vars yet).
      }
    }

    void loadFromApi();

    return () => {
      cancelled = true;
    };
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
      [agent.name, agent.role, agent.location, agent.summary, agent.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [agents, search]);

  const handleInput =
    (key: "name" | "role" | "location" | "linkedin" | "summary" | "tags") =>
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
  const inputClass = isDark
    ? "w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:bg-slate-900"
    : "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white";
  const chipClass = isDark
    ? "rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100"
    : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700";
  const cardClass = isDark
    ? "rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-black/40 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg";
  const labelClass = isDark ? "text-sm text-slate-200" : "text-sm text-slate-700";

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.linkedin) return;

    const createdAt = new Date();
    const ratingValue = Number(formData.rating);
    const countryRegion = normalizeCountryRegion(formData.location);
    const focusAreaTags = filterOutQuickTags(
      formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    );
    const commentTags = selectedQuickTags;

    const linkedin = formData.linkedin.trim();
    const existingAgent = agents.find(
      (agent) => normalizeLinkedin(agent.linkedin) === normalizeLinkedin(linkedin)
    );

    if (existingAgent) {
      const mergedTags = filterOutQuickTags(
        Array.from(new Set([...(existingAgent.tags ?? []), ...focusAreaTags]))
      );

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === existingAgent.id
            ? {
              ...agent,
              name: formData.name.trim() || agent.name,
              role: formData.role.trim() || agent.role,
              location: agent.location || "--",
              summary: formData.summary.trim() || agent.summary,
              tags: mergedTags,
              createdAt,
            }
            : agent
        )
      );

      if (ratingValue >= 1 && ratingValue <= 5) {
        const experience: Experience = {
          rating: ratingValue,
          notes: formData.summary.trim(),
          tags: commentTags,
          countryRegion,
          ghosted: false,
          fakeJob: false,
          noResponse: false,
          createdAt,
        };

        setExperiences((prev) => ({
          ...prev,
          [existingAgent.id]: [experience, ...(prev[existingAgent.id] || [])],
        }));

        void fetch(`/api/agents/${existingAgent.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            rating: ratingValue,
            notes: formData.summary.trim(),
            tags: commentTags,
            countryRegion,
            ghosted: false,
            fakeJob: false,
            noResponse: false,
            createdAt: createdAt.toISOString(),
          }),
        }).catch(() => {
          // Fall back to local-only state when API is unavailable.
        });
      }
    } else {
      const agentId = crypto.randomUUID();
      const nextAgent: Agent = {
        id: agentId,
        name: formData.name.trim(),
        role: formData.role.trim() || "HR Agent",
        location: countryRegion,
        linkedin,
        summary: formData.summary.trim() || "No summary yet.",
        tags: focusAreaTags,
        createdAt,
      };
      setAgents((prev) => [nextAgent, ...prev]);

      if (ratingValue >= 1 && ratingValue <= 5) {
        const firstExperience: Experience = {
          rating: ratingValue,
          notes: formData.summary.trim(),
          tags: commentTags,
          countryRegion,
          ghosted: false,
          fakeJob: false,
          noResponse: false,
          createdAt,
        };
        setExperiences((prev) => ({
          ...prev,
          [nextAgent.id]: [firstExperience, ...(prev[nextAgent.id] || [])],
        }));
      }

      void fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: nextAgent.id,
          name: nextAgent.name,
          role: nextAgent.role,
          location: nextAgent.location,
          linkedin: nextAgent.linkedin,
          summary: nextAgent.summary,
          tags: nextAgent.tags,
          rating: ratingValue,
          notes: formData.summary.trim(),
          experienceTags: commentTags,
          countryRegion,
          createdAt: createdAt.toISOString(),
        }),
      }).catch(() => {
        // Fall back to local-only state when API is unavailable.
      });
    }

    setFormData({
      name: "",
      role: "",
      location: "",
      linkedin: "",
      summary: "",
      tags: "",
      rating: 5,
    });
    setSelectedQuickTags([]);
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
                Add an HR agent
              </h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${isDark ? "bg-emerald-900/40 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                }`}
            >
              New
            </span>
          </div>
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
              <label className={labelClass} htmlFor="role">
                Role / title
              </label>
              <input
                id="role"
                value={formData.role}
                onChange={handleInput("role")}
                className={inputClass}
                placeholder="HRBP, recruiter, talent partner…"
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
                LinkedIn profile *
              </label>
              <input
                id="linkedin"
                type="url"
                value={formData.linkedin}
                onChange={handleInput("linkedin")}
                required
                className={inputClass}
                placeholder="https://www.linkedin.com/in/..."
              />
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
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30"
            >
              Add to directory
            </button>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Saved locally in this session.</p>
          </div>
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
              {filteredAgents.length} match{filteredAgents.length === 1 ? "" : "es"}
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
              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"
                  }`}
              >
                {filteredAgents.length} match{filteredAgents.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {sortedAgents.map((agent) => {
              const entries = experiences[agent.id] || [];
              const avg = averageRating(entries);
              const tagCounts = quickTagCountsFor(entries, quickTags);
              const tagPairs = Object.entries(tagCounts).sort(
                (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
              );
              const tagVotes = tagPairs.reduce((sum, [, count]) => sum + count, 0);
              const areaTags = filterOutQuickTags(agent.tags || []);
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
                              {agent.name}
                            </h3>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${isDark ? "bg-emerald-900/40 text-emerald-100" : "bg-emerald-50 text-emerald-700"
                                }`}
                            >
                              {agent.role || "HR Agent"}
                            </span>
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
                          <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            {agent.location}
                          </p>
                          <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-500"}`}>
                            {entries.length} submission{entries.length === 1 ? "" : "s"}
                            {tagVotes ? ` · ${tagVotes} tag vote${tagVotes === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
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
                            className={`inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 transition ${isDark ? "text-emerald-200 hover:text-emerald-100" : "text-emerald-700 hover:text-emerald-800"
                              }`}
                          >
                            View LinkedIn
                            <span aria-hidden>↗</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <details
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
            })}
            {!filteredAgents.length && (
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
