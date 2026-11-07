import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createFieldServer } from '../../server.mjs';
import { createEquipmentRepository } from '../equipment-client.js';

export async function verifyEquipment(){
  const directory=await mkdtemp(join(tmpdir(),'trackvision-equipment-')),dataFile=join(directory,'equipment.json');
  const root=fileURLToPath(new URL('../..',import.meta.url));
  let server,base,repo;const report={passed:true,cases:[]};
  async function start(){server=createFieldServer({root,dataFile});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;repo=createEquipmentRepository({base:base+'/api/equipment'});}
  async function stop(){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;}}
  const patch=(value,revision,origin)=>fetch(base+'/api/equipment/bobcat-t870',{method:'PATCH',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({patch:value,revision})});
  try{
    await start();const initial=await repo.load('bobcat-t870');assert.equal(initial.testHours,0);assert.equal(initial.parkingSlotId,'P03');
    const data={purpose:'좌우 트랙 내구 시험\n직접 입력하는 시험 정보',testHours:37.25,testStatus:'running',tracks:{left:'좌측 T-870 / 450 mm',right:'우측 시제품 B'},surfaceHours:{general:20.25,gravel:12.5,concrete:4.5}};
    const saved=await repo.save(initial.id,data,initial.revision);assert.equal(saved.revision,1);for(const key of Object.keys(data))assert.deepEqual(saved[key],data[key]);
    assert.deepEqual(JSON.parse(await readFile(dataFile,'utf8')).equipment[initial.id],saved);
    report.cases.push('manual hours, Korean text and all card fields saved to disk');
    await stop();await start();assert.deepEqual(await repo.load(initial.id),saved);
    report.cases.push('full server restart restores identical equipment information');
    assert.equal((await patch({testHours:-1},1)).status,400);assert.equal((await patch({id:'other'},1)).status,400);
    assert.equal((await patch({testStatus:'invalid'},1)).status,400);assert.equal((await patch({purpose:'stale'},0)).status,409);
    assert.equal((await patch({purpose:'cross-origin'},1,'https://example.invalid')).status,403);
    assert.equal((await fetch(base+'/api/equipment/constructor')).status,404);
    assert.equal((await fetch(base+'/api/equipment/unknown')).status,404);
    assert.equal((await fetch(base+'/data/equipment.json')).status,403);assert.equal((await fetch(base+'/.git/config')).status,403);
    assert.deepEqual(await repo.load(initial.id),saved);
    report.cases.push('invalid fields/hours, stale edits and cross-origin writes cannot overwrite data');
    const concurrent=await Promise.all([patch({purpose:'첫 번째 수정'},1),patch({purpose:'두 번째 수정'},1)]);
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal((await repo.load(initial.id)).revision,2);
    report.cases.push('concurrent edits are serialized with revision protection');
    await writeFile(dataFile,'{broken json','utf8');assert.equal((await fetch(base+'/api/equipment/bobcat-t870')).status,500);
    assert.equal((await patch({testHours:100},2)).status,500);assert.equal(await readFile(dataFile,'utf8'),'{broken json');
    report.cases.push('corrupt data is reported rather than reset or overwritten');
    return report;
  }finally{await stop();await unlink(dataFile).catch(()=>{});await rmdir(directory);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await verifyEquipment()));
