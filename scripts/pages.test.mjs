import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {createPreviewServer} from './preview-server.mjs';

let server,base;
before(async()=>{
  await access('dist/index.html');
  server=createPreviewServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  base=`http://127.0.0.1:${server.address().port}/woodland-survivors/`;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));});

test('RIFT entrypoints resolve their dependencies under a project Pages prefix',async()=>{
  const pending=[new URL('index.html',base),new URL('reboot.html',base)],seen=new Set();
  while(pending.length){
    const url=pending.shift();if(seen.has(url.href))continue;seen.add(url.href);
    assert.ok(url.href.startsWith(base),`dependency escaped project path: ${url}`);
    const response=await fetch(url);assert.equal(response.status,200,url.href);
    const text=await response.text(),refs=[];
    if(url.pathname.endsWith('.html')){
      for(const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g))refs.push(match[1]);
      for(const match of text.matchAll(/\bfrom\s*["']([^"']+)["']/g))refs.push(match[1]);
    }
    if(url.pathname.endsWith('.js'))for(const match of text.matchAll(/\b(?:from\s*|import\s*)["']([^"']+)["']/g))refs.push(match[1]);
    if(url.pathname.endsWith('.css')||url.pathname.endsWith('.html'))for(const match of text.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g))refs.push(match[1]);
    for(const ref of refs)if(!/^(?:data:|blob:|#|https?:)/.test(ref))pending.push(new URL(ref,url));
  }
  assert.ok(seen.size>=15,`only ${seen.size} dependencies were checked`);
});

test('runtime illustrations and font files are served as actual binary assets',async()=>{
  const images=(await readdir('dist/art/v2')).filter(name=>name.endsWith('.png'));
  assert.equal(images.length,8);
  for(const name of images){const response=await fetch(new URL(`art/v2/${name}`,base)),bytes=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200,name);assert.deepEqual([...bytes.slice(0,4)],[137,80,78,71],name);}
  for(const name of ['Galmuri11.woff2','Galmuri11-Bold.woff2']){const response=await fetch(new URL(`fonts/woodland/${name}`,base)),bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.toString('ascii',0,4),'wOF2',name);}
  for(const name of ['operators','enemies','vehicles','environment-v014','hangar-v014','vehicle-layers-v015']){const response=await fetch(new URL(`art/mission/${name}.png`,base));const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200,name);assert.deepEqual([...bytes.slice(0,4)],[137,80,78,71],name);}
  await access('dist/.nojekyll');await access('dist/fonts/woodland/LICENSE.txt');
});

test('the published bundle excludes development records and does not rely on domain-root paths',async()=>{
  for(const path of ['woodland.html','prototype.html','docs/motion-lab.html','art/v2/generation-record.json','outputs/','work/','README.md','src/main.js']){
    const response=await fetch(new URL(path,base));assert.equal(response.status,path==='src/main.js'?200:404,path);
  }
  const root=new URL(base).origin;
  assert.equal((await fetch(`${root}/src/main.js`)).status,404);
  assert.equal((await fetch(`${root}/art/v2/party-combat.png`)).status,404);
  assert.match(await readFile('dist/index.html','utf8'),/\.\/src\/reboot\/main\.js/);
});

test('entrypoints and transitive modules share one deployment version',async()=>{
 const html=await readFile('dist/index.html','utf8'),version=html.match(/src\/reboot\/main\.js\?v=([a-zA-Z0-9._-]+)/)?.[1];assert.ok(version);
 assert.ok(html.includes(`src/reboot/style.css?v=${version}`));
 const reboot=await readFile('dist/reboot.html','utf8');assert.ok(reboot.includes(`src/reboot/main.js?v=${version}`));assert.ok(reboot.includes(`src/reboot/style.css?v=${version}`));
 for(const path of ['main','model','render','profile','content','campaign','interface']){const source=await readFile(`dist/src/reboot/${path}.js`,'utf8');for(const [,ref]of source.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g))assert.ok(ref.endsWith(`.js?v=${version}`),`${path}: ${ref}`);}
 for(const path of ['src/main.js','src/mission/main.js','src/mission/model.js','src/mission/profile.js','src/mission/render.js','src/mission/motion.js','src/mission/route.js','src/sprint/main.js','src/sprint/render.js','src/core/game.js','src/game/render.js']){
  const source=await readFile('dist/'+path,'utf8');const imports=[...source.matchAll(/\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g)];assert.ok(imports.length>0,path);
  for(const [,ref]of imports)assert.ok(ref.endsWith(`.js?v=${version}`),`${path}: ${ref}`);
 }
});
