import {devices as electromagnetic} from './electromagnetic.mjs';
import {devices as electricalMechanical} from './electrical-mechanical.mjs';
import {devices as fluids} from './fluids.mjs';
import {withStudyViews} from './study-views.mjs';
export const devices=[...electromagnetic,...electricalMechanical,...fluids].map(withStudyViews);
export const findDevice=id=>devices.find(d=>d.id===id);
