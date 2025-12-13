"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";

type Agent = {
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
  ghosted: boolean;
  fakeJob: boolean;
  noResponse: boolean;
  createdAt: Date;
};

const starterAgents: Agent[] = [
  {
    name: "Mara Chen",
    role: "Senior HR Business Partner",
    location: "Singapore • APAC",
    linkedin: "https://www.linkedin.com/in/mara-chen",
    summary:
      "Builds people systems for hyper-growth teams and guides leaders through restructures with clarity and calm.",
    tags: ["hyper-growth", "org design", "people ops"],
    createdAt: new Date("2025-01-10"),
  },
  {
    name: "Andre Lewis",
    role: "Technical Recruiter",
    location: "Remote • Americas",
    linkedin: "https://www.linkedin.com/in/andre-lewis",
    summary:
      "Full-cycle recruiter for engineering orgs with a track record in startup-to-scale transitions.",
    tags: ["recruiting", "eng hiring", "process design"],
    createdAt: new Date("2025-01-08"),
  },
  {
    name: "Priya Raman",
    role: "Talent Development Lead",
    location: "London • EMEA",
    linkedin: "https://www.linkedin.com/in/priya-raman",
    summary:
      "Designs learning programs and leadership pipelines; great at distilling feedback into action plans.",
    tags: ["L&D", "leadership", "coaching"],
    createdAt: new Date("2025-01-05"),
  },
];

const seedExperiences: Record<string, Experience[]> = {
  "Mara Chen": [
    {
      rating: 5,
      notes: "Responsive, transparent, and set clear timelines during a reorg.",
      ghosted: false,
      fakeJob: false,
      noResponse: false,
      createdAt: new Date("2024-11-12"),
    },
  ],
  "Andre Lewis": [
    {
      rating: 2,
      notes: "Slow follow up; never heard back after sharing onsite availability.",
      ghosted: true,
      fakeJob: false,
      noResponse: true,
      createdAt: new Date("2025-01-04"),
    },
    {
      rating: 4,
      notes: "Solid for backend hiring; good prep materials.",
      ghosted: false,
      fakeJob: false,
      noResponse: false,
      createdAt: new Date("2024-09-15"),
    },
  ],
};

