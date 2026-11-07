import { daylightAt, SiteClock } from '../daylight.js';
import { terrainAt, terrainAtPhoto, terrainHeight, WET_PATCH } from '../terrain.js';
import { SurfaceEffects, PARTICLE_LIMIT, DUST_TRAIL_LIMIT } from '../surface-effects.js';
import { STREET_LIGHTS, BUILDING_WINDOWS } from '../site-lighting.js';
import { LOOPS, ROADS, Route } from '../routes.js';
import { PHOTO, photoToWorld, worldToPhoto, footprint, pointInPolygon } from '../photo-map.js';
import { VehicleMotion } from '../motion.js';
import { createEffectView, effectPixelSize } from '../effect-view.js';
import { BUILDING_PANES, createBuildingLighting } from '../building-lighting.js';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const date=time=>new Date(`2026-11-07T${time}:00+09:00`);
export function verifyPhase3(){
  const report={passed:true,cases:[],particleLimit:PARTICLE_LIMIT,streetLights:STREET_LIGHTS.length};
  assert(daylightAt(date('12:00')).day===1,'noon is not day');
  assert(daylightAt(date('22:00')).night===1,'22:00 is not night');
  assert(daylightAt(new Date('2026-11-06T15:00:00Z')).clock==='00:00','Seoul midnight/timezone rollover');
  assert(daylightAt(date('06:30')).day===.5&&daylightAt(date('18:30')).day===.5,'twilight interpolation');
  for(const time of ['06:00','07:00','18:00','19:00']){
    const t=date(time),a=daylightAt(new Date(t.getTime()-1000)),b=daylightAt(t);
    assert(Math.abs(a.day-b.day)<.001,'discontinuous dawn/dusk boundary');
  }
  let wallTime=date('18:59');const clock=new SiteClock(()=>wallTime);
  for(const rate of [1,10]){for(let i=0;i<rate*100;i++)clock.sample();assert(clock.sample().clock==='18:59','playback moved real clock');}
  wallTime=date('19:01');assert(clock.sample().night===1,'open-screen time did not refresh');
  clock.setPreview('day');assert(clock.sample().day===1&&clock.sample().preview,'day preview');
  clock.setPreview('night');assert(clock.sample().night===1,'night preview');
  clock.setPreview('live');assert(!clock.sample().preview&&clock.sample().clock==='19:01','return to live time');
  report.cases.push({name:'Seoul clock, midnight, smooth dawn/dusk, live refresh and playback independence',passed:true});

  assert(terrainAtPhoto(486,280).kind==='wet','pond classified as dry');
  assert(terrainAtPhoto(402,300).kind==='gravel','stony bank classified as water');
  const dKinds=new Set();for(let s=0;s<LOOPS.D.length;s+=.15){const p=LOOPS.D.point(s);dKinds.add(terrainAt(p.x,p.z).kind);}
  assert(dKinds.has('wet')&&dKinds.has('gravel'),'D route does not demonstrate both materials');
  report.cases.push({name:'photo-calibrated D wet/gravel zones both intersect driving route',passed:true});

  const emissions={};
  for(const[kind,photo]of Object.entries({soil:[502,182],dry:[872,645],earth:[544,560],wet:[486,280],gravel:[402,300],blocks:[312,390],road:[690,215]})){
    let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};
    const[x,z]=photoToWorld(photo),motion={x,z,yaw:0,leftDistance:0,rightDistance:0},pool=new SurfaceEffects(random);
    for(let i=0;i<450;i++){motion.leftDistance+=.02;motion.rightDistance+=.02;pool.update(1/90,motion);assert(pool.active<=PARTICLE_LIMIT,'unbounded pool');}
    const kinds=[...new Set(pool.particles.filter(p=>p.life>0).map(p=>p.kind))];emissions[kind]=kinds;
    if(kind==='wet')assert(kinds.includes('water')&&kinds.includes('mud')&&!kinds.includes('dust'),'wet emitted dust or lacks water/mud');
    if(kind==='gravel')assert(kinds.includes('gravel'),'gravel particles missing');
    if(kind==='road')assert(pool.spawned===0,'paved road emits dust');
    const before=pool.spawned;for(let i=0;i<300;i++)pool.update(1/90,motion);
    assert(pool.spawned===before&&pool.active===0,'parked vehicle emits or particles never expire');
    assert([...pool.positions,...pool.sizes,...pool.alphas].every(Number.isFinite),'non-finite particle state');
  }
  // A turn without center translation still moves the two tracks.
  const[x,z]=photoToWorld([502,182]),turning={x,z,yaw:0,leftDistance:0,rightDistance:0},turnPool=new SurfaceEffects(()=>.3);
  for(let i=0;i<90;i++){turning.leftDistance+=.01;turning.rightDistance-=.01;turnPool.update(1/90,turning);}
  assert(turnPool.spawned>0,'in-place track motion has no effect');
  // Motion substeps accumulate distance; effects update once per real frame.
  // Equal traveled distance should emit equally at 1x and 10x playback.
  const replay=rate=>{
    const pool=new SurfaceEffects(()=>.3),m={x,z,yaw:0,leftDistance:0,rightDistance:0};
    const frames=600/rate;
    for(let frame=0;frame<frames;frame++){
      m.leftDistance+=rate/60;m.rightDistance+=rate/60;pool.update(1/60,m);
      assert(pool.active<=PARTICLE_LIMIT,'high playback exhausts particle pool');
    }
    return pool.spawned;
  };
  assert(Math.abs(replay(1)-replay(10))<=2,'playback rate changes distance-based emission density');
  report.cases.push({name:'per-contact materials, steering, fixed particle pool, stop and natural expiry',emissions,passed:true});

  const visibility=[];
  for(const[width,height]of [[1450,905],[390,430]]){
    const pixelsPerMeter=8*Math.min(width/1135,height/755);
    const sizes={dust:effectPixelSize('dust',.42,pixelsPerMeter),gravel:effectPixelSize('gravel',.09,pixelsPerMeter),water:effectPixelSize('water',.16,pixelsPerMeter),mud:effectPixelSize('mud',.12,pixelsPerMeter)};
    assert(sizes.dust>=7&&sizes.gravel>=2.8&&sizes.water>=2.8&&sizes.water<=7&&sizes.mud>=2.2&&sizes.mud<=5,'particle screen size outside material bounds');
    visibility.push({width,height,pixelSizes:sizes});
  }
  const view=createEffectView(turnPool);view.setScale(10,2);view.sync();
  assert(view.cloud.geometry.getAttribute('aKind').array===turnPool.kinds,'material shape attribute missing');
  assert(view.cloud.material.uniforms.uScale.value===20&&view.cloud.material.uniforms.uPixelRatio.value===2,'DPR sizing mismatch');
  // Exercise the actual frame scheduling contract: motion can run at 10x,
  // while a fresh visible splash keeps its real-time lifetime after stopping.
  const[wx,wz]=photoToWorld([486,280]),fast={x:wx,z:wz,yaw:0,leftDistance:0,rightDistance:0};
  const spray=new SurfaceEffects(()=>.3);
  for(let frame=0;frame<60;frame++){fast.leftDistance+=.68*10/60;fast.rightDistance+=.68*10/60;spray.update(1/60,fast);}
  const before=spray.spawned;spray.update(.1,fast);
  assert(spray.active>0&&spray.spawned===before,'10x splash vanishes immediately or emits after stop');
  assert(spray.ripples.some(r=>r.life>0),'wet driving produces no contact wake');
  for(let frame=0;frame<180;frame++)spray.update(1/60,fast);
  assert(spray.active===0&&spray.spawned===before,'real-time effects never expire');
  assert(spray.ripples.every(r=>r.life===0&&r.alpha===0),'wet wake continues while stationary');
  view.cloud.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
  report.cases.push({name:'overview/mobile pixel visibility, material sprite attributes and real-time lifetime at 10x',visibility,passed:true});

  const poses={};
  for(const[id,route]of Object.entries(LOOPS)){
    const vehicle=new VehicleMotion();let maxPitch=0,maxRoll=0,minY=Infinity,maxY=-Infinity,trackDifference=0;
    for(let s=0;s<route.length;s+=.12){
      const p=route.point(s),t=route.tangent(s);vehicle.x=p.x;vehicle.z=p.z;vehicle.yaw=Math.atan2(t.x,t.z);
      vehicle.speed=0;vehicle.omega=0;vehicle.acceleration=0;vehicle.updateContact(1/60);
      assert(Object.values(vehicle.pose).every(Number.isFinite),'unstable terrain pose');
      maxPitch=Math.max(maxPitch,Math.abs(vehicle.pose.pitch));maxRoll=Math.max(maxRoll,Math.abs(vehicle.pose.roll));
      minY=Math.min(minY,vehicle.y);maxY=Math.max(maxY,vehicle.y);
      trackDifference=Math.max(trackDifference,Math.abs(vehicle.pose.leftPitch-vehicle.pose.rightPitch));
    }
    assert(maxPitch<.25&&maxRoll<.25,'excessive vehicle tilt');
    poses[id]={pitchDegrees:maxPitch*180/Math.PI,rollDegrees:maxRoll*180/Math.PI,heightRange:maxY-minY,trackDifferenceDegrees:trackDifference*180/Math.PI};
  }
  assert(poses.E.heightRange>poses.A.heightRange,'block response indistinguishable from compacted dirt');
  assert(poses.E.pitchDegrees>poses.A.pitchDegrees*4&&poses.E.trackDifferenceDegrees>2,'block course has no distinct body/track articulation');
  const stopped=new VehicleMotion(),stopPoint=LOOPS.E.point(LOOPS.E.length*.4);
  stopped.x=stopPoint.x;stopped.z=stopPoint.z;stopped.yaw=.5;
  for(let i=0;i<360;i++)stopped.updateContact(1/60);
  const settled={...stopped.pose};for(let i=0;i<120;i++)stopped.updateContact(1/60);
  assert(Object.keys(settled).every(key=>Math.abs(settled[key]-stopped.pose[key])<1e-5),'parked block course still shakes');
  report.cases.push({name:'bounded contact-based body pitch/roll/heave on A–E',poses,passed:true});

  for(const light of STREET_LIGHTS){
    assert(light.p[0]>=PHOTO.crop[0]&&light.p[0]<=PHOTO.crop[0]+PHOTO.crop[2]&&light.p[1]>=PHOTO.crop[1]&&light.p[1]<=PHOTO.crop[1]+PHOTO.crop[3],'fixture cropped in overview');
    const[x,z]=photoToWorld(light.p),reprojected=worldToPhoto(x,z);
    assert(Math.hypot(reprojected[0]-light.p[0],reprojected[1]-light.p[1])<1e-7,'fixture registration');
    for(const route of [...ROADS.map(r=>r.route),...Object.values(LOOPS)])for(let s=0;s<route.length;s+=.2){
      const p=route.point(s),t=route.tangent(s);
      assert(!pointInPolygon(light.p,footprint(p.x,p.z,Math.atan2(t.x,t.z))),`pole in vehicle swept path: ${light.id}`);
    }
  }
  assert(BUILDING_WINDOWS.office.length>0&&BUILDING_WINDOWS.garage.length>0,'building lighting missing');
  report.cases.push({name:'9 photo-registered roadside lights clear of driving paths, office and garage glazing',passed:true});

  const splashes=new SurfaceEffects(()=>.3);
  splashes.emit('water',wx,wz,0,1,.68);
  const drop=splashes.particles[0];
  assert(drop.vy<.8&&splashes.sizes[0]<.14&&splashes.alphas[0]<=.55,'water splash looks like a large opaque fountain');
  assert(splashes.colors[2]<=splashes.colors[1],'wet splash has saturated blue tint');
  const defs={children:[],append(child){this.children.push(child);}};
  const element=(tag,attributes={})=>({tag,attributes,children:[],append(...children){this.children.push(...children);}});
  const building=createBuildingLighting({svgElement:element,defs,photoUrl:'assets/field-photo-a-uniform-source.png'});
  const interiors=building.interiors.children.flatMap(g=>g.children);
  assert(interiors.every(node=>node.tag==='use'&&node.attributes['clip-path']),'building glazing painted with flat colour');
  assert(defs.children.filter(n=>n.tag==='image').length===2,'building material does not reuse photo texture');
  assert(BUILDING_PANES.office.every(p=>p.strength<.7)&&BUILDING_PANES.garage.every(p=>p.strength<.65),'overexposed building lights');
  assert(new Set(BUILDING_PANES.office.map(p=>p.strength)).size>2,'every office room has identical brightness');
  report.cases.push({name:'subtle water ballistics/wakes and photo-textured pane-clipped building illumination',officePanes:BUILDING_PANES.office.length,garageBays:BUILDING_PANES.garage.length,passed:true});

  const previousD=new Route([[402,300],[452,262],[486,286],[524,258],[556,282]].map(photoToWorld),false,'previous-D');
  const coverage=route=>{
    const path=[];for(let s=0;s<route.length;s+=.4)path.push(route.point(s));
    let covered=0,total=0;
    for(let u=410;u<=590;u+=4)for(let v=228;v<=324;v+=4){
      if(!pointInPolygon([u,v],WET_PATCH))continue;
      total++;const[x,z]=photoToWorld([u,v]);
      if(path.some(p=>Math.hypot(p.x-x,p.z-z)<2.4))covered++;
    }
    return {covered,total,fraction:covered/total};
  };
  const oldCoverage=coverage(previousD),newCoverage=coverage(LOOPS.D);
  assert(newCoverage.covered>oldCoverage.covered*1.35,'expanded D route does not cover substantially more pond');
  assert(poses.D.pitchDegrees>2.5&&poses.E.pitchDegrees>2.8,'D/E body response remains too subtle');
  const wake=new SurfaceEffects(()=>.3),wm={x:wx,z:wz,yaw:0,speed:.68,leftDistance:0,rightDistance:0};
  for(let i=0;i<90;i++){wm.leftDistance+=.68/60;wm.rightDistance+=.68/60;wake.update(1/60,wm);}
  assert(wake.ripples.some(r=>r.alpha>.15&&r.radius>.4),'wet contact disturbance remains invisible');
  for(const id of ['D','E']){
    const m=new VehicleMotion(),p=LOOPS[id].point(LOOPS[id].length*.45);
    m.x=p.x;m.z=p.z;for(let i=0;i<360;i++)m.updateContact(1/60);
    const pose={...m.pose};for(let i=0;i<120;i++)m.updateContact(1/60);
    assert(Object.keys(pose).every(key=>Math.abs(pose[key]-m.pose[key])<1e-5),`${id} keeps jolting at rest`);
  }
  report.cases.push({name:'broader wet-course coverage, stronger D/E jolts and visible contact wakes',oldCoverage,newCoverage,passed:true});

  const puff=new SurfaceEffects(()=>.3),still={x,z,yaw:0,leftDistance:0,rightDistance:0};
  puff.emitDustPuff(x,z,0,1,2);
  assert(puff.spawned===3,'dust is not grouped into billows');
  const initial=puff.sizes[0],origin=Array.from(puff.positions.slice(0,3));
  puff.update(.12,still);
  assert(puff.sizes[0]>initial*1.5&&puff.alphas[0]>0,'dust does not bloom from a small puff');
  puff.update(.15,still);
  assert(puff.positions[1]-origin[1]>.3,'dust stays at ground level instead of rising into billows');
  assert(Math.hypot(puff.positions[0]-origin[0],puff.positions[2]-origin[2])<.15,'dust shoots backwards instead of billowing');
  for(let frame=0;frame<90;frame++)puff.update(1/60,still);
  assert(puff.active===0&&puff.spawned===3,'stationary billows do not fade naturally');
  const trailChecks=[];
  for(const rate of [1,10]){
    const cloud=new SurfaceEffects(()=>.3),m={x:0,z:0,yaw:0,speed:2.15,leftDistance:0,rightDistance:0};
    let maxDistance=0;
    for(let frame=0;frame<180;frame++){
      const distance=frame*rate*2.15/60,p=LOOPS.A.point(LOOPS.A.length*.3+distance),t=LOOPS.A.tangent(LOOPS.A.length*.3+distance);
      m.x=p.x;m.z=p.z;m.yaw=Math.atan2(t.x,t.z);m.leftDistance=distance;m.rightDistance=distance;
      const before=cloud.spawned;cloud.update(1/60,m);
      assert((cloud.spawned-before)%3===0,'soil emits an even stream instead of grouped puffs');
      cloud.particles.forEach((particle,i)=>{
        if(particle.life<=0||particle.kind!=='dust')return;
        assert(cloud.dustTravel-particle.birthTravel<DUST_TRAIL_LIMIT,'dust forms a long trail at '+rate+'x');
        maxDistance=Math.max(maxDistance,Math.hypot(cloud.positions[i*3]-m.x,cloud.positions[i*3+2]-m.z));
      });
    }
    assert(maxDistance<4.8,'visible dust too far behind loader');
    const road=photoToWorld([690,215]);m.x=road[0];m.z=road[1];m.yaw=0;
    const before=cloud.spawned;m.leftDistance+=.02;m.rightDistance+=.02;cloud.update(1/60,m);
    assert(cloud.spawned===before,'old dust budget spills onto paving');
    trailChecks.push({playback:rate,maxCloudDistanceMetres:maxDistance});
  }
  report.cases.push({name:'compact grouped dust billows, rapid expansion, natural fade and bounded trail at 1x/10x',trailChecks,passed:true});
  return report;
}
