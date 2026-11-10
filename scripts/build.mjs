import {mkdir,cp,rm,readdir,writeFile,readFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of ['index.html','reboot.html','favicon.svg','mission-icon.svg','src'])await cp(name,`dist/${name}`,{recursive:true});
for(const folder of ['v2','mission']){
 await mkdir(`dist/art/${folder}`,{recursive:true});
 const extension=folder==='mission'?'.webp':'.png';
 for(const name of await readdir(`public/art/${folder}`))if(name.endsWith(extension))await cp(`public/art/${folder}/${name}`,`dist/art/${folder}/${name}`);
}
await cp('public/fonts','dist/fonts',{recursive:true});
await mkdir('dist/docs',{recursive:true});
// Version every module edge as well as the entrypoint: Pages can cache children
// independently, which otherwise mixes old combat rules with a new interface.
const release=JSON.parse(await readFile('package.json','utf8')).version;
const assetVersion=(process.env.GITHUB_SHA?.slice(0,12)||release).replace(/[^a-zA-Z0-9._-]/g,'');
async function versionAssets(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=`${directory}/${entry.name}`;
    if(entry.isDirectory()){await versionAssets(path);continue;}
    if(!/\.(js|html)$/.test(entry.name))continue;
    let source=await readFile(path,'utf8');
    source=source.replace(/(\b(?:from\s*|import\s*)['"])(\.{1,2}\/[^'"]+\.js)(['"])/g,`$1$2?v=${assetVersion}$3`);
    if(entry.name.endsWith('.html'))source=source.replace(/((?:src|href)=["'])(\.{1,2}\/[^"']+\.(?:js|css))(["'])/g,`$1$2?v=${assetVersion}$3`);
    await writeFile(path,source);
  }
}
await versionAssets('dist');
await writeFile('dist/.nojekyll','');
console.log('Static build ready in dist/');
