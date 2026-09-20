import type {VehicleDefinition} from '../core/types';

export type BodyStation=[number,number,number,number];
type Design={cabin:[number,number,number,number,number];widths:number[];shoulders:number[];centres:number[];grille:number;lamp:'compact'|'blade'|'rally'|'tourer'|'race'};
/** Original design language, not a scaled copy of one body. Cabin values are
 * rear glass base / rear roof / front roof / windscreen base / roof half-width ratio. */
const designs:Record<string,Design>={
  aeris:{cabin:[-1.39,-.69,.35,.87,.67],widths:[.87,.96,1,.96,.95,.97,.91,.82],shoulders:[.23,.29,.30,.26,.23,.25,.15,.025],centres:[.25,.27,.26,.24,.21,.18,.12,.055],grille:.40,lamp:'compact'},
  velara:{cabin:[-1.44,-.81,.08,.86,.59],widths:[.81,.98,1.02,.90,.91,1.015,.96,.77],shoulders:[.20,.26,.34,.23,.21,.31,.17,-.005],centres:[.21,.24,.25,.20,.18,.105,.07,.015],grille:.55,lamp:'blade'},
  crest:{cabin:[-1.58,-.95,.35,1.02,.69],widths:[.90,.98,1.01,.97,.97,1.01,.95,.87],shoulders:[.28,.32,.33,.30,.27,.29,.21,.12],centres:[.29,.31,.30,.29,.27,.245,.19,.145],grille:.43,lamp:'rally'},
  nova:{cabin:[-1.70,-.94,.04,.86,.61],widths:[.85,.96,1,.96,.95,1,.95,.87],shoulders:[.24,.30,.32,.28,.25,.29,.20,.07],centres:[.26,.29,.28,.25,.22,.20,.14,.10],grille:.53,lamp:'tourer'},
  gtx:{cabin:[-1.23,-.67,.32,1.03,.60],widths:[.95,1.01,1.04,.93,.92,1.04,1,.88],shoulders:[.21,.28,.34,.22,.18,.30,.13,-.02],centres:[.22,.24,.24,.19,.15,.07,.025,.015],grille:.63,lamp:'race'},
};
export function roadDesign(d:VehicleDefinition){
  const style=designs[d.id]??designs.velara,L=d.length/2,W=d.width/2;
  const z=[-L,-L+.24,-d.wheelbase/2,-.60,.20,d.wheelbase/2,L-.35,L];
  const stations:BodyStation[]=z.map((p,i)=>[p,W*style.widths[i],style.shoulders[i],style.centres[i]]);
  return {...style,stations};
}
