// Run against the dev server: pure DOM fixtures plus the actual integrated application navigator.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.KAIROS_URL ?? 'http://127.0.0.1:5187';
const output = process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/controller-navigation';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage(), errors = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
const capture = async name => {
  await page.evaluate(async () => { if (window.kairos) { await window.kairos.renderer.scene.whenReadyAsync(); window.kairos.advanceTime(0); } });
  await page.screenshot({ path: `${output}/${name}.png` });
};
try {
  await page.route('**/__controller_verify', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><title>Controller verification</title><style>
    body{font:18px sans-serif;background:#172831;color:white;padding:40px}#root{display:flex;flex-direction:column;gap:16px;width:420px}button,select{padding:12px}svg{width:400px;height:100px}input[type=range]{width:300px}
    </style></head><body><h1>Controller navigation verification</h1><div id="root"></div><button id="external">External dialog control</button></body></html>` }));
  await page.goto(`${base}/__controller_verify`);
  await page.evaluate(async () => {
    const { ControllerMenuNavigator } = await import('/src/ui/controller-navigation.ts');
    const root = document.querySelector('#root');
    let active = true, screen = 'fixture', now = 0;
    const log = { clicks: [], changes: [], inputs: [], back: 0 };
    const html = `<button id="first">First</button><button disabled id="disabled">Disabled</button>
      <div hidden><button id="hidden">Hidden ancestor</button></div><div style="opacity:0"><button>Transparent ancestor</button></div>
      <fieldset disabled><button>Disabled fieldset</button></fieldset><div inert><button>Inert</button></div>
      <button aria-disabled="true">ARIA disabled</button><button style="visibility:hidden">Invisible</button>
      <select data-race="kind"><option value="one">One</option><option disabled>Disabled</option><optgroup disabled><option>Disabled group</option></optgroup><option hidden>Hidden</option><option value="two">Two</option><option value="three">Three</option></select>
      <input type="range" data-custom="bias" min="0.45" max="0.72" step="0.01" value="0.60">
      <input type="checkbox" data-setting="abs"><svg viewBox="0 0 400 100"><g role="button" tabindex="0" data-action="map-select" data-value="vista"><circle cx="40" cy="40" r="15" fill="#9dcced"/><text x="70" y="45" fill="white">Vista marker</text></g><g role="button" tabindex="-1" id="minimap"><circle cx="200" cy="40" r="15"/></g></svg><button id="last">Last</button>`;
    root.innerHTML = html;
    root.addEventListener('click', event => log.clicks.push(event.target.closest('button,[role="button"],input')?.id || event.target.closest('[data-value]')?.dataset.value || event.target.type));
    root.addEventListener('input', event => log.inputs.push(event.target.value));
    root.addEventListener('change', event => {
      const key = event.target.dataset.race ?? event.target.dataset.custom ?? event.target.dataset.setting;
      log.changes.push({ key, value: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
      if (key === 'kind' || key === 'bias') root.innerHTML = root.innerHTML; // Deliberately destroy focused nodes.
    });
    const nav = new ControllerMenuNavigator(root, { isActive: () => active, context: () => screen, onBack: () => log.back++ });
    const pad = (buttons = [], axes = [0, 0], id = 'virtual-pad') => ({ connected: true, index: 0, id, axes,
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), touched: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) });
    const tick = (buttons = [], elapsed = 130, axes = [0, 0]) => { now += elapsed; nav.update(now, pad(buttons, axes)); };
    const tap = button => { tick(); tick([button]); tick(); };
    window.verifyMenu = { nav, log, root, tick, tap, pad,
      setActive: value => { active = value; nav.refresh(); },
      setScreen: value => { screen = value; nav.refresh(); },
      reset: () => { root.innerHTML = html; nav.refresh(); },
      focus: selector => root.querySelector(selector).focus() };
    tick([0, 13]); tick([0, 13], 1000);
  });
  assert.equal(await page.evaluate(() => verifyMenu.log.clicks.length), 0);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BODY');
  checks.push('held confirm/D-pad on connect are suppressed');

  await page.evaluate(() => verifyMenu.tap(0));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
  assert.equal(await page.evaluate(() => verifyMenu.log.clicks.length), 0);
  await page.evaluate(() => verifyMenu.tap(0));
  assert.deepEqual(await page.evaluate(() => verifyMenu.log.clicks), ['first']);
  checks.push('first confirm establishes focus; second activates exactly once');

  await page.evaluate(() => verifyMenu.tap(13));
  assert.equal(await page.evaluate(() => document.activeElement.dataset.race), 'kind');
  await page.evaluate(() => verifyMenu.tap(15));
  assert.deepEqual(await page.evaluate(() => verifyMenu.log.changes.at(-1)), { key: 'kind', value: 'two' });
  assert.equal(await page.evaluate(() => document.activeElement.dataset.race), 'kind');
  checks.push('hidden/disabled/inert controls skipped; select skips disabled/hidden options; focus survives rerender');

  await page.evaluate(() => { verifyMenu.tap(13); verifyMenu.tap(15); });
  assert.deepEqual(await page.evaluate(() => verifyMenu.log.changes.at(-1)), { key: 'bias', value: '0.61' });
  assert.equal(await page.evaluate(() => document.activeElement.dataset.custom), 'bias');
  await page.evaluate(() => { const el = document.activeElement; el.value = '.72'; verifyMenu.tap(15); });
  assert.equal(await page.evaluate(() => document.activeElement.value), '0.72');
  checks.push('decimal range step and maximum clamp; range focus survives rerender');

  await page.evaluate(() => { verifyMenu.tap(13); verifyMenu.tap(0); });
  assert.deepEqual(await page.evaluate(() => verifyMenu.log.changes.at(-1)), { key: 'abs', value: true });
  await page.evaluate(() => { verifyMenu.tap(13); verifyMenu.tap(0); });
  assert.equal(await page.evaluate(() => verifyMenu.log.clicks.at(-1)), 'vista');
  await capture('fixture-marker');
  await page.evaluate(() => verifyMenu.tap(13));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
  checks.push('checkbox emits change; SVG marker bubbles click and receives visible focus; minimap excluded');

  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'first');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
  const beforeEnter = await page.evaluate(() => verifyMenu.log.clicks.length);
  await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
  assert.equal(await page.evaluate(() => verifyMenu.log.clicks.length), beforeEnter + 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => verifyMenu.log.back), 1);
  checks.push('Tab wraps, Shift+Tab reverses, held Enter only activates once, Escape calls back');

  await page.evaluate(() => { verifyMenu.focus('[data-setting="abs"]'); });
  const beforeCheckbox = await page.evaluate(() => verifyMenu.log.changes.length);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => verifyMenu.log.changes.length), beforeCheckbox + 1);
  assert.equal(await page.evaluate(() => document.activeElement.checked), false);
  checks.push('keyboard Space toggles checkbox exactly once');

  await page.evaluate(() => {
    verifyMenu.focus('[data-custom="bias"]');
    verifyMenu.root.insertAdjacentHTML('afterbegin', '<button>Inserted control</button>');
    verifyMenu.root.innerHTML = verifyMenu.root.innerHTML;
  });
  assert.equal(await page.evaluate(() => document.activeElement.dataset.custom), 'bias');
  await page.evaluate(() => { document.activeElement.remove(); });
  assert.ok(await page.evaluate(() => verifyMenu.root.contains(document.activeElement)));
  checks.push('mutation observer restores semantic focus after insertion/rerender and falls back after removal');

  await page.evaluate(() => { verifyMenu.setActive(false); });
  await page.keyboard.down('ArrowDown');
  await page.evaluate(() => { verifyMenu.setActive(true); });
  const heldFocus = await page.evaluate(() => document.activeElement.outerHTML);
  await page.keyboard.down('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement.outerHTML), heldFocus);
  await page.keyboard.up('ArrowDown'); await page.keyboard.press('ArrowDown');
  assert.notEqual(await page.evaluate(() => document.activeElement.outerHTML), heldFocus);
  checks.push('held gameplay keyboard direction requires release on menu entry');

  await page.evaluate(() => {
    verifyMenu.focus('#last'); verifyMenu.setScreen('other'); verifyMenu.focus('#first'); verifyMenu.setScreen('fixture');
  });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
  await page.evaluate(() => { document.querySelector('#external').focus(); verifyMenu.tap(0); verifyMenu.tap(13); });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'external');
  await page.evaluate(() => { document.querySelector('#external').blur(); verifyMenu.tick([0]); verifyMenu.tick([0], 1000); });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'last');
  const beforeBlur = await page.evaluate(() => verifyMenu.log.clicks.length);
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); verifyMenu.tick([0]); window.dispatchEvent(new Event('focus')); verifyMenu.tick([0]); });
  assert.equal(await page.evaluate(() => verifyMenu.log.clicks.length), beforeBlur);
  checks.push('external dialogs retain focus; return from dialog or window blur requires fresh input');
  await page.evaluate(() => { verifyMenu.root.innerHTML = '<button disabled>No actions</button>'; verifyMenu.tap(0); verifyMenu.tap(13); });
  checks.push('per-screen focus bookmarks and empty menus');
  await page.evaluate(() => { verifyMenu.reset(); verifyMenu.nav.dispose(); });
  assert.equal(await page.locator('style').count(), 1);
  checks.push('dispose removes helper style and listeners');

  // Verify the actual Interface handlers and snapshots using the application's own navigator.
  await page.goto(`${base}/?renderer=webgl`);
  await page.waitForFunction(() => window.kairos?.ui, null, { timeout: 60000 });
  await page.evaluate(async () => {
    const game = window.kairos;
    game.advanceTime(0);
    const nav = game.menuNavigation;
    let now = 0;
    const tick = (buttons = [], elapsed = 130) => {
      now += elapsed;
      nav.update(now, { connected: true, index: 0, id: 'virtual-pad', axes: [0, 0],
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0, touched: buttons.includes(i) })) });
    };
    const tap = button => { tick(); tick([button]); tick(); };
    const seek = selector => {
      for (let i = 0; i < 120; i++) { if (document.activeElement?.matches(selector)) return; tap(13); }
      throw new Error(`Could not reach ${selector}`);
    };
    window.liveMenu = { nav, tap, tick, seek };
    tick(); seek('[data-action="screen"][data-value="motorsport"]'); tap(0);
    seek('[data-race="entrants"]'); tap(15);
  });
  assert.equal(await page.evaluate(() => window.kairos.raceConfig.entrants), 12);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.race), 'entrants');
  assert.equal(await page.evaluate(() => document.activeElement.value), '12');
  checks.push('actual race configuration changes and retains focus across Interface.render');

  await page.evaluate(() => {
    liveMenu.seek('[data-action="screen"][data-value="settings"]'); liveMenu.tap(0);
    liveMenu.seek('[data-setting="volume"]'); liveMenu.tap(14);
    liveMenu.seek('[data-setting="abs"]'); liveMenu.tap(0);
  });
  assert.equal(await page.evaluate(() => window.kairos.save.settings.volume), 0.5);
  assert.equal(await page.evaluate(() => window.kairos.save.settings.abs), false);
  await capture('settings');
  checks.push('actual settings range and checkbox update game state');

  await page.evaluate(() => {
    liveMenu.seek('[data-action="screen"][data-value="customize"]'); liveMenu.tap(0);
    liveMenu.seek('[data-custom="livery"]'); liveMenu.tap(15);
  });
  assert.equal(await page.evaluate(() => window.kairos.save.customization[window.kairos.save.selected].livery), 1);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.custom), 'livery');
  await page.keyboard.press('ArrowDown'); await page.keyboard.down('ArrowRight');
  assert.equal(await page.evaluate(() => window.kairos.input.keys.has('ArrowRight')), false);
  await page.keyboard.up('ArrowRight');
  assert.equal(await page.evaluate(() => window.kairos.save.customization[window.kairos.save.selected].brakeBias), 0.61);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.custom), 'brakeBias');
  checks.push('actual controller livery and keyboard range changes retain focus through car/render replacement');
  await page.evaluate(() => { liveMenu.seek('[data-custom="paint"]'); liveMenu.tap(15); });
  assert.equal(await page.evaluate(() => window.kairos.save.customization[window.kairos.save.selected].paint), '#27aaa5');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.custom), 'paint');
  await page.evaluate(() => { liveMenu.seek('[data-custom="wheels"]'); liveMenu.tap(14); });
  assert.equal(await page.evaluate(() => window.kairos.save.customization[window.kairos.save.selected].wheels), '#182128');
  checks.push('controller paint and wheel palette works without native OS color picker');

  await page.evaluate(() => {
    liveMenu.seek('[data-action="screen"][data-value="map"]'); liveMenu.tap(0);
    liveMenu.seek('[data-action="map-filter"][data-value="scenic"]'); liveMenu.tap(0);
    liveMenu.seek('[data-action="map-select"][data-value="vista"]'); liveMenu.tap(0);
  });
  assert.equal(await page.evaluate(() => window.kairos.mapFilter), 'scenic');
  assert.equal(await page.locator('[data-action="map-filter"][data-value="scenic"]').getAttribute('aria-pressed'), 'true');
  checks.push('actual controller activates a map event filter and survives the filtered rerender');
  assert.equal(await page.evaluate(() => window.kairos.mapSelection), 'vista');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.value), 'vista');
  await capture('map-marker');
  await page.evaluate(() => { liveMenu.seek('[data-action="navigate"]'); liveMenu.tap(0); });
  assert.ok(await page.evaluate(() => window.kairos.route.length > 0));
  const snapshot = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
  assert.equal(snapshot.screen, 'map'); assert.equal(snapshot.destination, 'vista');
  checks.push('actual SVG map marker selection, focus restoration and route reflected in text snapshot');

  await page.evaluate(async () => {
    const game = window.kairos; await game.startDrive(); liveMenu.nav.refresh();
    liveMenu.tick([0, 1, 9]); game.setScreen('pause'); liveMenu.tick([0, 1, 9]); liveMenu.tick([0, 1, 9], 1000);
  });
  assert.equal(await page.evaluate(() => window.kairos.screen), 'pause');
  await page.evaluate(() => { liveMenu.tick(); liveMenu.tap(1); });
  assert.equal(await page.evaluate(() => window.kairos.screen), 'drive');
  checks.push('held gameplay A/B/Menu cannot activate/resume pause; release and fresh B resumes');
  await capture('drive');

  await page.evaluate(async () => {
    const game=window.kairos;await game.action('home');
    // A blocked Web Audio resume promise must never block a gamepad-started session.
    const original=game.audio.start.bind(game.audio);window.restoreAudioStart=()=>{game.audio.start=original;};
    game.audio.start=()=>new Promise(()=>{});
    liveMenu.seek('#start-handling');liveMenu.tap(0);await game.transitionPromise;
  });
  assert.equal(await page.evaluate(()=>window.kairos.screen),'drive');
  checks.push('controller activates handling-course entry even if audio permission is pending');
  await page.evaluate(async()=>{
    window.restoreAudioStart();
    window.gamepadButtons=[];window.virtualPadConnected=true;
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>window.virtualPadConnected?[{connected:true,index:0,id:'virtual-driving-pad',axes:[0,0],buttons:Array.from({length:17},(_,i)=>({pressed:window.gamepadButtons.includes(i),value:window.gamepadButtons.includes(i)?1:0,touched:false}))}]:[]});
    await window.advanceTime(1000);window.gamepadButtons=[7];await window.advanceTime(2000);window.gamepadButtons=[];
  });
  assert.ok(await page.evaluate(()=>window.kairos.player.state.speed)>5);
  await page.evaluate(async()=>{window.gamepadButtons=[9];await window.advanceTime(30);await window.advanceTime(1000);});
  assert.equal(await page.evaluate(()=>window.kairos.screen),'pause');
  await page.evaluate(async()=>{window.virtualPadConnected=false;window.dispatchEvent(new Event('gamepaddisconnected'));window.advanceTime(0);window.virtualPadConnected=true;window.gamepadButtons=[1,9];await window.advanceTime(1000);});
  assert.equal(await page.evaluate(()=>window.kairos.screen),'pause');
  await page.evaluate(async()=>{window.gamepadButtons=[];await window.advanceTime(16);window.gamepadButtons=[1];await window.advanceTime(16);window.gamepadButtons=[];await window.advanceTime(16);});
  assert.equal(await page.evaluate(()=>window.kairos.screen),'drive');
  checks.push('actual frame polling: trigger drives; Menu pauses; held reconnect buttons cannot resume; fresh B resumes');
  await page.evaluate(async()=>{delete navigator.getGamepads;window.kairos.setScreen('pause');liveMenu.seek('[data-action="home"]');liveMenu.tap(0);liveMenu.seek('[data-action="screen"][data-value="motorsport"]');liveMenu.tap(0);liveMenu.seek('#start-race');liveMenu.tap(0);await window.kairos.transitionPromise;});
  assert.equal(await page.evaluate(()=>window.kairos.screen),'drive');
  assert.equal(await page.evaluate(()=>window.kairos.mode),'Quick Race');
  await page.evaluate(()=>{window.kairos.setScreen('pause');liveMenu.seek('[data-action="end-session"]');liveMenu.tap(0);});
  assert.equal(await page.evaluate(()=>window.kairos.screen),'results');
  await page.evaluate(()=>{liveMenu.seek('[data-results-scroll="1"]');liveMenu.tap(0);});
  assert.ok(await page.locator('.results-table').evaluate(el=>el.scrollTop)>0);
  await page.evaluate(()=>{liveMenu.seek('[data-results-scroll="-1"]');liveMenu.tap(0);});
  assert.equal(await page.locator('.results-table').evaluate(el=>el.scrollTop),0);
  assert.equal(await page.locator('.results-layout').evaluate(el=>el.scrollTop),0);
  await capture('results-driver-browsing');
  checks.push('controller scrolls the driver table without hiding the results heading or actions');
  await page.evaluate(()=>liveMenu.tap(1));
  assert.equal(await page.evaluate(()=>window.kairos.screen),'home');
  checks.push('controller race setup → start → pause/end → results → home does not reopen a finished race');
  assert.deepEqual(errors, []);
  await fs.writeFile(`${output}/report.json`, JSON.stringify({ checks, errors, snapshot,
    limitations: ['Synthetic standard gamepad snapshots; no physical controller or rumble evidence.',
      'OS save-file pickers remain outside the DOM controller navigation surface; controller paint uses an in-game palette.'] }, null, 2));
  console.log(`${checks.length} controller navigation browser checks passed`);
} finally {
  await browser.close();
}
