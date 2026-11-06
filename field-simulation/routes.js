import { CatmullRomCurve3, Vector3 } from './vendor/three.core.js';
import { photoToWorld, worldToPhoto, HOME_PHOTO, surfaceAtPhoto, SURFACE_POLYGONS } from './photo-map.js';

export const HOME=photoToWorld(HOME_PHOTO);
export const SURFACES={
  A:{name:'순환 주행로',material:'다짐흙',speed:2.15},
  B:{name:'대형 선회로',material:'건조토',speed:1.8},
  C:{name:'소형 선회로',material:'흙 노면',speed:1.25},
  D:{name:'습지 · 자갈',material:'습지 / 자갈',speed:.68},
  E:{name:'요철 시험로',material:'블록 노면',speed:.88},
};
export class Route {
  constructor(points,closed=false,name='') {
    this.name=name;this.closed=closed;
    this.curve=new CatmullRomCurve3(points.map(p=>new Vector3(p[0],0,p[1])),closed,'centripetal');
    this.curve.arcLengthDivisions=2400;this.curve.updateArcLengths();this.length=this.curve.getLength();
  }
  point(s){const u=this.closed?((s%this.length)+this.length)%this.length/this.length:Math.max(0,Math.min(1,s/this.length));return this.curve.getPointAt(u);}
  tangent(s){return this.point(s+.07).sub(this.point(s-.07)).normalize();}
  curvature(s){const a=this.tangent(s-.45),b=this.tangent(s+.45);return(a.z*b.x-a.x*b.z)/.9;}
  reversed(){return new Route([...this.curve.points].reverse().map(p=>[p.x,p.z]),false,this.name+'-return');}
}
const fromPhoto=(points,closed,name)=>new Route(points.map(photoToWorld),closed,name);
export const LOOPS={
  A:fromPhoto([[274,299],[228,331],[188,360],[174,385],[180,406],[210,430],[254,457],[299,479],[342,487],[382,476],[426,447],[480,413],[540,374],[600,334],[651,298],[671,277],[656,252],[610,224],[554,196],[502,182],[456,189],[398,222],[336,260]],true,'A'),
  B:fromPhoto([[784,610],[823,635],[872,645],[923,639],[966,618],[992,586],[1002,552],[983,518],[950,497],[913,489],[872,480],[829,486],[792,507],[769,542],[764,576]],true,'B'),
  C:fromPhoto([[510,575],[544,583],[578,580],[605,563],[619,537],[606,510],[575,492],[543,487],[514,499],[492,528],[491,555]],true,'C'),
  D:fromPhoto([[402,300],[452,262],[486,286],[524,258],[556,282]],false,'D-zigzag'),
  E:fromPhoto([[312,352],[275,372],[343,382],[284,399],[365,413],[326,430]],false,'E-zigzag'),
};
const gatePhoto=[242,272];
const homeToGatePts=[HOME_PHOTO,[619,192],[548,155],[472,138],[405,168],[332,214],[275,250],gatePhoto];
const gateToAPts=[gatePhoto,[258,286],[274,299]];
const aToDPts=[[274,299],[298,308],[332,312],[368,308],[402,300]];
const aToEPts=[[274,299],[292,320],[312,352]];
const gateToDPts=[gatePhoto,[258,286],[274,299],[298,308],[332,312],[368,308],[402,300]];
const gateToEPts=[gatePhoto,[258,286],[274,299],[292,320],[312,352]];
const eToDPts=[[312,352],[342,334],[372,316],[402,300]];
const gateToCPts=[gatePhoto,[178,315],[122,354],[102,388],[126,422],[186,464],[266,518],[354,578],[425,612],[472,598],[510,575]];
const gateToBPts=[gatePhoto,[178,315],[122,354],[102,388],[126,422],[186,464],[266,518],[354,578],[435,626],[512,660],[572,674],[638,670],[704,648],[748,625],[784,610]];
const cToBPts=[[510,575],[498,616],[518,658],[572,674],[638,670],[704,648],[748,625],[784,610]];
const homeToBPts=[HOME_PHOTO,[710,241],[760,272],[814,309],[874,357],[940,402],[978,452],[996,515],[995,575],[966,618],[918,640],[850,640],[784,610]];

export const INGRESS={
  A:fromPhoto([...homeToGatePts.slice(0,-1),...gateToAPts],false,'A-entry'),
  B:fromPhoto(homeToBPts,false,'B-entry'),
  C:fromPhoto([...homeToGatePts.slice(0,-1),...gateToCPts],false,'C-entry'),
  D:fromPhoto([...homeToGatePts.slice(0,-1),...gateToDPts],false,'D-entry'),
  E:fromPhoto([...homeToGatePts.slice(0,-1),...gateToEPts],false,'E-entry'),
};

