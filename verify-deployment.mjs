import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = process.cwd();
const site = resolve(root, "site");
const read = (path) => readFile(resolve(site, path));
const json = async (path) => JSON.parse((await read(path)).toString("utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const textHash = (bytes) => hash(Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n")));
const canonicalHash = (value) => hash(Buffer.from(JSON.stringify(value), "utf8"));
const versionId = (value) => `candidate-${canonicalHash(value).slice(0, 12)}`;

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else {
      assert.ok(entry.isFile());
      result.push(relative(site, path).replaceAll("\\", "/"));
    }
  }
  return result.sort();
}

const report = await json("data/monthly-report.json");
const november = await json("reports/2026-11/monthly-report.json");
const october = await json("reports/2026-10/monthly-report.json");
const september = await json("reports/2026-09/monthly-report.json");
const august = await json("reports/2026-08/monthly-report.json");
const index = await json("reports/index.json");

assert.deepEqual(report, november);
assert.equal(report.report.month, "2026-11");
assert.deepEqual([report.report.window_start, report.report.window_end], ["2026-10-03", "2026-11-01"]);
assert.equal(report.recent_models.model_count, 7);
assert.equal(report.recent_models.rows.length, 7);
assert.equal(report.priority_candidate_directions.length, 5);
assert.equal(new Set(report.priority_candidate_directions.map((item) => item.candidate_id)).size, 5);
for (const [key, value] of Object.entries({
  functions: 235,
  releases: 19,
  recent_models: 7,
  lifecycle_events: 12,
  recommendations: 5,
  price_quotes: 30,
  reference_costs: 8,
  confirmed_price_changes: 0,
  window_price_events: 0,
  baseline_prices: 63,
})) assert.equal(report.dataset_counts[key], value, key);
assert.equal(report.monthly_price_changes.confirmed_changes.length, 0);
assert.equal(report.monthly_price_changes.window_events.length, 0);
assert.doesNotMatch(report.monthly_price_changes.conclusion, /0%/);
assert.equal(index.latest_month, "2026-11");
assert.deepEqual(index.reports.map((item) => item.month), ["2026-11", "2026-10", "2026-09", "2026-08"]);
assert.equal(october.report.month, "2026-10");
assert.equal(september.report.month, "2026-09");
assert.equal(august.report.month, "2026-08");

for (const [path, expected] of [
  ["reports/2026-08/monthly-report.json", "7236f9a41aeeb13f6c93b9045e976f3d909320c8f9400372bc9617309bbe76ac"],
  ["reports/2026-09/monthly-report.json", "cdcaa1e91fd44ce15743ef2d7cdb5ac4b9cb773547f60cda27ea85b6ef8c2f99"],
]) assert.equal(textHash(await read(path)), expected, `${path} historical data changed`);
assert.equal(textHash(await read("reports/2026-10/monthly-report.json")), "664ecb87182265db3b991a3449da5dfac07efe6837f9ffab971568f3591e4d65");

const octoberVersions = await json("reports/2026-10/versions/index.json");
assert.equal(octoberVersions.active_version, "candidate-cd08450564f1");
assert.equal(octoberVersions.active_version, versionId(october));
assert.deepEqual(octoberVersions.archived_versions.map((item) => item.version_id), ["candidate-20806adfe650"]);
const octoberArchive = octoberVersions.archived_versions[0];
assert.deepEqual(await json(`${octoberArchive.url}correction.json`), { schema_version: 1, month: "2026-10", ...octoberArchive });
assert.equal(textHash(await read(octoberArchive.data_url)), "7076273130dc0ed61fde3d3bd7ab60d1b9d63e0bde836e189aaee4739d575548");

