import { STREET_LIGHTS, POLE_CLEARANCE } from './site-fixtures.js';
import { PARKING_SLOTS, DEFAULT_PARKING_SLOT } from './parking-config.js';
import { SURFACE_NAMES } from './equipment-schema.js';
import { PHOTO_PROJECTION } from './photo-calibration.js';
// All layout, paths and exclusion zones share the original 1200 × 896 photo.
// The active raster keeps the E-gate image inside A and blends an enlarged outer A lane.
// Frame the field closely on a desktop while leaving the northern and
// southern concrete boundaries, garage, and office visible in overview.
export const PHOTO = Object.freeze({ width:1200, height:896, pixelsPerMeter:8, ...PHOTO_PROJECTION, origin:[600,430], crop:[55,-3,1135,755] });
const sy=Math.sin(PHOTO.yaw),cy=Math.cos(PHOTO.yaw),se=Math.sin(PHOTO.elevation),s=PHOTO.pixelsPerMeter;
export function photoToWorld(p){const r=(p[0]-PHOTO.origin[0])/s,q=(p[1]-PHOTO.origin[1])/(s*se);return [cy*r+sy*q,-sy*r+cy*q];}
export function worldToPhoto(x,z,y=0){return [PHOTO.origin[0]+s*(cy*x-sy*z),PHOTO.origin[1]+s*(se*(sy*x+cy*z)-Math.cos(PHOTO.elevation)*y)];}
const poles=STREET_LIGHTS.map(light=>({...light,world:photoToWorld(light.p)}));

