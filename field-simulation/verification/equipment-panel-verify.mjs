import assert from 'node:assert/strict';
import { readFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFieldServer } from '../../server.mjs';
import { createEquipmentRepository } from '../equipment-client.js';
import { createEquipmentPanel } from '../equipment-panel.js';
import { PARKING_SLOTS, PARKING_AREA } from '../parking-config.js';
import { HOME, HOME_YAW } from '../routes.js';
import { photoToWorld, worldToPhoto, pointInPolygon, checkVehiclePose, setParkedEquipment, SITE_BOUNDARY } from '../photo-map.js';
import { createWorld } from '../world.js';
import { SURFACE_NAMES } from '../equipment-schema.js';
import { Scene } from '../vendor/three.core.js';
import { PERIMETER_FORWARD, PERIMETER_ROW } from '../photo-calibration.js';

// Controller-level event tests, not browser/layout screenshots. The production
// controller and real HTTP/disk repository run unchanged behind this small DOM.
class Element extends EventTarget{
  constructor(){super();this.value='';this.hidden=false;this.disabled=false;this.dataset={};this.attributes={};this.textContent='';}
  get valueAsNumber(){return this.value===''?NaN:Number(this.value);}
  setAttribute(name,value){this.attributes[name]=value;}
  focus(){this.focused=true;}
  scrollIntoView(){}
}
function documentFixture(html){
  const doc=new EventTarget(),elements=new Map();
  for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){
    const element=new Element();element.hidden=/\shidden(?:\s|>)/.test(match[0]);element.disabled=/\sdisabled(?:\s|>)/.test(match[0]);element.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]||'';elements.set(match[1],element);
  }
  const routes=['A','C','B','D','E','F'].map(id=>{const el=new Element();el.dataset.route=id;return el;});
  doc.getElementById=id=>{assert(elements.has(id),'missing field '+id);return elements.get(id);};
  doc.querySelectorAll=selector=>selector==='[data-route]'?routes:[];
  elements.get('equipment-form').checkValidity=()=>['test-hours','hours-general','hours-gravel','hours-concrete'].every(id=>{const n=elements.get(id).valueAsNumber;return Number.isFinite(n)&&n>=0&&n<=1e7;});
  doc.hidden=false;return{doc,elements,routes};
}
export async function verifyEquipmentPanel(){
  const directory=await mkdtemp(join(tmpdir(),'trackvision-panel-')),dataFile=join(directory,'equipment.json');
  const root=fileURLToPath(new URL('../..',import.meta.url)),html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const oldDocument=globalThis.document,server=createFieldServer({root,dataFile});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const actual=createEquipmentRepository({base:`http://127.0.0.1:${server.address().port}/api/equipment`});
  const report={passed:true,cases:[]};let release,hold=false,failWrites=false;
  const repository={load:actual.load,save:async(...args)=>{if(failWrites)throw new Error('저장 연결 실패');if(hold){hold=false;await new Promise(resolve=>release=resolve);}return actual.save(...args);}};
  try{
    let fixture=documentFixture(html);globalThis.document=fixture.doc;const chosen=[];
    let panel=createEquipmentPanel({repository,onChooseRoute:id=>chosen.push(id)});await panel.ready;
    assert.equal(panel.snapshot().loaded,true);assert.equal(panel.visible,false);
    panel.open();assert.equal(panel.visible,true);assert.equal(chosen.length,0);
    fixture.elements.get('drive').onclick();assert.equal(panel.choosing,true);assert.equal(chosen.length,0);
    fixture.routes[0].dispatchEvent(new Event('click'));assert.deepEqual(chosen,['A']);assert.equal(panel.choosing,false);
    assert.equal([...html.matchAll(/<details>/g)].length,4);assert(!html.includes('<footer'));
    report.cases.push('equipment selection opens a compact card; driving requires explicit surface choice');
    const edit=(id,value)=>{fixture.elements.get(id).value=String(value);fixture.elements.get('equipment-form').dispatchEvent(new Event('input'));};
    edit('test-purpose','수동 입력 내구 시험');edit('test-hours',25.75);edit('track-left','좌측 시제품');edit('track-right','우측 비교품');
    edit('hours-general',12.5);edit('hours-gravel',8.25);edit('hours-concrete',5);
    fixture.elements.get('test-status').value='running';fixture.elements.get('test-status').dispatchEvent(new Event('change'));
    assert.equal(await panel.save(),true);const record=await actual.load('bobcat-t870');
    assert.equal(record.testHours,25.75);assert.equal(record.testStatus,'running');assert.equal(record.tracks.left,'좌측 시제품');assert.equal(record.surfaceHours.concrete,5);
    await panel.close();fixture=documentFixture(html);globalThis.document=fixture.doc;
    panel=createEquipmentPanel({repository,onChooseRoute:id=>chosen.push(id)});await panel.ready;
    assert.equal(fixture.elements.get('test-purpose').value,'수동 입력 내구 시험');assert.equal(Number(fixture.elements.get('test-hours').value),25.75);assert.equal(fixture.elements.get('test-status').value,'running');
    assert.equal(panel.visible,false);panel.open();
    report.cases.push('manual fields and test status survive closing and creating a fresh card');
    hold=true;edit('test-hours',30);const first=panel.save();edit('test-hours',31.5);const second=panel.save();release();await Promise.all([first,second]);
    assert.equal((await actual.load('bobcat-t870')).testHours,31.5);assert.equal(panel.snapshot().dirty,false);
    report.cases.push('editing during an in-flight save preserves the newest hours');
    failWrites=true;edit('test-purpose','저장 실패에도 보존할 입력');assert.equal(await panel.save(),false);await panel.close();assert.equal(panel.visible,true);assert.equal(panel.snapshot().dirty,true);assert.equal(panel.snapshot().saveState,'error');
    failWrites=false;assert.equal(await panel.save(),true);await panel.close();
    report.cases.push('save failure stays visible and closing cannot silently discard edits');
    const poses=PARKING_SLOTS.map(slot=>{assert(pointInPolygon(slot.p,PARKING_AREA));const[x,z]=photoToWorld(slot.p);assert.equal(checkVehiclePose(x,z,HOME_YAW),null);return{id:slot.id,x,z,yaw:HOME_YAW};});
    setParkedEquipment(poses);for(const pose of poses)assert.equal(checkVehiclePose(pose.x,pose.z,pose.yaw,pose.id),null);
    assert.equal(checkVehiclePose(HOME[0],HOME[1],HOME_YAW)?.name,'주차 장비');setParkedEquipment([]);
    report.cases.push('P slots are separate, face the arrow and parked equipment blocks overlap');
    const scene=new Scene(),world=createWorld(scene);
    assert(world.parkingBays?.isMesh,'parking bay paint is missing');
    const painted=world.parkingBays.geometry.attributes.position;
    const parallel=(a,b)=>Math.abs(a[0]*b[1]-a[1]*b[0])/(Math.hypot(...a)*Math.hypot(...b))<1e-5;
    const projectedVector=(x,z)=>{const a=worldToPhoto(HOME[0],HOME[1]),b=worldToPhoto(HOME[0]+x,HOME[1]+z);return[b[0]-a[0],b[1]-a[1]];};
    assert(parallel(projectedVector(Math.sin(HOME_YAW),Math.cos(HOME_YAW)),PERIMETER_FORWARD),'loader axis does not follow right perimeter');
    for(let bay=0;bay<PARKING_SLOTS.length;bay++)for(let strip=0;strip<3;strip++){
      const start=(bay*3+strip)*6;
      const a=worldToPhoto(painted.getX(start),painted.getZ(start)),b=worldToPhoto(painted.getX(start+5),painted.getZ(start+5));
      assert(parallel([b[0]-a[0],b[1]-a[1]],strip===1?PERIMETER_ROW:PERIMETER_FORWARD),'paint does not follow the corresponding perimeter edge');
    }
    report.cases.push('all seven painted bays and the loader axis follow the two perimeter guides');
    for(let i=0;i<painted.count;i++)assert(pointInPolygon(worldToPhoto(painted.getX(i),painted.getZ(i)),SITE_BOUNDARY),'parking paint crosses perimeter');
    assert(!world.labels.some(label=>/^P\d|^[1-7]$/.test(label.name)),'parking bay numbers should not be displayed');
    assert(!scene.children.some(node=>node.isLine));assert(!world.labels.some(label=>label.gate||label.name.includes('X 진입')));
    for(const[id,name]of Object.entries(SURFACE_NAMES))assert.equal(world.labels.find(label=>label.id===id).name,name);
    assert(world.labels.some(label=>label.parking&&label.name==='P'));
    scene.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
    report.cases.push('new surface names, a P marker and no dashed routes or X entrance label');
    return report;
  }finally{setParkedEquipment([]);globalThis.document=oldDocument;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await unlink(dataFile).catch(()=>{});await rmdir(directory);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await verifyEquipmentPanel()));
