// 기사 제목 압축과 게시 데이터의 일치 여부를 검증합니다.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("./update-daily.mjs", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(
  source.slice(source.indexOf("const sourceTailPattern ="), source.indexOf("function isCelebrityFashionArticle"))
    + source.slice(source.indexOf("function titleScore("), source.indexOf("function getTag(")),
  context,
);
const { compactArticleTitle, articleDisplayTitle } = context;
const hiring = "인동에프엔, 4년 만에 신입 사원 뽑는다! 2026년 하반기 신입사원 공개 채용 디자인·기획MD·영업 등 13개 직무 모집…채용 연계형 인턴십 거쳐 내년 1월 입사";
const fashionWeek = "[종합] 2027 SS 밀라노 패션위크 트렌드 키워드 9 유틸리티 페미닌룩, 가죽 재킷, 레오파드, 스커트의 재조명, 브라톱, 셔츠의 변주, 스쿱 넥, 버뮤다 팬츠 등 밀라노 2027 S/S 패션위크 트렌드 키워드 9가지를 소개한다.";
const concise = "인동에프엔, 2026 하반기 13개 직무 신입사원 채용";
assert.equal(articleDisplayTitle(concise, hiring), concise);
assert.equal(articleDisplayTitle("", hiring), "인동에프엔, 4년 만에 신입 사원 뽑는다");
assert.equal(compactArticleTitle(fashionWeek), "2027 SS 밀라노 패션위크 트렌드 키워드 9");
assert.equal(compactArticleTitle("브랜드, 매출 2.6% 증가"), "브랜드, 매출 2.6% 증가");
assert.equal(articleDisplayTitle("", ""), "");
const noBoundary = "핵심 브랜드와 사건이 담겨 있고 안전하게 제거할 부제 경계가 없는 원문 제목은 단어를 임의로 잘라 의미를 잃지 않도록 유지한다";
assert.equal(compactArticleTitle(noBoundary), noBoundary);
assert.equal(compactArticleTitle(concise + " - 패션비즈"), concise);
assert.equal(articleDisplayTitle("채용", hiring), "인동에프엔, 4년 만에 신입 사원 뽑는다");

const dataContext = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(new URL("../data/issues.js", import.meta.url), "utf8"), dataContext);
const issue = dataContext.window.FASHION_DAILY_ISSUES.find((item) => item.date === "2026-10-02");
const html = fs.readFileSync(new URL("../issues/2026-10-02.html", import.meta.url), "utf8");
assert.equal(issue.headlines.length, 6);
const headings = [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]);
assert.deepEqual(headings, Array.from(issue.headlines));
assert.ok(headings.every((title) => title.length <= 48));
assert.equal(headings[4], concise);
assert.equal(headings[5], "2027 S/S 밀라노 패션위크, 트렌드 키워드 9");
console.log("Passed 8 title cases and all 6 published title consistency checks.");
