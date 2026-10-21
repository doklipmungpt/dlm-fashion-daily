// 게시할 브리핑의 기사 수와 제목·요약·출처 일치 여부를 검증합니다.
export function briefingProblems(articles, expectedCount = 6) {
  const problems = [];
  if (!Array.isArray(articles) || articles.length !== expectedCount) {
    problems.push("Expected " + expectedCount + " articles, got " + (articles?.length || 0));
  }
  const urls = new Set();
  const titles = new Set();
  const bullets = new Set();
  for (const article of articles || []) {
    const title = (article.title || "").trim();
    if (title.length < 8 || title.length > 48 || /[,·:;…]$/.test(title)) problems.push("Invalid title: " + title);
    if (!/^https?:\/\//.test(article.url || "") || urls.has(article.url)) problems.push("Missing or duplicate article URL");
    if (titles.has(title)) problems.push("Duplicate article title");
    urls.add(article.url);
    titles.add(title);
    if (!article.summaryBullets?.length) problems.push("Missing factual summary: " + title);
    for (const bullet of article.summaryBullets || []) {
      const key = bullet.replace(/\s+/g, "");
      if (bullets.has(key)) problems.push("Repeated summary sentence");
      if (bullet.length < 18 || !/[.!?]$|[가-힣](?:했다|한다|있다|없다|니다|된다|됐다|였다|었다|았다|이다|는다)$/.test(bullet)) problems.push("Incomplete summary: " + bullet);
      bullets.add(key);
    }
  }
  return problems;
}

export function publishedBriefingProblems(issue, html) {
  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const articles = [...html.matchAll(/<article>([\s\S]*?)<\/article>/g)].map((match) => ({
    title: decode(match[1].match(/<h2>(.*?)<\/h2>/)?.[1] || ""),
    url: decode(match[1].match(/class="article-link" href="([^"]+)"/)?.[1] || ""),
    summaryBullets: [...match[1].matchAll(/<li>(.*?)<\/li>/g)].map((bullet) => decode(bullet[1])),
  }));
  const problems = briefingProblems(articles);
  const impacts = [...html.matchAll(/<p class="impact"><strong>업계 영향<\/strong>\s*([\s\S]*?)<\/p>/g)].map((match) => decode(match[1]).replace(/\s+/g, ""));
  if (new Set(impacts).size !== impacts.length) problems.push("Repeated industry impact");
  if (JSON.stringify(issue?.headlines) !== JSON.stringify(articles.map((article) => article.title))) problems.push("Archive headlines do not match article cards");
  if (!issue?.title || !html.includes("<h1>" + issue.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") + "</h1>")) problems.push("Archive title does not match issue page");
  return problems;
}
