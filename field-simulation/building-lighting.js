// Glazing traced on the actual raster. Keep concrete borders, mullions and
// reflections visible instead of painting flat yellow rectangles over them.
const sourcePoint=(x,y)=>[x*1200/1451,y*896/1084];
const fromOffice=points=>points.map(([x,y])=>sourcePoint(790+x/3,410+y/3));
const officeRooms=[
  {points:[[32,41],[113,80],[113,127],[32,89]],panes:2,strength:.62},
  {points:[[158,101],[253,145],[253,191],[158,149]],panes:3,strength:.47},
  {points:[[263,140],[327,100],[327,146],[263,188]],panes:2,strength:.36},
  {points:[[32,137],[113,177],[113,224],[32,182]],panes:2,strength:.45},
  {points:[[158,201],[253,245],[253,288],[158,245]],panes:3,strength:.26},
  {points:[[263,242],[327,203],[327,247],[263,286]],panes:2,strength:.21},
];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function subPane(points,from,to){
  const topA=lerp(points[0],points[1],from),topB=lerp(points[0],points[1],to);
  const bottomA=lerp(points[3],points[2],from),bottomB=lerp(points[3],points[2],to);
  return [lerp(topA,bottomA,.07),lerp(topB,bottomB,.07),lerp(topB,bottomB,.93),lerp(topA,bottomA,.93)];
}
export const BUILDING_PANES={
  office:officeRooms.flatMap(room=>Array.from({length:room.panes},(_,i)=>({
    points:fromOffice(subPane(room.points,(i+.045)/room.panes,(i+.955)/room.panes)),strength:room.strength,
  }))),
  garage:[
    [[105,78],[133,91],[133,111],[105,99]],
    [[151,98],[179,111],[179,132],[151,120]],
    [[195,119],[224,132],[224,153],[195,140]],
    [[280,159],[309,173],[309,194],[280,181]],
    [[326,181],[355,195],[355,216],[326,203]],
    [[374,203],[403,217],[403,238],[374,225]],
    [[421,225],[450,239],[450,261],[421,247]],
  ].map((points,i)=>({points:subPane(points,.055,.945).map(([x,y])=>sourcePoint(x+780,y+120)),strength:[.46,.55,.35,.58,.39,.49,.29][i]})),
};
export const BUILDING_WINDOWS=Object.fromEntries(Object.entries(BUILDING_PANES).map(([name,panes])=>[name,panes.map(p=>p.points)]));
export const BUILDING_LIGHT_PROFILES=Object.freeze({
  office:{matrix:'1.08 0 0 0 .095  0 1.02 0 0 .063  0 0 .91 0 .023  0 0 0 1 0'},
  // Lift the dark interior gently while compressing the photograph's bright
  // sunlit floor patches, so they do not become white cut-outs at night.
  garage:{matrix:'.92 0 0 0 .12  0 .90 0 0 .105  0 0 .86 0 .075  0 0 0 1 0'},
});
export function createBuildingLighting({svgElement,defs,photoUrl}){
  const interiors=svgElement('g'),spill=svgElement('g');
  const spillGradient=svgElement('linearGradient',{id:'building-spill-fade',x1:'0%',y1:'0%',x2:'0%',y2:'100%'});
  for(const[offset,opacity]of [['0%',.12],['45%',.045],['100%',0]])spillGradient.append(svgElement('stop',{offset,'stop-color':'#e8d8b8','stop-opacity':opacity}));
  defs.append(spillGradient);
  for(const[name,panes]of Object.entries(BUILDING_PANES)){
    const filter=svgElement('filter',{id:`building-${name}-relight`,x:'0%',y:'0%',width:'100%',height:'100%','color-interpolation-filters':'sRGB'});
    filter.append(svgElement('feColorMatrix',{type:'matrix',values:BUILDING_LIGHT_PROFILES[name].matrix}));defs.append(filter);
    defs.append(svgElement('image',{id:`building-${name}-photo`,href:photoUrl,x:0,y:0,width:1200,height:896,preserveAspectRatio:'none',filter:`url(#building-${name}-relight)`}));
    const group=svgElement('g',{'data-building':name});
    panes.forEach(({points,strength},i)=>{
      const clip=svgElement('clipPath',{id:`building-${name}-pane-${i}`,clipPathUnits:'userSpaceOnUse'});
      clip.append(svgElement('polygon',{points:points.map(p=>p.join(',')).join(' ')}));defs.append(clip);
      group.append(svgElement('use',{href:`#building-${name}-photo`,'clip-path':`url(#building-${name}-pane-${i})`,opacity:strength}));
      if(name==='garage'){
        // A restrained trapezoid follows each bay's threshold and perspective;
        // no circular bloom on the facade, roof or surrounding concrete wall.
        const a=points[3],b=points[2],away=[-7,10];
        const floor=[a,b,[b[0]+away[0],b[1]+away[1]],[a[0]+away[0],a[1]+away[1]]];
        spill.append(svgElement('polygon',{points:floor.map(p=>p.join(',')).join(' '),fill:'url(#building-spill-fade)',opacity:strength}));
      }
    });
    interiors.append(group);
  }
  return {interiors,spill};
}