const homeToGate=fromPhoto(homeToGatePts,false,'home-gate');
const gateToA=fromPhoto(gateToAPts,false,'gate-A');
const aToD=fromPhoto(aToDPts,false,'A-D');
const aToE=fromPhoto(aToEPts,false,'A-E');
const gateToD=fromPhoto(gateToDPts,false,'gate-D');
const gateToE=fromPhoto(gateToEPts,false,'gate-E');
const eToD=fromPhoto(eToDPts,false,'E-D');
const gateToC=fromPhoto(gateToCPts,false,'gate-C-lower');
const gateToB=fromPhoto(gateToBPts,false,'gate-B-lower');
const cToB=fromPhoto(cToBPts,false,'C-B-lower');
const homeToB=fromPhoto(homeToBPts,false,'home-B');

function expectedSeconds(route,speed){
  let seconds=1.2;
  const samples=Math.max(1,Math.ceil(route.length/.5)),ds=route.length/samples;
  for(let i=0;i<samples;i++){
    const s=(i+.5)*ds,curve=Math.abs(route.curvature(s));
    const allowed=Math.min(speed,Math.sqrt(.7/Math.max(.03,curve)));
    seconds+=ds/Math.max(.35,allowed);
  }
  return seconds;
}
const edge=(from,to,route,speed)=>Object.freeze({from,to,route,speed,seconds:expectedSeconds(route,speed)});
export const ROADS=Object.freeze([
  edge('home','gate',homeToGate,1.9),edge('gate','home',homeToGate.reversed(),1.9),
  edge('gate','A',gateToA,1.5),edge('A','gate',gateToA.reversed(),1.5),
  edge('A','D',aToD,1.5),edge('D','A',aToD.reversed(),1.5),
  edge('A','E',aToE,1.5),edge('E','A',aToE.reversed(),1.5),
  edge('gate','D',gateToD,1.55),edge('D','gate',gateToD.reversed(),1.55),
  edge('gate','E',gateToE,1.55),edge('E','gate',gateToE.reversed(),1.55),
  edge('E','D',eToD,1.55),edge('D','E',eToD.reversed(),1.55),
  edge('gate','C',gateToC,1.95),edge('C','gate',gateToC.reversed(),1.95),
  edge('gate','B',gateToB,1.95),edge('B','gate',gateToB.reversed(),1.95),
  edge('C','B',cToB,1.95),edge('B','C',cToB.reversed(),1.95),
  edge('home','B',homeToB,1.9),edge('B','home',homeToB.reversed(),1.9),
]);

// Dijkstra on expected travel time. Transfers between test surfaces never
// route through the garage ('home'); they use internal connectors or the
// lower perimeter / divider passage.
export function planTravel(from,to){
  if(from===to)return {edges:[],seconds:0,nodes:[from]};
  const costs=new Map([[from,0]]),previous=new Map(),unvisited=new Set([from]);
  while(unvisited.size){
    let at=null,best=Infinity;for(const node of unvisited){const n=costs.get(node);if(n<best){at=node;best=n;}}
    unvisited.delete(at);if(at===to)break;
    for(const road of ROADS)if(road.from===at){
      if(road.to==='home'&&to!=='home')continue;
      const next=best+road.seconds;
      if(next<(costs.get(road.to)??Infinity)){costs.set(road.to,next);previous.set(road.to,road);unvisited.add(road.to);}
    }
  }
  if(!costs.has(to))throw new Error(`No safe road from ${from} to ${to}`);
  const edges=[];for(let node=to;node!==from;){const road=previous.get(node);edges.unshift(road);node=road.from;}
  return {edges,seconds:costs.get(to),nodes:[from,...edges.map(road=>road.to)]};
}
export const surfaceAt=(x,z)=>surfaceAtPhoto(...worldToPhoto(x,z));
export function groundHeight(x,z){
  const kind=surfaceAt(x,z);
  if(kind==='road')return .025;
  const base=.035+.012*Math.sin(x*.73+z*.4)*Math.sin(z*.86);
  if(kind!=='D'&&kind!=='E')return base;
  const p=worldToPhoto(x,z),poly=SURFACE_POLYGONS[kind];let edge=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    edge=Math.min(edge,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
  }
  const fade=Math.min(1,edge/14);
  return base+fade*(kind==='D'?.09+.08*Math.sin(x*1.63+z*.7)+.05*Math.sin(z*2.03-x*.51):.055+.045*Math.cos(x*4.7)*Math.cos(z*4.7));
}
