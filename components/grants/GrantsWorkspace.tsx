"use client";

import { useEffect, useRef, useState } from "react";
import { ArchiveRestore, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ds/core/Button";
import { Spinner } from "@/components/ds/core/Spinner";
import { Tag } from "@/components/ds/core/Tag";
import { Alert } from "@/components/ds/feedback/Alert";
import { EmptyState } from "@/components/ds/feedback/EmptyState";
import { Toast } from "@/components/ds/feedback/Toast";
import { Tabs } from "@/components/ds/navigation/Tabs";
import { useCurrentUser } from "@/lib/auth/CurrentUserContext";
import {
  fetchGrantsData, linkSprintTask, saveProfile, setDismissed, setFeedback, setStarred,
  type GrantProfile, type GrantProgram, type GrantSyncRun,
} from "@/lib/data/grants";
import { grantReviewPresentation } from "@/lib/grants/reviewPresentation";
import { hasCompanySetup } from "@/lib/server/validation";
import { needsReview } from "@/lib/grants/assessment";
import { runGrantReview, type ReviewProgress } from "@/lib/grants/reviewQueue";
import { daysUntil } from "@/components/pm/pmFormat";
import { isExpired, profileCompleteness } from "./grantFormat";
import { GrantsKpiRow } from "./GrantsKpiRow";
import { GrantsHero } from "./GrantsHero";
import { GrantsAllSection } from "./GrantsAllSection";
import { GrantCard } from "./GrantCard";
import { GrantDrawer } from "./GrantDrawer";
import { GrantsProfileTab } from "./GrantsProfileTab";

/* Owner-scoped company setup, grant review, and application handoff. */

type TabValue = "recommend" | "profile" | "archive";
type ToastMsg = { tone: "success" | "danger"; title: string; text: string };

export function GrantsWorkspace({sprintUrl}:{sprintUrl:string|null}) {
  const me = useCurrentUser();
  const meKey = me.id;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [programs, setPrograms] = useState<GrantProgram[]>([]);
  const [profile, setProfile] = useState<GrantProfile | null>(null);
  const [lastSync, setLastSync] = useState<GrantSyncRun | null>(null);
  const [tab, setTab] = useState<TabValue>("recommend");
  const [toast, setToast] = useState<ToastMsg | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [reviewProgress, setReviewProgress] = useState<ReviewProgress | null>(null);
  const stopReview = useRef(false);
  const reviewRunning = useRef(false);
  const mounted = useRef(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pendingImports=useRef(new Map<string,Window>());
  const [keyGuidance, setKeyGuidance] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    mounted.current = true;
    fetchGrantsData()
      .then((d) => {
        if (!alive) return;
        setPrograms(d.programs);
        setProfile(d.profile);
        setLastSync(d.lastSync);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      mounted.current = false;
      stopReview.current = true;
    };
  }, []);

  useEffect(()=>{
    if(!sprintUrl)return;
    const receive=(event:MessageEvent)=>{
      const message=event.data;
      if(event.origin!==sprintUrl || !message || message.type!=="sprint-grant-imported" || typeof message.grantId!=="string" || typeof message.taskId!=="string" || pendingImports.current.get(message.grantId)!==event.source)return;
      pendingImports.current.delete(message.grantId);
      void linkSprintTask(message.grantId,message.taskId).then(updated=>{
        setPrograms(prev=>prev.map(p=>p.id===updated.id?updated:p));
        setToast({tone:"success",title:"Added to Sprint Dashboard",text:"The task was created and linked to this announcement."});
      }).catch(()=>setToast({tone:"danger",title:"Could not save the link",text:"The Sprint Dashboard task was created, but its link could not be saved. Open it again to retry."}));
    };
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[sprintUrl]);

  const patchLocal = (updated: GrantProgram) =>
    setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const fail = (title: string) => (err: unknown) => {
    console.error(err);
    setToast({ tone: "danger", title, text: "Could not save. Please try again." });
  };

  const handleToggleStar = (p: GrantProgram) => setStarred(p.id, !p.starred).then(patchLocal).catch(fail("Star"));
  const handleFeedback = (p: GrantProgram, v: "up" | "down") =>
    setFeedback(p.id, p.feedback === v ? null : v).then(patchLocal).catch(fail("Feedback"));
  const handleDismiss = (p: GrantProgram) =>
    setDismissed(p.id, true)
      .then((u) => {
        patchLocal(u);
        setToast({ tone: "success", title: "Archived", text: "You can restore it from Archive at any time." });
      })
      .catch(fail("Archive"));
  const handleRestore = (p: GrantProgram) => setDismissed(p.id, false).then(patchLocal).catch(fail("Restore"));

  const handleSync = async () => {
    setSyncing(true);
    setKeyGuidance(null);
    try {
      const res = await fetch("/api/grants/sync", { method: "POST" });
      const json = await res.json() as { error?: string; guidance?: string; results?: {source:string;fetched:number;error?:string}[] };
      if (res.status === 503 && json.error === "api_key_missing") {
        setKeyGuidance(json.guidance ?? "An API key has not been configured.");
        return;
      }
      const results = (json.results ?? []) as { source: string; fetched: number; error?: string }[];
      // 소스별 결과를 그대로 보여준다 — 실패 원인(키 미등록 등)이 토스트에 남게.
      const label = (s: string) => (s === "bizinfo" ? "Bizinfo" : s === "kstartup" ? "K-Startup" : s);
      const parts = results.map((r) => (r.error ? `${label(r.source)} error: ${r.error}` : `${label(r.source)}: ${r.fetched} records`));
      const complete = results.length > 0 && results.every((r) => !r.error);
      if (!res.ok && results.length === 0) throw new Error(json.error ?? "sync failed");
      setToast(
        complete
          ? { tone: "success", title: "Sync complete", text: parts.join(" · ") }
          : { tone: "danger", title: "Collection incomplete", text: parts.join(" · ") || "Could not collect announcements." },
      );
      const d = await fetchGrantsData();
      setPrograms(d.programs);
      setLastSync(d.lastSync);
    } catch (err) {
      console.error(err);
      setToast({ tone: "danger", title: "Sync failed", text: "Could not collect announcements. Please try again later." });
    } finally {
      setSyncing(false);
    }
  };

  const handleMatch = async (mode: "unmatched" | "all" = "unmatched", ids?: string[]) => {
    if (reviewRunning.current || syncing) return;
    reviewRunning.current = true;
    stopReview.current = false;
    setMatching(true);
    setReviewProgress(null);
    try {
      const current = await fetchGrantsData();
      if (!current.profile || !hasCompanySetup(current.profile)) { setTab("profile"); throw new Error("Complete your company setup first."); }
      setPrograms(current.programs);
      setProfile(current.profile);
      const queue = current.programs.filter(p => !p.dismissed && !isExpired(p)
        && (ids ? ids.includes(p.id) : mode === "all" || needsReview(p, current.profile?.updatedAt ?? "")));
      const result = await runGrantReview(queue.map(p => p.id), {
        shouldStop: () => stopReview.current,
        onProgress: progress => { if (mounted.current) setReviewProgress(progress); },
        review: async batch => {
          const res = await fetch("/api/grants/match", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "all", ids: batch }),
          });
          const json = await res.json() as { error?: string; guidance?:string; detail?:string; results?: {id:string;grade:GrantProgram["grade"];score:number;why:string;eligibility:GrantProgram["eligibility"];matched_tags:string[];assessment?:GrantProgram["assessment"]}[]; failed?:{id:string;error:string;assessment?:GrantProgram["assessment"]}[] };
          if (mounted.current && (json.results || json.failed)) setPrograms(prev => prev.map(p => {
            const r = json.results?.find((item: { id: string }) => item.id === p.id);
            const failure = json.failed?.find((item: { id: string }) => item.id === p.id);
            return r ? { ...p, grade: r.grade, score: r.score, why: r.why, eligibility: r.eligibility,
              matchedTags: r.matched_tags, matchedAt: r.assessment?.reviewedAt ?? p.matchedAt, assessment: r.assessment }
              : failure?.assessment ? { ...p, assessment: failure.assessment } : p;
          }));
          return { results: json.results ?? [], failed: json.failed ?? [],
            fatalError: !res.ok ? json.guidance ?? json.detail ?? json.error ?? "Review request failed" : undefined };
        },
      });
      if (mounted.current) setToast({ tone: result.failed.length ? "danger" : "success",
        title: result.stopped ? "Review stopped" : result.failed.length ? "Some announcements need a retry" : "Review complete",
        text: `${result.completed} of ${result.total} completed · ${result.failed.length} failed. ${result.stopped || result.failed.length ? "Saved results are kept. Resume reviewing the remaining announcements." : "Open an announcement to see the rationale and source coverage."}` });
    } catch (err) {
      if (mounted.current) setToast({ tone: "danger", title: "Review interrupted", text: `${err instanceof Error ? err.message : "Request failed"} Completed results are saved. Run the remaining review again.` });
    } finally {
      const current = await fetchGrantsData().catch(() => null);
      if (mounted.current) { if (current) setPrograms(current.programs); setMatching(false); }
      reviewRunning.current = false;
    }
  };

  const handleSaveProfile = async (p: GrantProfile, completeSetup: boolean) => {
    setSavingProfile(true);
    try {
      const saved = await saveProfile(p, meKey, completeSetup);
      setProfile(saved);
      if (!hasCompanySetup(profile) && completeSetup) setTab("recommend");
      setToast({ tone: "success", title: "Profile saved", text: hasCompanySetup(saved) ? "Your next AI review will use the saved profile." : "Draft saved. Return here to finish company setup." });
    } catch (err) {
      console.error(err);
      throw new Error(err instanceof Error ? err.message : "Could not save the profile. Your entries are still here; please retry.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddToSprint = async (p: GrantProgram) => {
    if (!sprintUrl) {setToast({tone:"danger",title:"Connect Sprint Dashboard",text:"Set SPRINT_SERVICE_URL to your Sprint Dashboard service address on the server."});return;}
    const left=daysUntil(p.applyEnd);
    const payload={title:`Prepare application: ${p.title}`,description:[p.url?`Official announcement: ${p.url}`:"",p.why?`${grantReviewPresentation(p, profile?.updatedAt ?? "").stale ? "Previous rationale (review again)" : "AI rationale"}: ${p.why}`:""].filter(Boolean).join("\n\n"),dueDate:p.applyEnd,priority:left!=null&&left<=14?"high":"medium",...(p.url?{sourceUrl:p.url}:{}),grantId:p.id};
    const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(payload)),b=>String.fromCharCode(b)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
    const popup=window.open(`${sprintUrl}/import/grant?payload=${encoded}`,"_blank");
    if(popup)pendingImports.current.set(p.id,popup);
    setToast({tone:"success",title:"Continue in Sprint Dashboard",text:"Review the details in Sprint Dashboard and create the task there. Sending the same announcement again will not create a duplicate."});
  };

  const handleImport = async (file:File|undefined)=>{
    if(!file)return;
    try {
      if(file.size>1_000_000)throw new Error("Split the JSON file into files of 1 MB or less.");
      const response=await fetch("/api/grants/import",{method:"POST",headers:{"Content-Type":"application/json"},body:await file.text()});
      const value=await response.json() as {error?:string;inserted:number};if(!response.ok)throw new Error(value.error??"Import failed");
      const current=await fetchGrantsData();setPrograms(current.programs);setLastSync(current.lastSync);
      setToast({tone:"success",title:"Announcements imported",text:`Saved ${value.inserted} announcements to your account.`});
    }catch(error){setToast({tone:"danger",title:"Import failed",text:error instanceof Error?error.message:"Please check the file."});}
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) return <div className="setup-wrap"><Alert tone="danger" title="Could not load your workspace">Please retry before editing your company information.</Alert><Button onClick={() => window.location.reload()}>Retry</Button></div>;
  if (!hasCompanySetup(profile)) return <div className="setup-wrap">
    <header className="setup-intro"><span className="setup-step">Company setup</span><h1>{profile ? "Finish your company setup" : "Tell us about your company"}</h1><p>Save your company information before exploring grant recommendations. Your profile helps assess location, business age, industry, and eligibility.</p><p className="profile-hint">{profile ? "Your saved draft is ready below." : "Start with your own information. No company details have been filled in."} You can edit everything later in Profile.</p></header>
    <GrantsProfileTab key={profile?.updatedAt ?? "empty"} profile={profile} saving={savingProfile} onboarding onSave={handleSaveProfile} />
    {toast && <Toast tone={toast.tone} title={toast.title} onClose={() => setToast(null)}>{toast.text}</Toast>}
  </div>;
  const comp = profileCompleteness(profile);
  const openProgram = programs.find((p) => p.id === openId) ?? null;
  const dismissed = programs.filter((p) => p.dismissed);
  const unmatchedCount = programs.filter((p) => !p.dismissed && !isExpired(p) && needsReview(p, profile?.updatedAt ?? "")).length;

  return (
    <div className="sx-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24 }}>
      <div className="sx-anim-view" style={{ maxWidth: 1560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Grant recommendations</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
            Match Bizinfo and K-Startup announcements to your company profile
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <Tag size="sm" onClick={() => setTab("profile")} active={comp.pct < 60}>
          Profile completeness {comp.pct}%
        </Tag>
        {lastSync && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            Last sync {new Date(lastSync.ranAt).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <Button variant="secondary" size="sm" loading={syncing} disabled={matching} onClick={handleSync}>
          <RefreshCw size={14} /> Sync announcements
        </Button>
        <Button variant="primary" size="sm" loading={matching} disabled={syncing} onClick={() => void handleMatch()}>
          <Sparkles size={14} /> Review remaining{unmatchedCount > 0 ? ` (${unmatchedCount})` : ""}
        </Button>
        {/* Snapshot all eligible IDs once; each is processed at most once in this run. */}
        <Button variant="ghost" size="sm" disabled={matching || syncing} title="Review every open announcement again, including existing grades"
          onClick={() => void handleMatch("all")}>
          Review all again
        </Button>
      </header>

      {reviewProgress && (
        <section aria-label="Review progress" style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
          <strong>{matching ? "Reviewing announcements" : reviewProgress.stopped ? "Review stopped" : "Review results"}</strong>
          <p role="status" style={{ margin: "8px 0" }}>
            Total {reviewProgress.total} · Complete {reviewProgress.completed} · Failed {reviewProgress.failed.length} · Remaining {Math.max(0, reviewProgress.total - reviewProgress.completed - reviewProgress.failed.length)}
          </p>
          <progress aria-label="Announcement review progress" max={Math.max(1, reviewProgress.total)} value={reviewProgress.completed + reviewProgress.failed.length} style={{ width: "100%" }} />
          {matching && <p style={{ fontSize: 13 }}>Keep this page open to finish the queue. Completed results are saved if you stop or close it.</p>}
          {matching && <Button variant="secondary" size="sm" onClick={() => { stopReview.current = true; }}>Stop after this batch</Button>}
          {reviewProgress.failed.length > 0 && <details><summary>Failed announcements: {reviewProgress.failed.length}</summary>
            <ul>{reviewProgress.failed.map(f => <li key={f.id}><button onClick={() => setOpenId(f.id)}>{programs.find(p => p.id === f.id)?.title ?? f.id}</button>: {f.error}</li>)}</ul>
          </details>}
        </section>
      )}

      {keyGuidance && (
        <Alert tone="warning" title="Announcement API keys are not configured" onClose={() => setKeyGuidance(null)}>
          {keyGuidance} You can still browse imported announcements. AI reviews require a separate AI connection.
        </Alert>
      )}

      <details className="import-help"><summary>Import announcements · connection setup</summary><p>Configure your collection API keys on the server to sync announcements. You can also import announcement records as JSON.</p><label>Announcement JSON file <input type="file" accept=".json,application/json" onChange={event=>{void handleImport(event.target.files?.[0]);event.target.value="";}} /></label><p><a href="/import-format.json" download>Download the field specification</a> · Up to 500 records / 1 MB. Example records are never added automatically.</p></details>

      <Tabs
        items={[
          { value: "recommend", label: "Recommendations" },
          { value: "profile", label: "Profile" },
          { value: "archive", label: "Archive", count: dismissed.length || undefined },
        ]}
        value={tab}
        onChange={(v) => setTab(v as TabValue)}
      />

      {tab === "recommend" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <GrantsKpiRow programs={programs} profileUpdatedAt={profile?.updatedAt ?? ""} />
          <GrantsHero
            programs={programs}
            profileUpdatedAt={profile?.updatedAt ?? ""}
            onOpen={(p) => setOpenId(p.id)}
            onAddToSprint={handleAddToSprint}
            onDismiss={handleDismiss}
            addingId={addingId}
          />
          <GrantsAllSection
            programs={programs}
            profileUpdatedAt={profile?.updatedAt ?? ""}
            onOpen={(p) => setOpenId(p.id)}
            onToggleStar={handleToggleStar}
            onFeedback={handleFeedback}
            onDismiss={handleDismiss}
          />
        </div>
      )}

      <div hidden={tab !== "profile"}>
        <GrantsProfileTab key={profile?.updatedAt ?? "empty"} profile={profile} saving={savingProfile} onSave={handleSaveProfile} />
      </div>

      {tab === "archive" &&
        (dismissed.length === 0 ? (
          <EmptyState title="Your archive is empty" description="Announcements removed from recommendations appear here." />
        ) : (
          <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {dismissed.map((p) => (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <GrantCard
                  program={p}
                  profileUpdatedAt={profile?.updatedAt ?? ""}
                  onOpen={() => setOpenId(p.id)}
                  onToggleStar={() => handleToggleStar(p)}
                  onFeedback={(v) => handleFeedback(p, v)}
                  onDismiss={() => handleRestore(p)}
                />
                <Button variant="ghost" size="sm" onClick={() => handleRestore(p)}>
                  <ArchiveRestore size={14} /> Restore to recommendations
                </Button>
              </div>
            ))}
          </div>
        ))}

      <GrantDrawer
        program={openProgram}
        profileUpdatedAt={profile?.updatedAt ?? ""}
        onClose={() => setOpenId(null)}
        onAddToSprint={handleAddToSprint}
        onFeedback={handleFeedback}
        adding={addingId === openProgram?.id}
        onMatch={(p) => void handleMatch("all", [p.id])}
        matching={matching}
      />

      {toast && (
        <div style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, width: "min(360px,calc(100vw - 32px))" }}>
          <Toast tone={toast.tone} title={toast.title} onClose={() => setToast(null)}>
            {toast.text}
          </Toast>
        </div>
      )}
      </div>
    </div>
  );
}
