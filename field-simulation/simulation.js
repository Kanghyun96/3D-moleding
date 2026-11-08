import * as T from './vendor/three.module.js';
import { createWorld, seeded } from './world.js';
import { PHOTO, photoToWorld, worldToPhoto } from './photo-map.js';
import { createCTL } from './ctl-model.js';
import { createDX55 } from './dx55-model.js';
import { VehicleMotion } from './motion.js';
import { groundHeight, surfaceAt, SURFACES, LOOPS } from './routes.js';
import { terrainAt } from './terrain.js';
import { SurfaceEffects } from './surface-effects.js';
import { createEffectView } from './effect-view.js';
import { createSiteLighting } from './site-lighting.js';
import { createEquipmentPanel } from './equipment-panel.js';
import { DEFAULT_EQUIPMENT_ID } from './parking-config.js';

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
  const sky=new T.HemisphereLight('#e4f0ee','#8c8c62',2.45);scene.add(sky);
  const sun=new T.DirectionalLight('#fff0d2',3.35);sun.position.set(-35,75,-25);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:75,bottom:-75,near:1,far:180});sun.shadow.normalBias=.045;sun.shadow.bias=-.00015;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
  const fill=new T.DirectionalLight('#d8e6e5',.75);fill.position.set(40,20,60);scene.add(fill);
  const camera=new T.OrthographicCamera(-75,75,60,-60,.1,650);
  const world=createWorld(scene);

  // Equipment 1: Bobcat T-870 (CTL) - Assigned to slot P03
  const ctl=createCTL();
  const motionBobcat=new VehicleMotion({slotId:'P03'});
  scene.add(ctl.root);

  // Equipment 2: Doosan DX-55 (Excavator / MHE) - Assigned to slot P01
  const dx55=await createDX55();
  const motionDX55=new VehicleMotion({slotId:'P01'});
  scene.add(dx55.root);

  // Both vehicles initialize precisely at their assigned slots without overlapping
  ctl.update(motionBobcat);
  dx55.update(motionDX55);

  let activeEquipmentId=DEFAULT_EQUIPMENT_ID;
  const motions={'bobcat-t870':motionBobcat,'dx-55':motionDX55};
  const models={'bobcat-t870':ctl,'dx-55':dx55};
  const getActiveMotion=()=>motions[activeEquipmentId]||motionBobcat;

  const panel=createEquipmentPanel({
    equipmentId:activeEquipmentId,
    onChooseRoute:(routeId,eqId)=>selectRoute(routeId,eqId),
    onEquipmentChange:id=>setActiveEquipment(id,false)
  });

  function setActiveEquipment(id,openPanel=false){
    if(!motions[id])return;
    activeEquipmentId=id;
    panel.setEquipment(id);
    if(openPanel)panel.open();
    updateHud();
    if(cameraMode==='follow')cameraTargets();
  }

  // 2D Screen click target buttons for both equipments
  const targetBobcat=document.createElement('button');
  targetBobcat.className='equipment-hit-target';
  targetBobcat.setAttribute('aria-label','Bobcat T-870 장비 정보 열기');
  targetBobcat.title='Bobcat T-870 (CTL)';
  container.appendChild(targetBobcat);
  targetBobcat.onclick=()=>setActiveEquipment('bobcat-t870',true);

  const targetDX55=document.createElement('button');
  targetDX55.className='equipment-hit-target';
  targetDX55.setAttribute('aria-label','Doosan DX-55 굴착기 정보 열기');
  targetDX55.title='Doosan DX-55 (굴착기)';
  container.appendChild(targetDX55);
  targetDX55.onclick=()=>setActiveEquipment('dx-55',true);

  const lighting=createSiteLighting({container,scene,renderer,sun,fill,sky,shadow:world.shadow,photo});
  lighting.update(0,getActiveMotion());
  const center=new T.Vector3(),desiredCenter=new T.Vector3(),viewVector=new T.Vector3(),projected=new T.Vector3();
  let cameraMode='overview',width=1,height=1,playbackRate=1,labelsVisible=false,hoveredSurface=null;
  const orbitYaw=PHOTO.yaw,orbitElevation=PHOTO.elevation;
  let viewHalfHeight=70,targetHalfHeight=70,dragging=false,pointerStart=null,dragLast=null,dragDistance=0;
  let paused=false,qualityVisible=false,frameCount=0,fps=0,fpsTime=0,elapsed=0,previousTime=null,lastHud=0;
  const rng=seeded(87087);

  const effects=new SurfaceEffects(rng);
  const effectView=createEffectView(effects);scene.add(effectView.cloud);
  const marks=new T.InstancedMesh(new T.BoxGeometry(.39,.007,.12),new T.MeshStandardMaterial({color:'#5e533e',transparent:true,opacity:.19,depthWrite:false,roughness:1}),1000);marks.instanceMatrix.setUsage(T.DynamicDrawUsage);marks.frustumCulled=false;
  const stamp=new T.Object3D();stamp.scale.setScalar(0);stamp.updateMatrix();for(let i=0;i<1000;i++)marks.setMatrixAt(i,stamp.matrix);scene.add(marks);let markCursor=0,lastMark=0;

  function updateMarks(m, isDX55 = false){
    m._lastMark = m._lastMark || 0;
    if(m.distance - m._lastMark > 0.28){
      m._lastMark = m.distance;
      const sy = Math.sin(m.yaw), cy = Math.cos(m.yaw);
      const halfWidth = isDX55 ? 0.714 : 1.025;
      const rearOffset = isDX55 ? 0.65 : 1.06;
      const stampScaleX = isDX55 ? 0.23 / 0.39 : 1.0;
      for(const side of [-1, 1]){
        const x = m.x + cy * side * halfWidth - sy * rearOffset;
        const z = m.z - sy * side * halfWidth - cy * rearOffset;
        if(!terrainAt(x, z).marks) continue;
        stamp.position.set(x, groundHeight(x, z) + 0.009, z);
        stamp.rotation.set(0, m.yaw, 0);
        stamp.scale.set(stampScaleX, 1, 1);
        stamp.updateMatrix();
        marks.setMatrixAt(markCursor++ % 1000, stamp.matrix);
      }
      marks.instanceMatrix.needsUpdate = true;
    }
  }

  const labels=world.labels.map(info=>{
    const el=document.createElement('div');el.className='world-label'+(info.building?' building':'')+(info.parking?' parking':'');
    if(info.id){const letter=document.createElement('span');letter.className='letter';letter.textContent=info.id;const text=document.createElement('span');text.className='label-text';text.textContent=info.name;el.append(letter,text);}else el.textContent=info.name;
    $('labels').appendChild(el);return{...info,el,v:new T.Vector3(...info.p)};
  });

  function cameraTargets(){
    const motion=getActiveMotion();
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
    const motion=getActiveMotion();
    if(cameraMode==='follow')cameraTargets();
    const blend=1-Math.exp(-dt*4.5);center.lerp(desiredCenter,blend);viewHalfHeight=T.MathUtils.lerp(viewHalfHeight,targetHalfHeight,blend);
    camera.top=viewHalfHeight;camera.bottom=-viewHalfHeight;camera.left=-viewHalfHeight*width/height;camera.right=-camera.left;camera.updateProjectionMatrix();
    camera.position.copy(center).addScaledVector(viewVector,220);camera.lookAt(center);camera.updateMatrixWorld();
    const scale=height/(2*viewHalfHeight*PHOTO.pixelsPerMeter),cp=worldToPhoto(center.x,center.z);
    photo.style.width=(PHOTO.width*scale)+'px';photo.style.height=(PHOTO.height*scale)+'px';
    photo.style.left=(width/2-cp[0]*scale)+'px';photo.style.top=(height/2-cp[1]*scale)+'px';
    lighting.align(photo.style);
    effectView.setScale(height/(viewHalfHeight*2),renderer.getPixelRatio());
    const activeTarget=(motion.destination&&motion.destination!=='home')?motion.destination:(motion.pending&&motion.pending!=='home')?motion.pending:motion.routeId;
    for(const l of labels){
      projected.copy(l.v).project(camera);const x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      const wanted=l.parking||labelsVisible||(panel.choosing&&!!l.id);
      l.el.style.display=(!wanted||projected.z>1||projected.z< -1||x<8||x>width-8||y<8||y>height-8)?'none':'';
      l.el.style.left=x+'px';l.el.style.top=y+'px';l.el.classList.toggle('active',l.id===activeTarget);
    }

    // Position overlay click targets on 2D screen tracking real vehicle positions
    const updateTarget=(btn,pos)=>{
      projected.set(pos.x,pos.y+1.2,pos.z).project(camera);
      btn.style.left=((projected.x*.5+.5)*width)+'px';btn.style.top=((-projected.y*.5+.5)*height)+'px';
      btn.hidden=projected.z>1||projected.z< -1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1;
    };
    updateTarget(targetBobcat,ctl.root.position);
    updateTarget(targetDX55,dx55.root.position);

    for(const[id,mesh]of Object.entries(world.surfaceHighlights))mesh.visible=panel.choosing&&id===hoveredSurface;
  }
  new ResizeObserver(resize).observe(container);resize();

  function selectRoute(id,eqId=activeEquipmentId){
    setActiveEquipment(eqId,false);
    const m=motions[eqId]||getActiveMotion();
    m.select(id);
    paused=false;
    $('pause').setAttribute('aria-label','주행 일시 정지');
    updateHud();
  }
  function setCamera(mode){cameraMode=mode;$('overview').classList.toggle('active',mode==='overview');$('follow').classList.toggle('active',mode==='follow');cameraTargets();}
  $('overview').onclick=()=>setCamera('overview');$('follow').onclick=()=>setCamera('follow');
  $('labels-toggle').onclick=()=>{labelsVisible=!labelsVisible;$('labels-toggle').setAttribute('aria-pressed',String(labelsVisible));};
  $('pause').onclick=()=>{
    const m=getActiveMotion();
    paused=!paused;m.paused=paused;
    $('pause').setAttribute('aria-label',paused?'주행 재개':'주행 일시 정지');
    $('pause').textContent=paused?'주행 재개':'일시 정지';
    updateHud();
  };
  $('return').onclick=()=>{
    const m=getActiveMotion();
    m.returnHome();
    paused=false;
    updateHud();
  };

  const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0),hit=new T.Vector3();
  function routeAtPointer(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);if(!ray.ray.intersectPlane(plane,hit))return null;const id=surfaceAt(hit.x,hit.z);return SURFACES[id]?id:null;}
  function equipmentAtPointer(e){
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);
    if(ray.intersectObject(ctl.root,true).length>0)return 'bobcat-t870';
    if(ray.intersectObject(dx55.root,true).length>0)return 'dx-55';
    return null;
  }
  renderer.domElement.addEventListener('pointermove',e=>{
    const eq=equipmentAtPointer(e);
    hoveredSurface=panel.choosing?routeAtPointer(e):null;
    renderer.domElement.style.cursor=eq||hoveredSurface?'pointer':'default';
  });
  renderer.domElement.addEventListener('pointerleave',()=>{hoveredSurface=null;});
  renderer.domElement.addEventListener('click',e=>{
    const hitEq=equipmentAtPointer(e);
    if(hitEq){setActiveEquipment(hitEq,true);return;}
    if(panel.choosing){const id=routeAtPointer(e);if(id)panel.selectRoute(id);}
  });

  function setPlaybackRate(value){
    const rate=Number(value);
    if(!Number.isFinite(rate))return;
    playbackRate=Math.max(1,Math.min(10,Math.round(rate)));
    $('playback-rate').value=String(playbackRate);
    $('playback-rate').setAttribute('aria-valuetext',`${playbackRate}배`);
    $('playback-value').textContent=`${playbackRate}×`;
  }
  $('playback-rate').addEventListener('input',e=>setPlaybackRate(e.target.value));
  setPlaybackRate($('playback-rate').value);
  $('lighting-mode').addEventListener('change',e=>lighting.setMode(e.target.value));

  function updateHud(){
    const motion=getActiveMotion();
    $('speed').textContent=(motion.speed*3.6).toFixed(1);
    $('distance').textContent=Math.floor(motion.distance).toLocaleString('ko-KR');
    $('laps').textContent=motion.laps;
    const state=motion.blocked?'장애물 앞 정지':motion.phase==='parked'?'P 주차 중':motion.phase==='parking'?'주차 방향 정렬 중':paused?'감속 · 일시 정지':motion.phase==='entry'?'시험로로 이동 중':motion.phase==='transfer'?'다음 노면으로 이동 중':motion.phase==='return'?'P로 복귀 중':motion.turning?'방향 전환 중':'시험 주행 중';
    $('state-label').textContent=state;
    $('surface-label').textContent=motion.phase==='parked'||motion.phase==='parking'?'P 주차장':SURFACES[motion.surface]?.name||'포장도로';
    $('status-dot').style.background=motion.phase==='parked'?'#9aa297':'#6e9770';
    const lightState=lighting.snapshot();
    $('site-time').textContent=`${lightState.preview?'미리보기 · ':''}${lightState.clock} KST · ${lightState.label}`;
    const eqName=activeEquipmentId==='dx-55'?'Doosan DX-55':'Bobcat T-870';
    $('motion-note').textContent=motion.blocked?motion.blocked.name+'과의 간격을 확인해 주세요.':motion.phase==='parked'?'주행을 눌러 시험 노면을 선택하세요.':motion.phase==='parking'?'주차 화살표 방향으로 맞춥니다.':motion.destination?`${motion.destination==='home'||motion.destination==='home_P01'?'P 주차장':SURFACES[motion.destination]?.name||'목적지'}으로 이동합니다.`:motion.routeId?`${eqName} ${SURFACES[motion.routeId]?.name||''} 시험 주행 중입니다.`:'';
    const activeTarget=(motion.destination&&motion.destination!=='home'&&motion.destination!=='home_P01')?motion.destination:(motion.pending&&motion.pending!=='home'&&motion.pending!=='home_P01')?motion.pending:motion.routeId;
    document.querySelectorAll('[data-route]').forEach(el=>{const active=el.dataset.route===activeTarget;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});
    $('pause').hidden=motion.phase==='parked'||motion.phase==='parking';
    $('pause').textContent=paused?'주행 재개':'일시 정지';
    $('return').disabled=motion.phase==='parked'||motion.phase==='parking';
    if(qualityVisible)$('quality').textContent=`${fps.toFixed(0)} fps · ${renderer.info.render.calls} draws\n${(renderer.info.render.triangles/1000).toFixed(0)}k triangles\n${activeEquipmentId} ${motion.phase} ${motion.routeId||''} · ${terrainAt(motion.x,motion.z).kind}\nx ${motion.x.toFixed(2)} z ${motion.z.toFixed(2)}\npitch ${(motion.pose.pitch*180/Math.PI).toFixed(2)}°\nL ${motion.leftDistance.toFixed(1)} R ${motion.rightDistance.toFixed(1)}\nparticles ${effects.active}/320 · lights ${lightState.streetLights}\n${lightState.clock} KST · ${lightState.mode}`;
  }
  window.addEventListener('keydown',e=>{if(['BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.key.toLowerCase()==='q'){qualityVisible=!qualityVisible;$('quality').hidden=!qualityVisible;}if(e.code==='Space'&&!e.repeat){e.preventDefault();$('pause').click();}});

  window.FieldSimulation=Object.freeze({
    selectRoute,returnToParking:()=>getActiveMotion().returnHome(),setPaused:value=>{paused=!!value;getActiveMotion().paused=paused;},setCamera,setPlaybackRate,openEquipment:()=>panel.open(),saveEquipment:()=>panel.save(),
    setActiveEquipment,
    setLightingMode:mode=>{lighting.setMode(mode);$('lighting-mode').value=mode;},
    snapshot:()=>{
      const motion=getActiveMotion();
      return {equipment:activeEquipmentId,equipmentInfo:panel.getRecord(),equipmentPanel:panel.snapshot(),playbackRate,blocked:motion.blocked?.id||null,map:'photo-a-uniform-source',phase:motion.phase,route:motion.routeId,destination:motion.destination,x:motion.x,z:motion.z,speed:motion.speed,distance:motion.distance,laps:motion.laps,leftDistance:motion.leftDistance,rightDistance:motion.rightDistance,pose:{...motion.pose},terrain:terrainAt(motion.x,motion.z).kind,lighting:lighting.snapshot(),particles:effects.active,fps,source:models[activeEquipmentId]?.source};
    },
  });

  const params=new URLSearchParams(location.search);
  if(params.has('equipment')&&motions[params.get('equipment')])setActiveEquipment(params.get('equipment'));
  if(params.has('demo')&&LOOPS[params.get('demo')])selectRoute(params.get('demo'));
  if(['day','dusk','night'].includes(params.get('lighting'))){lighting.setMode(params.get('lighting'));$('lighting-mode').value=params.get('lighting');lighting.update(0,getActiveMotion());}
  if(params.get('view')==='equipment')setCamera('follow');
  if(params.has('quality')){qualityVisible=true;$('quality').hidden=false;}
  if(params.has('routePreview')){
    const id=params.get('routePreview');
    const motion=getActiveMotion();
    if(LOOPS[id]){motion.routeId=id;motion.route=LOOPS[id];motion.phase=LOOPS[id].closed?'loop':'zigzag';motion.s=LOOPS[id].length*.11;const p=motion.route.point(motion.s),t=motion.route.tangent(motion.s);motion.x=p.x;motion.z=p.z;motion.yaw=Math.atan2(t.x,t.z);motion.speed=SURFACES[id].speed;}
  }

  document.addEventListener('visibilitychange',()=>{previousTime=null;});

  function frame(now){
    requestAnimationFrame(frame);if(document.hidden)return;
    const dt=previousTime===null?1/60:Math.min(.16,(now-previousTime)/1000);previousTime=now;elapsed+=dt;

    // Both vehicles update physics independently in real-time!
    let remain=dt*playbackRate;
    while(remain>1e-6){
      const step=Math.min(1/90,remain);
      motionBobcat.update(step);
      motionDX55.update(step);

      if(motionBobcat.speed>0.05)updateMarks(motionBobcat, false);
      if(motionDX55.speed>0.05)updateMarks(motionDX55, true);
      remain-=step;
    }

    const currentM=getActiveMotion();
    // Effects originate from driving vehicles
    const drivingM=motionDX55.speed>motionBobcat.speed?motionDX55:motionBobcat;
    effects.update(dt,drivingM.speed>0.05?drivingM:currentM);
    effectView.sync();

    const lightState=lighting.update(dt,currentM);
    const night=lighting.getNight?lighting.getNight():(lightState.night??0);

    // 3D Models update simultaneously with rolling wheels, crawler tracks & night headlights
    ctl.update(motionBobcat, night);
    dx55.update(motionDX55, night);
    updateCamera(dt);renderer.render(scene,camera);
    frameCount++;fpsTime+=dt;if(fpsTime>=1){fps=frameCount/fpsTime;frameCount=0;fpsTime=0;}
    if(elapsed-lastHud>.12){updateHud();lastHud=elapsed;}
    if(elapsed>.15&&!$('loading').hidden){$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,600);}
    if(currentM.events.length){for(const e of currentM.events.splice(0))window.dispatchEvent(new CustomEvent('trackvision:field-motion',{detail:{...e,equipment:activeEquipmentId,simulated:true}}));}
  }
  requestAnimationFrame(frame);
} catch(error){showError(error);}
