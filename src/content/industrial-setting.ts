/** Road-relative industrial compounds. Progress is a fraction of Foundry
 * Avenue; offsets keep each compound beyond the public road shoulder. */
export const INDUSTRIAL_SITE_DEFINITIONS=[
  {id:'redwood-freight',at:.15,offset:72,yaw:.04,kind:'containers',seed:2101},
  {id:'foundry-tanks',at:.34,offset:-76,yaw:-.08,kind:'tanks',seed:2102},
  {id:'harbor-logistics',at:.64,offset:74,yaw:.10,kind:'containers',seed:2103},
  {id:'aurelia-works',at:.76,offset:-80,yaw:-.05,kind:'plant',seed:2104},
] as const;
