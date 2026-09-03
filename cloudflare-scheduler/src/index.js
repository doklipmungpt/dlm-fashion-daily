// 패션 데일리 자동 업데이트 누락을 보완하는 Cloudflare Worker Cron입니다.
const DEFAULTS = {
  owner: "doklipmungpt",
  repo: "dlm-fashion-daily",
  workflowFile: "daily-fashion.yml",
  ref: "main",
  siteDataUrl: "https://dlm-fashion-daily.pages.dev/data/issues.js",
};

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduler(env, { reason: "cron", cron: event.cron }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/") {
      return jsonResponse({ ok: false, error: "Not found" }, 404);
    }

    const dryRun = url.searchParams.get("dryRun") !== "false";
    const result = await runScheduler(env, { reason: "manual-check", dryRun });
    return jsonResponse(result, result.ok ? 200 : 500);
  },
};

async function runScheduler(env, options = {}) {
  const config = getConfig(env);
  const targetDate = getKstDate();
  const latest = await getLatestIssue(config.siteDataUrl);

  if (latest.date === targetDate) {
    return {
      ok: true,
      action: "skip",
      reason: "today-briefing-exists",
      targetDate,
      latest,
    };
  }

  const recentRun = await getRecentWorkflowRun(config, targetDate);
  if (recentRun && isActiveOrFresh(recentRun)) {
    return {
      ok: true,
      action: "skip",
      reason: "workflow-already-running-or-recent",
      targetDate,
      latest,
      recentRun,
    };
  }

  if (options.dryRun) {
    return {
      ok: true,
      action: "would-dispatch",
      reason: options.reason || "dry-run",
      targetDate,
      latest,
      recentRun,
    };
  }

  await dispatchWorkflow(config, targetDate);
  return {
    ok: true,
    action: "dispatched",
    reason: options.reason || "missing-today-briefing",
    targetDate,
    latest,
    recentRun,
  };
}

function getConfig(env) {
  const token = env.GITHUB_WORKFLOW_TOKEN;
  if (!token) {
    throw new Error("Missing Cloudflare secret: GITHUB_WORKFLOW_TOKEN");
  }

  return {
    owner: env.GITHUB_OWNER || DEFAULTS.owner,
    repo: env.GITHUB_REPO || DEFAULTS.repo,
    workflowFile: env.GITHUB_WORKFLOW_FILE || DEFAULTS.workflowFile,
    ref: env.GITHUB_REF || DEFAULTS.ref,
    siteDataUrl: env.SITE_DATA_URL || DEFAULTS.siteDataUrl,
    token,
  };
}

async function getLatestIssue(siteDataUrl) {
  const response = await fetch(`${siteDataUrl}?scheduler=${Date.now()}`, {
    headers: { "cache-control": "no-cache" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch site data: ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/window\.FASHION_DAILY_ISSUES\s*=\s*([\s\S]*?);\s*$/);
  if (!match) {
    throw new Error("Could not parse FASHION_DAILY_ISSUES from site data");
  }

  const issues = JSON.parse(match[1]);
  const latest = issues[0] || {};
  return {
    date: latest.date || null,
    title: latest.title || null,
    updatedAtText: latest.updatedAtText || null,
    url: latest.url || null,
  };
}

async function getRecentWorkflowRun(config, targetDate) {
  const url = githubApiUrl(config, `/actions/workflows/${encodeURIComponent(config.workflowFile)}/runs?per_page=20`);
  const data = await githubFetch(config, url);
  const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
  return runs.find((run) => getKstDate(new Date(run.created_at)) === targetDate) || null;
}

function isActiveOrFresh(run) {
  if (["queued", "in_progress", "waiting", "requested", "pending"].includes(run.status)) {
    return true;
  }

  const createdAt = new Date(run.created_at).getTime();
  const ageMinutes = (Date.now() - createdAt) / 60000;
  return ageMinutes < 20;
}

async function dispatchWorkflow(config, targetDate) {
  const url = githubApiUrl(config, `/actions/workflows/${encodeURIComponent(config.workflowFile)}/dispatches`);
  await githubFetch(config, url, {
    method: "POST",
    body: JSON.stringify({
      ref: config.ref,
      inputs: { target_date: targetDate },
    }),
  });
}

async function githubFetch(config, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      "user-agent": "dlm-fashion-daily-scheduler",
      "x-github-api-version": "2022-11-28",
      ...(init.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API failed: ${response.status} ${text.slice(0, 300)}`);
  }

  return text ? JSON.parse(text) : null;
}

function githubApiUrl(config, path) {
  return `https://api.github.com/repos/${config.owner}/${config.repo}${path}`;
}

function getKstDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
