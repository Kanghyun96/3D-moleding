import { CatmullRomCurve3, Vector3 } from './vendor/three.core.js';
import { photoToWorld, worldToPhoto, HOME_PHOTO, surfaceAtPhoto, SURFACE_POLYGONS } from './photo-map.js';
import { terrainHeight } from './terrain.js';
import { SURFACE_NAMES } from './equipment-schema.js';
import { PARKING_DIRECTION } from './parking-config.js';

export const HOME=photoToWorld(HOME_PHOTO);
const parkingFront=photoToWorld([HOME_PHOTO[0]+PARKING_DIRECTION[0],HOME_PHOTO[1]+PARKING_DIRECTION[1]]);
export const HOME_YAW=Math.atan2(parkingFront[0]-HOME[0],parkingFront[1]-HOME[1]);
export const SURFACES={
  A:{name:'순환 주행로',material:'다짐흙',speed:2.15},
  B:{name:'대형 선회로',material:'건조토',speed:1.8},
  C:{name:'소형 선회로',material:'흙 노면',speed:1.25},
  D:{name:'습지 · 자갈',material:'습지 / 자갈',speed:.68},
  E:{name:'요철 시험로',material:'블록 노면',speed:.88},
  F:{name:'콘크리트 왕복로',material:'콘크리트',speed:1.8},
};
for(const[id,name]of Object.entries(SURFACE_NAMES))SURFACES[id].name=name;
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
  // Sweep both the near/far halves of the pond while preserving the entrance
  // anchor shared with A/E. Turning points stay inside the stony bank.
  D:fromPhoto([[402,300],[443,248],[473,260],[470,318],[510,311],[534,260],[582,282],[552,315]],false,'D-zigzag'),
  E:fromPhoto([[312,352],[275,372],[343,382],[284,399],[365,413],[326,430]],false,'E-zigzag'),
  F:fromPhoto([[348,195],[300,224],[254,260],[208,294],[162,329],[124,360],[108,389],[120,418],[159,451],[211,489],[268,529],[326,569],[370,592],[394,606]],false,'F-concrete-shuttle'),
};
const gatePhoto=[242,272];
const parkingExit=[HOME_PHOTO,[642,93],[625,130],[575,150],[548,152],[520,145],[472,138],[405,168]];
const homeToGatePts=[...parkingExit,[332,214],[275,250],gatePhoto];
const gateToAPts=[gatePhoto,[258,286],[274,299]];
const aToDPts=[[274,299],[298,308],[332,312],[368,308],[402,300]];
const aToEPts=[[274,299],[292,320],[312,352]];
const gateToDPts=[gatePhoto,[258,286],[274,299],[298,308],[332,312],[368,308],[402,300]];
const gateToEPts=[gatePhoto,[258,286],[274,299],[292,320],[312,352]];
const eToDPts=[[312,352],[342,334],[372,316],[402,300]];
const gateToCPts=[gatePhoto,[178,315],[122,354],[102,388],[126,422],[186,464],[266,518],[354,578],[425,612],[472,598],[510,575]];
const gateToBPts=[gatePhoto,[178,315],[122,354],[102,388],[126,422],[186,464],[266,518],[354,578],[435,626],[512,660],[572,674],[638,670],[704,648],[748,625],[784,610]];
const cToBPts=[[510,575],[498,616],[518,658],[572,674],[638,670],[704,648],[748,625],[784,610]];
const homeToBPts=[HOME_PHOTO,[642,93],[640,125],[690,215],[710,241],[760,272],[814,309],[874,357],[940,402],[978,452],[996,515],[995,575],[966,618],[918,640],[850,640],[784,610]];
const homeToFPts=[...parkingExit,[348,195]];
const fToGatePts=[[348,195],[300,224],[254,260],gatePhoto];

export const INGRESS={
  A:fromPhoto([...homeToGatePts.slice(0,-1),...gateToAPts],false,'A-entry'),
  B:fromPhoto(homeToBPts,false,'B-entry'),
  C:fromPhoto([...homeToGatePts.slice(0,-1),...gateToCPts],false,'C-entry'),
  D:fromPhoto([...homeToGatePts.slice(0,-1),...gateToDPts],false,'D-entry'),
  E:fromPhoto([...homeToGatePts.slice(0,-1),...gateToEPts],false,'E-entry'),
  F:fromPhoto(homeToFPts,false,'F-entry'),
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
const homeToF=fromPhoto(homeToFPts,false,'home-F');
const fToGate=fromPhoto(fToGatePts,false,'F-gate');

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
  edge('home','F',homeToF,1.8),edge('F','home',homeToF.reversed(),1.8),
  edge('F','gate',fToGate,1.65),edge('gate','F',fToGate.reversed(),1.65),
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
  return terrainHeight(x,z);
}
