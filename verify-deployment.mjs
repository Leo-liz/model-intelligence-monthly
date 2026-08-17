import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const site = resolve(root, "site");
const html = await readFile(resolve(site, "index.html"), "utf8");
const report = JSON.parse(await readFile(resolve(site, "data/monthly-report.json"), "utf8"));

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
assert.equal(report.recent_models.model_count, 12);
assert.equal(report.priority_candidate_directions.length, 8);
assert.equal(report.dataset_counts.functions, 235);
assert.equal(report.dataset_counts.baseline_prices, 63);

const publicFiles = await readdir(root, { recursive: true });
const forbidden = publicFiles.filter((file) =>
  /(?:^|[\\/])(?:coordination|data[\\/]research)(?:[\\/]|$)|\.(?:xlsx?|env|pem|key)$/i.test(file),
);
assert.deepEqual(forbidden, [], `公开仓库包含不应发布的文件：${forbidden.join(", ")}`);

console.log("公开发布包验证通过：资源完整，12/8/235/63 计数正确，未发现研究台账、Excel 或凭据文件。");
