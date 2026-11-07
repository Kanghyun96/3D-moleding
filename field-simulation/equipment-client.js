export function createEquipmentRepository({base='/api/equipment',fetcher=(...args)=>fetch(...args)}={}){
  async function request(id,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetcher(`${base.replace(/\/$/,'')}/${encodeURIComponent(id)}`,{cache:'no-store',...options,signal:controller.signal});
      let value;try{value=await response.json();}catch{throw new Error('시험 정보 저장 서버에 연결되지 않았습니다.');}
      if(!response.ok)throw Object.assign(new Error(value.error||'시험 정보를 저장하지 못했습니다.'),{status:response.status});
      return value;
    }catch(error){if(error.name==='AbortError')throw new Error('저장 서버 응답이 늦습니다. 다시 시도해 주세요.');if(error instanceof TypeError&&!error.status)throw new Error('저장 서버에 연결하지 못했습니다. 다시 시도해 주세요.');throw error;}
    finally{clearTimeout(timeout);}
  }
  return {load:id=>request(id),save:(id,patch,revision)=>request(id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({patch,revision})})};
}
