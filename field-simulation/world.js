import * as T from './vendor/three.module.js';
import { PHOTO, MAP_LABELS, photoToWorld } from './photo-map.js';
import { LOOPS } from './routes.js';
export function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createWorld(scene){
  // The supplied field photograph is the visible environment. This transparent
  // receiver adds real-time equipment shadows without replacing its layout.
  const floor=new T.Mesh(new T.PlaneGeometry(600,600),new T.ShadowMaterial({opacity:.27}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.012;floor.receiveShadow=true;scene.add(floor);
  const routeLines={};
  for(const[id,route]of Object.entries(LOOPS)){
    const points=Array.from({length:401},(_,i)=>{const p=route.point(i/400*route.length);p.y=.22;return p;});
    const line=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineDashedMaterial({color:'#e3ead0',transparent:true,opacity:.42,dashSize:.65,gapSize:.5,depthWrite:false}));
    line.computeLineDistances();line.visible=false;scene.add(line);routeLines[id]=line;
  }
  const labels=MAP_LABELS.map(info=>{const[x,z]=photoToWorld(info.p);return{...info,p:[x,0,z]};});
  return{labels,routeLines,photo:PHOTO};
}
