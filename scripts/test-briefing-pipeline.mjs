// 분야 오탐, 원문 파싱, 실제 선정 경로와 게시 조건의 회귀를 검증합니다.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { briefingProblems, publishedBriefingProblems } from "./briefing-validation.mjs";

const source = fs.readFileSync(new URL("./update-daily.mjs", import.meta.url), "utf8");
function block(start, end) {
  const begin = source.indexOf(start);
  const finish = source.indexOf(end, begin);
  assert.ok(begin >= 0 && finish > begin, start);
  return source.slice(begin, finish);
}
const context = vm.createContext({
  URL, briefingProblems, console, date: "2026-10-21", preferredArticleDate: "2026-10-20", TIME_ZONE: "Asia/Seoul",
  previousKeys: new Set(), previousTokenSets: [], ARTICLE_LIMIT: 6,
});
vm.runInContext(
  block("const queries =", "const sourceTailPattern =")
    + block("const sourceTailPattern =", "function articleKey(")
    + block("function articleKey(", "async function fetchFeed(")
    + block("function kstDateString(", "const preferredDateValue =")
    + block("function metaContent(", "async function fetchDirectSource(")
    + block("function isFashionRelevant(", "const candidates =")
    + block("function normalizeArticleDate(", "function fallbackImpact(")
    + block("function articleAnalysis(", "function fallbackWatchPoints(")
    + block("function sameArticle(", "function fallbackTags(")
    + block("function toBriefingArticle(", "async function chooseArticleImage(")
    + block("function editorialMatchesArticles(", "async function finalEditorial("),
  context,
);
for (const title of [
  "온유, 컴백 전 음원 음방 1위…웰메이드 솔로 신보",
  "뮤지션 15팀 집결…웰메이드 공연으로 기대 충족",
  "DMS, 유리기판 정밀 세정으로 사업 확장",
  "웰메이드코리아, 이든 베트남 독점 총판 계약 체결",
]) {
  assert.equal(context.isFashionRelevant({ title }), false, title);
  assert.equal(context.businessPriority({ title }), 0, title);
}
assert.ok(context.isFashionRelevant({ title: "세정 웰메이드, 가을 다운 판매 확대" }));
assert.equal(context.isFashionRelevant({ title: "서울 오피스 공실률 상승", source: "어패럴뉴스" }), false);
assert.equal(context.cleanSummaryText("PAT는 가을 아우터 상품을 새로 선보였습니다."), "PAT는 가을 아우터 상품을 새로 선보였습니다.");
assert.equal(context.metaContent('<meta property="og:title" content="무신사, \'겨울 아우터\' 기획전 개최">', ["og:title"]), "무신사, '겨울 아우터' 기획전 개최");
assert.equal(context.metaContent("<meta content='헤지스, \"겨울 상품\" 확대' property='og:title'>", ["og:title"]), '헤지스, "겨울 상품" 확대');
assert.equal(context.pagePublishedAt('<p class="date">발행 2026년 10월 20일</p>'), "2026-10-20T09:00:00+09:00");
assert.equal(context.canonicalArticleUrl("http://www.apparelnews.co.kr/news/news_view/?idx=1&amp;cate=CAT12Z&utm_source=test"), "https://www.apparelnews.co.kr/news/news_view/?idx=1");
assert.equal(context.absolutizeUrl("http://www.apparelnews.co.kr/upfiles/image.jpg", "https://www.apparelnews.co.kr/"), "https://www.apparelnews.co.kr/upfiles/image.jpg");
const facts = context.fallbackSummaryBullets({
  title: "남성복 성장분의 83%가 두 브랜드에 집중",
  bodyText: "추동 시즌이 본격화되면서 의류 시장의 매출이 확대되고 있다. 신규 성장분의 83%가 두 브랜드에 집중된 것으로 나타났다. 전체 브랜드 가운데 다수는 매출이 줄어 성장 격차가 확대됐다.",
});
assert.ok(facts[0].includes("83%"));
const articleTitles = [
  "세정 웰메이드, 가을 다운 판매 확대", "헤지스, 여성 라인과 프리미엄 사업 강화",
  "형지 크로커다일레이디, 파크골프 상품 출시", "섬유 제조업 수출 회복세 확인",
  "백화점 상권 방문객 증가와 구매 전환 분석", "의류 공급망 관세 대응 전략 발표",
];
context.candidates = articleTitles.map((title, i) => ({
  title, url: "https://example.com/news/" + i, source: "한국섬유신문", sourceType: "direct",
  publishedAt: "2026-10-20T09:00:00+09:00",
  description: title.replace(/[,]/g, "") + "를 통해 실제 사업 운영의 변화가 확인됐습니다.",
  bodyText: "지난해보다 상품 판매가 늘면서 관련 사업의 매출이 개선됐습니다.",
}));
const actualSelected = context.normalizeBriefingArticles([]);
assert.equal(actualSelected.length, 6);
const usedSummaryBullets = new Set();
for (const article of actualSelected) article.summaryBullets = context.normalizeSummaryBullets(article, usedSummaryBullets);
assert.equal(briefingProblems(actualSelected).length, 0);
assert.ok(briefingProblems(actualSelected.slice(0, 3)).length > 0);
assert.ok(briefingProblems([{ ...actualSelected[0], title: "무신사," }], 1).length > 0);
assert.equal(context.editorialMatchesArticles({
  leadArticleUrl: "https://example.com/music", leadHeadline: "웰메이드 공연의 성장", leadSummary: "음원 이야기", watchPoints: [],
}, actualSelected), false);
const supportedEditorial = {
  leadArticleUrl: actualSelected[0].url, leadHeadline: actualSelected[0].title, leadSummary: actualSelected[0].summary,
  watchPoints: [
    "경량 상품의 판매 시기와 품목별 재고 회전 속도를 나누어 확인할 필요가 있습니다.",
    "신규 여성 라인의 가격대와 기존 고객의 구매 반응을 구분해 살펴볼 필요가 있습니다.",
    "오프라인 행사 이후 재구매와 방문 고객의 구매 전환을 함께 확인할 필요가 있습니다.",
  ],
};
assert.equal(context.editorialMatchesArticles(supportedEditorial, actualSelected), true);
assert.equal(context.editorialMatchesArticles({ ...supportedEditorial, leadSummary: "온유의 음원과 웰메이드 공연을 소개합니다." }, actualSelected), false);
assert.equal(context.editorialMatchesArticles({ ...supportedEditorial, leadSummary: "매출이 99999% 증가했습니다." }, actualSelected), false);
assert.equal(context.editorialMatchesArticles({ ...supportedEditorial, watchPoints: Array(3).fill(supportedEditorial.watchPoints[0]) }, actualSelected), false);
const archive = { window: {} };
vm.runInNewContext(fs.readFileSync("data/issues.js", "utf8"), archive);
const issue = archive.window.FASHION_DAILY_ISSUES.find((item) => item.date === "2026-10-21");
assert.equal(publishedBriefingProblems(issue, fs.readFileSync("issues/2026-10-21.html", "utf8")).length, 0);
console.log("Passed domain false positives, quoted metadata, publication dates, canonical URLs, factual salience, real six-article selection and incomplete publication rejection.");

if (process.argv.includes("--live")) {
  const page = await fetch("https://www.apparelnews.co.kr/news/news_view/?cat=CAT113&idx=228331");
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(context.pageBodyText(html).length > 300);
  assert.ok(context.pagePublishedAt(html).startsWith("2026-10-19"));
  console.log("Apparel News body and publication date parsed from the live article.");
}
