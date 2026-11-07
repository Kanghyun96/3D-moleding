import { writeFile } from 'node:fs/promises';
import { verify } from './verify.js';
import { verifyPhase3 } from './phase3-verify.js';
import { verifyConcrete } from './concrete-verify.js';
import { verifyEquipment } from './equipment-verify.mjs';
import { verifyEquipmentPanel } from './equipment-panel-verify.mjs';

const motion=verify();
const phase3=verifyPhase3();
const concrete=verifyConcrete();
const equipment=await verifyEquipment();
const panel=await verifyEquipmentPanel();
await writeFile(new URL('./results.json',import.meta.url),JSON.stringify(motion,null,2)+'\n');
await writeFile(new URL('./phase3-results.json',import.meta.url),JSON.stringify({verifiedAt:new Date().toISOString(),...phase3,
  browserVisualReview:'pending: Computer Use stopped because the current browser URL could not be verified',
  browserPerformanceReview:'pending',
},null,2)+'\n');
await writeFile(new URL('./concrete-results.json',import.meta.url),JSON.stringify(concrete,null,2)+'\n');
await writeFile(new URL('./equipment-results.json',import.meta.url),JSON.stringify({verifiedAt:new Date().toISOString(),storage:equipment,panel,browserLayoutReview:'pending: browser URL validation unavailable'},null,2)+'\n');
console.log(JSON.stringify({passed:true,pathSamples:motion.pathSamples,motionSteps:motion.motionSteps,transfers:motion.transfers,phase3Cases:phase3.cases.length,concreteCases:concrete.caseGroups,storageCases:equipment.cases.length,panelCases:panel.cases.length,streetLights:phase3.streetLights}));
