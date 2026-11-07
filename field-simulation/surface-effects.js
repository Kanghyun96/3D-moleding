import { terrainAt, terrainHeight } from './terrain.js';

export const PARTICLE_LIMIT=320;
export const RIPPLE_LIMIT=48;
export const DUST_TRAIL_LIMIT=2.4;
const palette={dust:[.52,.34,.13],gravel:[.18,.17,.13],water:[.26,.29,.24],mud:[.14,.105,.065]};
const kindIndex={dust:0,gravel:1,water:2,mud:3};
export class SurfaceEffects {
  constructor(random=Math.random){
    this.random=random;this.cursor=0;this.budget=[0,0];this.previous=[0,0];this.spawned=0;
    this.positions=new Float32Array(PARTICLE_LIMIT*3);this.sizes=new Float32Array(PARTICLE_LIMIT);
    this.alphas=new Float32Array(PARTICLE_LIMIT);this.colors=new Float32Array(PARTICLE_LIMIT*3);
    this.kinds=new Float32Array(PARTICLE_LIMIT);this.angles=new Float32Array(PARTICLE_LIMIT);
    this.particles=Array.from({length:PARTICLE_LIMIT},()=>({life:0,max:1}));
    this.ripples=Array.from({length:RIPPLE_LIMIT},()=>({life:0,max:1,x:0,z:0,y:0,radius:0,alpha:0}));
    this.rippleCursor=0;this.rippleBudget=[0,0];
    this.dustTravel=0;
    this.contactMaterials=[null,null];
  }
  emit(kind,x,z,yaw,side,speed,impact=0){
    const i=this.cursor++%PARTICLE_LIMIT,p=this.particles[i],r=this.random;
    const wet=kind==='water'||kind==='mud',solid=kind==='gravel'||wet;
    p.kind=kind;p.life=p.max=wet?.4+r()*.3:solid?.65+r()*.45:.95+r()*.25;
    const outward=wet?.16+Math.min(speed,2)*.12+r()*.22:solid?.7+r()*.8:.08+r()*.1;
    const backward=wet?.08+speed*.13:solid?.25+speed*.24:.025+Math.min(speed,3)*.025;
    p.vx=Math.cos(yaw)*side*outward-Math.sin(yaw)*backward;
    p.vz=-Math.sin(yaw)*side*outward-Math.cos(yaw)*backward;
    p.vy=wet?.36+Math.min(speed,2)*.14+r()*.26+impact*.14:kind==='gravel'?.85+r()*.7:1.25+r()*.4;p.gravity=solid?4.2:0;
    p.floor=terrainHeight(x,z);this.positions.set([x,p.floor+(wet?.035:.1),z],i*3);
    this.sizes[i]=kind==='dust'?.3+r()*.18:kind==='gravel'?.09+r()*.065:kind==='water'?.07+r()*.065:.055+r()*.05;
    if(kind==='dust'){
      p.initialSize=this.sizes[i];p.puffSize=.9+r()*.35;p.birthTravel=this.dustTravel;
    }
    this.kinds[i]=kindIndex[kind];this.angles[i]=(r()-.5)*Math.PI;
    p.opacity=wet?(kind==='water'?.5:.58):solid?.9:.34;
    this.alphas[i]=wet?p.opacity:solid?.85:0;
    this.colors.set(palette[kind],i*3);this.spawned++;
  }
  emitDustPuff(x,z,yaw,side,speed){
    const sy=Math.sin(yaw),cy=Math.cos(yaw);
    // Three overlapping lobes born together form one compact billow rather
    // than evenly spaced dots. Small local offsets keep it close to the belt.
    for(let lobe=0;lobe<3;lobe++){
      const across=(this.random()-.5)*.3,along=(this.random()-.5)*.28;
      this.emit('dust',x+cy*across+sy*along,z-sy*across+cy*along,yaw,side,speed);
    }
  }
  update(dt,motion){
    if(!(dt>0))return;
    const distances=[motion.leftDistance,motion.rightDistance];
    const deltas=distances.map((distance,i)=>distance-this.previous[i]);
    this.dustTravel+=(Math.abs(deltas[0])+Math.abs(deltas[1]))*.5;
    for(const ripple of this.ripples){
      if(ripple.life<=0){ripple.alpha=0;continue;}
      ripple.life=Math.max(0,ripple.life-dt);const age=1-ripple.life/ripple.max;
      ripple.radius=.2+age*.95;
      ripple.alpha=.38*(ripple.strength||1)*Math.sin(Math.PI*age)*(1-age);
    }
    for(let i=0;i<PARTICLE_LIMIT;i++){
      const p=this.particles[i];if(p.life<=0){this.alphas[i]=0;continue;}
      p.life=Math.max(0,p.life-dt);const offset=i*3;
      this.positions[offset]+=p.vx*dt;this.positions[offset+1]+=p.vy*dt;this.positions[offset+2]+=p.vz*dt;
      p.vy-=p.gravity*dt;
      const age=p.max-p.life;
      if(p.kind==='dust'){
        // Billow quickly and lose horizontal momentum, then dissolve. Bound
        // the trail by belt travel as well as real time, including 10x playback.
        p.vx*=Math.exp(-dt*4.4);p.vz*=Math.exp(-dt*4.4);p.vy*=Math.exp(-dt*.65);
        this.sizes[i]=p.initialSize+(p.puffSize-p.initialSize)*(1-Math.exp(-age*6));
        const travel=this.dustTravel-p.birthTravel;
        if(travel>=DUST_TRAIL_LIMIT)p.life=0;
        const near=Math.max(0,Math.min(1,(DUST_TRAIL_LIMIT-travel)/.9));
        this.alphas[i]=p.life>0?p.opacity*(1-Math.exp(-age*18))*Math.pow(p.life/p.max,.7)*near:0;
        continue;
      }
      if(p.gravity&&this.positions[offset+1]<p.floor)p.life=0;
      const fade=Math.min(1,p.life/.22);
      this.alphas[i]=p.life>0?fade*p.opacity:0;
    }
    const sy=Math.sin(motion.yaw),cy=Math.cos(motion.yaw);
    distances.forEach((distance,index)=>{
      const delta=deltas[index];this.previous[index]=distance;
      // Use actual belt displacement, including in-place steering. A stationary
      // or collision-blocked vehicle cannot accumulate a new emission budget.
      const speed=Math.min(4,Math.abs(delta)/dt),side=index===0?-1:1;
      if(speed<.04){this.budget[index]=0;this.rippleBudget[index]=0;return;}
      // Rear outer edge of the belt contact footprint. The previous rear=.95
      // point was under the tread and most short-lived droplets stayed hidden.
      const x=motion.x+cy*side*1.2-sy*1.4,z=motion.z-sy*side*1.2-cy*1.4;
      const material=terrainAt(x,z),density=material.dust+material.gravel+material.water;
      if(this.contactMaterials[index]!==material.kind){
        this.contactMaterials[index]=material.kind;this.budget[index]=0;this.rippleBudget[index]=0;
      }
      if(!density){this.budget[index]=0;return;}
      const impact=material.water?Math.min(1,Math.abs(terrainHeight(x+sy*.6,z+cy*.6)-terrainHeight(x,z))*9):0;
      if(material.water){
        this.rippleBudget[index]+=Math.abs(delta);
        if(this.rippleBudget[index]>=.26){
          this.rippleBudget[index]%=.26;
          const ripple=this.ripples[this.rippleCursor++%RIPPLE_LIMIT];
          Object.assign(ripple,{x,z,y:terrainHeight(x,z)+.026,life:1.25,max:1.25,radius:.2,alpha:0,yaw:motion.yaw,strength:1+impact*.45});
        }
      }else this.rippleBudget[index]=0;
      if(material.dust&&!material.water&&!material.gravel){
        this.budget[index]=Math.min(7.2,this.budget[index]+Math.abs(delta)*density*.5);
        while(this.budget[index]>=3.6){
          const physicalSpeed=Number.isFinite(motion.speed)?Math.abs(motion.speed):speed;
          this.emitDustPuff(x,z,motion.yaw,side,physicalSpeed);this.budget[index]-=3.6;
        }
        return;
      }
      this.budget[index]=Math.min(10,this.budget[index]+Math.abs(delta)*density*.5);
      while(this.budget[index]>=1){
        let kind=material.water?(this.random()<.82?'water':'mud'):material.gravel?(this.random()<.85?'gravel':'dust'):'dust';
        const physicalSpeed=material.water&&Number.isFinite(motion.speed)?Math.min(2,Math.abs(motion.speed)+Math.abs(motion.omega||0)):speed;
        this.emit(kind,x,z,motion.yaw,side,physicalSpeed,impact);this.budget[index]--;
      }
    });
  }
  get active(){return this.particles.reduce((n,p)=>n+(p.life>0?1:0),0);}
}
