const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : [path.join(dir,e.name)]); }
const files = [path.join(root,'README.md'), ...walk(path.join(root,'docs')), path.join(root,'artifacts/sonar/README.md')].filter(f=>f.endsWith('.md'));
let count=0; const missing=[];
for (const file of files) {
  const body=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
  for (const match of body.matchAll(/\]\((<[^>]+>|[^)\n]+)\)/g)) {
    let url=match[1].replace(/^<|>$/g,'');
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    url=decodeURI(url.split('#')[0]); count++;
    if (!fs.existsSync(path.resolve(path.dirname(file),url))) missing.push({file:path.relative(root,file),url});
  }
}
console.log(JSON.stringify({files:files.length,links:count,missing},null,2));
process.exitCode=missing.length?1:0;
