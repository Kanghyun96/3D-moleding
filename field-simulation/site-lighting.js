import * as T from './vendor/three.module.js';
import { PHOTO, photoToWorld, worldToPhoto } from './photo-map.js';
import { SiteClock } from './daylight.js';
import { createBuildingLighting } from './building-lighting.js';
import { STREET_LIGHTS } from './site-fixtures.js';
export { STREET_LIGHTS } from './site-fixtures.js';
export { BUILDING_WINDOWS } from './building-lighting.js';

// Decorative roadside fixtures proposed by the user-authorized layout pass.
// All coordinates refer to the SAME 1200 x 896 photo as routes/collision data.
const NS='http://www.w3.org/2000/svg';
function svgElement(name,attributes={}){
  const el=document.createElementNS(NS,name);
  for(const[k,v]of Object.entries(attributes))el.setAttribute(k,String(v));
  return el;
}
export function createSiteLighting({container,scene,renderer,sun,fill,sky,shadow,photo}){
  const clock=new SiteClock();
  const layer=svgElement('svg',{id:'site-lights',viewBox:`0 0 ${PHOTO.width} ${PHOTO.height}`,'aria-hidden':'true'});
  const defs=svgElement('defs');layer.append(defs);
  const gradient=svgElement('radialGradient',{id:'site-warm-pool'});
  for(const[offset,opacity]of [['0%',.68],['32%',.38],['65%',.14],['100%',0]])gradient.append(svgElement('stop',{offset,'stop-color':'#ffdb94','stop-opacity':opacity}));
  defs.append(gradient);
  const pools=svgElement('g'),fixtures=svgElement('g');
  const building=createBuildingLighting({svgElement,defs,photoUrl:photo.currentSrc||photo.src});
  layer.append(pools,building.spill,fixtures,building.interiors);
  const bulbs=[];
  for(const light of STREET_LIGHTS){
    const[u,v]=light.p,[x,z]=photoToWorld(light.p),head=worldToPhoto(x,z,3.5);
    pools.append(svgElement('ellipse',{cx:u,cy:v,rx:light.radius,ry:light.radius*Math.sin(PHOTO.elevation),fill:'url(#site-warm-pool)'}));
    fixtures.append(svgElement('path',{d:`M${u},${v} L${head[0]},${head[1]} l6,-2`,fill:'none',stroke:'#545e58','stroke-width':1.8,'stroke-linecap':'round'}));
    const bulb=svgElement('ellipse',{cx:head[0]+6,cy:head[1]-2,rx:3.1,ry:1.8,fill:'#adb5a8'});
    fixtures.append(bulb);bulbs.push(bulb);
  }
  container.insertBefore(layer,container.querySelector('canvas'));
  // One nearest local light illuminates the 3D loader; photo pools are bounded
  // SVG gradients, avoiding nine dynamic shadow maps or additive overexposure.
  const equipmentLight=new T.PointLight('#ffdea2',0,22,2);scene.add(equipmentLight);
  const daySky=new T.Color('#e4f0ee'),nightSky=new T.Color('#8fa6d6'),daySun=new T.Color('#fff0d2'),nightSun=new T.Color('#abbfdf');
  let state=clock.sample(),night=state.night,first=true,lastStyle=-1;
  function update(dt,motion){
    state=clock.sample();
    night=first?state.night:T.MathUtils.lerp(night,state.night,1-Math.exp(-dt*2.5));first=false;
    sky.intensity=T.MathUtils.lerp(2.45,.85,night);
    sky.color.lerpColors(daySky,nightSky,night);
    sun.intensity=T.MathUtils.lerp(3.35,.38,night);sun.color.lerpColors(daySun,nightSun,night);
    fill.intensity=T.MathUtils.lerp(.75,.4,night);
    shadow.opacity=T.MathUtils.lerp(.27,.07,night);
    renderer.toneMappingExposure=T.MathUtils.lerp(1.12,.9,night);
    if(Math.abs(night-lastStyle)>.0005){
      photo.style.filter=`brightness(${1-night*.62}) saturate(${1-night*.36})`;
      pools.style.opacity=String(night*.82);building.interiors.style.opacity=String(night);building.spill.style.opacity=String(night);
      for(const bulb of bulbs)bulb.setAttribute('fill',night>.2?'#ffe8b4':'#adb5a8');
      document.documentElement.style.setProperty('--night',night.toFixed(4));
      lastStyle=night;
    }
    let nearest=null,distance=Infinity;
    for(const light of STREET_LIGHTS){const[x,z]=photoToWorld(light.p),d=Math.hypot(x-motion.x,z-motion.z);if(d<distance){distance=d;nearest=[x,z];}}
    if(nearest){equipmentLight.position.set(nearest[0],3.5,nearest[1]);equipmentLight.intensity=night*32*Math.max(0,1-distance/19);}
    return state;
  }
  function align(photoStyle){for(const key of ['width','height','left','top'])layer.style[key]=photoStyle[key];}
  return {update,align,setMode:mode=>clock.setPreview(mode),getNight:()=>night,
    snapshot:()=>({...state,renderedNight:night,schedule:'06:00–07:00 / 18:00–19:00 KST (임시)',streetLights:STREET_LIGHTS.length,buildingLights:['office','garage']})};
}
