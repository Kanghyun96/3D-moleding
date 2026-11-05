import { checkVehiclePose } from './photo-map.js';
import { HOME, SURFACES, LOOPS, INGRESS, groundHeight, surfaceAt } from './routes.js';

const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const angleDelta = (a,b) => Math.atan2(Math.sin(b-a), Math.cos(b-a));

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
  constructor() {
    this.x=HOME[0]; this.z=HOME[1]; this.y=groundHeight(this.x,this.z);
    this.yaw=2.14;this.blocked=null; this.speed=0; this.acceleration=0; this.omega=0;
    this.route=null; this.routeId=null; this.phase='parked'; this.s=0;
    this.pending=null; this.departAfterReturn=false; this.paused=false;
    this.distance=0; this.laps=0; this.leftDistance=0; this.rightDistance=0;
    this.pitchSpring=new Spring(2.4,.84);this.rollSpring=new Spring(2.8,.82);this.heaveSpring=new Spring(4,.85);
    this.armSpring=new Spring(3.6,.72);this.trackWidth=2.065;this.time=0;
    this.pose={pitch:0,roll:0,heave:0,arm:0,leftHeight:0,rightHeight:0};
    this.events=[];
  }
  select(id) {
    if (!LOOPS[id]) return;
    this.paused=false;
    if(this.phase==='parked') return this.depart(id);
    if(this.routeId===id && this.phase!=='return') {this.pending=null;return;}
    this.pending=id;
    this.departAfterReturn=true;
  }
  depart(id) {
    this.routeId=id;this.route=INGRESS[id];this.phase='entry';this.s=0;this.pending=null;
    this.events.push({type:'depart',route:id});
  }
  returnHome() {
    this.pending=null;this.departAfterReturn=false;this.paused=false;
    if(this.phase==='entry') {
      const oldS=this.s;
      this.route=this.route.reversed();this.s=this.route.length-oldS;this.phase='return';
      this.speed=0; // The vehicle turns in place before returning along the access road.
    } else if(this.phase==='loop') this.pending='home';
  }
  update(dt) {
    dt=clamp(dt,0,.04);this.time+=dt;
    const before={x:this.x,z:this.z,yaw:this.yaw,s:this.s,phase:this.phase,route:this.route,laps:this.laps};
    const direction=this.phase==='return'?-1:1;
    let desired=0, turnTarget=this.yaw;
    if(this.route) {
      const t=this.route.tangent(this.s);
      turnTarget=Math.atan2(t.x,t.z)+(direction<0?Math.PI:0);
      const headingError=Math.abs(angleDelta(this.yaw,turnTarget));
      const kind=surfaceAt(this.x,this.z), surface=SURFACES[kind];
      const cruise=this.phase==='loop'?SURFACES[this.routeId].speed:(surface?.speed||1.85);
      const curvature=Math.abs(this.route.curvature(this.s+Math.max(.5,this.speed)));
      desired=Math.min(cruise, Math.sqrt(.7/Math.max(.03,curvature)));
      if(this.phase!=='loop') desired=Math.min(desired,Math.sqrt(Math.max(0,2*.58*(this.route.length-this.s))));
      if(headingError>.28) desired*=Math.max(0,1-(headingError-.28)/.65);
      if(this.paused)desired=0;
    }
    const oldSpeed=this.speed;
    const targetA=clamp((desired-this.speed)*2,-.85,.48);
    this.acceleration += (targetA-this.acceleration)*(1-Math.exp(-dt*5));
    this.speed=Math.max(0,this.speed+this.acceleration*dt);
    if(desired===0 && this.speed<.008)this.speed=0;
    const delta=angleDelta(this.yaw,turnTarget);
    const maxTurn=.58;
    this.omega += (clamp(delta*5,-maxTurn,maxTurn)-this.omega)*(1-Math.exp(-dt*7));
    if(!this.route || this.paused)this.omega*=Math.exp(-dt*7);
    this.yaw+=this.omega*dt;
    let travel=(oldSpeed+this.speed)*.5*dt;
    if(this.route) {
      this.s+=travel;
      if(this.phase==='loop' && this.s>=this.route.length) {
        this.s-=this.route.length;this.laps++;
        this.events.push({type:'lap',route:this.routeId,laps:this.laps});
        if(this.pending) {
          this.route=INGRESS[this.routeId].reversed();this.s=0;this.phase='return';
          this.speed=0;
        }
      } else if(this.phase!=='loop' && this.s>=this.route.length-.025 && this.speed<.2) {
        if(this.phase==='entry') {
          this.route=LOOPS[this.routeId];this.s=0;this.phase='loop';
          // Entry endpoints and loop tangents are continuous; speed is ramped smoothly.
        } else {
          const next=this.pending && this.pending!=='home'?this.pending:null;
          this.phase='parked';this.route=null;this.s=0;this.speed=0;this.acceleration=0;this.omega=0;
          this.x=HOME[0];this.z=HOME[1];
          this.events.push({type:'parked'});
          if(next)this.depart(next);else{this.routeId=null;this.pending=null;}
        }
      }
      if(this.route) {const p=this.route.point(this.s);this.x=p.x;this.z=p.z;}
    }
    // Guard the actual oriented body and bucket, not just the path centre.
    // Fine substeps prevent tunnelling even at 2× playback. A blocked step is
    // rolled back before track phases, contact response or rendering advance.
    this.blocked=checkVehiclePose(this.x,this.z,this.yaw);
    if(this.blocked){
      this.x=before.x;this.z=before.z;this.yaw=before.yaw;this.s=before.s;
      this.phase=before.phase;this.route=before.route;this.laps=before.laps;
      this.speed=0;this.acceleration=0;this.omega=0;travel=0;
    }
    this.distance+=travel;
    const angularTravel=angleDelta(before.yaw,this.yaw);
    this.leftDistance+=direction*travel+angularTravel*this.trackWidth*.5;
    this.rightDistance+=direction*travel-angularTravel*this.trackWidth*.5;
    this.updateContact(dt);
    return this;
  }
  updateContact(dt) {
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
    this.surface=surfaceAt(this.x,this.z);
  }
}
