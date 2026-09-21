import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const output='output/map-filters';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],external=[],failed=[];
page.on('pageerror',error=>errors.push(String(error)));
page.on('response',response=>{if(response.status()>=400)failed.push({url:response.url(),status:response.status()});});
await context.route('**/*',route=>{const url=route.request().url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1'){external.push(url);return route.abort();}return route.continue();});
await page.goto('http://127.0.0.1:5187/?renderer=webgl');
await page.waitForFunction(()=>window.kairos?.ui,{timeout:60000});
await page.click('[data-action="screen"][data-value="map"]');
await page.waitForSelector('.map-filters');

const expected={
  all:['home','handling','aster','westbrook','summitservice','vista','lakeside','pines','speed1','speed2','speed3','speed4','trial1','trial2','trial3','drift1','drift2'],
  activities:['speed1','speed2','speed3','speed4','trial1','trial2','trial3','drift1','drift2'],
  scenic:['vista','lakeside','pines'],
  services:['home','westbrook','summitservice'],
  motorsport:['aster']
};
const report={filters:{},route:{},keyboard:{},errors,external,failed};
const markerIds=()=>page.locator('.map-container .map-marker').evaluateAll(nodes=>nodes.map(node=>node.dataset.value));
for(const [filter,ids] of Object.entries(expected)){
  await page.click(`[data-action="map-filter"][data-value="${filter}"]`);
  const visible=await markerIds();
  assert.deepEqual(new Set(visible),new Set(ids));
  assert.equal(await page.locator(`[data-action="map-filter"][data-value="${filter}"]`).getAttribute('aria-pressed'),'true');
  assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).mapFilter,filter);
  report.filters[filter]=visible;
  if(['all','activities','services'].includes(filter))await page.screenshot({path:`${output}/${filter}.png`});
}

const scenicButton=page.locator('[data-action="map-filter"][data-value="scenic"]');
await scenicButton.focus();await page.keyboard.press('Enter');
assert.equal(JSON.parse(await page.evaluate(()=>window.render_game_to_text())).mapFilter,'scenic');
assert.equal(await scenicButton.getAttribute('aria-pressed'),'true');
report.keyboard={filter:'scenic',activeElement:await page.evaluate(()=>document.activeElement?.getAttribute('data-value'))};

await page.click('[data-action="map-filter"][data-value="activities"]');
await page.locator('[data-action="map-select"][data-value="speed1"]').click();
await page.click('[data-action="navigate"][data-value="speed1"]');
const before=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
assert.equal(before.destination,'speed1');assert.ok(before.routePoints>0);
await page.click('[data-action="map-filter"][data-value="services"]');
const activeRouteIds=await markerIds(),after=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
assert.deepEqual(new Set(activeRouteIds),new Set([...expected.services,'speed1']));
assert.equal(after.destination,'speed1');assert.equal(after.mapFilter,'services');assert.ok(after.routePoints>0);
assert.equal(await page.locator('[data-action="map-select"][data-value="speed1"].chosen').count(),1);
report.route={before:{destination:before.destination,routePoints:before.routePoints},after:{destination:after.destination,routePoints:after.routePoints,visible:activeRouteIds}};
await page.screenshot({path:`${output}/services-active-route.png`});

await page.click('[data-action="screen"][data-value="home"]');
await page.click('#start-drive');await page.waitForSelector('#speed');
await page.keyboard.press('KeyM');await page.waitForSelector('.map-filters');
const resumed=JSON.parse(await page.evaluate(()=>window.render_game_to_text()));
assert.equal(resumed.screen,'map');assert.equal(resumed.mapFilter,'services');assert.equal(resumed.destination,'speed1');assert.ok(resumed.routePoints>0);
report.route.resumed={screen:resumed.screen,filter:resumed.mapFilter,destination:resumed.destination,routePoints:resumed.routePoints};
const cleared=await page.evaluate(()=>{const g=window.kairos;g.destination=null;g.route=[];g.setScreen('drive');g.setScreen('map');return {selection:g.mapSelection,state:g.snapshot()};});
assert.ok(expected.services.includes(cleared.selection));assert.equal(cleared.state.destination,null);assert.equal(cleared.state.routePoints,0);
assert.deepEqual(new Set(await markerIds()),new Set(expected.services));
report.route.cleared={selection:cleared.selection,destination:cleared.state.destination,routePoints:cleared.state.routePoints};
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(external,[]);
await fs.writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log('Map filter checks passed');
