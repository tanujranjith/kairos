import type {Landmark,SaveGame} from '../core/types';
import {formatTime} from '../core/math';

export type MapFilter='all'|'activities'|'scenic'|'services'|'motorsport';
export const MAP_FILTERS:MapFilter[]=['all','activities','scenic','services','motorsport'];

export function landmarkMatchesMapFilter(landmark:Landmark,filter:MapFilter){
  if(filter==='all')return true;
  if(filter==='activities')return ['speed','trial','drift'].includes(landmark.type);
  if(filter==='services')return ['garage','service'].includes(landmark.type);
  if(filter==='motorsport')return landmark.type==='circuit';
  return landmark.type==='scenic';
}

export interface SpeedTrapResult {
  speedKph:number;
  bestKph:number;
  personalBest:boolean;
  targetReached:boolean;
}

export interface ActivityState {
  name:string;
  id:string;
  type:Landmark['type'];
  time:number;
  score:number;
  started:boolean;
}

export function evaluateSpeedTrap(previousBest:number|undefined,speedMps:number,targetKph:number):SpeedTrapResult {
  const speedKph=Math.abs(speedMps)*3.6,oldBest=previousBest??0;
  return {speedKph,bestKph:Math.max(oldBest,speedKph),personalBest:speedKph>oldBest,targetReached:speedKph>=targetKph};
}

export function activityRecordText(landmark:Landmark,save:SaveGame){
  if(landmark.type==='scenic')return save.visits.includes(landmark.id)?'DISCOVERED':'NOT YET DISCOVERED';
  if(!['speed','trial','drift'].includes(landmark.type))return '';
  const record=save.records[landmark.id];
  if(record===undefined)return 'NO PERSONAL BEST';
  if(landmark.type==='speed')return `PERSONAL BEST · ${Math.round(record)} KM/H`;
  if(landmark.type==='trial')return `PERSONAL BEST · ${formatTime(record)}`;
  if(landmark.type==='drift')return `PERSONAL BEST · ${Math.round(record)} PTS`;
  return '';
}
