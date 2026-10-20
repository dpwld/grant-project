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

/* 지원사업 추천 워크스페이스 — Poliflo 벤치마크(docs/competitor-poliflo-salesforce.md §3A).
   수집(동기화) → AI 매칭(S~D) → 이번 주 3건 히어로 → Paceboard 태스크 전환. UI는 한국어. */

type TabValue = "recommend" | "profile" | "archive";
type ToastMsg = { tone: "success" | "danger"; title: string; text: string };

export function GrantsWorkspace({sprintUrl}:{sprintUrl:string|null}) {
  const me = useCurrentUser();
  const meKey = me.id;

  const [loading, setLoading] = useState(true);
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
        if (alive) setToast({ tone: "danger", title: "로드 실패", text: "지원사업 데이터를 불러오지 못했습니다. 새로고침해주세요." });
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
        setToast({tone:"success",title:"Paceboard에 추가됨",text:"태스크를 생성하고 공고와 연결했습니다."});
      }).catch(()=>setToast({tone:"danger",title:"연결 저장 실패",text:"Paceboard 태스크는 생성되었지만 공고 연결을 저장하지 못했습니다. 다시 열어 연결해주세요."}));
    };
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[sprintUrl]);

  const patchLocal = (updated: GrantProgram) =>
    setPrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

  const fail = (title: string) => (err: unknown) => {
    console.error(err);
    setToast({ tone: "danger", title, text: "저장에 실패했습니다. 다시 시도해주세요." });
  };

  const handleToggleStar = (p: GrantProgram) => setStarred(p.id, !p.starred).then(patchLocal).catch(fail("별표"));
  const handleFeedback = (p: GrantProgram, v: "up" | "down") =>
    setFeedback(p.id, p.feedback === v ? null : v).then(patchLocal).catch(fail("피드백"));
  const handleDismiss = (p: GrantProgram) =>
    setDismissed(p.id, true)
      .then((u) => {
        patchLocal(u);
        setToast({ tone: "success", title: "추천에서 제외", text: "보관함 탭에서 언제든 복원할 수 있습니다." });
      })
      .catch(fail("제외"));
  const handleRestore = (p: GrantProgram) => setDismissed(p.id, false).then(patchLocal).catch(fail("복원"));

  const handleSync = async () => {
    setSyncing(true);
    setKeyGuidance(null);
    try {
      const res = await fetch("/api/grants/sync", { method: "POST" });
      const json = await res.json() as { error?: string; guidance?: string; results?: {source:string;fetched:number;error?:string}[] };
      if (res.status === 503 && json.error === "api_key_missing") {
        setKeyGuidance(json.guidance ?? "API 키가 설정되지 않았습니다.");
        return;
      }
      const results = (json.results ?? []) as { source: string; fetched: number; error?: string }[];
      // 소스별 결과를 그대로 보여준다 — 실패 원인(키 미등록 등)이 토스트에 남게.
      const label = (s: string) => (s === "bizinfo" ? "기업마당" : s === "kstartup" ? "K-Startup" : s);
      const parts = results.map((r) => (r.error ? `${label(r.source)} 오류: ${r.error}` : `${label(r.source)} ${r.fetched}건`));
      const complete = results.length > 0 && results.every((r) => !r.error);
      if (!res.ok && results.length === 0) throw new Error(json.error ?? "sync failed");
      setToast(
        complete
          ? { tone: "success", title: "동기화 완료", text: parts.join(" · ") }
          : { tone: "danger", title: "전체 수집 미완료", text: parts.join(" · ") || "공고 수집에 실패했습니다." },
      );
      const d = await fetchGrantsData();
      setPrograms(d.programs);
      setLastSync(d.lastSync);
    } catch (err) {
      console.error(err);
      setToast({ tone: "danger", title: "동기화 실패", text: "공고 수집에 실패했습니다. 잠시 후 다시 시도해주세요." });
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
      if (!current.profile) { setTab("profile"); throw new Error("기업 프로필을 먼저 저장해주세요."); }
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
            fatalError: !res.ok ? json.guidance ?? json.detail ?? json.error ?? "심사 요청 실패" : undefined };
        },
      });
      if (mounted.current) setToast({ tone: result.failed.length ? "danger" : "success",
        title: result.stopped ? "심사 중지됨" : result.failed.length ? "일부 공고 재시도 필요" : "전체 심사 완료",
        text: `${result.total}건 중 ${result.completed}건 완료 · 실패 ${result.failed.length}건. ${result.stopped || result.failed.length ? "저장된 결과를 유지하며 남은 공고는 이어서 심사할 수 있습니다." : "각 공고에서 평가 근거와 원문 확인 범위를 볼 수 있습니다."}` });
    } catch (err) {
      if (mounted.current) setToast({ tone: "danger", title: "심사가 중단됐습니다", text: `${err instanceof Error ? err.message : "요청 실패"} 완료된 결과는 저장되어 있습니다. 남은 공고 심사를 다시 실행해주세요.` });
    } finally {
      const current = await fetchGrantsData().catch(() => null);
      if (mounted.current) { if (current) setPrograms(current.programs); setMatching(false); }
      reviewRunning.current = false;
    }
  };

  const handleSaveProfile = async (p: GrantProfile) => {
    setSavingProfile(true);
    try {
      const saved = await saveProfile(p, meKey);
      setProfile(saved);
      setToast({ tone: "success", title: "프로필 저장됨", text: "다음 AI 매칭부터 반영됩니다." });
    } catch (err) {
      console.error(err);
      setToast({ tone: "danger", title: "저장 실패", text: "프로필 저장에 실패했습니다." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddToSprint = async (p: GrantProgram) => {
    if (!sprintUrl) {setToast({tone:"danger",title:"Paceboard 연결 필요",text:"서버의 SPRINT_SERVICE_URL에 본인 Paceboard 웹서비스 주소를 설정해주세요."});return;}
    const left=daysUntil(p.applyEnd);
    const payload={title:`신청 준비: ${p.title}`,description:[p.url?`공고 원문: ${p.url}`:"",p.why?`${grantReviewPresentation(p, profile?.updatedAt ?? "").stale ? "이전 평가 이유 (재심사 필요)" : "AI 추천 이유"}: ${p.why}`:""].filter(Boolean).join("\n\n"),dueDate:p.applyEnd,priority:left!=null&&left<=14?"high":"medium",...(p.url?{sourceUrl:p.url}:{}),grantId:p.id};
    const encoded=btoa(Array.from(new TextEncoder().encode(JSON.stringify(payload)),b=>String.fromCharCode(b)).join("")).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"");
    const popup=window.open(`${sprintUrl}/import/grant?payload=${encoded}`,"_blank");
    if(popup)pendingImports.current.set(p.id,popup);
    setToast({tone:"success",title:"Paceboard에서 확인",text:"열린 Paceboard 화면에서 내용을 확인한 후 태스크를 생성하세요. 같은 공고를 다시 보내도 중복 생성되지 않습니다."});
  };

  const handleImport = async (file:File|undefined)=>{
    if(!file)return;
    try {
      if(file.size>1_000_000)throw new Error("JSON 파일을 1MB 이하로 나눠주세요.");
      const response=await fetch("/api/grants/import",{method:"POST",headers:{"Content-Type":"application/json"},body:await file.text()});
      const value=await response.json() as {error?:string;inserted:number};if(!response.ok)throw new Error(value.error??"가져오기 실패");
      const current=await fetchGrantsData();setPrograms(current.programs);setLastSync(current.lastSync);
      setToast({tone:"success",title:"공고 가져옴",text:`${value.inserted}건을 서버에 저장했습니다.`});
    }catch(error){setToast({tone:"danger",title:"가져오기 실패",text:error instanceof Error?error.message:"파일을 확인해주세요."});}
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const comp = profileCompleteness(profile);
  const openProgram = programs.find((p) => p.id === openId) ?? null;
  const dismissed = programs.filter((p) => p.dismissed);
  const unmatchedCount = programs.filter((p) => !p.dismissed && !isExpired(p) && needsReview(p, profile?.updatedAt ?? "")).length;

  return (
    <div className="sx-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 24 }}>
      <div className="sx-anim-view" style={{ maxWidth: 1560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>지원사업 추천</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
            기업마당·K-Startup 공고를 기업 프로필로 AI 매칭합니다
          </p>
        </div>
        <span style={{ flex: 1 }} />
        <Tag size="sm" onClick={() => setTab("profile")} active={comp.pct < 60}>
          프로필 완성도 {comp.pct}%
        </Tag>
        {lastSync && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            마지막 동기화 {new Date(lastSync.ranAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <Button variant="secondary" size="sm" loading={syncing} disabled={matching} onClick={handleSync}>
          <RefreshCw size={14} /> 공고 동기화
        </Button>
        <Button variant="primary" size="sm" loading={matching} disabled={syncing} onClick={() => void handleMatch()}>
          <Sparkles size={14} /> 남은 공고 전체 심사{unmatchedCount > 0 ? ` (${unmatchedCount})` : ""}
        </Button>
        {/* Snapshot all eligible IDs once; each is processed at most once in this run. */}
        <Button variant="ghost" size="sm" disabled={matching || syncing} title="모집중 전체 공고의 기존 등급도 처음부터 다시 심사합니다"
          onClick={() => void handleMatch("all")}>
          전체 다시 심사
        </Button>
      </header>

      {reviewProgress && (
        <section aria-label="전체 심사 진행 상황" style={{ border: "1px solid var(--border-default)", borderRadius: 12, padding: 16 }}>
          <strong>{matching ? "전체 공고를 심사하고 있습니다" : reviewProgress.stopped ? "심사가 중지됐습니다" : "이번 심사 결과"}</strong>
          <p role="status" style={{ margin: "8px 0" }}>
            대상 {reviewProgress.total}건 · 완료 {reviewProgress.completed}건 · 실패 {reviewProgress.failed.length}건 · 남음 {Math.max(0, reviewProgress.total - reviewProgress.completed - reviewProgress.failed.length)}건
          </p>
          <progress aria-label="공고 심사 진행률" max={Math.max(1, reviewProgress.total)} value={reviewProgress.completed + reviewProgress.failed.length} style={{ width: "100%" }} />
          {matching && <p style={{ fontSize: 13 }}>이 화면을 열어두면 끝까지 이어서 처리합니다. 중지하거나 화면을 닫아도 완료된 결과는 저장됩니다.</p>}
          {matching && <Button variant="secondary" size="sm" onClick={() => { stopReview.current = true; }}>현재 처리 후 중지</Button>}
          {reviewProgress.failed.length > 0 && <details><summary>실패한 공고 {reviewProgress.failed.length}건</summary>
            <ul>{reviewProgress.failed.map(f => <li key={f.id}><button onClick={() => setOpenId(f.id)}>{programs.find(p => p.id === f.id)?.title ?? f.id}</button>: {f.error}</li>)}</ul>
          </details>}
        </section>
      )}

      {keyGuidance && (
        <Alert tone="warning" title="공고 수집 API 키가 아직 없습니다" onClose={() => setKeyGuidance(null)}>
          {keyGuidance} 키가 없어도 이미 수집된 공고로 매칭·검토는 가능합니다.
        </Alert>
      )}

      <details className="import-help"><summary>공고 데이터 가져오기 · 연결 안내</summary><p>수집 API는 서버 환경변수에 본인 인증키를 설정한 뒤 사용할 수 있습니다. 직접 확보한 공고는 JSON으로 가져올 수 있습니다.</p><label>공고 JSON 파일 <input type="file" accept=".json,application/json" onChange={event=>{void handleImport(event.target.files?.[0]);event.target.value="";}} /></label><p><a href="/import-format.json" download>공고 필드 명세 내려받기</a> · 최대 500건 / 1MB. 예시 데이터는 자동으로 채워지지 않습니다.</p></details>

      <Tabs
        items={[
          { value: "recommend", label: "추천" },
          { value: "profile", label: "프로필" },
          { value: "archive", label: "보관함", count: dismissed.length || undefined },
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

      {tab === "profile" && (
        <GrantsProfileTab key={profile ? "loaded" : "empty"} profile={profile} saving={savingProfile} onSave={handleSaveProfile} />
      )}

      {tab === "archive" &&
        (dismissed.length === 0 ? (
          <EmptyState title="보관함이 비어 있습니다" description="추천에서 뺀 공고가 여기에 모입니다." />
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
                  <ArchiveRestore size={14} /> 추천으로 복원
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