export const HOME_PHOTO=PARKING_SLOTS.find(slot=>slot.id===DEFAULT_PARKING_SLOT).p;
const parkedEquipment=new Map();
export function setParkedEquipment(vehicles=[]){parkedEquipment.clear();for(const vehicle of vehicles)parkedEquipment.set(vehicle.id,{...vehicle});}
export const SITE_BOUNDARY=[[526,17],[692,49],[1154,228],[1160,349],[1093,392],[1099,446],[1175,510],[1117,588],[944,724],[821,739],[664,735],[525,711],[402,642],[298,568],[174,478],[102,426],[58,382],[46,337],[68,285],[155,220],[335,149]];
export const BLOCKED_POLYGONS=[
  {id:'garage',name:'차고지',points:[[677,113],[731,63],[1151,230],[1151,282],[1116,340],[677,166]],margin:2},
  {id:'office',name:'사무실',points:[[660,336],[715,306],[778,331],[780,406],[731,435],[659,395]],margin:3},
  {id:'hut',name:'관리 시설',points:[[1073,511],[1102,491],[1141,516],[1134,551],[1091,569],[1075,545]],margin:2},
];
export const WALLS=[
  // X gate is the outer opening between (238,306) and (291,273).
  {id:'a-northwest',name:'A 외벽',points:[[291,273],[430,183],[472,163],[508,162],[552,175],[685,244],[700,264],[698,284]],radius:3},
  // Aligned to the visible inner top rim of the southern A wall so the track/bucket never clips it visually.
  {id:'a-south',name:'A 외벽',points:[[238,306],[166,352],[146,376],[145,400],[164,424],[208,454],[260,482],[308,502],[348,505],[396,490],[442,458],[684,299],[698,284]],radius:3},
  // Inner concrete curb around D and E; inner entrance right below X gate is between (262,324) and (335,279).
  {id:'a-inner',name:'A 내벽',points:[[335,279],[444,210],[476,202],[512,207],[560,228],[628,262],[641,277],[630,295],[550,349],[450,415],[382,461],[345,473],[302,463],[255,438],[215,412],[203,390],[209,368],[262,324]],radius:2},
  {id:'bc-divider',name:'B/C 분리벽',points:[[528,622],[565,623],[605,610],[642,585],[675,550],[705,512],[740,475],[782,442],[828,418],[868,405],[898,412]],radius:3.5},
  {id:'south-perimeter',name:'외곽 벽',points:[[402,642],[471,690],[553,724],[665,737],[816,739],[944,722],[1090,590]],radius:3},
];
export const SURFACE_POLYGONS={
  A:[[472,163],[508,162],[552,175],[685,244],[700,264],[698,284],[684,303],[442,464],[396,498],[346,515],[302,512],[252,491],[198,461],[154,429],[137,403],[140,378],[162,354],[238,306],[291,273],[430,183]],
  B:[[943,414],[1016,450],[1119,516],[1066,592],[950,701],[830,711],[728,669],[688,618],[721,552],[776,488],[841,447],[901,434]],
  C:[[439,477],[502,452],[560,474],[645,512],[683,521],[651,573],[610,608],[560,625],[485,603],[423,554],[400,511]],
  D:[[380,275],[444,215],[495,210],[560,232],[632,268],[625,295],[545,345],[465,355],[380,315]],
  E:[[275,325],[335,335],[420,385],[445,412],[382,458],[345,470],[300,460],[255,435],[215,410],[206,388],[212,368]],
  F:[[337,171],[300,192],[240,235],[186,270],[139,307],[99,346],[84,375],[85,400],[103,430],[145,471],[197,510],[251,550],[310,590],[370,629],[411,635],[421,601],[392,588],[347,555],[291,514],[235,474],[184,435],[148,402],[136,381],[146,360],[186,329],[232,295],[276,262],[316,233],[366,207]],
};
export function pointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
export function surfaceAtPhoto(u,v){for(const id of ['D','E','A','C','B','F'])if(pointInPolygon([u,v],SURFACE_POLYGONS[id]))return id;return 'road';}
function orient(a,b,c){return(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function segmentsIntersect(a,b,c,d){const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);return ((o1>0)!==(o2>0))&&((o3>0)!==(o4>0));}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
function segmentDistance(a,b,c,d){if(segmentsIntersect(a,b,c,d))return 0;return Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));}
export function footprint(x,z,yaw,margin=.07){const cs=Math.cos(yaw),sn=Math.sin(yaw);return [[-1.34-margin,-1.72-margin],[1.34+margin,-1.72-margin],[1.34+margin,2.57+margin],[-1.34-margin,2.57+margin]].map(([side,fore])=>worldToPhoto(x+cs*side+sn*fore,z-sn*side+cs*fore));}
export function checkVehiclePose(x,z,yaw,ignoreEquipmentId=null){
  const hull=footprint(x,z,yaw);
  if(hull.some(p=>!pointInPolygon(p,SITE_BOUNDARY)))return {id:'site-boundary',name:'시험장 경계 / 수목'};
  for(const vehicle of parkedEquipment.values()){
    if(vehicle.id===ignoreEquipmentId)continue;
    const other=footprint(vehicle.x,vehicle.z,vehicle.yaw,.18);
    if(hull.some(p=>pointInPolygon(p,other))||other.some(p=>pointInPolygon(p,hull)))return{id:`equipment:${vehicle.id}`,name:'주차 장비'};
    for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(segmentDistance(hull[i],hull[(i+1)%4],other[j],other[(j+1)%4])<.5)return{id:`equipment:${vehicle.id}`,name:'주차 장비'};
  }
  // Physical distance to the body+bucket rectangle, in metres. This also runs
  // during in-place turns and immediate transfers, not just on route samples.
  const cs=Math.cos(yaw),sn=Math.sin(yaw);
  for(const pole of poles){
    const dx=pole.world[0]-x,dz=pole.world[1]-z,side=cs*dx-sn*dz,fore=sn*dx+cs*dz;
    const gap=Math.hypot(Math.max(0,Math.abs(side)-1.41),Math.max(0,-1.79-fore,fore-2.64));
    if(gap<POLE_CLEARANCE)return {id:`street-light:${pole.id}`,name:'가로등 기둥'};
  }
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
  {id:'A',name:SURFACE_NAMES.A,p:[660,287]}, {id:'B',name:SURFACE_NAMES.B,p:[878,562]}, {id:'C',name:SURFACE_NAMES.C,p:[550,539]},
  {id:'D',name:SURFACE_NAMES.D,p:[500,266]}, {id:'E',name:SURFACE_NAMES.E,p:[322,385]},
  {id:'F',name:SURFACE_NAMES.F,p:[316,225]},
  {name:'P',p:[548,52],parking:true},
  {name:'차고지',p:[966,146],building:true},{name:'사무실',p:[719,326],building:true},
];
