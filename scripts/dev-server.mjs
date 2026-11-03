import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=process.cwd(),port=Number(process.env.WOODLAND_PORT||5200);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.woff2':'font/woff2','.json':'application/json'};
http.createServer(async(req,res)=>{
  try {
    let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(path.startsWith('/fonts/')||path.startsWith('/art/'))path='/public'+path;
    let file=resolve(root,'.'+path);
    if(file!==root&&!file.startsWith(root+'/'))throw new Error('path');
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
  } catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Woodland Survivors · http://127.0.0.1:${port}`));
