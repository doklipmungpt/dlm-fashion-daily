// 제목 수집, 문장 분리, 사실 요약과 컬렉션 기사 제한을 검증합니다.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./update-daily.mjs", import.meta.url), "utf8");
const context = vm.createContext({ beautyKeywords: [] });
function block(start, end) {
  const begin = source.indexOf(start);
  return source.slice(begin, source.indexOf(end, begin));
}
vm.runInContext(
  block("const queries =", "const sourceTailPattern =")
    + block("const sourceTailPattern =", "function articleKey(")
    + block("const similarityStopwords =", "function getTag(")
    + block("function metaContent(", "function pagePublishedAt(")
    + block("function articleKey(", "function clusterTitleKey(")
    + block("function toBriefingArticle(", "function safeBriefingArticle(")
    + block("function businessPriority(", "const candidates =")
    + block("function isCollectionReview(", "async function chooseArticleImage("),
  context,
);
const sentence = "영국 디자이너 스텔라 맥카트니가 바다의 아름다움과 해양 생태계에 대한 문제의식을 담은 2027 S/S 컬렉션을 선보였다.";
assert.deepEqual(Array.from(context.sentenceParts(sentence)), [sentence]);
assert.equal(context.qualityBullet("영국 디자이너 스텔라 맥카트니가 바다"), "");
assert.equal(context.qualityBullet("움과 해양 생태계에 대한 문제의식을 담은 2027 S/S 컬렉션을 선보였다."), "");
const decimal = "신발 매출은 전년 동기 대비 8.1% 증가했다.";
assert.deepEqual(Array.from(context.sentenceParts(decimal + " 하이킹 제품의 판매 비중도 늘었다.")), [
  decimal, "하이킹 제품의 판매 비중도 늘었다.",
]);
const summary = context.normalizeSummaryBullets({ title: "스텔라 맥카트니 컬렉션", description: sentence });
assert.deepEqual(Array.from(summary), [sentence]);
assert.equal(context.qualityBullet("스텔라 맥카트니 이슈는 기사에서 확인된 변화가 상품 기획과 고객 접점에 어떻게 연결되는지 보게 합니다."), "");
const used = new Set();
assert.equal(context.normalizeSummaryBullets({ description: sentence }, used).length, 1);
assert.equal(context.normalizeSummaryBullets({ description: sentence }, used).length, 0);
const heading = "2027 S/S 스텔라 맥카트니 컬렉션";
assert.equal(context.compactArticleTitle("[리뷰] " + heading + " " + sentence), heading);
assert.equal(context.compactArticleTitle("[리뷰] 유기적인 곡선과 실루엣 바다를 향한 찬사! " + heading), heading);
assert.equal(context.pageTitle('<meta property="og:title" content="[리뷰] ' + heading + '"><h1>' + sentence + '</h1>'), "[리뷰] " + heading);
const body = '<p>메뉴 영역</p><div class="view_body"><p>' + sentence + '</p><p>' + decimal + '</p><p>패션엔 정소예 기자</p></div><p>관련 없는 다른 기사</p>';
assert.equal(context.pageBodyText(body), sentence + " " + decimal);
assert.equal(context.pageBodyText("<div><p>본문 영역을 찾지 못한 경우</p></div>"), "");
const excerpt = "컬렉션의 모든 팬츠에는 재활용 소재를 사용했다. 투명한 가방은 재활용 플라스틱 병으로 제작했다.";
assert.equal(context.fallbackSummaryBullets({ description: sentence, bodyText: excerpt }).length, 3);

Object.assign(context, {
  fallbackImpact: () => "분석 문장",
  normalizeArticleDate: (value) => value,
  inferCategory: () => "브랜드",
});
const fallback = context.toBriefingArticle({
  title: "[리뷰] " + heading + " " + sentence, description: sentence, url: "https://example.com/review",
});
assert.equal(fallback.title, heading);
assert.equal(fallback.summaryBullets.length, 1);
assert.equal(context.toBriefingArticle({ title: "본문 정보 없는 제목" }), null);
assert.ok(context.isCollectionReview({ title: heading, url: "https://www.fashionn.com/board/read_new.php?table=1028&number=1" }));
assert.ok(!context.isCollectionReview({ title: "브랜드, 신규 상품 출시", url: "https://example.com/news" }));

const collection = (brand, priority) => ({
  title: brand + " 2027 S/S 컬렉션", url: "https://www.fashionn.com/board/read_new.php?table=1028&number=" + priority, priority,
});
const fixtures = [
  collection("디올", 100), collection("스텔라 맥카트니", 90),
  ...["신발 매출 증가", "의류 수출 확대", "유통 플랫폼 실적", "섬유 소재 개발", "정책 지원사업"].map((title, i) => ({
    title, url: "https://example.com/" + i, priority: 80 - i,
  })),
];
Object.assign(context, {
  candidates: fixtures,
  safeNormalizeModelArticle: (article) => article,
  isAdultItem: () => false,
  sameArticle: (a, b) => a.url === b.url,
  priorityScore: (article) => article.priority,
  topicKey: () => "",
  clusterTitleKey: () => "",
  safeBriefingArticle: (article) => article,
  previousKeys: new Set(), previousTopicKeys: new Set(), previousClusterKeys: new Set(), previousTokenSets: [],
  ARTICLE_LIMIT: 6,
});
const selected = context.normalizeBriefingArticles(fixtures);
assert.equal(selected.length, 6);
assert.equal(selected.filter(context.isCollectionReview).length, 1);
assert.ok(selected.some((article) => article.title === "신발 매출 증가"));

const dataContext = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL("../data/issues.js", import.meta.url), "utf8"), dataContext);
const issue = dataContext.window.FASHION_DAILY_ISSUES.find((item) => item.date === "2026-10-06");
const html = fs.readFileSync(new URL("../issues/2026-10-06.html", import.meta.url), "utf8");
const titles = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]);
assert.deepEqual(titles, Array.from(issue.headlines));
assert.equal(titles.length, 6);
assert.equal(titles.filter((title) => title.includes("컬렉션")).length, 1);
assert.ok(titles[1].includes("K2·아이더"));
const stella = [...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].map((match) => match[1]).find((card) => card.includes(heading.replace("2027 S/S ", "")) || card.includes("스텔라 맥카트니"));
assert.ok(stella);
const bullets = [...stella.matchAll(/<li>(.*?)<\/li>/g)].map((match) => match[1]);
assert.equal(bullets.length, 3);
assert.ok(bullets.every((bullet) => context.qualityBullet(bullet) === bullet));
console.log("Passed title, sentence, factual fallback, collection selection and October 6 publication checks.");

if (process.argv.includes("--live")) {
  for (const url of [
    "https://www.fashionn.com/board/read_new.php?table=1028&number=62657&sel_cat=",
    "https://www.ktnews.com/news/articleView.html?idxno=149113",
  ]) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    assert.equal(response.status, 200);
    const html = await response.text();
    const title = context.compactArticleTitle(context.pageTitle(html));
    const bodyText = context.pageBodyText(html);
    assert.ok(title.length <= 48);
    assert.ok(bodyText.length > 100);
    assert.equal(context.fallbackSummaryBullets({ bodyText }).length, 3);
    console.log(JSON.stringify({ url, title, bodyLength: bodyText.length, factualBullets: 3 }));
  }
  const response = await fetch("https://www.ktnews.com/news/photo/202610/149113_131444_4059.jpg", {
    signal: AbortSignal.timeout(12000),
  });
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("content-type")?.startsWith("image/"));
  console.log("Replacement article image returned HTTP 200 with an image content type.");
}
