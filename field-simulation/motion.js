import { checkVehiclePose } from './photo-map.js';
import { HOME, HOME_YAW, P01_HOME, P01_YAW, SURFACES, LOOPS, Route, planTravel, groundHeight, surfaceAt } from './routes.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a), Math.cos(b-a));

function canTurnInPlace(x, z, yaw0, yaw1) {
  const d = angleDelta(yaw0, yaw1);
  for (let i = 0; i <= 18; i++) {
    if (checkVehiclePose(x, z, yaw0 + d * (i / 18))) return false;
  }
  return true;
}
function isRouteClear(route, startYaw = null, endYaw = null) {
  const steps = Math.max(6, Math.ceil(route.length / .1));
  const t0 = route.tangent(0), y0 = Math.atan2(t0.x, t0.z);
  const p0 = route.point(0);
  if (startYaw !== null && !canTurnInPlace(p0.x, p0.z, startYaw, y0)) return false;
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * route.length, p = route.point(s), t = route.tangent(s);
    if (checkVehiclePose(p.x, p.z, Math.atan2(t.x, t.z))) return false;
  }
  if (endYaw !== null) {
    const p1 = route.point(route.length), t1 = route.tangent(route.length), y1 = Math.atan2(t1.x, t1.z);
    if (!canTurnInPlace(p1.x, p1.z, y1, endYaw)) return false;
  }
  return true;
}
function directRoute(x0, z0, x1, z1, name = 'direct') {
  return new Route([[x0, z0], [(x0 + x1) * .5, (z0 + z1) * .5], [x1, z1]], false, name);
}
function sliceRoute(route, s0, s1, name = 'slice') {
  const n = Math.max(4, Math.ceil(Math.abs(s1 - s0) / .6));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = route.point(s0 + (s1 - s0) * (i / n));
    pts.push([p.x, p.z]);
  }
  return new Route(pts, false, name);
}

export class Spring {
  constructor(frequency = 4, damping = .85) { this.value=0; this.velocity=0; this.frequency=frequency; this.damping=damping; }
  step(target, dt) {
    // Analytically integrated damped spring: stable at 30/60/144 Hz and tab recovery.
    const w = this.frequency * Math.PI * 2;
    const z = this.damping, wd = w * Math.sqrt(Math.max(.0001,1-z*z));
    const d = this.value-target, c = (this.velocity+z*w*d)/wd;
    const e = Math.exp(-z*w*dt), sn=Math.sin(wd*dt), co=Math.cos(wd*dt);
    this.value = target+e*(d*co+c*sn);
    this.velocity = e*((-z*w*d+wd*c)*co+(-z*w*c-wd*d)*sn);
    return this.value;
  }
}