const quickTags = ["Ghosted","Resume taker", "Slow response", "Good experience", "Got interview/job"];

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>(starterAgents);
  const [search, setSearch] = useState("");
  const [experiences, setExperiences] = useState<Record<string, Experience[]>>(seedExperiences);
  const [sortOption, setSortOption] = useState<
    "latest" | "rating-desc" | "rating-asc" | "name-asc" | "name-desc"
  >("latest");
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.linkedin) return;
    const nextAgent: Agent = {
      name: formData.name.trim(),
      role: formData.role.trim() || "HR Agent",
      location: formData.location.trim() || "—",
      linkedin: formData.linkedin.trim(),
      summary: formData.summary.trim() || "No summary yet.",
      tags: Array.from(
        new Set([
          ...selectedQuickTags,
          ...formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        ])
      ),
      createdAt: new Date(),
    };
    setAgents((prev) => [nextAgent, ...prev]);

    const ratingValue = Number(formData.rating);
    if (ratingValue >= 1 && ratingValue <= 5) {
      const firstExperience: Experience = {
        rating: ratingValue,
        notes: "",
        ghosted: false,
        fakeJob: false,
        noResponse: false,
        createdAt: new Date(),
      };
      setExperiences((prev) => ({
        ...prev,
        [nextAgent.name]: [firstExperience, ...(prev[nextAgent.name] || [])],
      }));
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
      const aAvg = averageRating(experiences[a.name] || []);
      const bAvg = averageRating(experiences[b.name] || []);
      if (sortOption === "latest") return b.createdAt.getTime() - a.createdAt.getTime();
      if (sortOption === "rating-desc") return bAvg - aAvg || a.name.localeCompare(b.name);
      if (sortOption === "rating-asc") return aAvg - bAvg || a.name.localeCompare(b.name);
      if (sortOption === "name-asc") return a.name.localeCompare(b.name);
      if (sortOption === "name-desc") return b.name.localeCompare(a.name);
      return 0;
    });
    return list;
  }, [filteredAgents, sortOption, experiences]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:gap-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">HR Agent Directory</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            Share HR agents, then see how others experienced them.
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
            Layered like a social feed: add a profile with your own comments, search quickly, and browse cards that feel
            familiar to Facebook/LinkedIn.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">User input</p>
              <h2 className="text-xl font-semibold text-slate-900">Add an HR agent</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">New</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="name">
                Full name *
              </label>
              <input
                id="name"
                value={formData.name}
                onChange={handleInput("name")}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="e.g. Jamie Park"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="role">
                Role / title
              </label>
              <input
                id="role"
                value={formData.role}
                onChange={handleInput("role")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="HRBP, recruiter, talent partner…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="location">
                Location / region
              </label>
              <input
                id="location"
                value={formData.location}
                onChange={handleInput("location")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="Remote, NYC, EMEA…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="linkedin">
                LinkedIn profile *
              </label>
              <input
                id="linkedin"
                type="url"
                value={formData.linkedin}
                onChange={handleInput("linkedin")}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="https://www.linkedin.com/in/..."
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm text-slate-700" htmlFor="summary">
                Comment
              </label>
              <textarea
                id="summary"
                value={formData.summary}
                onChange={handleInput("summary")}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="Share your experience or assessment—responsiveness, honesty, process…"
              />
                <label className="text-sm text-slate-700" htmlFor="summary">
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
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-200"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">
                Quick tags under your comment: Ghosted, Slow response, Good experience, Got interview/job.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="tags">
                Focus areas (comma separated)
              </label>
              <input
                id="tags"
                value={formData.tags}
                onChange={handleInput("tags")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white"
                placeholder="recruiting, HRBP, onboarding"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm text-slate-700" htmlFor="rating">
                First rating (1-5)
              </label>
              <div className="flex flex-wrap gap-2" id="rating">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = formData.rating === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-1 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
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
            <p className="text-xs text-slate-500">Saved locally in this session.</p>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Search</p>
              <h2 className="text-xl font-semibold text-slate-900">Find an agent quickly</h2>
              <p className="text-sm text-slate-600">Filter by name, focus, region, or keywords.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
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
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-emerald-400 focus:bg-white"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Listing</p>
              <h2 className="text-2xl font-semibold text-slate-900">List of HR agents</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Sort
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as typeof sortOption)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 outline-none transition focus:border-emerald-400"
                >
                  <option value="latest">Latest submit</option>
                  <option value="rating-desc">Rating: high to low</option>
                  <option value="rating-asc">Rating: low to high</option>
                  <option value="name-asc">Name: A → Z</option>
                  <option value="name-desc">Name: Z → A</option>
                </select>
              </label>
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700">
                {filteredAgents.length} match{filteredAgents.length === 1 ? "" : "es"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {sortedAgents.map((agent) => {
              const entries = experiences[agent.name] || [];
              const avg = averageRating(entries);
              const flaggedIssues = entries.flatMap((item) => {
                const issues: string[] = [];
                if (item.ghosted) issues.push("ghosted");
                if (item.fakeJob) issues.push("fake job");
                if (item.noResponse) issues.push("no response");
                return issues;
              });
              const initials =
                agent.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "HR";

              return (
                <article
                  key={agent.linkedin}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                      {initials}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{agent.name}</h3>
                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              {agent.role || "HR Agent"}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">{agent.location}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                            {avg ? `★ ${avg} / 5` : "No ratings yet"}
                          </div>
                          <a
                            href={agent.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline-offset-4 transition hover:text-emerald-800"
                          >
                            View LinkedIn
                            <span aria-hidden>↗</span>
                          </a>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">User comment</p>
                        <p className="text-sm leading-relaxed text-slate-700">{agent.summary}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agent.tags.length ? (
                          agent.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">No focus areas added.</span>
                        )}
                      </div>
                      {flaggedIssues.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[...new Set(flaggedIssues)].map((issue) => (
                            <span
                              key={issue}
                              className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700"
                            >
                              {issue}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Community experiences</p>
                      <p className="text-xs text-slate-600">{entries.length} submission(s)</p>
                    </div>
                    {entries.length > 0 ? (
                      <div className="space-y-3 border-t border-slate-200 pt-3">
                        {entries.slice(0, 3).map((entry, idx) => (
                          <div key={idx} className="rounded-xl bg-white px-4 py-3 shadow-[0_4px_10px_-8px_rgba(0,0,0,0.4)]">
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <span className="font-semibold text-emerald-700">★ {entry.rating}</span>
                              <span>·</span>
                              <span>{entry.createdAt.toLocaleDateString()}</span>
                            </div>
                            <p className="mt-1 text-sm text-slate-800">
                              {entry.notes || "No additional notes provided."}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                              {entry.ghosted && <span className="rounded-full bg-slate-100 px-2 py-1">Ghosted</span>}
                              {entry.fakeJob && <span className="rounded-full bg-slate-100 px-2 py-1">Fake job</span>}
                              {entry.noResponse && <span className="rounded-full bg-slate-100 px-2 py-1">No echo</span>}
                            </div>
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <div className="text-right text-xs text-slate-600">
                            +{entries.length - 3} more submission(s)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        No experiences shared yet for this agent.
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {!filteredAgents.length && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                No matching agents yet. Add a profile or adjust your search.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
