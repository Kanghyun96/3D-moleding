import { EQUIPMENTS } from './parking-config.js';
import { createGLBEquipment, computeTrackLoop } from './dx55-model.js';

const t870Loop = computeTrackLoop({
  zFront: EQUIPMENTS['bobcat-t870'].zFront,
  zRear: EQUIPMENTS['bobcat-t870'].zRear,
  rTrack: EQUIPMENTS['bobcat-t870'].rTrack,
});
export const TRACK_LENGTH = t870Loop.trackLength;

export function createCTL({ glbUrl } = {}) {
  return createGLBEquipment(EQUIPMENTS['bobcat-t870'], { glbUrl });
}
