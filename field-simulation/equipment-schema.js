import { DEFAULT_EQUIPMENT } from './parking-config.js';
export const EQUIPMENT_SCHEMA_VERSION=1;
export const SURFACE_NAMES=Object.freeze({A:'윗 흙 노면',B:'아래 흙 노면',C:'중간 흙 노면',D:'습전 노면',E:'자갈노면',F:'콘크리트 왕복로'});
export function initialEquipment(){return {...DEFAULT_EQUIPMENT,purpose:'',testHours:0,testStatus:'waiting',tracks:{left:'',right:''},surfaceHours:{general:0,gravel:0,concrete:0},revision:0,updatedAt:null};}
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function text(value,max,label){if(typeof value!=='string'||value.length>max)fail(`${label}: ${max}자 이내로 입력해 주세요.`);return value.trim();}
function hours(value){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e7)fail('시간은 0 이상의 숫자로 입력해 주세요.');return value;}
function keys(value,allowed){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('지원하지 않는 시험 정보입니다.');}
export function applyEquipmentPatch(record,patch){
  keys(patch,['purpose','testHours','testStatus','tracks','surfaceHours']);const next=structuredClone(record);
  if('purpose'in patch)next.purpose=text(patch.purpose,1200,'시험 목적');
  if('testHours'in patch)next.testHours=hours(patch.testHours);
  if('testStatus'in patch){if(!['waiting','running'].includes(patch.testStatus))fail('시험 상태를 확인해 주세요.');next.testStatus=patch.testStatus;}
  if('tracks'in patch){keys(patch.tracks,['left','right']);for(const key of Object.keys(patch.tracks))next.tracks[key]=text(patch.tracks[key],240,'트랙 정보');}
  if('surfaceHours'in patch){keys(patch.surfaceHours,['general','gravel','concrete']);for(const key of Object.keys(patch.surfaceHours))next.surfaceHours[key]=hours(patch.surfaceHours[key]);}
  return next;
}
