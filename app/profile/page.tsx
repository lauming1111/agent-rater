"use client";

import { StickyHeader } from "@/app/components/StickyHeader";
import { useThemeMode } from "@/app/components/useThemeMode";
import Image from "next/image";
import Link from "next/link";
import { validateAndNormalizePhone } from "@/lib/phone";
import { useCallback, useEffect, useMemo, useState } from "react";

type AuthUser = { id: string; email?: string; name?: string; picture?: string };

type Submission = {
  agentId: string;
  createdAt: string;
  rating: number;
  notes: string;
  countryRegion: string;
  focusTags: string[];
  quickTags: string[];
  agent: {
    id: string;
    name: string;
    location: string;
    linkedin: string;
    phoneCountryCode: string;
    phone: string;
  } | null;
};

type EditDraft = {
  agentName: string;
  areaTags: string;
  phoneCountryCode: string;
  phone: string;
  rating: number;
  notes: string;
  countryRegion: string;
  quickTags: string[];
};

const quickTagChoices = ["Ghosted", "Resume taker", "Slow response", "Good experience", "Got interview/job"];

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function Field({
  label,
  value,
  labelClassName,
  valueClassName,
}: {
  label: string;
  value: string;
  labelClassName: string;
  valueClassName: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className="min-w-0">
      <p className={labelClassName}>{label}</p>
      <p className={valueClassName}>{value}</p>
    </div>
  );
}

