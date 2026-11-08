import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEquipmentStore } from './equipment-store.mjs';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
};

const json=(response,status,value)=>response.writeHead(status,{'Content-Type':mime['.json'],'Cache-Control':'no-store'}).end(JSON.stringify(value));
async function body(request){
  if(!request.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('JSON 형식으로 저장해 주세요.'),{status:415});
  let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>32768)throw Object.assign(new Error('입력 정보가 너무 큽니다.'),{status:413});chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('입력 형식을 확인해 주세요.'),{status:400});}
}
export function createFieldServer({root=process.cwd(),dataFile=resolve(root,'data/equipment.json')}={}){
root=resolve(root);const store=createEquipmentStore(dataFile);
return createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  try{
    if(pathname==='/api/equipment'&&request.method==='GET'){json(response,200,{schemaVersion:1,equipment:await store.list()});return;}
    const match=pathname.match(/^\/api\/equipment\/([a-z0-9][a-z0-9_-]{0,63})$/);
    if(match){
      if(request.method==='GET'){json(response,200,await store.get(match[1]));return;}
      if(request.method==='PATCH'){
        if(request.headers.origin&&request.headers.origin!==`http://${request.headers.host}`){json(response,403,{error:'허용되지 않은 저장 요청입니다.'});return;}
        const input=await body(request);
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['patch','revision'].includes(k))){json(response,400,{error:'입력 형식을 확인해 주세요.'});return;}
        json(response,200,await store.patch(match[1],input.patch,input.revision));return;
      }
      response.setHeader('Allow','GET, PATCH');json(response,405,{error:'지원하지 않는 요청입니다.'});return;
    }
    if(pathname.startsWith('/api/')){json(response,404,{error:'저장 API를 찾을 수 없습니다.'});return;}
  }catch(error){json(response,error.status||500,{error:error.status?error.message:'시험 정보를 저장하거나 불러오지 못했습니다. 서버와 저장 파일을 확인해 주세요.'});return;}
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  if(pathname.split('/').some(part=>part.startsWith('.')||part==='data')||['/equipment-store.mjs','/server.mjs'].includes(pathname)){response.writeHead(403).end('Forbidden');return;}
  let file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    if ((await stat(file)).isDirectory())file=resolve(file,'index.html');
    const content=await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': 'no-store'
    });
    response.end(request.method==='HEAD'?undefined:content);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const port=Number(process.env.PORT||8521);createFieldServer().listen(port,'127.0.0.1',()=>console.log(`Open http://127.0.0.1:${port}/`));
}
