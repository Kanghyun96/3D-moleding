// Until the site's coordinates are supplied, these are explicit Seoul CLOCK
// times, not calculated sunrise/sunset. Simulation playback never enters here.
export const DAYLIGHT_SCHEDULE = Object.freeze({timeZone:'Asia/Seoul',dawnStart:6,dawnEnd:7,duskStart:18,duskEnd:19});
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:DAYLIGHT_SCHEDULE.timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function daylightAt(date=new Date()){
  if(!Number.isFinite(date.getTime()))throw new TypeError('Invalid lighting time');
  const parts=Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
  const hour=parts.hour+parts.minute/60+parts.second/3600;
  const s=DAYLIGHT_SCHEDULE;
  const day=hour<s.dawnEnd?smooth((hour-s.dawnStart)/(s.dawnEnd-s.dawnStart))
    :1-smooth((hour-s.duskStart)/(s.duskEnd-s.duskStart));
  return {day,night:1-day,hour,label:day>=.99?'낮':day<=.01?'밤':hour<12?'새벽':'해질녘',timeZone:s.timeZone,
    clock:`${String(parts.hour).padStart(2,'0')}:${String(parts.minute).padStart(2,'0')}`};
}
export class SiteClock {
  constructor(now=()=>new Date()){this.now=now;this.preview=null;}
  setPreview(mode){
    if(!['live','day','dusk','night'].includes(mode))throw new RangeError('Unknown lighting mode');
    this.preview=mode==='live'?null:mode;
  }
  sample(){
    const live=this.now(),hours={day:12,dusk:18.5,night:22};
    // Presets are local inspection tools; normal startup always uses real time.
    const state=this.preview?daylightAt(new Date(`2026-11-07T${this.preview==='dusk'?'18:30':`${hours[this.preview]}:00`}:00+09:00`)):daylightAt(live);
    return {...state,mode:this.preview||'live',preview:!!this.preview};
  }
}
