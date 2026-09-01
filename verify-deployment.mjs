import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const site = resolve(root, "site");
const html = await readFile(resolve(site, "index.html"), "utf8");
const report = JSON.parse(await readFile(resolve(site, "data/monthly-report.json"), "utf8"));
const reportIndex = JSON.parse(await readFile(resolve(site, "reports/index.json"), "utf8"));
const augustReport = JSON.parse(await readFile(resolve(site, "reports/2026-08/monthly-report.json"), "utf8"));
const septemberReport = JSON.parse(await readFile(resolve(site, "reports/2026-09/monthly-report.json"), "utf8"));

assert.match(html, /<html lang="zh-CN">/);
assert.match(html, /<title>月度换模雷达｜模型情报月报<\/title>/);
assert.match(html, /\/model-intelligence-monthly\/assets\/[^"']+\.js/);
assert.match(html, /\/model-intelligence-monthly\/assets\/[^"']+\.css/);
assert.match(html, /https:\/\/leo-liz\.github\.io\/model-intelligence-monthly\/model-intelligence-preview\.png/);
assert.doesNotMatch(html, /产品总监|产品总监版|产品总监月报|favicon\.svg/);

for (const assetPath of html.matchAll(/\/model-intelligence-monthly\/(assets\/[^"']+\.(?:js|css))/g)) {
  assert.ok((await stat(resolve(site, assetPath[1]))).isFile(), `缺少页面资源：${assetPath[1]}`);
}

assert.ok((await stat(resolve(site, ".nojekyll"))).isFile());
assert.ok((await stat(resolve(site, "model-intelligence-preview.png"))).size > 0);
assert.equal(report.report.month, "2026-09");
assert.deepEqual([report.report.window_start, report.report.window_end], ["2026-08-02", "2026-09-01"]);
assert.equal(report.recent_models.model_count, 15);
assert.equal(report.priority_candidate_directions.length, 5);
assert.equal(report.dataset_counts.functions, 235);
assert.equal(report.dataset_counts.baseline_prices, 63);
assert.equal(report.monthly_price_changes.confirmed_count, 3);
assert.equal(reportIndex.latest_month, "2026-09");
assert.deepEqual(reportIndex.reports.map((item) => item.month), ["2026-09", "2026-08"]);
assert.equal(augustReport.report.month, "2026-08");
assert.equal(septemberReport.report.month, "2026-09");

for (const required of [
  "reports/2026-08/index.html",
  "reports/2026-08/monthly-report.json",
  "reports/2026-09/index.html",
  "reports/2026-09/monthly-report.json",
  "reports/index.json",
]) {
  assert.ok((await stat(resolve(site, required))).isFile(), `缺少历史月报文件：${required}`);
}

const siteFiles = (await readdir(site, { recursive: true })).map((file) => file.replaceAll("\\", "/"));
const forbidden = siteFiles.filter((file) =>
  /(?:^|[\\/])(?:coordination|data[\\/]research)(?:[\\/]|$)|\.(?:xlsx?|env|pem|key)$/i.test(file),
);
assert.deepEqual(forbidden, [], `公开仓库包含不应发布的文件：${forbidden.join(", ")}`);
assert.ok(siteFiles.every((file) =>
  (
    /^(?:assets|data|reports|reports\/2026-(?:08|09))$/.test(file) ||
    file === ".nojekyll" ||
    file === "index.html" ||
    file === "model-intelligence-preview.png" ||
    /^assets\/[^/]+\.(?:js|css)$/.test(file) ||
    file === "data/monthly-report.json" ||
    file === "reports/index.json" ||
    /^reports\/2026-(?:08|09)\/(?:index\.html|monthly-report\.json)$/.test(file) ||
    /\/$/.test(file)
  )
), `公开站点出现白名单外文件：${siteFiles.join(", ")}`);

for (const jsonPath of [
  "data/monthly-report.json",
  "reports/index.json",
  "reports/2026-08/monthly-report.json",
  "reports/2026-09/monthly-report.json",
]) {
  const text = await readFile(resolve(site, jsonPath), "utf8");
  assert.doesNotMatch(text, /(?:[A-Z]:\\Users\\|BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|github_pat_|ghp_)/i, `${jsonPath} 含本地路径或凭据特征`);
}

console.log("公开发布包验证通过：九月最新页、八九月历史、15/5/235/63/3 计数和静态载荷白名单均正确。");
