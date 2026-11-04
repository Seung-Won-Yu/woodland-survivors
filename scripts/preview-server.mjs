import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL} from 'node:url';

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};

// Serve the built files under the same project prefix as GitHub Pages, without dev asset aliases.
export function createPreviewServer({root=resolve('dist'),basePath='/woodland-survivors/'}={}){
  if(!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath))throw new Error('Use a slash-delimited project path.');
  root=resolve(root);
  return http.createServer(async(req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(path==='/'&&basePath!=='/'){res.writeHead(302,{Location:basePath});res.end();return;}
      if(!path.startsWith(basePath))throw new Error('outside project');
      let file=resolve(root,path.slice(basePath.length)||'index.html');
      if(file!==root&&!file.startsWith(root+'/'))throw new Error('outside build');
      if((await stat(file)).isDirectory())file=resolve(file,'index.html');
      const body=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
    }catch{res.writeHead(404);res.end('Not found');}
  });
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
  const port=Number(process.env.WOODLAND_PREVIEW_PORT||5201),basePath=process.env.WOODLAND_BASE_PATH||'/woodland-survivors/';
  const server=createPreviewServer({basePath});
  server.listen(port,'127.0.0.1',()=>console.log(`Built preview · http://127.0.0.1:${server.address().port}${basePath}`));
}
