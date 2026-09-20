/** Authored roadside planting corridors. Distances are metres; individual
 * plants are deterministic variations around these groups, not a uniform lawn. */
export const RURAL_CORRIDORS=[
  {road:'lakeshore',seed:101,spacing:125,setback:37,radius:27,trees:7,shrubs:7},
  {road:'forest',seed:211,spacing:90,setback:48,radius:43,trees:21,shrubs:16},
  {road:'pass',seed:307,spacing:130,setback:34,radius:25,trees:7,shrubs:5},
  {road:'south',seed:401,spacing:165,setback:42,radius:30,trees:5,shrubs:5},
  {road:'ring',seed:503,spacing:180,setback:48,radius:33,trees:5,shrubs:4},
  {road:'northbridge',seed:601,spacing:145,setback:37,radius:26,trees:6,shrubs:6},
] as const;
