import { VehicleMotion } from '../motion.js';
import { LOOPS, HOME, surfaceAt } from '../routes.js';
import { photoToWorld, checkVehiclePose } from '../photo-map.js';
import { STREET_LIGHTS, POLE_CLEARANCE } from '../site-fixtures.js';
import { terrainAt } from '../terrain.js';
import { SurfaceEffects } from '../surface-effects.js';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export function verifyConcrete(){
  const report={passed:true,caseGroups:0,motionSteps:0,minimumPoleGap:Infinity,routeMetres:LOOPS.F.length};
  const lights=STREET_LIGHTS.map(l=>({...l,world:photoToWorld(l.p)}));
  const gap=(p,yaw,light)=>{
    const dx=light.world[0]-p.x,dz=light.world[1]-p.z,cs=Math.cos(yaw),sn=Math.sin(yaw);
    const side=cs*dx-sn*dz,fore=sn*dx+cs*dz;
    return Math.hypot(Math.max(0,Math.abs(side)-1.41),Math.max(0,-1.79-fore,fore-2.64));
  };
  for(const path of [LOOPS.F,LOOPS.F.reversed()])for(let s=0;s<path.length;s+=.08){
    const p=path.point(s),t=path.tangent(s),yaw=Math.atan2(t.x,t.z);
    assert(!checkVehiclePose(p.x,p.z,yaw),'concrete body/bucket hits wall/pole');
    assert(surfaceAt(p.x,p.z)==='F','concrete path leaves its paved lane');
    for(const light of lights)report.minimumPoleGap=Math.min(report.minimumPoleGap,gap(p,yaw,light));
  }
  assert(report.minimumPoleGap>=POLE_CLEARANCE,'insufficient clearance to a streetlight base');
  for(const s of [0,LOOPS.F.length]){
    const p=LOOPS.F.point(s);
    for(let i=0;i<180;i++)assert(!checkVehiclePose(p.x,p.z,i*Math.PI/90),'concrete endpoint cannot turn safely');
  }
  const pole=lights.find(l=>l.id==='office-apron');
  assert(checkVehiclePose(pole.world[0],pole.world[1],0)?.id==='street-light:office-apron','pole guard does not block vehicle');
  report.caseGroups++;

  function setup(fraction,direction=1){
    const m=new VehicleMotion();m.routeId='F';m.phase='zigzag';m.patternDirection=direction;
    m.route=direction===1?LOOPS.F:LOOPS.F.reversed();m.s=m.route.length*fraction;
    const p=m.route.point(m.s),t=m.route.tangent(m.s);m.x=p.x;m.z=p.z;m.yaw=Math.atan2(t.x,t.z);m.speed=1.8;
    return m;
  }
  function step(m,dt){
    const before={x:m.x,z:m.z};m.update(dt);report.motionSteps++;
    assert(!m.blocked,`concrete motion blocked: ${m.blocked?.id}`);
    assert(!checkVehiclePose(m.x,m.z,m.yaw),'concrete motion penetrates obstacle');
    assert(Math.hypot(m.x-before.x,m.z-before.z)<.13,'concrete route joins by teleporting');
  }
  function finish(m,target){
    for(let i=0;i<50000;i++){
      step(m,1/60);
      if(target==='home'?m.phase==='parked':m.routeId===target&&(m.phase==='loop'||m.phase==='zigzag'))return;
    }
    throw new Error('concrete exit did not finish: '+target);
  }
  for(const rate of [1,10]){
    const m=setup(0),effects=new SurfaceEffects(()=>.3);let completed=false;
    for(let frame=0;frame<16000/rate;frame++){
      let remain=rate/60;
      while(remain>1e-6){const dt=Math.min(1/90,remain);step(m,dt);remain-=dt;}
      effects.update(1/60,m);
      if(m.laps>=1){completed=true;break;}
    }
    assert(completed,'concrete round trip did not complete at '+rate+'x');
    assert(effects.spawned===0&&effects.rippleCursor===0,'concrete creates soil/water particles');
    assert(terrainAt(m.x,m.z).kind==='concrete','concrete material missing');
  }
  report.caseGroups++;
  for(const direction of [1,-1])for(const[fraction,target]of [[.15,'A'],[.5,'B'],[.85,'home']]){
    const m=setup(fraction,direction);if(target==='home')m.returnHome();else m.select(target);finish(m,target);
    if(target==='home')assert(Math.hypot(m.x-HOME[0],m.z-HOME[1])<.001,'wrong parking position');
  }
  report.caseGroups++;
  const redirected=setup(.5);redirected.select('B');for(let i=0;i<30;i++)step(redirected,1/60);
  redirected.select('E');for(let i=0;i<30;i++)step(redirected,1/60);
  redirected.returnHome();finish(redirected,'home');
  report.caseGroups++;
  return report;
}
