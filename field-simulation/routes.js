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
  A:fromPhoto([[287,318],[236,350],[201,379],[196,407],[230,442],[277,463],[324,468],[371,452],[420,421],[486,378],[553,334],[616,293],[635,279],[613,257],[576,235],[530,214],[487,203],[449,215],[369,278]],true,'A'),
  B:fromPhoto([[913,489],[872,480],[829,486],[792,507],[769,542],[764,576],[784,610],[823,635],[872,645],[923,639],[966,618],[992,586],[1002,552],[983,518],[950,497]],true,'B'),
  C:fromPhoto([[606,510],[575,492],[543,487],[514,499],[492,528],[491,555],[510,575],[544,583],[578,580],[605,563],[619,537]],true,'C'),
  D:fromPhoto([[464,270],[478,253],[507,252],[537,263],[549,281],[531,294],[501,291],[477,281]],true,'D'),
  E:fromPhoto([[312,352],[345,360],[375,381],[386,401],[366,417],[326,433],[286,421],[261,398],[259,376],[283,355]],true,'E'),
};
const west=[HOME_PHOTO,[619,198],[548,161],[468,142],[402,174],[329,222],[266,270],[273,300]];
export const INGRESS={
  A:fromPhoto([...west,[298,305],[287,318]],false,'A-entry'),
  B:fromPhoto([HOME_PHOTO,[710,241],[760,272],[814,309],[874,357],[940,402],[970,444],[958,479],[937,491],[913,489]],false,'B-entry'),
  C:fromPhoto([HOME_PHOTO,[710,241],[760,272],[803,310],[813,349],[810,398],[769,437],[719,472],[671,498],[631,514],[606,510]],false,'C-entry'),
  D:fromPhoto([...west,[282,318],[320,322],[370,309],[415,290],[433,286],[452,277],[464,270]],false,'D-entry'),
  E:fromPhoto([...west,[282,318],[292,340],[312,352]],false,'E-entry'),
};
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
