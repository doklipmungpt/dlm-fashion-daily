// 지정일 브리핑이 기사 수와 제목·요약의 게시 조건을 충족하는지 확인합니다.
import fs from "node:fs";
import vm from "node:vm";
import { publishedBriefingProblems } from "./briefing-validation.mjs";

const date = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("Expected YYYY-MM-DD");
try {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync("data/issues.js", "utf8"), context, { timeout: 1000 });
  const issue = context.window.FASHION_DAILY_ISSUES.find((item) => item.date === date);
  const html = fs.readFileSync("issues/" + date + ".html", "utf8");
  const problems = publishedBriefingProblems(issue, html);
  if (problems.length) throw new Error(problems.join("; "));
  console.log("Complete briefing exists for " + date);
} catch (error) {
  console.error("Briefing needs generation: " + error.message);
  process.exitCode = 1;
}