export class VehicleMotion {
  constructor({ slotId = 'P03' } = {}) {
    this.slotId = slotId;
    this.homeNode = slotId === 'P01' ? 'home_P01' : 'home';
    const isP01 = slotId === 'P01';
    this.homePos = isP01 ? P01_HOME : HOME;
    this.homeYaw = isP01 ? P01_YAW : HOME_YAW;
    this.x = this.homePos[0]; this.z = this.homePos[1]; this.y = groundHeight(this.x, this.z);
    this.yaw = this.homeYaw; this.blocked = null; this.speed = 0; this.acceleration = 0; this.omega = 0;
    this.route = null; this.routeId = null; this.destination = null; this.phase = 'parked'; this.s = 0;
    this.pending=null; this.paused=false; this.turning=false; this.patternDirection=1;
    this.travelEdges=[];this.edgeIndex=0;this.activeRoad=null;
    this.distance=0; this.laps=0; this.leftDistance=0; this.rightDistance=0;
    this.pitchSpring=new Spring(2.4,.84);this.rollSpring=new Spring(2.8,.82);this.heaveSpring=new Spring(4,.85);
    this.armSpring=new Spring(3.6,.72);this.trackWidth=2.065;this.time=0;
    this.leftTrackSpring=new Spring(5,.86);this.rightTrackSpring=new Spring(5,.86);
    this.pose={pitch:0,roll:0,heave:0,arm:0,leftHeight:0,rightHeight:0,leftPitch:0,rightPitch:0};
    this.events=[];
  }
  select(id) {
    if (!LOOPS[id]) return;
    this.paused=false;
    if(this.phase==='parked'||this.phase==='parking') return this.depart(id);
    if(this.routeId===id && (this.phase==='loop'||this.phase==='zigzag')) {this.pending=null;return;}
    this.navigateImmediate(id);
  }
  depart(id) {
    this.routeId=id;this.beginTravel(this.homeNode,id);
    this.events.push({type:'depart',route:id});
  }
  returnHome() {
    this.paused=false;
    if(this.phase==='parked'||this.phase==='parking')return;
    this.navigateImmediate(this.homeNode);
  }
  navigateImmediate(target) {
    if(target==='home')target=this.homeNode;
    if(this.phase==='loop'||this.phase==='zigzag') {
      const from=this.routeId, plan=planTravel(from,target,this.slotId), edges=[...plan.edges];
      const nextYaw=edges[0]?Math.atan2(edges[0].route.tangent(0).x,edges[0].route.tangent(0).z):null;
      const anchor=LOOPS[from].point(0), dist=Math.hypot(this.x-anchor.x,this.z-anchor.z);
      if(dist>.08) {
        let prefix=null;
        if(from==='F'){
          // The concrete lane wraps around a wall. Exit along that lane rather
          // than cutting across A or joining a road from the wrong endpoint.
          const base=LOOPS.F,at=this.patternDirection>0?this.s:base.length-this.s;
          const backToAnchor=sliceRoute(base,at,0,'F-exit-to-anchor');
          let exits;
          if(isRouteClear(backToAnchor,this.yaw,nextYaw))exits=[backToAnchor];
          else{
            exits=[sliceRoute(this.route,this.s,this.route.length,'F-exit-continue')];
            if(this.patternDirection>0)exits.push(base.reversed());
          }
          edges.unshift(...exits.map(route=>({from,to:from,route,speed:1.8,seconds:route.length/1.8})));
          prefix='merged';
        }
        if((from==='D'||from==='E')&&edges[0]&&(edges[0].to==='D'||edges[0].to==='E')) {
          const nextAnchor=LOOPS[edges[0].to].point(0);
          const afterYaw=edges[1]?Math.atan2(edges[1].route.tangent(0).x,edges[1].route.tangent(0).z):Math.atan2(LOOPS[edges[0].to].tangent(0).x,LOOPS[edges[0].to].tangent(0).z);
          const shortcut=directRoute(this.x,this.z,nextAnchor.x,nextAnchor.z,`${from}-${edges[0].to}-direct`);
          if(isRouteClear(shortcut,this.yaw,afterYaw)){edges[0]={...edges[0],route:shortcut,speed:1.75};prefix='merged';}
        }
        if(!prefix) {
          const direct=directRoute(this.x,this.z,anchor.x,anchor.z,`${from}-exit`);
          if(isRouteClear(direct,this.yaw,nextYaw)) prefix=direct;
          else if(this.route) {
            const fwd=sliceRoute(this.route,this.s,this.route.length,`${from}-exit-fwd`);
            const rev=sliceRoute(this.route,this.s,0,`${from}-exit-rev`);
            prefix=(rev.length<fwd.length&&isRouteClear(rev,this.yaw,nextYaw))?rev:fwd;
          }
          if(prefix) edges.unshift({from,to:from,route:prefix,speed:2.1,seconds:prefix.length/1.8});
        }
      }
      this.destination=target;this.pending=null;this.travelEdges=edges;this.edgeIndex=0;
      this.phase=target==='home'?'return':'transfer';
      this.events.push({type:'navigate',from,to:target,nodes:plan.nodes,estimatedSeconds:plan.seconds});
      if(!edges.length){this.arrive(target);return;}
      this.activeRoad=edges[0];this.setRoute(this.activeRoad.route);
      return;
    }
    if(this.activeRoad) {
      if(this.destination===target){this.pending=null;return;}
      const u=this.activeRoad.from, v=this.activeRoad.to, r=this.activeRoad.route;
      const planV=planTravel(v,target);
      const remFwd=this.s<r.length-.08?sliceRoute(r,this.s,r.length,`${u}-${v}-rem`):null;
      const remainingExits=[];
      if(u==='F'&&v==='F')for(const road of this.travelEdges.slice(this.edgeIndex+1)){
        if(road.from!=='F'||road.to!=='F')break;
        remainingExits.push(road);
      }
      const edges=[...(remFwd?[{from:u,to:v,route:remFwd,speed:this.activeRoad.speed,seconds:remFwd.length/this.activeRoad.speed}]:[]),...remainingExits,...planV.edges];
      this.destination=target;this.pending=null;this.travelEdges=edges;this.edgeIndex=0;
      this.phase=target==='home'?'return':'transfer';
      this.events.push({type:'navigate',from:v,to:target,nodes:planV.nodes,estimatedSeconds:planV.seconds});
      if(!edges.length){this.arrive(target);return;}
      this.activeRoad=edges[0];this.setRoute(this.activeRoad.route);
    }
  }
  setRoute(route) {
    this.route=route;this.s=0;this.omega=0;
    const t=route.tangent(0),heading=Math.atan2(t.x,t.z);
    this.turning=Math.abs(angleDelta(this.yaw,heading))>.08;
    if(this.turning){this.speed=0;this.acceleration=0;}
  }
  beginTravel(from,to) {
    const plan=planTravel(from,to,this.slotId);
    this.destination=to;this.pending=null;this.travelEdges=plan.edges;this.edgeIndex=0;
    const isHome=n=>n==='home'||n==='home_P01'||n===this.homeNode;
    this.phase=isHome(to)?'return':isHome(from)?'entry':'transfer';
    this.events.push({type:'navigate',from,to,nodes:plan.nodes,estimatedSeconds:plan.seconds});
    if(!plan.edges.length){this.arrive(to);return;}
    this.activeRoad=plan.edges[0];this.setRoute(this.activeRoad.route);
  }
  arrive(node) {
    this.activeRoad=null;this.travelEdges=[];this.edgeIndex=0;this.destination=null;
    if(node==='home'||node===this.homeNode||node==='home_P01') {
      this.phase='parking';this.route=null;this.routeId=null;this.s=0;this.turning=true;
      this.x=this.homePos[0];this.z=this.homePos[1];this.speed=0;this.acceleration=0;this.omega=0;
      return;
    }
    this.routeId=node;this.phase=LOOPS[node].closed?'loop':'zigzag';this.patternDirection=1;
    this.setRoute(LOOPS[node]);this.events.push({type:'mission-start',route:node});
  }
  advanceRoad() {
    const node=this.activeRoad.to;
    if(this.pending){const target=this.pending;this.beginTravel(node,target);return;}
    this.edgeIndex++;
    if(this.edgeIndex<this.travelEdges.length){this.activeRoad=this.travelEdges[this.edgeIndex];this.setRoute(this.activeRoad.route);}
    else this.arrive(this.destination);
  }
  finishPatternLeg() {
    if(this.patternDirection===1){
      this.patternDirection=-1;this.setRoute(LOOPS[this.routeId].reversed());
    }else{
      this.laps++;this.events.push({type:'lap',route:this.routeId,laps:this.laps});
      if(this.pending){const target=this.pending;this.beginTravel(this.routeId,target);}
      else{this.patternDirection=1;this.setRoute(LOOPS[this.routeId]);}
    }
  }
  update(dt) {
    dt=clamp(dt,0,.04);this.time+=dt;
    const before={x:this.x,z:this.z,yaw:this.yaw,s:this.s,phase:this.phase,route:this.route,laps:this.laps,routeId:this.routeId,pending:this.pending,destination:this.destination,travelEdges:this.travelEdges,edgeIndex:this.edgeIndex,activeRoad:this.activeRoad,turning:this.turning,patternDirection:this.patternDirection,events:this.events.length};
    let desired=0, turnTarget=this.yaw;
    if(this.phase==='parking'){turnTarget=this.homeYaw;this.turning=true;}
    if(this.route) {
      // Smooth lookahead steering for fluid, natural turns without jerky stopping
      const lookahead=Math.max(0.4, Math.min(1.2, this.speed * 0.55));
      const lookS=this.phase==='loop'?this.s+lookahead:Math.min(this.s+lookahead, this.route.length);
      const t=this.route.tangent(lookS);
      turnTarget=Math.atan2(t.x,t.z);
      const headingError=Math.abs(angleDelta(this.yaw,turnTarget));

      // Only enter in-place pivot turn for extreme hairpin turns (>110 deg) when almost stopped
      if(headingError>1.92 && this.speed<0.15) this.turning=true;

      const kind=surfaceAt(this.x,this.z), surface=SURFACES[kind];
      const cruise=this.phase==='loop'||this.phase==='zigzag'?SURFACES[this.routeId].speed:this.activeRoad?.speed||(surface?.speed||1.85);
      const curvature=Math.abs(this.route.curvature(this.s+Math.max(.5,this.speed)));
      desired=Math.min(cruise, Math.sqrt(.7/Math.max(.03,curvature)));
      if(this.phase!=='loop') desired=Math.min(desired,Math.sqrt(Math.max(0,2*.58*(this.route.length-this.s))));

      // Smooth deceleration during turns while maintaining continuous forward motion
      if(headingError>.18) desired*=Math.max(0.38, 1-(headingError-.18)*0.45);
      if(this.paused||this.turning)desired=0;
    }
    const oldSpeed=this.speed;
    const targetA=clamp((desired-this.speed)*2.4,-1.25,.85);
    this.acceleration += (targetA-this.acceleration)*(1-Math.exp(-dt*6));
    this.speed=Math.max(0,this.speed+this.acceleration*dt);
    if(this.turning){this.speed=0;this.acceleration=0;}
    if(desired===0 && this.speed<.008)this.speed=0;

    const delta=angleDelta(this.yaw,turnTarget);
    const maxTurn=this.turning?1.4:1.75;
    const steerResponsiveness=this.turning?5.0:7.5;
    this.omega += (clamp(delta*steerResponsiveness,-maxTurn,maxTurn)-this.omega)*(1-Math.exp(-dt*8));
    if((!this.route&&this.phase!=='parking') || this.paused)this.omega*=Math.exp(-dt*6);
    this.yaw+=this.omega*dt;
    if(this.turning&&Math.abs(angleDelta(this.yaw,turnTarget))<.045){this.turning=false;this.omega=0;}
    if(this.phase==='parking'&&!this.turning){this.phase='parked';this.yaw=this.homeYaw;this.events.push({type:'parked'});}
    let travel=(oldSpeed+this.speed)*.5*dt;
    if(this.route) {
      this.s+=travel;
      if(this.phase!=='loop')this.s=Math.min(this.s,this.route.length);
      if(this.phase==='loop' && this.s>=this.route.length) {
        this.s-=this.route.length;this.laps++;
        this.events.push({type:'lap',route:this.routeId,laps:this.laps});
        if(this.pending) {
          const target=this.pending;this.beginTravel(this.routeId,target);
        }
      } else if(this.phase!=='loop' && this.s>=this.route.length-.025 && this.speed<.2) {
        this.s=this.route.length;
        if(this.phase==='zigzag')this.finishPatternLeg();else this.advanceRoad();
      }
      if(this.route) {const p=this.route.point(this.s);this.x=p.x;this.z=p.z;}
    }
    // Guard the actual oriented body and bucket, not just the path centre.
    // Fine substeps prevent tunnelling even at 2× playback. A blocked step is
    // rolled back before track phases, contact response or rendering advance.
    this.blocked=checkVehiclePose(this.x,this.z,this.yaw);
    if(this.blocked){
      this.x=before.x;this.z=before.z;this.yaw=before.yaw;this.s=before.s;
      this.phase=before.phase;this.route=before.route;this.laps=before.laps;this.routeId=before.routeId;
      this.pending=before.pending;this.destination=before.destination;this.travelEdges=before.travelEdges;
      this.edgeIndex=before.edgeIndex;this.activeRoad=before.activeRoad;this.turning=before.turning;
      this.patternDirection=before.patternDirection;this.events.length=before.events;
      this.speed=0;this.acceleration=0;this.omega=0;travel=0;
    }
    this.distance+=travel;
    const angularTravel=angleDelta(before.yaw,this.yaw);
    this.leftDistance+=travel+angularTravel*this.trackWidth*.5;
    this.rightDistance+=travel-angularTravel*this.trackWidth*.5;
    this.updateContact(dt);
    return this;
  }
  updateContact(dt) {
    const rough=['D','E'].includes(surfaceAt(this.x,this.z));
    this.pitchSpring.frequency=rough?3.2:2.4;this.pitchSpring.damping=rough?.62:.84;
    this.rollSpring.frequency=rough?3.5:2.8;this.rollSpring.damping=rough?.65:.82;
    this.heaveSpring.frequency=rough?4.6:4;this.heaveSpring.damping=rough?.61:.85;
    const sy=Math.sin(this.yaw), cy=Math.cos(this.yaw),half=this.trackWidth*.5;
    const contact=(side,fore)=>groundHeight(this.x+cy*side+sy*fore,this.z-sy*side+cy*fore);
    const lf=contact(-half,1.05),lr=contact(-half,-1.05),rf=contact(half,1.05),rr=contact(half,-1.05);
    const left=(lf+lr)*.5,right=(rf+rr)*.5,front=(lf+rf)*.5,rear=(lr+rr)*.5;
    this.y=(left+right)*.5;
    // Terrain tilt + modest inertial response. No random or time-driven body bobbing.
    const pitch=-Math.atan2(front-rear,2.1)-this.acceleration*.024;
    const roll=Math.atan2(right-left,this.trackWidth)-this.speed*this.omega*.017;
    this.pose.pitch=this.pitchSpring.step(pitch,dt);
    this.pose.roll=this.rollSpring.step(roll,dt);
    this.pose.heave=this.heaveSpring.step(this.y,dt)-this.y;
    this.pose.arm=this.armSpring.step(-this.pitchSpring.velocity*.012-this.acceleration*.005,dt);
    this.pose.leftHeight=left-this.y;this.pose.rightHeight=right-this.y;
    this.pose.leftPitch=this.leftTrackSpring.step(-Math.atan2(lf-lr,2.1),dt);
    this.pose.rightPitch=this.rightTrackSpring.step(-Math.atan2(rf-rr,2.1),dt);
    this.surface=surfaceAt(this.x,this.z);
  }
}
