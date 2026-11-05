import * as T from './vendor/three.module.js';
import { createWorld, seeded } from './world.js';
import { PHOTO, photoToWorld, worldToPhoto } from './photo-map.js';
import { createCTL } from './ctl-model.js';
import { VehicleMotion } from './motion.js';
import { groundHeight, surfaceAt, SURFACES, LOOPS } from './routes.js';

const $=id=>document.getElementById(id);
const showError=error=>{$('loading').hidden=true;$('error').hidden=false;$('error-message').textContent=error?.message||String(error);console.error(error);};
window.addEventListener('error',e=>showError(e.error||e.message));
window.addEventListener('unhandledrejection',e=>showError(e.reason));

try {
  const container=$('scene'),photo=$('field-photo');
  await photo.decode();
  container.appendChild($('labels'));
  const scene=new T.Scene();
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showError(new Error('3D 그래픽 연결이 중단되었습니다. 다시 시도해 주세요.'));});
  scene.add(new T.HemisphereLight('#e4f0ee','#8c8c62',2.45));
  const sun=new T.DirectionalLight('#fff0d2',3.35);sun.position.set(-35,75,-25);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:180});sun.shadow.normalBias=.045;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
  const fill=new T.DirectionalLight('#d8e6e5',.75);fill.position.set(40,20,60);scene.add(fill);
  const camera=new T.OrthographicCamera(-75,75,60,-60,.1,650);
  const world=createWorld(scene),ctl=createCTL(),motion=new VehicleMotion();scene.add(ctl.root);
  const center=new T.Vector3(),desiredCenter=new T.Vector3(),viewVector=new T.Vector3(),projected=new T.Vector3();
  let cameraMode='overview',width=1,height=1,playbackRate=1.5;
  const orbitYaw=PHOTO.yaw,orbitElevation=PHOTO.elevation;
  let viewHalfHeight=70,targetHalfHeight=70,dragging=false,pointerStart=null,dragLast=null,dragDistance=0;
  let paused=false,qualityVisible=false,frameCount=0,fps=0,fpsTime=0,elapsed=0,previousTime=null,lastHud=0;
  const rng=seeded(87087);

  // Particles originate at the actual belt contact points. Dry dust and small
  // wet splashes have different density, gravity and lifetime.
  const particleCount=260,positions=new Float32Array(particleCount*3),sizes=new Float32Array(particleCount),alphas=new Float32Array(particleCount),colors=new Float32Array(particleCount*3);
  const particles=Array.from({length:particleCount},()=>({life:0,max:1,vx:0,vy:0,vz:0}));let particleCursor=0,dustBudget=0;
  const pg=new T.BufferGeometry();pg.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));pg.setAttribute('aSize',new T.BufferAttribute(sizes,1).setUsage(T.DynamicDrawUsage));pg.setAttribute('aAlpha',new T.BufferAttribute(alphas,1).setUsage(T.DynamicDrawUsage));pg.setAttribute('color',new T.BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage));
  const pm=new T.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{uScale:{value:10}},vertexShader:'attribute float aSize;attribute float aAlpha;varying float vAlpha;varying vec3 vColor;uniform float uScale;void main(){vAlpha=aAlpha;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(0.,aSize*uScale);}',fragmentShader:'varying float vAlpha;varying vec3 vColor;void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;float a=pow(max(0.,1.-r*r),2.)*vAlpha;if(a<.002)discard;gl_FragColor=vec4(vColor,a);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  // Shader preprocessor directives must start on their own line.
  pm.fragmentShader=pm.fragmentShader.replace(';#include',';\n#include');
  const cloud=new T.Points(pg,pm);cloud.frustumCulled=false;scene.add(cloud);
  const marks=new T.InstancedMesh(new T.BoxGeometry(.39,.007,.12),new T.MeshStandardMaterial({color:'#5e533e',transparent:true,opacity:.19,depthWrite:false,roughness:1}),1000);marks.instanceMatrix.setUsage(T.DynamicDrawUsage);marks.frustumCulled=false;
  const stamp=new T.Object3D();stamp.scale.setScalar(0);stamp.updateMatrix();for(let i=0;i<1000;i++)marks.setMatrixAt(i,stamp.matrix);scene.add(marks);let markCursor=0,lastMark=0;

  function emitParticle(wet=false){
    const i=particleCursor++%particleCount,p=particles[i],side=rng()<.5?-1:1,sy=Math.sin(motion.yaw),cy=Math.cos(motion.yaw),sideD=side*1.05;
    positions[i*3]=motion.x+cy*sideD-sy*.95;positions[i*3+2]=motion.z-sy*sideD-cy*.95;positions[i*3+1]=groundHeight(positions[i*3],positions[i*3+2])+.08;
    p.life=p.max=wet?.35+rng()*.35:1.1+rng()*1.3;p.vx=(rng()-.5)*.35-sy*.15;p.vz=(rng()-.5)*.35-cy*.15;p.vy=wet?.6+rng()*.5:.1+rng()*.1;p.wet=wet;sizes[i]=wet?.06+rng()*.08:.25+rng()*.25;
    const c=new T.Color(wet?'#7a8a7a':'#c5b28c');colors.set([c.r,c.g,c.b],i*3);
  }
  function updateEffects(dt){
    const wet=motion.surface==='D',dry=['A','B','C'].includes(motion.surface);
    if(motion.speed>.12&&(wet||dry)){dustBudget+=dt*motion.speed*(wet?10:9);while(dustBudget>=1){emitParticle(wet);dustBudget--;}}
    for(let i=0;i<particleCount;i++){
      const p=particles[i];if(p.life<=0){alphas[i]=0;continue;}p.life-=dt;positions[i*3]+=p.vx*dt;positions[i*3+1]+=p.vy*dt;positions[i*3+2]+=p.vz*dt;
      if(p.wet)p.vy-=dt*3.5;else{p.vx+=dt*.04;sizes[i]+=dt*.22;}alphas[i]=Math.sin(Math.PI*Math.max(0,p.life/p.max))*(p.wet?.4:.12);
    }
    for(const attr of ['position','aSize','aAlpha','color'])pg.attributes[attr].needsUpdate=true;
    if(dry&&motion.distance-lastMark>.3){
      lastMark=motion.distance;const sy=Math.sin(motion.yaw),cy=Math.cos(motion.yaw);
      for(const side of [-1,1]){
        const x=motion.x+cy*side*1.025-sy*1.06,z=motion.z-sy*side*1.025-cy*1.06;
        stamp.position.set(x,groundHeight(x,z)+.009,z);stamp.rotation.set(0,motion.yaw,0);stamp.scale.set(1,1,1);stamp.updateMatrix();marks.setMatrixAt(markCursor++%1000,stamp.matrix);
      }marks.instanceMatrix.needsUpdate=true;
    }
  }

  const labels=world.labels.map(info=>{
    const el=document.createElement('div');el.className='world-label'+(info.building?' building':'')+(info.gate?' gate':'');
    if(info.id){const letter=document.createElement('span');letter.className='letter';letter.textContent=info.id;const text=document.createElement('span');text.className='label-text';text.textContent=info.name;el.append(letter,text);}else el.textContent=info.name;
    $('labels').appendChild(el);return{...info,el,v:new T.Vector3(...info.p)};
  });

  function cameraTargets(){
    viewVector.set(Math.sin(orbitYaw)*Math.cos(orbitElevation),Math.sin(orbitElevation),Math.cos(orbitYaw)*Math.cos(orbitElevation));
    const [cx,cy,cw,ch]=PHOTO.crop;
    const scale=Math.min(width/cw,height/ch);
    if(cameraMode==='overview'){
      const [x,z]=photoToWorld([cx+cw/2,cy+ch/2]);desiredCenter.set(x,0,z);
      targetHalfHeight=height/(2*PHOTO.pixelsPerMeter*scale);
    }else{
      desiredCenter.set(motion.x,0,motion.z);targetHalfHeight=height/(2*PHOTO.pixelsPerMeter*scale*2.8);
    }
  }
  function resize(){
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);
    renderer.setSize(width,height,false);cameraTargets();center.copy(desiredCenter);viewHalfHeight=targetHalfHeight;
    updateCamera(0);
  }
  function updateCamera(dt){
    if(cameraMode==='follow')cameraTargets();
    const blend=1-Math.exp(-dt*4.5);center.lerp(desiredCenter,blend);viewHalfHeight=T.MathUtils.lerp(viewHalfHeight,targetHalfHeight,blend);
    camera.top=viewHalfHeight;camera.bottom=-viewHalfHeight;camera.left=-viewHalfHeight*width/height;camera.right=-camera.left;camera.updateProjectionMatrix();
    camera.position.copy(center).addScaledVector(viewVector,220);camera.lookAt(center);camera.updateMatrixWorld();
    const scale=height/(2*viewHalfHeight*PHOTO.pixelsPerMeter),cp=worldToPhoto(center.x,center.z);
    photo.style.width=(PHOTO.width*scale)+'px';photo.style.height=(PHOTO.height*scale)+'px';
    photo.style.left=(width/2-cp[0]*scale)+'px';photo.style.top=(height/2-cp[1]*scale)+'px';
    pm.uniforms.uScale.value=height/(viewHalfHeight*2)*renderer.getPixelRatio();
    for(const l of labels){
      projected.copy(l.v).project(camera);const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      l.el.style.display=(projected.z>1||projected.z< -1||x<8||x>width-8||y<8||y>height-8)?'none':'';
      l.el.style.left=x+'px';l.el.style.top=y+'px';l.el.classList.toggle('active',l.id===motion.routeId);
    }
  }
  new ResizeObserver(resize).observe(container);resize();
  function selectRoute(id){motion.select(id);paused=false;$('pause').setAttribute('aria-label','주행 일시 정지');updateHud();}
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>selectRoute(el.dataset.route)));
  function setCamera(mode){cameraMode=mode;$('overview').classList.toggle('active',mode==='overview');$('follow').classList.toggle('active',mode==='follow');cameraTargets();}
  $('overview').onclick=()=>setCamera('overview');$('follow').onclick=()=>setCamera('follow');
  $('pause').onclick=()=>{paused=!paused;motion.paused=paused;$('pause').setAttribute('aria-label',paused?'주행 재개':'주행 일시 정지');updateHud();};
  $('return').onclick=()=>{motion.returnHome();paused=false;updateHud();};
  const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
  function routeAtPointer(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);if(!ray.ray.intersectPlane(plane,hit))return null;const id=surfaceAt(hit.x,hit.z);return SURFACES[id]?id:null;}
  renderer.domElement.addEventListener('pointermove',e=>{renderer.domElement.style.cursor=routeAtPointer(e)?'pointer':'default';});
  renderer.domElement.addEventListener('click',e=>{const id=routeAtPointer(e);if(id)selectRoute(id);});
  function setPlaybackRate(value){
    if(![1,1.5,2].includes(Number(value)))return;
    playbackRate=Number(value);$('playback-rate').value=String(playbackRate);
  }
  $('playback-rate').addEventListener('change',e=>setPlaybackRate(e.target.value));

  function updateHud(){
    $('speed').textContent=(motion.speed*3.6).toFixed(1);$('distance').textContent=Math.floor(motion.distance).toLocaleString('ko-KR');$('laps').textContent=motion.laps;
    const state=motion.blocked?'장애물 앞 정지':motion.phase==='parked'?'주차 중':paused?'감속 · 일시 정지':motion.phase==='entry'?'시험로로 이동 중':motion.phase==='return'?'주차장으로 복귀 중':'시험 주행 중';
    $('state-label').textContent=state;$('surface-label').textContent=SURFACES[motion.surface]?.material||'포장도로';$('status-dot').style.background=motion.phase==='parked'?'#9aa297':'#6e9770';
    $('motion-note').textContent=motion.blocked?motion.blocked.name+'과의 간격을 확인해 주세요.':motion.phase==='parked'?'시험 노면을 선택해 주행을 시작하세요.':motion.pending?'현재 구간을 마친 뒤 안전하게 이동합니다.':motion.surface==='D'?'자갈 접지에 따라 차체가 반응합니다.':motion.surface==='E'?'블록의 높낮이를 따라 저속 주행합니다.':'트랙 회전과 주행 거리를 동기화합니다.';
    $('route-hint').textContent=motion.pending?'경로 변경 대기 중':motion.routeId?`${motion.routeId} · ${SURFACES[motion.routeId].name}`:'노면을 클릭하면 장비가 출발합니다.';
    document.querySelectorAll('[data-route]').forEach(el=>{const active=el.dataset.route===(motion.pending&&motion.pending!=='home'?motion.pending:motion.routeId);el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    for(const [id,path] of Object.entries(world.routeLines))path.visible=id===motion.routeId;
    $('pause').style.background=paused?'#dce7d3':'';
    if(qualityVisible)$('quality').textContent=`${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws\n${(renderer.info.render.triangles/1000).toFixed(0)}k triangles\n${motion.phase} ${motion.routeId||''} · ${motion.surface}\nx ${motion.x.toFixed(2)} z ${motion.z.toFixed(2)}\npitch ${(motion.pose.pitch*180/Math.PI).toFixed(2)}°\nL ${motion.leftDistance.toFixed(1)} R ${motion.rightDistance.toFixed(1)}`;
  }
  window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='q'){qualityVisible=!qualityVisible;$('quality').hidden=!qualityVisible;}if(e.code==='Space'&&!['BUTTON','INPUT'].includes(document.activeElement.tagName)){e.preventDefault();$('pause').click();}});
  // An isolated client-side API for future Home integrations. No app/service
  // imports, parent DOM access, storage, navigation or real equipment writes.
  window.FieldSimulation=Object.freeze({
    selectRoute,returnToParking:()=>motion.returnHome(),setPaused:value=>{paused=!!value;motion.paused=paused;},setCamera,setPlaybackRate,
    snapshot:()=>({equipment:'bobcat-t870',playbackRate,blocked:motion.blocked?.id||null,map:'photo-e-gate-v2',phase:motion.phase,route:motion.routeId,x:motion.x,z:motion.z,speed:motion.speed,distance:motion.distance,laps:motion.laps,leftDistance:motion.leftDistance,rightDistance:motion.rightDistance,pose:{...motion.pose},fps,source:ctl.source}),
  });
  const params=new URLSearchParams(location.search);if(params.has('demo')&&LOOPS[params.get('demo')])selectRoute(params.get('demo'));
  if(params.get('view')==='equipment')setCamera('follow');
  if(params.has('quality')){qualityVisible=true;$('quality').hidden=false;}
  if(params.has('routePreview')){const id=params.get('routePreview');if(LOOPS[id]){motion.routeId=id;motion.route=LOOPS[id];motion.phase='loop';motion.s=LOOPS[id].length*.11;const p=motion.route.point(motion.s),t=motion.route.tangent(motion.s);motion.x=p.x;motion.z=p.z;motion.yaw=Math.atan2(t.x,t.z);motion.speed=SURFACES[id].speed;}}
  document.addEventListener('visibilitychange',()=>{previousTime=null;});
  function frame(now){
    requestAnimationFrame(frame);if(document.hidden)return;
    const dt=previousTime===null?1/60:Math.min(.16,(now-previousTime)/1000);previousTime=now;elapsed+=dt;
    let remain=dt*playbackRate;while(remain>1e-6){const step=Math.min(1/90,remain);motion.update(step);updateEffects(step);remain-=step;}
    ctl.update(motion);
    updateCamera(dt);renderer.render(scene,camera);
    frameCount++;fpsTime+=dt;if(fpsTime>=1){fps=frameCount/fpsTime;frameCount=0;fpsTime=0;}
    if(elapsed-lastHud>.12){updateHud();lastHud=elapsed;}
    if(elapsed>.15&&!$('loading').hidden){$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,600);}
    if(motion.events.length){for(const e of motion.events.splice(0))window.dispatchEvent(new CustomEvent('trackvision:field-motion',{detail:{...e,equipment:'bobcat-t870',simulated:true}}));}
  }
  requestAnimationFrame(frame);
} catch(error){showError(error);}