const novemberVersions = await json("reports/2026-11/versions/index.json");
assert.equal(novemberVersions.active_version, "candidate-5173e03fcc1b");
assert.equal(novemberVersions.active_version, versionId(november));
assert.equal(index.reports[0].active_version, novemberVersions.active_version);
const expectedNovemberArchives = {
  "candidate-a97483ef03e5": {
    raw: "1bcf74e7fe770ba2fc25b9513bac995dee2e01dcfc27c429e6c44a2483ddc302",
    replacedBy: "candidate-ef735e87ef30",
    replacementHash: "ef735e87ef3083b8792ab86223badb9a1f007516f7bcf4813ceddb706d9f8edd",
  },
  "candidate-ef735e87ef30": {
    raw: "840d3c3f24e938510d4ac8c2c58d987f360aa9d873bf0ffe11e5eed384070828",
    replacedBy: "candidate-5173e03fcc1b",
    replacementHash: "5173e03fcc1b2573ed38119ab0063759e4d74ca92521f5ca285ea876ff6ba909",
  },
};
assert.deepEqual(novemberVersions.archived_versions.map((item) => item.version_id).sort(), Object.keys(expectedNovemberArchives).sort());
for (const entry of novemberVersions.archived_versions) {
  const expected = expectedNovemberArchives[entry.version_id];
  assert.equal(entry.archived_at, null);
  assert.equal(entry.archived_at_evidence.status, "unknown_historical_event");
  assert.equal(entry.archived_json_sha256_raw, expected.raw);
  assert.equal(entry.replaced_by_version, expected.replacedBy);
  assert.equal(entry.replaced_by_content_sha256_canonical, expected.replacementHash);
  assert.equal(hash(await read(entry.data_url)), expected.raw);
  assert.equal(versionId(await json(entry.data_url)), entry.version_id);
  assert.deepEqual(await json(`${entry.url}correction.json`), { schema_version: 1, month: "2026-11", ...entry });
  const replacement = await json(entry.replaced_by_data_url);
  assert.equal(canonicalHash(replacement), expected.replacementHash);
}

const rootHtml = (await read("index.html")).toString("utf8");
const assets = [...rootHtml.matchAll(/\/model-intelligence-monthly\/(assets\/[^"']+\.(?:js|css))/g)].map((match) => match[1]);
assert.equal(new Set(assets).size, 2);
assert.ok(assets.some((path) => path.endsWith(".js")) && assets.some((path) => path.endsWith(".css")));
const expectedFiles = new Set([
  ".nojekyll",
  "index.html",
  "model-intelligence-preview.png",
  "data/monthly-report.json",
  "reports/index.json",
  ...assets,
  ...["2026-08", "2026-09", "2026-10", "2026-11"].flatMap((month) => [`reports/${month}/index.html`, `reports/${month}/monthly-report.json`]),
  "reports/2026-10/versions/index.json",
  ...["index.html", "monthly-report.json", "correction.json"].map((name) => `reports/2026-10/versions/candidate-20806adfe650/${name}`),
  "reports/2026-11/versions/index.json",
  ...Object.keys(expectedNovemberArchives).flatMap((version) => ["index.html", "monthly-report.json", "correction.json"].map((name) => `reports/2026-11/versions/${version}/${name}`)),
]);
const files = await filesUnder(site);
assert.deepEqual(files, [...expectedFiles].sort());
for (const path of files) assert.ok((await stat(resolve(site, path))).isFile());
assert.equal(hash(await read("model-intelligence-preview.png")), "23804624f12d5377c7cccd4a87b88705080bdc723bccd4e1a3d19d5142f8d2a2");

const forbidden = /(?:data[\\/]research|reports[\\/]research|coordination[\\/]|\.(?:xlsx?|env|gitattributes)\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_|gh[pousr]_|(?:api[_-]?key|secret|token|cookie|authorization)\s*[=:]\s*["'][^"']+|[A-Z]:\\Users\\|\/Users\/|\/home\/)/i;
for (const path of files.filter((name) => /\.(?:html|json|js|css)$/.test(name))) assert.doesNotMatch((await read(path)).toString("utf8"), forbidden, path);
for (const path of files.filter((name) => name.endsWith(".html"))) {
  const html = (await read(path)).toString("utf8");
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<title>月度换模雷达｜模型情报月报<\/title>/);
  assert.match(html, /https:\/\/leo-liz\.github\.io\/model-intelligence-monthly\/model-intelligence-preview\.png/);
  assert.doesNotMatch(html, /产品总监|favicon\.svg/);
  for (const asset of assets) assert.match(html, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.deepEqual((await readdir(root)).filter((name) => name !== ".git").sort(), [".github", "README.md", "site", "verify-deployment.mjs"]);
assert.deepEqual(await readdir(resolve(root, ".github")), ["workflows"]);
assert.deepEqual(await readdir(resolve(root, ".github/workflows")), ["deploy-pages.yml"]);
console.log(JSON.stringify({
  outcome: "pass",
  month: report.report.month,
  window: [report.report.window_start, report.report.window_end],
  recent_models: 7,
  candidates: 5,
  functions: 235,
  baseline_prices: 63,
  price_quotes: 30,
  confirmed_price_changes: 0,
  site_files: files.length,
  history_months: index.reports.map((item) => item.month),
  november_versions: [novemberVersions.active_version, ...novemberVersions.archived_versions.map((item) => item.version_id)],
}));
