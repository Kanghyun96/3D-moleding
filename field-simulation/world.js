import * as T from './vendor/three.module.js';
import { PHOTO, MAP_LABELS, photoToWorld, SURFACE_POLYGONS, WALLS } from './photo-map.js';
import { PARKING_SLOTS, PARKING_BAY } from './parking-config.js';
export function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createWorld(scene){
  // The supplied field photograph is the visible environment. This transparent
  // receiver adds real-time equipment shadows without replacing its layout.
  const floor=new T.Mesh(new T.PlaneGeometry(600,600),new T.ShadowMaterial({opacity:.27}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.012;floor.receiveShadow=true;scene.add(floor);
  const paint=[];
  function strip(a,b){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ox=-dz/length*PARKING_BAY.paintWidth/2,oz=dx/length*PARKING_BAY.paintWidth/2;
    const corners=[[a[0]+ox,.032,a[1]+oz],[a[0]-ox,.032,a[1]-oz],[b[0]-ox,.032,b[1]-oz],[b[0]+ox,.032,b[1]+oz]];
    for(const i of [0,1,2,0,2,3])paint.push(...corners[i]);
  }
  for(const slot of PARKING_SLOTS){
    const[x,z]=photoToWorld(slot.p),front=photoToWorld([slot.p[0]+slot.direction[0],slot.p[1]+slot.direction[1]]),yaw=Math.atan2(front[0]-x,front[1]-z),cs=Math.cos(yaw),sn=Math.sin(yaw);
    const at=(side,fore)=>[x+cs*side+sn*fore,z-sn*side+cs*fore];
    const a=at(-PARKING_BAY.width/2,PARKING_BAY.front),b=at(-PARKING_BAY.width/2,PARKING_BAY.rear),c=at(PARKING_BAY.width/2,PARKING_BAY.rear),d=at(PARKING_BAY.width/2,PARKING_BAY.front);
    strip(a,b);strip(b,c);strip(c,d);
  }
  const paintGeometry=new T.BufferGeometry();paintGeometry.setAttribute('position',new T.Float32BufferAttribute(paint,3));paintGeometry.computeVertexNormals();
  const parkingBays=new T.Mesh(paintGeometry,new T.MeshStandardMaterial({color:'#e3dfd0',transparent:true,opacity:.72,depthWrite:false,roughness:1,side:T.DoubleSide}));
  parkingBays.name='parking-bays';parkingBays.receiveShadow=true;parkingBays.renderOrder=1;scene.add(parkingBays);
  const surfaceHighlights={};
  for(const[id,polygon]of Object.entries(SURFACE_POLYGONS)){
    const points=polygon.map(p=>{const[x,z]=photoToWorld(p);return new T.Vector2(x,-z);});
    const shape=new T.Shape(points);
    if(id==='A')shape.holes.push(new T.Path(WALLS.find(w=>w.id==='a-inner').points.map(p=>{const[x,z]=photoToWorld(p);return new T.Vector2(x,-z);})));
    const geometry=new T.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);
    const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({color:'#e8efcf',transparent:true,opacity:.15,depthWrite:false,side:T.DoubleSide}));
    mesh.position.y=.03;mesh.visible=false;scene.add(mesh);surfaceHighlights[id]=mesh;
  }
  const labels=MAP_LABELS.map(info=>{const[x,z]=photoToWorld(info.p);return{...info,p:[x,0,z]};});
  return{labels,surfaceHighlights,parkingBays,photo:PHOTO,shadow:floor.material};
}
