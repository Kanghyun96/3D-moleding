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
  const padPositions=[];
  const stopperPositions=[];
  const ctlAccentPositions=[];
  const mheAccentPositions=[];
  function quad(arr,p0,p1,p2,p3,y=.026){
    const c=[[p0[0],y,p0[1]],[p1[0],y,p1[1]],[p2[0],y,p2[1]],[p3[0],y,p3[1]]];
    for(const i of [0,1,2,0,2,3])arr.push(...c[i]);
  }
  function strip(a,b){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ox=-dz/length*PARKING_BAY.paintWidth/2,oz=dx/length*PARKING_BAY.paintWidth/2;
    const corners=[[a[0]+ox,.032,a[1]+oz],[a[0]-ox,.032,a[1]-oz],[b[0]-ox,.032,b[1]-oz],[b[0]+ox,.032,b[1]+oz]];
    for(const i of [0,1,2,0,2,3])paint.push(...corners[i]);
  }
  for(const slot of PARKING_SLOTS){
    const[x,z]=photoToWorld(slot.p),front=photoToWorld([slot.p[0]+slot.direction[0],slot.p[1]+slot.direction[1]]),yaw=Math.atan2(front[0]-x,front[1]-z),cs=Math.cos(yaw),sn=Math.sin(yaw);
    const at=(side,fore)=>[x+cs*side+sn*fore,z-sn*side+cs*fore];
    const hw=PARKING_BAY.width/2,r=PARKING_BAY.rear,f=PARKING_BAY.front;
    const a=at(-hw,f),b=at(-hw,r),c=at(hw,r),d=at(hw,f);
    strip(a,b);strip(b,c);strip(c,d);
    // Subtle dark bay surface pad
    quad(padPositions,at(-hw+.08,f-.05),at(-hw+.08,r+.08),at(hw-.08,r+.08),at(hw-.08,f-.05),.022);
    // Safety wheel stopper bar near the rear of the bay
    quad(stopperPositions,at(-hw*.58,r+.42),at(-hw*.58,r+.26),at(hw*.58,r+.26),at(hw*.58,r+.42),.036);
    // Zone color header accent along the rear edge (CTL vs MHE)
    const accentTarget=slot.zone==='MHE'?mheAccentPositions:ctlAccentPositions;
    quad(accentTarget,at(-hw+.06,r-.04),at(-hw+.06,r-.20),at(hw-.06,r-.20),at(hw-.06,r-.04),.034);
  }
  const paintGeometry=new T.BufferGeometry();paintGeometry.setAttribute('position',new T.Float32BufferAttribute(paint,3));paintGeometry.computeVertexNormals();
  const parkingBays=new T.Mesh(paintGeometry,new T.MeshStandardMaterial({color:'#f4f3eb',transparent:true,opacity:.86,depthWrite:false,roughness:.9,side:T.DoubleSide}));
  parkingBays.name='parking-bays';parkingBays.receiveShadow=true;parkingBays.renderOrder=1;scene.add(parkingBays);

  const makeLayer=(positions,color,opacity)=>{
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();
    const m=new T.Mesh(g,new T.MeshStandardMaterial({color,transparent:true,opacity,depthWrite:false,roughness:.95,side:T.DoubleSide}));
    m.receiveShadow=true;m.renderOrder=1;scene.add(m);return m;
  };
  makeLayer(padPositions,'#28302c',.22);
  makeLayer(stopperPositions,'#e0a32e',.82);
  makeLayer(ctlAccentPositions,'#3b6e52',.78);
  makeLayer(mheAccentPositions,'#d96b27',.82);
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
