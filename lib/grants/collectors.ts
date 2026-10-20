import { collectPages } from "./collectPages";
import { plainText } from "./source";
export function normalizeKey(v: string | undefined): string {
  const k = (v ?? "").replace(/['"\s]/g, "");
  if (!k.includes("%")) return k;
  try {
    return decodeURIComponent(k);
  } catch {
    return k;
  }
}



/** Ingestion-only row shape — never includes match/curation columns. */
export interface IngestRow {
  source: "bizinfo" | "kstartup";
  source_id: string;
  title: string;
  url: string;
  summary: string;
  support_types: string[];
  targets: string[];
  region: string;
  amount_text: string;
  apply_start: string | null;
  apply_end: string | null;
  raw: unknown;
}

/** "20260801" → "2026-08-01"; anything else → null. */
function toDate(v: unknown): string | null {
  const s = String(v ?? "").replace(/[^0-9]/g, "");
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function stripTags(v: unknown): string {
  return plainText(text(v));
}

/* 인증 오류 시 두 API 모두 JSON 대신 XML/텍스트를 돌려준다 —
   SERVICE_KEY_IS_NOT_REGISTERED 같은 원인이 토스트까지 전달되게 본문을 던진다. */
async function fetchJson(url: string, label: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const body = await res.text();
  if (!res.ok) throw new Error(`${label} http ${res.status}: ${body.slice(0, 100)}`);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`${label} non-json: ${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100)}`);
  }
  // data.go.kr 게이트웨이는 인증 오류를 JSON 봉투로도 돌려준다 — 조용한 0건이
  // 되지 않게 오류 메시지를 그대로 던진다.
  const header = (json as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response?.header;
  if (header?.resultMsg && header.resultCode !== "00") {
    throw new Error(`${label} ${header.resultCode ?? ""} ${header.resultMsg}`.trim());
  }
  const flatMsg = (json as { resultMsg?: string; errMsg?: string })?.resultMsg ?? (json as { errMsg?: string })?.errMsg;
  if (flatMsg) throw new Error(`${label} ${flatMsg}`);
  return json;
}

/* 기업마당 공고 API. reqstBeginEndDe는 "20260801 ~ 20260930" 또는
   "예산 소진시까지" 같은 자유 텍스트 — 파싱 실패 시 날짜는 null로 둔다. */
export async function fetchBizinfo(key: string): Promise<IngestRow[]> {
  const items = await collectPages<Record<string, unknown>>(async page => {
    const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${encodeURIComponent(key)}&dataType=json&searchCnt=0&pageUnit=100&pageIndex=${page}`;
    const json = (await fetchJson(url, "bizinfo")) as Record<string, unknown> & { jsonArray?: unknown; item?: unknown };
    const items = Array.isArray(json?.jsonArray) ? json.jsonArray : Array.isArray(json?.item) ? json.item : Array.isArray(json) ? json : null;
    if (!items) throw new Error("기업마당 공고 목록 형식을 확인할 수 없습니다");
    return items;
  }, item => text(item.pblancId));
  return items
    .map((it): IngestRow | null => {
      const sourceId = text(it.pblancId);
      const title = stripTags(it.pblancNm);
      if (!sourceId || !title) return null;
      const period = text(it.reqstBeginEndDe);
      const [beginRaw, endRaw] = period.split("~").map((s) => s.trim());
      const detail = text(it.pblancUrl);
      return {
        source: "bizinfo",
        source_id: sourceId,
        title,
        url: detail.startsWith("http") ? detail : detail ? `https://www.bizinfo.go.kr${detail}` : "",
        summary: stripTags(it.bsnsSumryCn),
        support_types: [text(it.pldirSportRealmLclasCodeNm)].filter(Boolean),
        targets: [text(it.trgetNm)].filter(Boolean),
        region: text(it.jrsdInsttNm),
        amount_text: "",
        apply_start: toDate(beginRaw),
        apply_end: toDate(endRaw),
        raw: it,
      };
    })
    .filter((r): r is IngestRow => r !== null);
}

/* K-Startup 창업지원사업 공고 API (data.go.kr B552735).
   cond[rcrt_prgs_yn::EQ]=Y — 모집중 공고만. 응답의 결과 배열은 data 또는
   data.data 로 감싸여 온다 (Swagger 명세가 이중 중첩으로 선언돼 있음). */
export async function fetchKstartup(key: string): Promise<IngestRow[]> {
  const scalar = (v: unknown): string => (v == null || typeof v === "object" ? "" : String(v).trim());
  const items = await collectPages<Record<string, unknown>>(async page => {
    const url = `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(key)}&page=${page}&perPage=100&returnType=json&cond%5Brcrt_prgs_yn%3A%3AEQ%5D=Y`;
    const json = (await fetchJson(url, "kstartup")) as Record<string, unknown> & { data?: unknown };
    const outer = json?.data;
    const items = Array.isArray(outer) ? outer : Array.isArray((outer as Record<string, unknown> | undefined)?.data) ? (outer as Record<string, unknown>).data as Record<string, unknown>[] : null;
    if (!items) throw new Error("K-Startup 공고 목록 형식을 확인할 수 없습니다");
    return items;
  }, item => scalar(item.pbanc_sn ?? item.pbancSn));
  const rows = items
    .map((it): IngestRow | null => {
      const sourceId = scalar(it.pbanc_sn ?? it.pbancSn);
      const title = stripTags(it.biz_pbanc_nm ?? it.bizPbancNm ?? it.intg_pbanc_biz_nm);
      if (!sourceId || !title) return null;
      return {
        source: "kstartup",
        source_id: sourceId,
        title,
        url: scalar(it.detl_pg_url ?? it.detlPgUrl),
        summary: stripTags(it.pbanc_ctnt ?? it.pbancCtnt),
        support_types: [scalar(it.supt_biz_clsfc ?? it.suptBizClsfc)].filter(Boolean),
        targets: [stripTags(it.aply_trgt_ctnt ?? it.aplyTrgtCtnt)].filter(Boolean),
        region: scalar(it.supt_regin ?? it.suptRegin),
        amount_text: "",
        apply_start: toDate(it.pbanc_rcpt_bgng_dt ?? it.pbancRcptBgngDt),
        apply_end: toDate(it.pbanc_rcpt_end_dt ?? it.pbancRcptEndDt),
        raw: it,
      };
    })
    .filter((r): r is IngestRow => r !== null);
  // 수신은 됐는데 매핑에서 전부 걸러졌다면 필드명이 다른 것 — 첫 항목을 노출해 진단.
  if (items.length > 0 && rows.length === 0) {
    throw new Error(`kstartup ${items.length}건 수신·매핑 0건: 첫 항목: ${JSON.stringify(items[0]).slice(0, 140)}`);
  }
  return rows;
}

