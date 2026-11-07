import { surfaceAtPhoto, worldToPhoto, pointInPolygon, SURFACE_POLYGONS } from './photo-map.js';

// Photo-calibrated visual approximation, not surveyed terrain or live sensor data.
// D's central pond is wet; the surrounding stony bank remains gravel.
export const WET_PATCH = [[414,255],[450,232],[483,229],[531,249],[588,277],[578,299],[547,322],[510,318],[470,297],[435,286]];
export const MATERIALS = Object.freeze({
  road: {name:'포장도로',dust:0,gravel:0,water:0,marks:false},
  soil: {name:'다짐흙',dust:11,gravel:0,water:0,marks:true},
  dry: {name:'건조토',dust:16,gravel:0,water:0,marks:true},
  earth: {name:'흙 노면',dust:12,gravel:0,water:0,marks:true},
  gravel: {name:'자갈',dust:2,gravel:21,water:0,marks:false},
  wet: {name:'습지 · 진흙',dust:0,gravel:0,water:20,marks:false},
  blocks: {name:'요철 블록',dust:.5,gravel:0,water:0,marks:false},
  concrete: {name:'콘크리트',dust:0,gravel:0,water:0,marks:false},
});
const kinds={A:'soil',B:'dry',C:'earth',E:'blocks',F:'concrete',road:'road'};
export function edgeDistance(p,poly){
  let edge=Infinity;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
    edge=Math.min(edge,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
  }
  return edge;
}
export function terrainAtPhoto(u,v){
  const surface=surfaceAtPhoto(u,v);
  const kind=surface==='D'?(pointInPolygon([u,v],WET_PATCH)?'wet':'gravel'):kinds[surface];
  return {surface,kind,...MATERIALS[kind]};
}
export const terrainAt=(x,z)=>terrainAtPhoto(...worldToPhoto(x,z));
export function terrainHeight(x,z){
  const p=worldToPhoto(x,z),surface=surfaceAtPhoto(...p);
  if(surface==='road'||surface==='F')return .025;
  const base=.035+.012*Math.sin(x*.73+z*.4)*Math.sin(z*.86);
  if(surface!=='D'&&surface!=='E')return base;
  const fade=Math.min(1,edgeDistance(p,SURFACE_POLYGONS[surface])/14);
  if(surface==='E'){
    // Staggered raised blocks, tied to the photo rather than a time-driven
    // shake. The longer ridges survive averaging over the four belt contacts.
    const u=(p[0]-275)/8,v=(p[1]-350)/(8*Math.sin(.75));
    const ridges=.103*Math.sin(u*2.2+v*.65)+.049*Math.sin(v*2.8-u*.45);
    const joints=.03*Math.cos(u*6.2)*Math.cos(v*5.4);
    return base+fade*(.16+ridges+joints);
  }
  const inside=pointInPolygon(p,WET_PATCH),distance=edgeDistance(p,WET_PATCH);
  const wet=Math.max(0,Math.min(1,.5+(inside?distance:-distance)/10));
  const gravel=.09+.055*Math.sin(x*1.63+z*.7)+.035*Math.sin(z*2.03-x*.51)
    +.018*Math.sin(x*11.3+z*6.7);
  // Submerged ruts and stones keep the wet half physically uneven too.
  // Spatial waves continue through the pond; no clock-driven shaking at rest.
  const mud=.125+.085*Math.sin(x*2.2+z*.7)+.047*Math.sin(z*2.55-x*.4)
    +.023*Math.cos(x*6.4)*Math.cos(z*5.3);
  return base+fade*(gravel*(1-wet)+mud*wet);
}
