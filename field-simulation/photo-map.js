// All layout, paths and exclusion zones share the original 1200 × 896 photo.
// The actual raster is a localized E-gate edit, normalized to this coordinate space.
export const PHOTO = Object.freeze({ width:1200, height:896, pixelsPerMeter:8, yaw:.57, elevation:.75, origin:[600,430], crop:[30,48,1140,694] });
const sy=Math.sin(PHOTO.yaw),cy=Math.cos(PHOTO.yaw),se=Math.sin(PHOTO.elevation),s=PHOTO.pixelsPerMeter;
export function photoToWorld(p){const r=(p[0]-PHOTO.origin[0])/s,q=(p[1]-PHOTO.origin[1])/(s*se);return [cy*r+sy*q,-sy*r+cy*q];}
export function worldToPhoto(x,z,y=0){return [PHOTO.origin[0]+s*(cy*x-sy*z),PHOTO.origin[1]+s*(se*(sy*x+cy*z)-Math.cos(PHOTO.elevation)*y)];}

export const HOME_PHOTO=[667,230];
export const SITE_BOUNDARY=[[526,17],[692,49],[1154,228],[1160,349],[1093,392],[1099,446],[1175,510],[1117,588],[944,724],[821,739],[664,735],[525,711],[419,650],[318,573],[215,483],[141,433],[91,385],[79,337],[101,285],[179,229],[335,149]];
export const BLOCKED_POLYGONS=[
  {id:'garage',name:'차고지',points:[[677,113],[731,63],[1151,230],[1151,282],[1116,340],[677,166]],margin:2},
  {id:'office',name:'사무실',points:[[660,336],[715,306],[778,331],[780,406],[731,435],[659,395]],margin:3},
  {id:'hut',name:'관리 시설',points:[[1073,511],[1102,491],[1141,516],[1134,551],[1091,569],[1075,545]],margin:2},
];
export const WALLS=[
  {id:'a-northwest',name:'A 외벽',points:[[292,287],[494,164],[710,272]],radius:3},
  // E opening is the deliberate gap between (251,312) and (292,287).
  {id:'a-south',name:'A 외벽',points:[[251,312],[185,351],[151,376],[146,396],[158,422],[190,451],[234,480],[280,500],[330,505],[382,495],[427,476],[454,457],[711,286],[710,272]],radius:4},
  {id:'bc-divider',name:'B/C 분리벽',points:[[530,633],[572,634],[622,618],[664,583],[700,540],[733,498],[776,461],[822,435],[866,417],[902,420]],radius:4},
  {id:'south-perimeter',name:'외곽 벽',points:[[408,648],[471,690],[553,724],[665,737],[816,739],[944,722],[1090,590]],radius:3},
];
export const SURFACE_POLYGONS={
  A:[[494,171],[699,276],[448,446],[420,472],[373,485],[328,491],[279,480],[234,460],[196,431],[165,405],[158,382]],
  B:[[943,414],[1016,450],[1119,516],[1066,592],[950,701],[830,711],[728,669],[688,618],[721,552],[776,488],[841,447],[901,434]],
  C:[[439,477],[502,452],[560,474],[645,512],[683,521],[651,573],[610,608],[560,625],[485,603],[423,554],[400,511]],
  D:[[444,221],[495,221],[551,241],[589,269],[580,298],[542,320],[492,311],[449,292],[420,267]],
  E:[[305,318],[351,334],[398,362],[434,391],[389,424],[341,451],[295,445],[253,425],[219,395],[218,373],[250,345]],
};
export function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
export function surfaceAtPhoto(u,v){for(const id of ['D','E','A','C','B'])if(pointInPolygon([u,v],SURFACE_POLYGONS[id]))return id;return 'road';}
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsIntersect(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return ((o1>0)!==(o2>0))&&((o3>0)!==(o4>0));}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function segmentDistance(a,b,c,d){if(segmentsIntersect(a,b,c,d))return 0;return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));}
export function footprint(x,z,yaw,margin=.07){const cs=Math.cos(yaw),sn=Math.sin(yaw);return [[-1.34-margin,-1.72-margin],[1.34+margin,-1.72-margin],[1.34+margin,2.57+margin],[-1.34-margin,2.57+margin]].map(([side,fore])=>worldToPhoto(x+cs*side+sn*fore,z-sn*side+cs*fore));}
export function checkVehiclePose(x,z,yaw){
  const hull=footprint(x,z,yaw);
  if(hull.some(p=>!pointInPolygon(p,SITE_BOUNDARY)))return {id:'site-boundary',name:'시험장 경계 / 수목'};
  for(const obstacle of BLOCKED_POLYGONS){
    if(hull.some(p=>pointInPolygon(p,obstacle.points))||obstacle.points.some(p=>pointInPolygon(p,hull)))return obstacle;
    for(let i=0;i<4;i++)for(let j=0;j<obstacle.points.length;j++)if(segmentDistance(hull[i],hull[(i+1)%4],obstacle.points[j],obstacle.points[(j+1)%obstacle.points.length])<obstacle.margin)return obstacle;
  }
  for(const wall of WALLS)for(let j=1;j<wall.points.length;j++){
    if(pointInPolygon(wall.points[j],hull))return wall;
    for(let i=0;i<4;i++)if(segmentDistance(hull[i],hull[(i+1)%4],wall.points[j-1],wall.points[j])<wall.radius)return wall;
  }
  return null;
}
export const MAP_LABELS=[
  {id:'A',name:'순환 주행로',p:[647,287]}, {id:'B',name:'대형 선회',p:[878,562]}, {id:'C',name:'소형 선회',p:[550,539]},
  {id:'D',name:'습지 · 자갈',p:[500,266]}, {id:'E',name:'요철 시험',p:[322,385]},
  {name:'차고지',p:[966,146],building:true},{name:'사무실',p:[719,326],building:true},{name:'E 진입로',p:[251,279],gate:true},
];
