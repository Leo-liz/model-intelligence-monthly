import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, relative } from "node:path";
const root=process.cwd(), site=resolve(root,"site");
const read=(p)=>readFile(resolve(site,p));
const json=async(p)=>JSON.parse((await read(p)).toString());
const hash=(b)=>createHash("sha256").update(b).digest("hex");
const textHash=(b)=>hash(Buffer.from(b.toString().replaceAll("\r\n","\n")));
const versionId=(v)=>"candidate-"+hash(Buffer.from(JSON.stringify(v))).slice(0,12);
async function filesUnder(dir){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  const p=resolve(dir,e.name);
  if(e.isDirectory())out.push(...await filesUnder(p));
  else{assert.ok(e.isFile());out.push(relative(site,p).replaceAll("\\","/"));}
 }return out.sort();
}
const report=await json("data/monthly-report.json"), index=await json("reports/index.json");
assert.deepEqual(report,await json("reports/2026-10/monthly-report.json"));
assert.equal(report.report.month,"2026-10");
assert.deepEqual([report.report.window_start,report.report.window_end],["2026-09-10","2026-10-09"]);
assert.equal(report.recent_models.model_count,14);
assert.equal(report.recent_models.rows.length,14);
assert.equal(report.priority_candidate_directions.length,5);
for(const [k,v]of Object.entries({functions:235,baseline_prices:63,price_quotes:76,confirmed_price_changes:0,window_price_events:1}))assert.equal(report.dataset_counts[k],v);
assert.equal(report.monthly_price_changes.confirmed_count,0);
assert.equal(report.monthly_price_changes.window_events.length,1);
assert.equal(index.latest_month,"2026-10");
assert.deepEqual(index.reports.map(x=>x.month),["2026-10","2026-09","2026-08"]);
for(const [m,h]of [["2026-08","7236f9a41aeeb13f6c93b9045e976f3d909320c8f9400372bc9617309bbe76ac"],["2026-09","cdcaa1e91fd44ce15743ef2d7cdb5ac4b9cb773547f60cda27ea85b6ef8c2f99"]]){
 const p="reports/"+m+"/monthly-report.json";assert.equal((await json(p)).report.month,m);assert.equal(textHash(await read(p)),h,"Historical data changed");
}
const versions=await json("reports/2026-10/versions/index.json");
assert.equal(versions.schema_version,1);assert.equal(versions.month,"2026-10");
assert.equal(versions.active_version,"candidate-cd08450564f1");
assert.equal(versions.active_version,versionId(report));
assert.equal(index.reports[0].active_version,versions.active_version);
assert.equal(index.reports[0].version_history_url,"reports/2026-10/versions/index.json");
assert.deepEqual(versions.archived_versions.map(x=>x.version_id),["candidate-20806adfe650"]);
const versionFiles=[];
for(const e of versions.archived_versions){
 assert.match(e.version_id,/^candidate-[a-f0-9]{12}$/);
 const p="reports/2026-10/versions/"+e.version_id;
 assert.equal(e.url,p+"/");assert.equal(e.data_url,p+"/monthly-report.json");assert.equal(e.status,"archived_before_correction");
 assert.equal(versionId(await json(e.data_url)),e.version_id);
 assert.equal(textHash(await read(e.data_url)),"7076273130dc0ed61fde3d3bd7ab60d1b9d63e0bde836e189aaee4739d575548");
 assert.deepEqual(await json(p+"/correction.json"),{schema_version:1,month:"2026-10",...e});
 versionFiles.push(...["index.html","monthly-report.json","correction.json"].map(n=>p+"/"+n));
}
const files=await filesUnder(site);
const allowed=/^(?:\.nojekyll|index\.html|model-intelligence-preview\.png|assets\/[A-Za-z0-9_-]+\.(?:js|css)|data\/monthly-report\.json|reports\/index\.json|reports\/2026-(?:08|09|10)\/(?:index\.html|monthly-report\.json)|reports\/2026-10\/versions\/index\.json|reports\/2026-10\/versions\/candidate-20806adfe650\/(?:index\.html|monthly-report\.json|correction\.json))$/;
for(const p of files)assert.match(p,allowed);
for(const p of [".env","data/source.xlsx","reports/research/report.json","coordination/state.json","reports/2026-10/versions/../secret.json","reports/2026-10/versions/candidate-20806adfe650/payload.js"])assert.doesNotMatch(p,allowed);
const required=[".nojekyll","index.html","data/monthly-report.json","model-intelligence-preview.png","reports/index.json","reports/2026-10/versions/index.json",...["2026-08","2026-09","2026-10"].flatMap(m=>["reports/"+m+"/index.html","reports/"+m+"/monthly-report.json"]),...versionFiles];
for(const p of required)assert.ok((await stat(resolve(site,p))).isFile());
assert.equal(hash(await read("model-intelligence-preview.png")),"23804624f12d5377c7cccd4a87b88705080bdc723bccd4e1a3d19d5142f8d2a2");
const forbidden=/(?:data[\\/]research|reports[\\/]research|coordination[\\/]|\.(?:xlsx?|env)\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_|gh[pousr]_|(?:api[_-]?key|secret|token|cookie|authorization)\s*[=:]\s*["'][^"']+|[A-Z]:\\Users\\|\/Users\/|\/home\/)/i;
for(const p of files.filter(p=>/\.(?:html|json|js|css)$/.test(p)))assert.doesNotMatch((await read(p)).toString(),forbidden,p);
for(const p of files.filter(p=>p.endsWith(".html"))){
 const html=(await read(p)).toString();
 assert.match(html,/<html lang="zh-CN">/);assert.match(html,/<title>月度换模雷达｜模型情报月报<\/title>/);
 assert.match(html,/https:\/\/leo-liz\.github\.io\/model-intelligence-monthly\/model-intelligence-preview\.png/);
 assert.doesNotMatch(html,/产品总监|favicon\.svg/);
 const assets=[...html.matchAll(/\/model-intelligence-monthly\/(assets\/[^"']+\.(?:js|css))/g)].map(x=>x[1]);
 assert.ok(assets.some(x=>x.endsWith(".js"))&&assets.some(x=>x.endsWith(".css")));
 for(const asset of assets)assert.ok(files.includes(asset));
}
assert.deepEqual((await readdir(root)).filter(n=>n!==".git").sort(),[".github","README.md","site","verify-deployment.mjs"]);
assert.deepEqual(await readdir(resolve(root,".github")),["workflows"]);
assert.deepEqual(await readdir(resolve(root,".github/workflows")),["deploy-pages.yml"]);
console.log(JSON.stringify({outcome:"pass",month:report.report.month,window:[report.report.window_start,report.report.window_end],models:14,candidates:5,functions:235,baseline_prices:63,price_quotes:76,confirmed_price_changes:0,window_price_events:1,site_files:files.length,history_unchanged:true,version_archive_verified:true}));
