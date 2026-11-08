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

function createHeadlightFlareTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,128,128);
  const grad=ctx.createRadialGradient(64,64,3,64,64,62);
  grad.addColorStop(0,'rgba(255,255,255,1.0)');
  grad.addColorStop(0.18,'rgba(255,250,225,0.92)');
  grad.addColorStop(0.38,'rgba(255,225,145,0.45)');
  grad.addColorStop(0.70,'rgba(255,195,85,0.12)');
  grad.addColorStop(1.0,'rgba(255,170,40,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.arc(64,64,62,0,Math.PI*2);
  ctx.fill();
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;return tex;
}

function createHeadlightPoolTexture(){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,256);
  // Wide, soft forward beam covering the entire front width of the bucket
  const grad=ctx.createRadialGradient(128,190,15,128,130,120);
  grad.addColorStop(0,'rgba(255,246,205,0.76)');
  grad.addColorStop(0.32,'rgba(255,234,165,0.46)');
  grad.addColorStop(0.62,'rgba(255,215,130,0.18)');
  grad.addColorStop(0.85,'rgba(240,195,100,0.05)');
  grad.addColorStop(1.0,'rgba(200,170,80,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();
  ctx.ellipse(128,135,118,105,0,0,Math.PI*2);
  ctx.fill();
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;return tex;
}

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
  const lampMaterial=new T.MeshStandardMaterial({color:'#ffffff',emissive:'#fff6dd',emissiveIntensity:.8,roughness:.15});
  for(const x of [-.32,.32]){const lamp=new T.Mesh(new T.BoxGeometry(.12,.06,.025),lampMaterial);lamp.position.set(x,1.54,.495);body.add(lamp);}
  const beacon=new T.Mesh(new T.CylinderGeometry(.036,.05,.07,12),new T.MeshStandardMaterial({color:'#dba154',emissive:'#bd6b1f',emissiveIntensity:.7,roughness:.3}));
  beacon.position.set(.32,1.73,-.25);body.add(beacon);

  // Bright glowing lens flare corona sprites on Bobcat headlights
  const flares=[];
  if(typeof document!=='undefined'){
    const flareTex=createHeadlightFlareTexture();
    const flareMat=new T.SpriteMaterial({map:flareTex,color:'#ffffff',transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false});
    for(const x of [-.32,.32]){
      const sp=new T.Sprite(flareMat);
      sp.position.set(x,1.54,.52);
      sp.scale.set(.42,.42,1);
      body.add(sp);
      flares.push(sp);
    }
  }

  // Mechanical wheel rollers rotate visibly with track travel
  const boltMat=new T.MeshStandardMaterial({color:'#c2c8c0',metalness:.85,roughness:.35});
  const spokeMat=new T.MeshStandardMaterial({color:'#283028',metalness:.75,roughness:.5});
  const ctlWheels=[];
  for(const side of [-1,1]){
    const sIdx=side<0?0:1;
    for(const [y,z] of [[.56,-.07],[.27,.92],[.27,-.88],[.14,-.52],[.14,-.18],[.14,.16],[.14,.5]]){
      const wheelGroup=new T.Group();
      wheelGroup.position.set(side*.958,y,z);
      const cap=new T.Mesh(new T.CylinderGeometry(.044,.044,.022,12),boltMat);
      cap.rotation.z=Math.PI/2;
      wheelGroup.add(cap);
      const spoke=new T.Mesh(new T.BoxGeometry(.024,.08,.026),spokeMat);
      wheelGroup.add(spoke);
      groups[side<0?'trackLeft':'trackRight'].add(wheelGroup);
      ctlWheels.push({group:wheelGroup,side:sIdx,radius:y>.2?.22:.12});
    }
  }
  // Night forward headlights: Soft wide ground illumination pool + subtle SpotLight
  const spotLight=new T.SpotLight('#fff4d6',0,11,Math.PI/3.3,.85,1.7);
  spotLight.position.set(0,1.55,.5);
  const spotTarget=new T.Object3D();spotTarget.position.set(0,0,3.0);
  pitchFrame.add(spotLight,spotTarget);spotLight.target=spotTarget;

  let poolMat=null,groundPool=null;
  if(typeof document!=='undefined'){
    const poolTex=createHeadlightPoolTexture();
    // Broad width: 3.6m wide (50% wider spread in front of the bucket), 2.9m length
    const poolGeo=new T.PlaneGeometry(3.6/1.35,2.9/1.35);poolGeo.rotateX(-Math.PI/2);
    poolMat=new T.MeshBasicMaterial({map:poolTex,transparent:true,opacity:0,depthWrite:false,blending:T.NormalBlending});
    groundPool=new T.Mesh(poolGeo,poolMat);
    groundPool.position.set(0,.005,1.95/1.35);
    root.add(groundPool);
  }

  const pivots={arm:new T.Vector3(0,1.28,-.9),bucket:new T.Vector3(0,.1,1.1)};
  // Geometry is retained in its original coordinate system. Tiny secondary motion
  // is applied around the mechanical pivots using compensated translations.
  const pivotRotation=(group,pivot,angle)=>{group.rotation.x=angle;group.position.copy(pivot).sub(pivot.clone().applyEuler(group.rotation));};
  function update(motion,night=0){
    const n=typeof night==='number'?night:0;
    root.position.set(motion.x,motion.y+.025,motion.z);root.rotation.y=motion.yaw;
    root.rotation.x=0;root.rotation.z=0;
    pitchFrame.rotation.x=motion.pose.pitch;pitchFrame.rotation.z=motion.pose.roll;
    pitchFrame.position.y=motion.pose.heave/1.35;
    trackLeft.position.y=motion.pose.leftHeight/1.35;trackRight.position.y=motion.pose.rightHeight/1.35;
    trackLeft.rotation.x=motion.pose.leftPitch??motion.pose.pitch;trackRight.rotation.x=motion.pose.rightPitch??motion.pose.pitch;
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
    for(const w of ctlWheels){
      const dist=(w.side===0?motion.leftDistance:motion.rightDistance)/1.35;
      w.group.rotation.x=dist/w.radius;
    }
    beacon.material.emissiveIntensity=(.55+Math.max(0,Math.sin(motion.time*5))*.8)*(1+n*.5);
    spotLight.intensity=n*2.6;
    spotLight.visible=n>.02;
    if(groundPool){groundPool.visible=n>.02;if(poolMat)poolMat.opacity=n*.48;}
    lampMaterial.emissiveIntensity=.4+n*5.2;
    lampMaterial.emissive.set(n>.1?'#ffffff':'#ffe5ab');
    for(const f of flares){
      f.visible=n>.02;
      f.material.opacity=n*.95;
      f.scale.setScalar(.40+n*.08+Math.sin(motion.time*16)*.01);
    }
  }
  return {root,update,source:'preview_ctl_3d.html',parts:groups};
}
