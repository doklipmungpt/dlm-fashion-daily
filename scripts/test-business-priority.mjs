// 경쟁사·유사 브랜드의 후보 선정과 카드 배치 우선순위를 검증합니다.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./update-daily.mjs", import.meta.url), "utf8");
function block(start, end) {
  const begin = source.indexOf(start);
  assert.ok(begin >= 0, start);
  const finish = source.indexOf(end, begin);
  assert.ok(finish > begin, end);
  return source.slice(begin, finish);
}
const context = vm.createContext({
  TIME_ZONE: "Asia/Seoul", date: "2026-10-06", preferredArticleDate: "2026-10-05",
});
vm.runInContext(
  block("const queries =", "const sourceTailPattern =")
    + block("const sourceTailPattern =", "function articleKey(")
    + block("const similarityStopwords =", "function getTag(")
    + block("function isLowResolutionImage(", "function imageQualityScore(")
    + block("function kstDateString(", "const preferredDateValue =")
    + block("function isAdultItem(", "function candidateImageRank(")
    + block("function businessPriority(", "const candidates =")
    + block("function articleKey(", "function clusterTitleKey(")
    + block("function isCollectionReview(", "async function chooseArticleImage(")
    + block("function relevanceSort(", "const orderedDraft ="),
  context,
);
const competitor = {
  title: "올포유, 가을 상품 판매 전략 강화", description: "한성에프아이의 가두점 판매 전략을 소개한다.",
  url: "https://example.com/competitor", source: "어패럴뉴스", sourceType: "google-news",
  publishedAt: "2026-10-04T09:00:00+09:00",
};
const general = {
  title: "해외 패션 시장의 새 기술과 소비 트렌드", url: "https://example.com/general", source: "한국섬유신문",
  sourceType: "direct", imageUrl: "https://example.com/news/photo/large.jpg",
  publishedAt: "2026-10-05T09:00:00+09:00",
};
assert.equal(context.businessPriority(competitor), 2);
assert.equal(context.businessPriority({ title: "PAT, 가을 상품 구성 강화" }), 2);
assert.equal(context.businessPriority({ title: "헤지스, 해외 유통 전략 확대" }), 2);
assert.equal(context.businessPriority({ title: "4050 소비자, 의류 구매 변화" }), 1);
assert.equal(context.businessPriority({ title: "4060 소비자, 의류 구매 변화" }), 1);
assert.equal(context.businessPriority({ title: "여성복 캐주얼 컬렉션" }), 0);
assert.equal(context.businessPriority({ title: "compatible fabric technology" }), 0);
assert.equal(context.businessPriority({ title: "헤지스, 셀럽 공항패션 화보" }), 0);
assert.equal(context.businessPriority({ title: "헤지스 화장품 시장 동향" }), 0);
assert.ok(context.priorityScore(general) > context.priorityScore(competitor));
assert.ok(context.compareArticlePriority(competitor, general) < 0);
assert.ok(context.compareArticlePriority({ title: "어덜트 고객층 구매 변화" }, general) < 0);
const imageCompetitor = { ...competitor, sourceType: "direct", imageUrl: general.imageUrl };
assert.ok(context.compareArticlePriority(imageCompetitor, competitor) < 0);

const generalArticles = [
  "웨어러블 기술 개발", "물류 플랫폼 투자", "의류 원단 생산", "백화점 고객 동향", "해외 전시회 개최", "수출 정책 변경",
].map((title, i) => ({ ...general, title, url: "https://example.com/" + i }));
Object.assign(context, {
  candidates: [competitor, ...generalArticles],
  safeNormalizeModelArticle: (article) => article,
  safeBriefingArticle: (article) => article,
  sameArticle: (a, b) => a.url === b.url,
  topicKey: () => "", clusterTitleKey: () => "",
  previousKeys: new Set(), previousTopicKeys: new Set(), previousClusterKeys: new Set(), previousTokenSets: [],
  ARTICLE_LIMIT: 6,
});
const selected = context.normalizeBriefingArticles(generalArticles);
assert.equal(selected.length, 6);
assert.equal(selected[0].url, competitor.url);
assert.ok(context.relevanceSort({ ...competitor, image: "" }, { ...generalArticles[0], image: general.imageUrl }) < 0);
context.previousKeys.add(context.articleKey(competitor.title));
const withoutDuplicate = context.normalizeBriefingArticles(generalArticles);
assert.equal(withoutDuplicate.length, 6);
assert.ok(withoutDuplicate.every((article) => article.url !== competitor.url));
context.previousKeys.clear();
context.safeBriefingArticle = () => null;
assert.equal(context.normalizeBriefingArticles(generalArticles).length, 6);
assert.ok(context.normalizeBriefingArticles(generalArticles).every((article) => article.url !== competitor.url));
context.candidates = generalArticles;
assert.equal(context.normalizeBriefingArticles(generalArticles).length, 6);
console.log("Passed relevance ranking, image tie-break, omitted candidate recovery, duplicate and quality gate checks.");

if (process.argv.includes("--audit")) {
  const archive = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../data/issues.js", import.meta.url), "utf8"), archive);
  for (const issue of archive.window.FASHION_DAILY_ISSUES.slice(0, 10)) {
    const related = issue.headlines.filter((title) => context.businessPriority({ title }) === 2);
    console.log(JSON.stringify({ date: issue.date, relatedCount: related.length, total: issue.headlines.length, related }));
  }
}

if (process.argv.includes("--live")) {
  const oldQueries = [
    "세정 한성 형지 인동 패션 브랜드",
    "올포유 웰메이드 올리비아로렌 크로커다일레이디",
    "폴로 랄프로렌 마시모듀띠 패션 유통",
  ];
  const queries = vm.runInContext("queries.slice(0, 3)", context);
  for (let i = 0; i < queries.length; i += 1) {
    const counts = await Promise.all([oldQueries[i], queries[i]].map(async (query) => {
      const url = new URL("https://news.google.com/rss/search");
      url.search = new URLSearchParams({ q: query + " when:7d", hl: "ko", gl: "KR", ceid: "KR:ko" }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      assert.equal(response.status, 200);
      const xml = await response.text();
      assert.ok(xml.includes("<rss"));
      return [...xml.matchAll(/<item>/g)].length;
    }));
    console.log(JSON.stringify({ query: queries[i], previousCount: counts[0], revisedCount: counts[1] }));
  }
}