function Chips({
  label,
  tags,
  labelClassName,
  chipClassName,
}: {
  label: string;
  tags: string[];
  labelClassName: string;
  chipClassName: string;
}) {
  if (!tags.length) return null;
  return (
    <div>
      <p className={labelClassName}>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className={chipClassName}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function toggleChoice(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeCountryCodeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  return digits ? `+${digits}` : "";
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

function headline(item: Submission) {
  const name = item.agent?.name || item.agentId;
  const pieces = [name, `Rating ${item.rating}/5`];
  const notes = item.notes.trim();
  if (notes) pieces.push(notes.length > 80 ? `${notes.slice(0, 80)}...` : notes);
  return pieces.join(" | ");
}

function formatPhone(phoneCountryCode: string, phone: string) {
  const cc = phoneCountryCode.trim();
  const digits = phone.trim();
  if (!digits) return "";
  return cc ? `${cc} ${digits}` : digits;
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { themeMode, isDark, toggleThemeMode } = useThemeMode("system");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const meRes = await fetch("/api/auth/me", { cache: "no-store" });
      const me = (await meRes.json()) as { user?: AuthUser | null };
      const nextUser = me.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setSubmissions([]);
        return;
      }

      const res = await fetch("/api/profile/submissions", { cache: "no-store" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Failed to load submissions (${res.status})`);
      }
      const data = (await res.json()) as { submissions?: Submission[] };
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err) {
      setSubmissions([]);
      setLoadError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const exportJson = useMemo(() => JSON.stringify(submissions, null, 2), [submissions]);

  const pageBg = isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900";
  const panelClass = isDark
    ? "rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/40"
    : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";
  const inputBaseClass = isDark
    ? "w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none transition focus:border-emerald-400 focus:bg-slate-900"
    : "w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-400";
  const chipClass = isDark
    ? "rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100"
    : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700";
  const smallLabelClass = `text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`;
  const mutedTextClass = isDark ? "text-slate-300" : "text-slate-600";
  const headingTextClass = isDark ? "text-slate-50" : "text-slate-900";
  const fieldValueClass = `mt-1 truncate text-sm ${isDark ? "text-slate-100" : "text-slate-900"}`;
  const secondaryButtonClass = `inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold transition ${isDark
      ? "border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
      : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
    }`;

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <StickyHeader themeMode={themeMode} isDark={isDark} onToggleTheme={toggleThemeMode}>
        <div className="flex items-center gap-3">
          {!isLoading && !user && (
            <a href="/api/auth/linkedin/start" className={secondaryButtonClass}>
              Sign in with LinkedIn
            </a>
          )}
          <Link href="/" className={secondaryButtonClass}>
            Back
          </Link>
          {!isLoading && user && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST" });
                } finally {
                  setUser(null);
                  setSubmissions([]);
                }
              }}
              className={secondaryButtonClass}
            >
              Sign out
            </button>
          )}
          <button type="button" onClick={() => void reload()} className={secondaryButtonClass}>
            Refresh
          </button>
        </div>
      </StickyHeader>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className={`${panelClass} p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">My Profile</p>
          <h1 className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>Account & submissions</h1>
        </header>

        <section className={panelClass}>
          <h2 className={`text-sm font-semibold ${headingTextClass}`}>LinkedIn user</h2>
          {isLoading ? (
            <p className={`mt-2 text-sm ${mutedTextClass}`}>Loading...</p>
          ) : !user ? (
            <p className={`mt-2 text-sm ${mutedTextClass}`}>Not signed in.</p>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              {user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name ? `${user.name} profile` : "LinkedIn profile"}
                  width={56}
                  height={56}
                  className={`h-14 w-14 rounded-full border object-cover ${isDark ? "border-slate-800" : "border-slate-200"}`}
                  unoptimized
                />
              ) : (
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border text-xs font-semibold ${isDark
                      ? "border-slate-800 bg-slate-900 text-slate-200"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  aria-hidden
                >
                  LI
                </div>
              )}
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${headingTextClass}`}>{user.name ?? "LinkedIn user"}</p>
                <p className={`truncate text-xs ${mutedTextClass}`}>{user.email ?? user.id}</p>
              </div>
            </div>
          )}
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-4">
            <h2 className={`text-sm font-semibold ${headingTextClass}`}>Your submissions (from DB)</h2>
            {user && (
              <button
                type="button"
                onClick={() => void reload()}
                className={`text-xs font-semibold underline underline-offset-4 ${isDark ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
              >
                Refresh
              </button>
            )}
          </div>

          {loadError && <p className={`mt-3 text-sm ${isDark ? "text-rose-200" : "text-rose-700"}`}>{loadError}</p>}

          {!user ? (
            <p className={`mt-3 text-sm ${mutedTextClass}`}>Sign in to see your submission history.</p>
          ) : isLoading ? (
            <p className={`mt-3 text-sm ${mutedTextClass}`}>Loading...</p>
          ) : submissions.length === 0 ? (
            <p className={`mt-3 text-sm ${mutedTextClass}`}>
              No DB-backed submissions found yet. Only submissions created after enabling DB tracking will appear here.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {submissions.map((item, idx) => (
                <details
                  key={`${item.agentId}:${item.createdAt}`}
                  className={`rounded-2xl border px-4 py-3 ${
                    isDark ? "border-slate-800 bg-slate-900/70" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-3">
                      <p className={`truncate text-sm font-semibold ${headingTextClass}`}>{headline(item)}</p>
                      <p className={`text-xs ${mutedTextClass}`}>{formatWhen(item.createdAt)}</p>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-4">
                    {editingIndex === idx && draft ? (
                      <form className="grid grid-cols-1 gap-3" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                          <p className={smallLabelClass}>Full name</p>
                          <input
                            value={draft.agentName}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, agentName: e.target.value } : prev))
                            }
                            className={inputBaseClass}
                          />
                        </div>
                        <div className="space-y-2">
                          <p className={smallLabelClass}>First rating (1-5)</p>
                          <div className="flex flex-wrap gap-2">
                            {[1, 2, 3, 4, 5].map((value) => {
                              const active = draft.rating === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => setDraft((prev) => (prev ? { ...prev, rating: value } : prev))}
                                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${active
                                      ? isDark
                                        ? "border-emerald-400 bg-emerald-900/30 text-emerald-100"
                                        : "border-emerald-400 bg-emerald-50 text-emerald-700"
                                      : isDark
                                        ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-emerald-300"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                                    }`}
                                >
                                  ★ {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className={smallLabelClass}>Country/Region</p>
                          <input
                            value={draft.countryRegion}
                            onChange={(e) =>
                              setDraft((prev) => (prev ? { ...prev, countryRegion: e.target.value } : prev))
                            }
                            className={inputBaseClass}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <p className={smallLabelClass}>Mobile phone country code</p>
                            <input
                              value={draft.phoneCountryCode}
                              onChange={(e) =>
                                setDraft((prev) =>
                                  prev ? { ...prev, phoneCountryCode: normalizeCountryCodeInput(e.target.value) } : prev
                                )
                              }
                              className={inputBaseClass}
                              placeholder="+1"
                            />
                          </div>
                          <div className="space-y-2">
                            <p className={smallLabelClass}>Mobile phone</p>
                            <input
                              value={draft.phone}
                              onChange={(e) =>
                                setDraft((prev) =>
                                  prev ? { ...prev, phone: normalizePhoneDigits(e.target.value) } : prev
                                )
                              }
                              className={inputBaseClass}
                              placeholder="1234567890"
                              inputMode="numeric"
                              maxLength={15}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className={smallLabelClass}>Focus areas (comma separated)</p>
                          <input
                            value={draft.areaTags}
                            onChange={(e) => setDraft((prev) => (prev ? { ...prev, areaTags: e.target.value } : prev))}
                            className={inputBaseClass}
                            placeholder="recruiting, HRBP, onboarding"
                          />
                          <Chips
                            label="Focus areas"
                            tags={parseTags(draft.areaTags)}
                            labelClassName={smallLabelClass}
                            chipClassName={chipClass}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className={smallLabelClass}>Comment</p>
                          <textarea
                            value={draft.notes}
                            onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                            rows={4}
                            className={`${inputBaseClass} resize-y`}
                          />
                        </div>

                        <div className="space-y-2">
                          <p className={smallLabelClass}>Tags</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {quickTagChoices.map((tag) => {
                              const active = draft.quickTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() =>
                                    setDraft((prev) =>
                                      prev ? { ...prev, quickTags: toggleChoice(prev.quickTags, tag) } : prev
                                    )
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active
                                      ? isDark
                                        ? "border-emerald-400 bg-emerald-900/30 text-emerald-100"
                                        : "border-emerald-400 bg-emerald-50 text-emerald-700"
                                      : isDark
                                        ? "border-slate-700 bg-slate-800 text-slate-200 hover:border-emerald-300"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                                    }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {saveError && <p className={`text-sm ${isDark ? "text-rose-200" : "text-rose-700"}`}>{saveError}</p>}

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={async () => {
                              setIsSaving(true);
                              setSaveError(null);
                              try {
                                if (draft.phone) {
                                  const validated = validateAndNormalizePhone(draft.phoneCountryCode, draft.phone);
                                  if (!validated) throw new Error("Invalid mobile phone for country code.");
                                }
                                const normalized = draft.phone
                                  ? validateAndNormalizePhone(draft.phoneCountryCode, draft.phone)
                                  : null;
                                const res = await fetch("/api/profile/submissions", {
                                  method: "PATCH",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({
                                    agentId: item.agentId,
                                    createdAt: item.createdAt,
                                    agentName: draft.agentName,
                                    rating: draft.rating,
                                    notes: draft.notes,
                                    countryRegion: draft.countryRegion,
                                    quickTags: draft.quickTags,
                                    focusTags: parseTags(draft.areaTags),
                                    phoneCountryCode: normalized ? normalized.phoneCountryCode : draft.phoneCountryCode,
                                    phone: normalized ? normalized.phone : draft.phone,
                                  }),
                                });
                                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                                if (!res.ok) throw new Error(data?.error || `Failed to save (${res.status})`);

                                setSubmissions((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          rating: draft.rating,
                                          notes: draft.notes,
                                          countryRegion: draft.countryRegion,
                                          quickTags: draft.quickTags,
                                          focusTags: Array.from(
                                            new Set([...(Array.isArray(x.focusTags) ? x.focusTags : []), ...parseTags(draft.areaTags)])
                                          ),
                                          agent: x.agent
                                            ? {
                                                ...x.agent,
                                                name: draft.agentName
                                                  .trim()
                                                  .replace(/\\s+/g, " ")
                                                  .toLowerCase() || x.agent.name,
                                                phoneCountryCode: normalized ? normalized.phoneCountryCode : draft.phoneCountryCode,
                                                phone: normalized ? normalized.phone : draft.phone,
                                              }
                                            : x.agent,
                                        }
                                      : x
                                  )
                                );
                                setEditingIndex(null);
                                setDraft(null);
                              } catch (err) {
                                setSaveError(err instanceof Error ? err.message : "Failed to save");
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setEditingIndex(null);
                              setDraft(null);
                              setSaveError(null);
                            }}
                            className={`${secondaryButtonClass} disabled:opacity-60`}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-3">
                          <Field
                            label="Agent"
                            value={item.agent?.name || ""}
                            labelClassName={smallLabelClass}
                            valueClassName={fieldValueClass}
                          />
                          <Field
                            label="Country/Region"
                            value={item.countryRegion || item.agent?.location || ""}
                            labelClassName={smallLabelClass}
                            valueClassName={fieldValueClass}
                          />
                          <Field
                            label="LinkedIn profile"
                            value={item.agent?.linkedin || ""}
                            labelClassName={smallLabelClass}
                            valueClassName={fieldValueClass}
                          />
                          <Field
                            label="Mobile phone"
                            value={formatPhone(item.agent?.phoneCountryCode || "", item.agent?.phone || "")}
                            labelClassName={smallLabelClass}
                            valueClassName={fieldValueClass}
                          />
                          <Chips
                            label="Focus areas"
                            tags={Array.isArray(item.focusTags) ? item.focusTags : []}
                            labelClassName={smallLabelClass}
                            chipClassName={chipClass}
                          />
                        </div>
                        <div className="space-y-3">
                          <Field
                            label="Rating"
                            value={`${item.rating}/5`}
                            labelClassName={smallLabelClass}
                            valueClassName={fieldValueClass}
                          />
                          <div>
                            <p className={smallLabelClass}>Comment</p>
                            <p className={`mt-1 whitespace-pre-wrap text-sm ${headingTextClass}`}>{item.notes.trim() || "-"}</p>
                          </div>
                          <Chips
                            label="Tags"
                            tags={Array.isArray(item.quickTags) ? item.quickTags : []}
                            labelClassName={smallLabelClass}
                            chipClassName={chipClass}
                          />
                        </div>
                      </div>
                    )}

                    {editingIndex !== idx && (
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-xs ${mutedTextClass}`}>
                          {item.agentId} · {item.createdAt}
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(idx);
                              setDraft({
                                agentName: item.agent?.name || "",
                                areaTags: Array.isArray(item.focusTags) ? item.focusTags.join(", ") : "",
                                phoneCountryCode: item.agent?.phoneCountryCode || "",
                                phone: item.agent?.phone || "",
                                rating: item.rating,
                                notes: item.notes,
                                countryRegion: item.countryRegion,
                                quickTags: Array.isArray(item.quickTags) ? item.quickTags : [],
                              });
                              setSaveError(null);
                              setDeleteError(null);
                            }}
                            className={`text-xs font-semibold underline underline-offset-4 ${isDark ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = window.confirm("Delete this experience? The agent profile will remain.");
                              if (!ok) return;
                              setDeleteError(null);
                              try {
                                const url = new URL("/api/profile/submissions", window.location.origin);
                                url.searchParams.set("agentId", item.agentId);
                                url.searchParams.set("createdAt", item.createdAt);
                                const res = await fetch(url.toString(), { method: "DELETE" });
                                const data = (await res.json().catch(() => null)) as { error?: string } | null;
                                if (!res.ok) throw new Error(data?.error || `Failed to delete (${res.status})`);
                                setSubmissions((prev) => prev.filter((_, i) => i !== idx));
                              } catch (err) {
                                setDeleteError(err instanceof Error ? err.message : "Failed to delete");
                              }
                            }}
                            className={`text-xs font-semibold underline underline-offset-4 ${
                              isDark ? "text-rose-200 hover:text-rose-100" : "text-rose-700 hover:text-rose-800"
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                    {editingIndex !== idx && deleteError && (
                      <p className={`text-sm ${isDark ? "text-rose-200" : "text-rose-700"}`}>{deleteError}</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        {user && submissions.length > 0 && (
          <section className={panelClass}>
            <h2 className={`text-sm font-semibold ${headingTextClass}`}>Export</h2>
            <p className={`mt-2 text-sm ${mutedTextClass}`}>Copy/paste this JSON if you want to analyze it elsewhere.</p>
            <pre className={`mt-3 max-h-[360px] overflow-auto rounded-xl p-3 text-xs text-slate-100 ${isDark ? "bg-slate-950" : "bg-slate-900"}`}>
              {exportJson}
            </pre>
          </section>
        )}
      </main>
    </div>
  );
}
