import * as T from './vendor/three.module.js';
import { buildBobcatCTLMesh } from './ctl-source.js';
import { rearDecalCanvas, leftArmDecal, rightArmDecal } from './ctl-decals.js';

const TRACK_LOOP = [[.04,-.92],[.04,.95],[.24,1.15],[.44,1.02],[.72,.04],[.72,-.18],[.44,-1.04],[.22,-1.13]];
const segments=TRACK_LOOP.map((a,i)=>{const b=TRACK_LOOP[(i+1)%TRACK_LOOP.length];return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1])};});
export const TRACK_LENGTH=segments.reduce((s,p)=>s+p.length,0);
const dummy=new T.Object3D();

function trackPoint(distance) {
  let d=((distance%TRACK_LENGTH)+TRACK_LENGTH)%TRACK_LENGTH;
  for(const s of segments){if(d<=s.length){const t=d/s.length;return {y:T.MathUtils.lerp(s.a[0],s.b[0],t),z:T.MathUtils.lerp(s.a[1],s.b[1],t),angle:-Math.atan2(s.b[0]-s.a[0],s.b[1]-s.a[1])};}d-=s.length;}
  return {y:.04,z:-.92,angle:0};
}

function texture(canvas){const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;}

export function createCTL() {
  const root=new T.Group();root.name='Bobcat T-870';root.scale.setScalar(1.35);
  const body=new T.Group(),trackLeft=new T.Group(),trackRight=new T.Group(),arm=new T.Group(),bucket=new T.Group();
  const pitchFrame=new T.Group();root.add(pitchFrame);pitchFrame.add(body,arm,bucket);root.add(trackLeft,trackRight);
  const groups={body,trackLeft,trackRight,arm,bucket};
  const faces=buildBobcatCTLMesh(.10,0);
  const rear=new T.MeshStandardMaterial({map:texture(rearDecalCanvas),roughness:.48,metalness:.18,side:T.DoubleSide});
  const decalLeft=new T.MeshStandardMaterial({map:texture(leftArmDecal),roughness:.5,metalness:.15,side:T.DoubleSide});
  const decalRight=new T.MeshStandardMaterial({map:texture(rightArmDecal),roughness:.5,metalness:.15,side:T.DoubleSide});
  const rubber=new T.MeshStandardMaterial({color:'#242824',roughness:.98,metalness:0,vertexColors:true,side:T.DoubleSide});
  const paint=new T.MeshStandardMaterial({roughness:.48,metalness:.18,vertexColors:true,side:T.DoubleSide});
  const steel=new T.MeshStandardMaterial({roughness:.56,metalness:.65,vertexColors:true,side:T.DoubleSide});
  const glass=new T.MeshPhysicalMaterial({color:'#223b3c',metalness:.48,roughness:.24,clearcoat:1,clearcoatRoughness:.12,side:T.DoubleSide});
  const buffers=new Map();
  for(const face of faces){
    const part=face.part||'body';let mat=paint,key='paint';
    if(part.startsWith('track')){mat=rubber;key='rubber';}
    else if(face.tag?.startsWith('cab')){mat=glass;key='glass';}
    else if(face.color==='#e2e8f0'||part==='bucket'){mat=steel;key='steel';}
    if(face.tag==='tailgate_back'){mat=rear;key='rear';}
    if(face.tag==='arm_left_outer'){mat=decalLeft;key='leftDecal';}
    if(face.tag==='arm_right_inner'){mat=decalRight;key='rightDecal';}
    const id=part+':'+key;
    if(!buffers.has(id))buffers.set(id,{part,mat,positions:[],colors:[],uvs:[]});
    const b=buffers.get(id),color=new T.Color(face.color),n=face.verts.length;
    const uv=n===4?[[0,0],[1,0],[1,1],[0,1]]:face.verts.map((_,i)=>[.5+Math.cos(i/n*Math.PI*2)*.5,.5+Math.sin(i/n*Math.PI*2)*.5]);
    for(let i=1;i<n-1;i++)for(const j of [0,i,i+1]){
      const v=face.verts[j];b.positions.push(v.x,v.y,v.z);b.colors.push(color.r,color.g,color.b);b.uvs.push(...uv[j]);
    }
  }
  for(const b of buffers.values()){
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.positions,3));g.setAttribute('color',new T.Float32BufferAttribute(b.colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uvs,2));g.computeVertexNormals();
    const m=new T.Mesh(g,b.mat);m.castShadow=true;m.receiveShadow=true;groups[b.part].add(m);
  }

  // Cab safety grid follows the original quadrilateral surfaces in 3D.
  const linePositions=[];
  const interpolate=(a,b,t)=>new T.Vector3().lerpVectors(new T.Vector3(a.x,a.y,a.z),new T.Vector3(b.x,b.y,b.z),t);
  for(const f of faces.filter(f=>['cab_outer','cab_inner','cab_front'].includes(f.tag))){
    const p=f.verts;
    for(let i=0;i<=9;i++){
      const u=i/9,a=interpolate(p[0],p[1],u),b=interpolate(p[3],p[2],u);
      linePositions.push(a.x*1.015,a.y,a.z*1.015,b.x*1.015,b.y,b.z*1.015);
    }
    for(let i=0;i<=7;i++){
      const u=i/7,a=interpolate(p[0],p[3],u),b=interpolate(p[1],p[2],u);
      linePositions.push(a.x*1.015,a.y,a.z*1.015,b.x*1.015,b.y,b.z*1.015);
    }
  }
  const cage=new T.BufferGeometry();cage.setAttribute('position',new T.Float32BufferAttribute(linePositions,3));
  body.add(new T.LineSegments(cage,new T.LineBasicMaterial({color:'#0e1918'})));
  const treadMaterial=new T.MeshStandardMaterial({color:'#34382f',roughness:.94});
  const treadGeo=new T.BoxGeometry(.398,.052,.12);
  const treadMeshes=[];
  for(const side of [-1,1]){
    const m=new T.InstancedMesh(treadGeo,treadMaterial,56);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;
    groups[side<0?'trackLeft':'trackRight'].add(m);treadMeshes.push(m);
  }
  const lampMaterial=new T.MeshStandardMaterial({color:'#fff6d5',emissive:'#ffe5ab',emissiveIntensity:.7,roughness:.2});
  for(const x of [-.32,.32]){const lamp=new T.Mesh(new T.BoxGeometry(.12,.06,.025),lampMaterial);lamp.position.set(x,1.54,.495);body.add(lamp);}
  const beacon=new T.Mesh(new T.CylinderGeometry(.036,.05,.07,12),new T.MeshStandardMaterial({color:'#dba154',emissive:'#bd6b1f',emissiveIntensity:.7,roughness:.3}));
  beacon.position.set(.32,1.73,-.25);body.add(beacon);
  // Mechanical details read clearly in the close inspection camera.
  const boltMat=new T.MeshStandardMaterial({color:'#929990',metalness:.8,roughness:.42});
  for(const side of [-1,1])for(const [y,z] of [[.56,-.07],[.27,.92],[.27,-.88],[.14,-.52],[.14,-.18],[.14,.16],[.14,.5]]){
    const cap=new T.Mesh(new T.CylinderGeometry(.034,.034,.018,8),boltMat);cap.rotation.z=Math.PI/2;cap.position.set(side*.958,y,z);groups[side<0?'trackLeft':'trackRight'].add(cap);
  }
  const pivots={arm:new T.Vector3(0,1.28,-.9),bucket:new T.Vector3(0,.1,1.1)};
  // Geometry is retained in its original coordinate system. Tiny secondary motion
  // is applied around the mechanical pivots using compensated translations.
  const pivotRotation=(group,pivot,angle)=>{group.rotation.x=angle;group.position.copy(pivot).sub(pivot.clone().applyEuler(group.rotation));};
  function update(motion){
    root.position.set(motion.x,motion.y+.025,motion.z);root.rotation.y=motion.yaw;
    root.rotation.x=0;root.rotation.z=0;
    pitchFrame.rotation.x=motion.pose.pitch;pitchFrame.rotation.z=motion.pose.roll;
    pitchFrame.position.y=motion.pose.heave/1.35;
    trackLeft.position.y=motion.pose.leftHeight/1.35;trackRight.position.y=motion.pose.rightHeight/1.35;
    trackLeft.rotation.x=motion.pose.pitch;trackRight.rotation.x=motion.pose.pitch;
    pivotRotation(arm,pivots.arm,motion.pose.arm);
    pivotRotation(bucket,pivots.bucket,motion.pose.arm*1.4);
    for(let s=0;s<2;s++){
      const distance=(s===0?motion.leftDistance:motion.rightDistance)/1.35;
      for(let i=0;i<56;i++){
        // At the bottom the belt travels backwards relative to the chassis.
        const p=trackPoint(i/56*TRACK_LENGTH-distance);
        dummy.position.set((s===0?-1:1)*.765,p.y-.018*Math.cos(p.angle),p.z-.018*Math.sin(p.angle));dummy.rotation.set(p.angle,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();treadMeshes[s].setMatrixAt(i,dummy.matrix);
      }
      treadMeshes[s].instanceMatrix.needsUpdate=true;
    }
    beacon.material.emissiveIntensity=.55+Math.max(0,Math.sin(motion.time*5))*.8;
  }
  return {root,update,source:'preview_ctl_3d.html',parts:groups};
}
