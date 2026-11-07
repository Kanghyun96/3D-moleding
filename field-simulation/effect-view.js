import * as T from './vendor/three.module.js';

// Physical sizes still scale with the camera, but the minimums keep grains and
// droplets legible in the overview. Values below are CSS pixels, before DPR.
export const EFFECT_PIXELS = Object.freeze({
  dust:{min:7,max:40},gravel:{min:2.8,max:9},water:{min:2.8,max:7},mud:{min:2.2,max:5},
});
export function effectPixelSize(kind,meters,pixelsPerMeter){
  const range=EFFECT_PIXELS[kind];return Math.max(range.min,Math.min(range.max,meters*pixelsPerMeter));
}
export function createEffectView(effects){
  const geometry=new T.BufferGeometry();
  for(const[name,array,itemSize]of [
    ['position',effects.positions,3],['aSize',effects.sizes,1],['aAlpha',effects.alphas,1],
    ['color',effects.colors,3],['aKind',effects.kinds,1],['aAngle',effects.angles,1],
  ])geometry.setAttribute(name,new T.BufferAttribute(array,itemSize).setUsage(T.DynamicDrawUsage));
  const material=new T.ShaderMaterial({
    transparent:true,depthWrite:false,vertexColors:true,
    uniforms:{uScale:{value:10},uPixelRatio:{value:1},uMinimum:{value:new T.Vector4(...Object.values(EFFECT_PIXELS).map(p=>p.min))},uMaximum:{value:new T.Vector4(...Object.values(EFFECT_PIXELS).map(p=>p.max))}},
    vertexShader:`
      attribute float aSize; attribute float aAlpha; attribute float aKind; attribute float aAngle;
      varying float vAlpha; varying vec3 vColor; varying float vKind; varying float vAngle;
      uniform float uScale; uniform float uPixelRatio; uniform vec4 uMinimum; uniform vec4 uMaximum;
      void main(){
        vAlpha=aAlpha;vColor=color;vKind=aKind;vAngle=aAngle;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        float smallest=aKind<.5?uMinimum.x:aKind<1.5?uMinimum.y:aKind<2.5?uMinimum.z:uMinimum.w;
        float largest=aKind<.5?uMaximum.x:aKind<1.5?uMaximum.y:aKind<2.5?uMaximum.z:uMaximum.w;
        gl_PointSize=clamp(aSize*uScale,smallest*uPixelRatio,largest*uPixelRatio);
      }`,
    fragmentShader:`
      varying float vAlpha; varying vec3 vColor; varying float vKind; varying float vAngle;
      void main(){
        if(vAlpha<.002)discard;
        vec2 p=(gl_PointCoord-.5)*2.;
        float cs=cos(vAngle),sn=sin(vAngle);p=mat2(cs,-sn,sn,cs)*p;
        float shape;vec3 tint=vColor;
        if(vKind<.5){
          // Rounded overlapping billows with feathered, mottled edges. Each
          // sprite has several lobes, instead of a uniform circular streak.
          float d=min(length(p-vec2(-.25,.08))-.59,length(p-vec2(.23,.02))-.57);
          d=min(d,length(p-vec2(-.02,-.28))-.49);
          shape=(1.-smoothstep(-.27,.12,d))*(.84+.16*sin(p.x*6.+p.y*2.)*sin(p.y*5.-p.x));
        }else if(vKind<1.5){
          // Faceted, opaque stone with a small bright edge.
          float radius=max(abs(p.x)*.95+abs(p.y)*.42,abs(p.y)*.9);
          shape=1.-smoothstep(.65,.95,radius);
          tint*=.62+.55*smoothstep(-.8,.7,p.x+p.y);
        }else if(vKind<2.5){
          // Small translucent muddy-water droplets, without a neon highlight.
          float radius=length(p*vec2(1.15,.94));
          shape=1.-smoothstep(.25,1.,radius);
          tint=mix(tint,vec3(.55,.58,.51),.18*max(0.,1.-length(p-vec2(-.1,-.2))));
        }else{
          float radius=length(p*vec2(1.05,.88));
          shape=1.-smoothstep(.7,1.,radius);
        }
        float alpha=shape*vAlpha;if(alpha<.003)discard;
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const cloud=new T.Points(geometry,material);cloud.frustumCulled=false;
  const rippleGeometry=new T.PlaneGeometry(1,1);rippleGeometry.rotateX(-Math.PI/2);
  const rippleAlphas=new Float32Array(effects.ripples.length);
  rippleGeometry.setAttribute('aRippleAlpha',new T.InstancedBufferAttribute(rippleAlphas,1).setUsage(T.DynamicDrawUsage));
  const rippleMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    vertexShader:`attribute float aRippleAlpha;varying vec2 vUv;varying float vAlpha;void main(){vUv=uv;vAlpha=aRippleAlpha;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float vAlpha;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float ring=exp(-pow((r-.72)/.11,2.));float inner=.3*exp(-pow((r-.48)/.13,2.));float broken=.68+.32*sin(atan(p.y,p.x)*3.+r*5.);float a=(ring+inner)*broken*vAlpha;if(a<.002)discard;gl_FragColor=vec4(.58,.59,.47,a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });
  const ripples=new T.InstancedMesh(rippleGeometry,rippleMaterial,effects.ripples.length);ripples.frustumCulled=false;ripples.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const stamp=new T.Object3D();cloud.add(ripples);
  return {cloud,
    sync:()=>{
      for(const attr of Object.values(geometry.attributes))attr.needsUpdate=true;
      effects.ripples.forEach((r,i)=>{stamp.position.set(r.x,r.y,r.z);stamp.rotation.y=r.yaw||0;stamp.scale.set(r.life>0?r.radius*2.25:0,1,r.life>0?r.radius*1.65:0);stamp.updateMatrix();ripples.setMatrixAt(i,stamp.matrix);rippleAlphas[i]=r.alpha;});
      rippleGeometry.attributes.aRippleAlpha.needsUpdate=true;ripples.instanceMatrix.needsUpdate=true;
    },
    setScale:(pixelsPerMeter,pixelRatio)=>{material.uniforms.uScale.value=pixelsPerMeter*pixelRatio;material.uniforms.uPixelRatio.value=pixelRatio;},
  };
}
