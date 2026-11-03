import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const name of ['index.html','src'])await cp(name,`dist/${name}`,{recursive:true});
await cp('public','dist',{recursive:true});
console.log('Static build ready in dist/');
