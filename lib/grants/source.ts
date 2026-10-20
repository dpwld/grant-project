export interface OriginalSource {
  sourceStatus: "original" | "summary_only";
  sourceUrl: string;
  sourceError?: string;
  text: string;
  originalChars: number;
  truncated: boolean;
  attachmentsReviewed: false;
}

export function plainText(html: string): string {
  const entities: Record<string, string> = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", middot: "·" };
  return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, entity: string) => {
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()] ?? m;
      const n = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : " ";
    }).replace(/\s+/g, " ").trim();
}

export function extractAnnouncement(html: string, source: string): string {
  const marker = source === "bizinfo" ? /<div\s+class=["']view_cont["'][^>]*>/i : /<div\s+id=["']contentViewHtml["'][^>]*>/i;
  const start = html.search(marker);
  if (start < 0) throw new Error("Could not locate the announcement body");
  const body = html.slice(start).split(/<!--\s*(?:s:\s*)?footer\s*-->|<div\s+class=["']footer/)[0];
  const text = plainText(body).split("이 공고를 열람한 사용자가 함께 본 공고")[0].trim();
  if (text.length < 100 || !/지원|신청|접수/.test(text)) throw new Error("The announcement body is empty");
  return text;
}

/** Use canonical portal URLs only. Never fetch arbitrary database/user URLs. */
export async function readOriginal(p: { source: string; source_id: string }): Promise<OriginalSource> {
  let url = "";
  if (p.source === "bizinfo" && /^PBLN_\d+$/.test(p.source_id)) url = `https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=${p.source_id}`;
  if (p.source === "kstartup" && /^\d+$/.test(p.source_id)) url = `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=${p.source_id}`;
  const base = { sourceUrl: url, text: "", originalChars: 0, truncated: false, attachmentsReviewed: false as const };
  if (!url) return { ...base, sourceStatus: "summary_only", sourceError: "Automatic source retrieval is not supported for this source" };
  try {
    async function page(address: string) {
      const response = await fetch(address, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`Source request HTTP ${response.status}`);
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error("The source page exceeded the size limit");
      return html;
    }
    let html = await page(url);
    // K-Startup moves recently closed calls via a script-generated form. Follow
    // only this known portal route and the same numeric ID; never execute scripts.
    const closedPath = `/web/contents/bizpbanc-deadline.do?schM=view&pbancSn=${p.source_id}`;
    if (p.source === "kstartup" && !/id=["']contentViewHtml["']/.test(html) && html.includes(`'${closedPath}'`)) {
      url = `https://www.k-startup.go.kr${closedPath}`;
      html = await page(url);
    }
    const text = extractAnnouncement(html, p.source);
    return { ...base, sourceUrl: url, sourceStatus: "original", text: text.slice(0, 18_000), originalChars: text.length, truncated: text.length > 18_000 };
  } catch (err) {
    return { ...base, sourceStatus: "summary_only", sourceError: err instanceof Error ? err.message.slice(0, 100) : "Could not retrieve the source" };
  }
}
