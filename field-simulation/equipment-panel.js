import { DEFAULT_EQUIPMENT_ID, EQUIPMENTS } from './parking-config.js';
import { createEquipmentRepository } from './equipment-client.js';

export function createEquipmentPanel({equipmentId=DEFAULT_EQUIPMENT_ID,onChooseRoute,onEquipmentChange=()=>{},onVisibilityChange=()=>{},repository=createEquipmentRepository({base:window.TrackVisionConfig?.equipmentApiBase||'/api/equipment'})}){
  const $=id=>document.getElementById(id),root=$('equipment-panel'),form=$('equipment-form');
  const selector=$('equipment-select');
  const typeLabel=$('equipment-type-label');
  const fields={purpose:$('test-purpose'),testHours:$('test-hours'),left:$('track-left'),right:$('track-right'),general:$('hours-general'),gravel:$('hours-gravel'),concrete:$('hours-concrete'),status:$('test-status')};
  let currentId=equipmentId;
  let record=null,loaded=false,saving=null,timer=null,version=0,savedVersion=0,choosing=false,saveState='loading';
  function status(message,state){$('save-status').textContent=message;$('save-status').dataset.state=state;saveState=state;}
  const format=value=>Number(value||0).toLocaleString('ko-KR',{maximumFractionDigits:3});
  function summaries(){
    $('purpose-summary').textContent=fields.purpose.value.trim()||'미입력';
    $('hours-summary').textContent=`${format(fields.testHours.value)} hrs`;
    $('tracks-summary').textContent=fields.left.value||fields.right.value?'좌·우 트랙 입력됨':'좌측 · 우측';
    fields.status.dataset.running=String(fields.status.value==='running');
  }
  function populate(value){
    if(selector)selector.value=value.id;
    if(typeLabel)typeLabel.textContent=EQUIPMENTS?.[value.id]?.type||(value.id==='dx-55'?'COMPACT EXCAVATOR':'COMPACT TRACK LOADER');
    $('equipment-name').textContent=value.name;fields.purpose.value=value.purpose;fields.testHours.value=value.testHours;
    fields.left.value=value.tracks.left;fields.right.value=value.tracks.right;
    for(const key of ['general','gravel','concrete'])fields[key].value=value.surfaceHours[key];
    fields.status.value=value.testStatus;summaries();
  }
  function draft(){return {purpose:fields.purpose.value,testHours:fields.testHours.valueAsNumber,testStatus:fields.status.value,tracks:{left:fields.left.value,right:fields.right.value},surfaceHours:{general:fields.general.valueAsNumber,gravel:fields.gravel.valueAsNumber,concrete:fields.concrete.valueAsNumber}};}
  function valid(){return form.checkValidity()&&Object.values(draft().surfaceHours).every(Number.isFinite)&&Number.isFinite(draft().testHours);}
  async function save(){
    clearTimeout(timer);
    if(saving){await saving;if(version>savedVersion)return save();return true;}
    if(!loaded)return false;
    if(version===savedVersion)return true;
    if(!valid()){status('입력한 시간 값을 확인해 주세요.','error');return false;}
    const sentVersion=version,patch=draft();status('저장 중…','saving');
    const operation=(async()=>{
      try{record=await repository.save(currentId,patch,record.revision);savedVersion=sentVersion;$('reload-info').hidden=true;status(version===savedVersion?'저장됨':'변경사항 저장 중…',version===savedVersion?'saved':'saving');return true;}
      catch(error){status(error.message||'저장하지 못했습니다. 다시 시도해 주세요.','error');$('reload-info').hidden=error.status!==409;return false;}
    })();saving=operation;const ok=await operation;saving=null;
    if(ok&&version>savedVersion)return save();return ok;
  }
  function edited(){if(!loaded)return;version++;summaries();status('변경사항 저장 대기','dirty');clearTimeout(timer);timer=setTimeout(()=>void save(),500);}
  async function load(targetId=currentId){
    if(saving)await saving;clearTimeout(timer);status('정보를 불러오는 중…','loading');
    try{record=await repository.load(targetId);currentId=targetId;populate(record);loaded=true;version=savedVersion=0;$('equipment-fields').disabled=false;fields.status.disabled=false;$('save-info').disabled=false;$('reload-info').hidden=true;status(record.updatedAt?'저장된 정보 불러옴':'입력 후 자동 저장','saved');}
    catch(error){status(error.message||'시험 정보를 불러오지 못했습니다.','error');$('reload-info').hidden=false;}
  }
  async function setEquipment(id){
    if(!id||id===currentId)return;
    if(version>savedVersion)await save();
    await load(id);
    onEquipmentChange(id);
  }
  if(selector){
    selector.addEventListener('change',e=>void setEquipment(e.target.value));
  }
  function choose(value){choosing=!!value;$('route-picker').hidden=!choosing;$('drive').setAttribute('aria-expanded',String(choosing));}
  function open(targetId){if(targetId&&targetId!==currentId)setEquipment(targetId);root.hidden=false;$('equipment-open').setAttribute('aria-expanded','true');$('map-hint').hidden=true;onVisibilityChange(true);}
  async function close(){if(version>savedVersion&&!(await save()))return;choose(false);root.hidden=true;$('equipment-open').setAttribute('aria-expanded','false');onVisibilityChange(false);$('equipment-open').focus({preventScroll:true});}
  form.addEventListener('input',edited);fields.status.addEventListener('change',edited);
  form.addEventListener('submit',event=>{event.preventDefault();void save();});
  $('reload-info').onclick=()=>void load(currentId);$('equipment-close').onclick=()=>void close();$('equipment-open').onclick=()=>open();
  $('drive').onclick=()=>{choose(!choosing);if(choosing)$('route-picker').scrollIntoView({block:'nearest'});};
  $('route-cancel').onclick=()=>choose(false);
  document.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>selectRoute(button.dataset.route)));
  function selectRoute(id){onChooseRoute(id,currentId);choose(false);}
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden){if(choosing)choose(false);else void close();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&version>savedVersion)void save();});
  const ready=load(currentId);
  return {open,close,save,ready,selectRoute,setEquipment,get currentEquipmentId(){return currentId;},get choosing(){return choosing;},get visible(){return !root.hidden;},getRecord:()=>record?structuredClone(record):null,snapshot:()=>({loaded,equipmentId:currentId,saveState,dirty:version>savedVersion,visible:!root.hidden,choosing})};
}
