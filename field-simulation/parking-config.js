import { PERIMETER_FORWARD, PERIMETER_ROW } from './photo-calibration.js';
export const DEFAULT_EQUIPMENT_ID='bobcat-t870';
export const DEFAULT_PARKING_SLOT='P03';
// The two directions come from the actual perimeter, not an estimated rotation.
export const PARKING_DIRECTION=PERIMETER_FORWARD;
export const PARKING_AREA=[[432,133],[585,24],[650,68],[484,175]];
export const PARKING_BAY={width:3.5,rear:-2.35,front:3.05,paintWidth:.09};
// Physical order is top-first. Keep P03's stable ID so existing saved equipment
// information still refers to the same assigned slot. IDs are never painted.
export const PARKING_SLOTS=['P03','P01','P02','P04','P05','P06','P07'].map((id,index)=>Object.freeze({
  id,p:[610-index*24,61+index*24*PERIMETER_ROW[1]/-PERIMETER_ROW[0]],direction:PARKING_DIRECTION,
}));
export const DEFAULT_EQUIPMENT=Object.freeze({id:DEFAULT_EQUIPMENT_ID,name:'Bobcat T-870',parkingSlotId:DEFAULT_PARKING_SLOT});
