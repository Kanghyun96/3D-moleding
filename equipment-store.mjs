import { readFile, writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EQUIPMENT_SCHEMA_VERSION, initialEquipment, applyEquipmentPatch } from './field-simulation/equipment-schema.js';
export function createEquipmentStore(file){
  let queue=Promise.resolve();
  async function load(){
    let data;
    try{data=JSON.parse(await readFile(file,'utf8'));}
    catch(error){if(error.code==='ENOENT')return{schemaVersion:EQUIPMENT_SCHEMA_VERSION,equipment:{'bobcat-t870':initialEquipment('bobcat-t870'),'dx-55':initialEquipment('dx-55')}};throw new Error('저장된 시험 정보를 읽지 못했습니다.');}
    if(!data||data.schemaVersion!==EQUIPMENT_SCHEMA_VERSION||!data.equipment||typeof data.equipment!=='object'||Array.isArray(data.equipment))throw new Error('지원하지 않는 시험 정보 저장 형식입니다.');
    for(const[id,record]of Object.entries(data.equipment)){
      if(!record||record.id!==id||typeof record.name!=='string'||typeof record.parkingSlotId!=='string'||!Number.isSafeInteger(record.revision)||record.revision<0)throw new Error('저장된 장비 정보가 올바르지 않습니다.');
      applyEquipmentPatch(record,{purpose:record.purpose,testHours:record.testHours,testStatus:record.testStatus,tracks:record.tracks,surfaceHours:record.surfaceHours});
    }
    return data;
  }
  async function persist(data){
    await mkdir(dirname(file),{recursive:true});const temporary=`${file}.${randomUUID()}.tmp`;
    try{await writeFile(temporary,JSON.stringify(data,null,2)+'\n',{encoding:'utf8',flag:'wx'});await rename(temporary,file);}
    catch(error){await unlink(temporary).catch(()=>{});throw error;}
  }
  return {
    async list(){await queue;return Object.values((await load()).equipment);},
    async get(id){await queue;const data=await load();const record=Object.hasOwn(data.equipment,id)?data.equipment[id]:null;if(!record)throw Object.assign(new Error('장비 정보를 찾을 수 없습니다.'),{status:404});return structuredClone(record);},
    patch(id,patch,revision){
      const operation=queue.then(async()=>{
        const data=await load(),record=Object.hasOwn(data.equipment,id)?data.equipment[id]:null;
        if(!record)throw Object.assign(new Error('장비 정보를 찾을 수 없습니다.'),{status:404});
        if(!Number.isSafeInteger(revision)||revision!==record.revision)throw Object.assign(new Error('다른 화면에서 정보가 변경됐습니다. 다시 불러온 뒤 저장해 주세요.'),{status:409});
        const next=applyEquipmentPatch(record,patch);next.revision=record.revision+1;next.updatedAt=new Date().toISOString();
        data.equipment[id]=next;await persist(data);return structuredClone(next);
      });queue=operation.catch(()=>{});return operation;
    },
  };
}
