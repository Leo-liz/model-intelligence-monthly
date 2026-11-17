import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

const argument = process.argv.indexOf("--site");
const site = resolve(argument >= 0 ? process.argv[argument + 1] : "site");
const read = (path) => readFile(resolve(site, path));
const json = async (path) => JSON.parse((await read(path)).toString("utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const assetPattern = /\/model-intelligence-monthly\/(assets\/[^"']+\.(?:js|css))/g;
const assetsIn = (html) => [...html.matchAll(assetPattern)].map((match) => match[1]);

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(relative(site, path).replaceAll("\\", "/"));
    else assert.fail(`公开包含非普通文件：${path}`);
  }
  return result.sort();
}

const index = await json("reports/index.json");
assert.equal(index.latest_month, "2026-11");
assert.equal(index.latest_sample, "2026-11-17");
const sample = await json("reports/samples/2026-11-17/report.json");
assert.equal(sample.report.id, "2026-11-17");
assert.match(sample.report.boundary, /不是完整11月月报/);
assert.equal(sample.model_ledger.length, 23);
assert.equal(sample.new_models.rows.length, 4);

const rootHtmlBytes = await read("index.html");
const rootHtml = rootHtmlBytes.toString("utf8");
const newAssets = assetsIn(rootHtml);
assert.equal(new Set(newAssets).size, 2);
assert.ok(newAssets.some((path) => path.endsWith(".js")) && newAssets.some((path) => path.endsWith(".css")));

const historicalHtml = [];
const expected = new Set([".nojekyll", "index.html", "model-intelligence-preview.png", "data/monthly-report.json", "reports/index.json", ...newAssets]);
for (const report of index.reports.filter((item) => item.status === "success")) {
  const htmlPath = `${report.url}index.html`;
  historicalHtml.push(htmlPath);
  expected.add(htmlPath);
  expected.add(report.data_url);
  if (!report.version_history_url) continue;
  expected.add(report.version_history_url);
  const versions = await json(report.version_history_url);
  for (const archived of versions.archived_versions) {
    const archivedHtml = `${archived.url}index.html`;
    historicalHtml.push(archivedHtml);
    expected.add(archivedHtml);
    expected.add(archived.data_url);
    expected.add(`${archived.url}correction.json`);
  }
}

const sampleHtml = [];
for (const entry of index.samples ?? []) {
  if (entry.status !== "success") continue;
  const htmlPath = `${entry.url}index.html`;
  sampleHtml.push(htmlPath);
  expected.add(htmlPath);
  expected.add(entry.data_url);
}
for (const path of sampleHtml) assert.deepEqual(await read(path), rootHtmlBytes, `${path} 必须使用新版入口`);

const legacyHtmlHash = "bd1b0933605dc57db68f7ee370c16476fed820cbf821184533c5c2b47f1a15ab";
const legacyAssets = new Set();
for (const path of historicalHtml) {
  const bytes = await read(path);
  assert.equal(hash(bytes), legacyHtmlHash, `${path} 历史 HTML 原始字节已改变`);
  for (const asset of assetsIn(bytes.toString("utf8"))) legacyAssets.add(asset);
}
assert.deepEqual([...legacyAssets].sort(), ["assets/index-AuV6lS5k.css", "assets/index-DO-WSJ3f.js"]);
for (const asset of legacyAssets) expected.add(asset);

const files = await filesUnder(site);
assert.deepEqual(files, [...expected].sort(), "增量发布后的公开文件白名单不一致");
for (const path of files) assert.ok((await stat(resolve(site, path))).isFile());

for (const [path, expectedHash] of Object.entries({
  "data/monthly-report.json": "30ba683456772e3b0db19fa027064265354c81d05f5b85a5f7c537f5963b3f65",
  "reports/2026-11/monthly-report.json": "30ba683456772e3b0db19fa027064265354c81d05f5b85a5f7c537f5963b3f65",
  "reports/2026-10/monthly-report.json": "664ecb87182265db3b991a3449da5dfac07efe6837f9ffab971568f3591e4d65",
  "reports/2026-09/monthly-report.json": "cdcaa1e91fd44ce15743ef2d7cdb5ac4b9cb773547f60cda27ea85b6ef8c2f99",
  "reports/2026-08/monthly-report.json": "7236f9a41aeeb13f6c93b9045e976f3d909320c8f9400372bc9617309bbe76ac",
  "reports/2026-11/versions/candidate-a97483ef03e5/monthly-report.json": "1bcf74e7fe770ba2fc25b9513bac995dee2e01dcfc27c429e6c44a2483ddc302",
  "reports/2026-11/versions/candidate-ef735e87ef30/monthly-report.json": "840d3c3f24e938510d4ac8c2c58d987f360aa9d873bf0ffe11e5eed384070828",
  "assets/index-AuV6lS5k.css": "1d50dcc0afd0ef66d88ba524f16aeb7de7aeaba247dbb4bd7775e042a9bea543",
  "assets/index-DO-WSJ3f.js": "204c30edffe41cca86c15361eef3fa5f97f6af4870533a5801b3e16cfa12daea",
})) assert.equal(hash(await read(path)), expectedHash, `${path} 不是公开仓库原始 blob 字节`);

const forbidden = /(?:data[\\/]research|reports[\\/]research|coordination[\\/]|\.(?:xlsx?|env|gitattributes)\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_|gh[pousr]_|(?:api[_-]?key|secret|cookie|authorization)\s*[=:]\s*["'][^"']+|[A-Z]:\\Users\\|\/Users\/|\/home\/|flowNo|externalFlowNo|rawmeta)/i;
for (const path of files.filter((name) => /\.(?:html|json|js|css)$/.test(name))) assert.doesNotMatch((await read(path)).toString("utf8"), forbidden, path);
console.log(JSON.stringify({ outcome: "pass", latest_sample: index.latest_sample, history_months: index.reports.map((item) => item.month), site_files: files.length, new_assets: newAssets.sort(), preserved_assets: [...legacyAssets].sort() }));
