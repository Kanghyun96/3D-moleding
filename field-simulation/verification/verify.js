import { VehicleMotion } from '../motion.js';
import { HOME, INGRESS, LOOPS, surfaceAt, Route } from '../routes.js';
import { PHOTO, photoToWorld, worldToPhoto, checkVehiclePose, BLOCKED_POLYGONS, SURFACE_POLYGONS } from '../photo-map.js';
import { OrthographicCamera, Vector3 } from '../vendor/three.core.js';
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export function verify(){
  const report={pathSamples:0,motionSteps:0,cases:[],projectionError:0};
  for(const[id,loop]of Object.entries(LOOPS)){
    const entry=INGRESS[id],end=entry.point(entry.length),start=loop.point(0);
    assert(end.distanceTo(start)<1e-6,id+' entry seam');
    assert(entry.point(0).distanceTo(new Vector3(HOME[0],0,HOME[1]))<1e-6,id+' parking seam');
    for(const route of [entry,loop,entry.reversed()]){
      for(let s=0;s<=route.length;s+=.1){
        const p=route.point(s),t=route.tangent(s),yaw=Math.atan2(t.x,t.z)+(route.name.endsWith('-return')?Math.PI:0);
        assert(!checkVehiclePose(p.x,p.z,yaw),route.name+' footprint collision at '+s);
        if(route===loop)assert(surfaceAt(p.x,p.z)===id,id+' leaves selected surface at '+s);
        report.pathSamples++;
      }
    }
  }
  function step(m,dt){m.update(dt);report.motionSteps++;assert(!m.blocked,'motion blocked '+m.routeId+' '+m.phase+' '+m.blocked?.id);assert(!checkVehiclePose(m.x,m.z,m.yaw),'motion overlaps obstacle');assert(Number.isFinite(m.pose.pitch),'invalid contact pose');}
  for(const id of Object.keys(LOOPS)){
    const m=new VehicleMotion();m.select(id);let requested=false,n=0;
    for(;n<900*60;n++){
      step(m,1/60);
      if(m.laps>=1&&!requested){requested=true;m.returnHome();}
      if(requested&&m.phase==='parked')break;
    }
    assert(m.phase==='parked',id+' did not return');
    assert(Math.hypot(m.x-HOME[0],m.z-HOME[1])<.001,id+' wrong parking position');
    report.cases.push({name:id+' entry / two laps / reverse return',seconds:n/60,laps:m.laps});
    const partial=new VehicleMotion();partial.select(id);
    for(let i=0;i<30*60;i++)step(partial,1/60);
    partial.returnHome();
    for(let i=0;i<300*60&&partial.phase!=='parked';i++)step(partial,1/60);
    assert(partial.phase==='parked',id+' mid-entry return');
    report.cases.push({name:id+' mid-entry return',passed:true});
  }
  const switched=new VehicleMotion();switched.select('B');let queued=false,done=false;
  for(let i=0;i<600*60;i++){
    step(switched,1/60);
    if(switched.phase==='loop'&&!queued){switched.select('E');queued=true;}
    if(queued&&switched.routeId==='E'&&switched.phase==='loop'){done=true;break;}
  }
  assert(done,'queued B to E switch');report.cases.push({name:'B → parking → E',passed:true});
  const paused=new VehicleMotion();paused.select('B');
  for(let i=0;i<30*60;i++)step(paused,1/60);
  paused.paused=true;for(let i=0;i<12*60;i++)step(paused,1/60);
  const stopped=paused.distance;for(let i=0;i<3*60;i++)step(paused,1/60);
  assert(Math.abs(paused.distance-stopped)<.001,'paused vehicle drifts');
  paused.paused=false;for(let i=0;i<5*60;i++)step(paused,1/60);
  assert(paused.distance>stopped+.2,'resume failed');report.cases.push({name:'pause / resume',passed:true});
  for(const rate of [1,1.5,2]){
    const m=new VehicleMotion();m.select('B');
    for(let frame=0;frame<1800;frame++){let remain=rate/60;while(remain>1e-6){let dt=Math.min(1/90,remain);step(m,dt);remain-=dt;}}
    report.cases.push({name:rate+'× playback',distance:m.distance});
  }
  const blocked=new VehicleMotion();
  // An intentionally invalid path through the office must stop outside it.
  const pts=[[840,375],[748,375],[710,375]].map(photoToWorld);
  blocked.x=pts[0][0];blocked.z=pts[0][1];blocked.route=new Route(pts,false,'invalid');blocked.routeId='B';blocked.phase='entry';
  let t=blocked.route.tangent(0);blocked.yaw=Math.atan2(t.x,t.z);
  assert(!checkVehiclePose(blocked.x,blocked.z,blocked.yaw),'negative-test start too close');
  for(let i=0;i<60*60&&!blocked.blocked;i++)blocked.update(1/60);
  assert(blocked.blocked?.id==='office','invalid route was not blocked');
  assert(!checkVehiclePose(blocked.x,blocked.z,blocked.yaw),'collision guard let body penetrate');
  report.cases.push({name:'invalid office crossing stops before contact',passed:true});
  const {crop,pixelsPerMeter:s,yaw,elevation}=PHOTO;
  for(const [w,h]of [[1400,700],[900,600],[390,400]]){
    const scale=Math.min(w/crop[2],h/crop[3]),half=h/(2*s*scale),cp=[crop[0]+crop[2]/2,crop[1]+crop[3]/2],center=photoToWorld(cp);
    const target=new Vector3(center[0],0,center[1]);
    const camera=new OrthographicCamera(-half*w/h,half*w/h,half,-half,.1,650);
    camera.position.copy(target).addScaledVector(new Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)),220);
    camera.lookAt(target);camera.updateMatrixWorld();camera.updateProjectionMatrix();
    for(const p of [[667,230],[322,385],[878,562],[966,146]]){
      const [x,z]=photoToWorld(p);
      for(const y of [0,2]){
        const projected=new Vector3(x,y,z).project(camera),expected=worldToPhoto(x,z,y);
        const error=Math.hypot((projected.x*.5+.5)*w-(w/2+(expected[0]-cp[0])*scale),(-projected.y*.5+.5)*h-(h/2+(expected[1]-cp[1])*scale));
        report.projectionError=Math.max(report.projectionError,error);assert(error<1e-7,'photo/camera registration mismatch');
      }
    }
    for(const p of [...BLOCKED_POLYGONS.flatMap(o=>o.points),...Object.values(SURFACE_POLYGONS).flat()]){
      const x=w/2+(p[0]-cp[0])*scale,y=h/2+(p[1]-cp[1])*scale;
      assert(x>=0&&x<=w&&y>=0&&y<=h,'useful field cropped at '+w+'px');
    }
  }
  report.cases.push({name:'photo registration / desktop and mobile full-field framing',passed:true});
  return{passed:true,...report};
}
