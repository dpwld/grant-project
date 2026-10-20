export async function collectPages<T>(load: (page: number) => Promise<T[]>, key: (item: T) => string, pageSize = 100): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  const deadline = Date.now() + 80_000;
  for (let page = 1; page <= 100; page++) {
    if (Date.now() > deadline) throw new Error(`전체 공고 수집 시간 초과: ${page - 1}페이지 ${rows.length}건 조회, 수집 미완료`);
    const items = await load(page);
    if (items.length === 0) return rows;
    const fresh = items.filter(item => !seen.has(key(item)));
    if (!fresh.length) throw new Error("공고 API가 같은 페이지를 반복했습니다: 전체 수집 여부를 확인해주세요");
    for (const item of fresh) { if (!seen.has(key(item))) { seen.add(key(item)); rows.push(item); } }
    if (items.length < pageSize) return rows;
  }
  throw new Error("수집 페이지 한도 도달: 전체 수집이 완료되지 않았습니다");
}
