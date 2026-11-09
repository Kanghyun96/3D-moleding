import { VehicleMotion } from '../motion.js';
import { HOME, HOME_YAW, ROADS, LOOPS, planTravel, surfaceAt, Route, SLOT_PHOTO } from '../routes.js';
import { PHOTO, HOME_PHOTO, photoToWorld, worldToPhoto, checkVehiclePose, BLOCKED_POLYGONS, SURFACE_POLYGONS } from '../photo-map.js';
import { OrthographicCamera, Vector3 } from '../vendor/three.core.js';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const ids=Object.keys(LOOPS);
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function verify(){
  const report={passed:true,pathSamples:0,motionSteps:0,transfers:0,projectionError:0,cases:[]};
  for(const road of ROADS){
    for(let s=0;s<=road.route.length;s+=.1){
      const p=road.route.point(s),t=road.route.tangent(s),yaw=Math.atan2(t.x,t.z);
      assert(!checkVehiclePose(p.x,p.z,yaw),`${road.from}→${road.to} road collision at ${s.toFixed(1)}`);
      report.pathSamples++;
    }
  }
  for(const[id,route]of Object.entries(LOOPS)){
    for(const path of route.closed?[route]:[route,route.reversed()]){
      for(let s=0;s<=path.length;s+=.1){
        const p=path.point(s),t=path.tangent(s),yaw=Math.atan2(t.x,t.z);
        assert(!checkVehiclePose(p.x,p.z,yaw),`${id} body collision at ${s.toFixed(1)}`);
        assert(surfaceAt(p.x,p.z)===id,`${id} pattern leaves selected terrain at ${s.toFixed(1)}`);
        report.pathSamples++;
      }
    }
  }
  const photo=p=>worldToPhoto(p.x,p.z);
  for(const road of ROADS){
    const first=road.route.point(0),last=road.route.point(road.route.length);
    const start=road.from==='home'?HOME_PHOTO:road.from.startsWith('home_')?SLOT_PHOTO[road.from.slice(5)]:road.from==='gate'?[242,272]:photo(LOOPS[road.from].point(0));
    const end=road.to==='home'?HOME_PHOTO:road.to.startsWith('home_')?SLOT_PHOTO[road.to.slice(5)]:road.to==='gate'?[242,272]:photo(LOOPS[road.to].point(0));
    assert(Math.hypot(...photo(first).map((v,i)=>v-start[i]))<.01,`${road.from} road start seam`);
    assert(Math.hypot(...photo(last).map((v,i)=>v-end[i]))<.01,`${road.to} road end seam`);
  }
  assert(JSON.stringify(planTravel('E','D').nodes)==='["E","D"]','E→D must connect directly across the inner dirt strip');
  assert(JSON.stringify(planTravel('D','E').nodes)==='["D","E"]','D→E must connect directly across the inner dirt strip');
  assert(JSON.stringify(planTravel('A','D').nodes)==='["A","D"]','A→D must enter directly via the inner gate');
  assert(JSON.stringify(planTravel('A','E').nodes)==='["A","E"]','A→E must enter directly via the inner gate');
  assert(JSON.stringify(planTravel('B','C').nodes)==='["B","C"]','B→C must use the lower divider passage');
  assert(JSON.stringify(planTravel('C','B').nodes)==='["C","B"]','C→B must use the lower divider passage');
  assert(JSON.stringify(planTravel('A','C').nodes)==='["A","gate","C"]','A→C must use the lower perimeter passage');
  assert(JSON.stringify(planTravel('A','B').nodes)==='["A","gate","B"]','A→B must use the lower perimeter passage');
  for(const a of ['home',...ids])for(const b of ['home',...ids])if(a!==b){
    const plan=planTravel(a,b);
    assert(plan.edges.length>0&&Number.isFinite(plan.seconds),`${a}→${b} has no timed route`);
    if(a!=='home'&&b!=='home')assert(!plan.nodes.includes('home'),`${a}→${b} must not route through home`);
  }

  function step(m){
    m.update(1/60);report.motionSteps++;
    assert(!m.blocked,`motion blocked: ${m.routeId} ${m.phase} ${m.blocked?.id}`);
    assert(!checkVehiclePose(m.x,m.z,m.yaw),'motion overlaps an obstacle');
    assert(Number.isFinite(m.pose.pitch),'invalid contact pose');
    if(m.route&&m.speed>.12){
      const t=m.route.tangent(m.s),heading=Math.atan2(t.x,t.z);
      assert(Math.abs(angleDelta(m.yaw,heading))<Math.PI/2,'bucket faces against travel');
    }
  }
  function runUntil(m,predicate,label,max=80000){
    for(let i=0;i<max;i++){step(m);if(predicate(m))return i;}
    throw new Error(`${label} did not finish`);
  }
  for(const id of ids){
    const m=new VehicleMotion();m.select(id);
    runUntil(m,v=>(v.phase==='loop'||v.phase==='zigzag')&&v.routeId===id,`home→${id}`);
    runUntil(m,v=>v.laps>=1,`${id} repeat pattern`);
    m.returnHome();runUntil(m,v=>v.phase==='parked',`${id}→home`);
    assert(Math.hypot(m.x-HOME[0],m.z-HOME[1])<.001,`${id} wrong parking point`);
    assert(Math.abs(angleDelta(m.yaw,HOME_YAW))<.001,`${id} bucket not facing parking arrow`);
    report.cases.push({name:`home→${id} pattern→home`,laps:m.laps,passed:true});
  }
  for(const from of ids)for(const to of ids)if(from!==to){
    const m=new VehicleMotion();m.select(from);
    runUntil(m,v=>v.routeId===from&&(v.phase==='loop'||v.phase==='zigzag')&&v.s>LOOPS[from].length*.35,`home→${from}`);
    m.events.length=0;m.select(to);
    assert(m.phase==='transfer'&&m.destination===to,`${from}→${to} did not depart immediately`);
    runUntil(m,v=>v.routeId===to&&(v.phase==='loop'||v.phase==='zigzag'),`${from}→${to}`);
    assert(m.laps===0,`${from}→${to} waited for full pattern before departing`);
    assert(!m.events.some(e=>e.type==='parked'),`${from}→${to} parked during transfer`);
    report.transfers++;report.cases.push({name:`${from}→${to}`,passed:true});
  }
  const paused=new VehicleMotion();paused.select('B');
  for(let i=0;i<1800;i++)step(paused);
  paused.paused=true;for(let i=0;i<900;i++)step(paused);
  const stopped=paused.distance;for(let i=0;i<180;i++)step(paused);
  assert(Math.abs(paused.distance-stopped)<.001,'paused vehicle drifts');
  paused.paused=false;for(let i=0;i<300;i++)step(paused);
  assert(paused.distance>stopped+.2,'resume failed');
  report.cases.push({name:'pause / resume',passed:true});

  function playbackDistance(rate){
    const m=new VehicleMotion();m.select('B');
    for(let frame=0;frame<600;frame++){
      let remaining=rate/60;
      while(remaining>1e-6){const dt=Math.min(1/90,remaining);m.update(dt);report.motionSteps++;
        assert(!m.blocked&&Number.isFinite(m.x),'high-rate playback blocked or lost position');remaining-=dt;}
    }
    return m.distance;
  }
  const one=playbackDistance(1),ten=playbackDistance(10);
  assert(one>1&&ten>one*2,'1× / 10× playback distance mismatch');
  report.cases.push({name:'1× / 10× playback substeps',distanceAt1:one,distanceAt10:ten,passed:true});

  const blocked=new VehicleMotion();
  const pts=[[840,375],[748,375],[710,375]].map(photoToWorld);
  blocked.x=pts[0][0];blocked.z=pts[0][1];blocked.route=new Route(pts,false,'invalid');blocked.routeId='B';blocked.phase='entry';
  let t=blocked.route.tangent(0);blocked.yaw=Math.atan2(t.x,t.z);
  assert(!checkVehiclePose(blocked.x,blocked.z,blocked.yaw),'negative-test start too close');
  for(let i=0;i<3600&&!blocked.blocked;i++)blocked.update(1/60);
  assert(blocked.blocked?.id==='office','invalid route was not blocked');
  assert(!checkVehiclePose(blocked.x,blocked.z,blocked.yaw),'collision guard let body penetrate');
  report.cases.push({name:'invalid office crossing stops',passed:true});

  const {crop,pixelsPerMeter:s,yaw,elevation}=PHOTO;
  for(const [w,h]of [[1400,700],[900,600],[390,400]]){
    const scale=Math.min(w/crop[2],h/crop[3]),half=h/(2*s*scale),cp=[crop[0]+crop[2]/2,crop[1]+crop[3]/2],center=photoToWorld(cp);
    const target=new Vector3(center[0],0,center[1]);
    const camera=new OrthographicCamera(-half*w/h,half*w/h,half,-half,.1,650);
    camera.position.copy(target).addScaledVector(new Vector3(Math.sin(yaw)*Math.cos(elevation),Math.sin(elevation),Math.cos(yaw)*Math.cos(elevation)),220);
    camera.lookAt(target);camera.updateMatrixWorld();camera.updateProjectionMatrix();
    for(const p of [HOME_PHOTO,[322,385],[878,562],[966,146]]){
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
  report.cases.push({name:'photo registration / full-field framing',passed:true});
  return report;
}
