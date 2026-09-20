import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
const output=process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'output/handling';
page.on('pageerror', e => errors.push(String(e)));
await fs.mkdir(output, { recursive: true });
try {
  await page.goto('http://127.0.0.1:5187/?renderer=webgl');
  await page.waitForFunction(() => window.kairos?.ui, null, { timeout: 60000 });
  await page.evaluate(() => window.advanceTime(0));
  await page.click('#start-handling');
  const report = await page.evaluate(async () => {
    const { runHandlingValidation } = await import('/src/tools/handling-validation.ts');
    return await runHandlingValidation(window.kairos);
  });
  const repeated = await page.evaluate(async () => {
    const { runHandlingValidation } = await import('/src/tools/handling-validation.ts');
    return await runHandlingValidation(window.kairos);
  });
  const repeatability = {
    accelerationSeconds: report.acceleration.map((v,i)=>Math.abs(v.timeTo100-repeated.acceleration[i].timeTo100)),
    brakingMeters: report.braking.map((v,i)=>Math.abs(v.distance-repeated.braking[i].distance)),
    skidpadRmsMeters: report.skidpad.map((v,i)=>Math.abs(v.rmsRadiusError-repeated.skidpad[i].rmsRadiusError)),
    bankRollRadians: Math.abs(report.bank.meanRoll-repeated.bank.meanRoll),
    collisionMeters: Math.abs(report.collision.finalX-repeated.collision.finalX),
  };
  const checks = [];
  const check = (name, predicate, details) => checks.push({ name, pass: Boolean(predicate), details });
  check('six classes accelerate and remain grounded', report.acceleration.every(v => v.grounded && v.finalSpeed > 27.78 && v.timeTo100 > 1 && v.timeTo100 < 10), report.acceleration.map(v => ({ id: v.id, zeroTo100: v.timeTo100, finalSpeed: v.finalSpeed })));
  const [dry, wet, worn] = report.braking;
  check('30 m/s braking is bounded, wet and worn tires extend stopping distance', dry.distance > 25 && dry.distance < 95 && wet.distance > dry.distance * 1.1 && worn.distance > dry.distance * 1.1 && report.braking.every(b => b.finalSpeed < .3 && b.seconds < 15), report.braking);
  check('neutral low-speed stability for 30 simulated seconds', report.lowSpeed.displacement < .35 && Math.abs(report.lowSpeed.finalSpeed) < .05, { displacement: report.lowSpeed.displacement, speed: report.lowSpeed.finalSpeed });
  check('held brake resists a 10 percent gradient', report.slope.displacement < .35 && Math.abs(report.slope.finalSpeed) < .1, { displacement: report.slope.displacement, speed: report.slope.finalSpeed });
  check('dry and wet 55m skidpad laps track the circle', report.skidpad.every(s => s.distance > 650 && s.rmsRadiusError < 3 && s.maxRadiusError < 6 && s.peakTilt < .6), report.skidpad.map(s => ({ wetness: s.wetness, distance: s.distance, rmsError: s.rmsRadiusError, maxError: s.maxRadiusError })));
  check('slalom follows the lane and clears cones', report.slalom.rmsPathError < 2 && report.slalom.coneClearance > 1.2 && report.slalom.distance > 430 && report.slalom.peakTilt < .6, { rmsError: report.slalom.rmsPathError, clearance: report.slalom.coneClearance, distance: report.slalom.distance });
  check('three measured bumps and one-sided curb do not launch or overturn the car', report.bumps.distance > 185 && report.bumps.peakVerticalSpeed > .25 && report.bumps.maxAirborne < .3 && report.bumps.peakTilt < .5 && report.curb.distance > 90 && report.curb.peakTilt > .015 && report.curb.peakTilt < .5, { bumps: { tilt: report.bumps.peakTilt, vertical: report.bumps.peakVerticalSpeed, airborne: report.bumps.maxAirborne }, curb: { tilt: report.curb.peakTilt, distance: report.curb.distance } });
  check('banked road physically tilts the chassis and retains lane control', Math.abs(report.bank.meanRoll) > .08 && Math.abs(report.bank.meanRoll) < .3 && report.bank.maxLaneError < 3 && report.bank.maxAirborne < .1, { roll: report.bank.meanRoll, laneError: report.bank.maxLaneError });
  check('launch ramp produces an airborne interval then a stable landing', report.jump.maxAirborne > .1 && report.jump.maxAirborne < 1.5 && report.jump.finalContact >= 3 && report.jump.peakTilt < .65 && report.jump.finalY < 19.1, { airborne: report.jump.maxAirborne, tilt: report.jump.peakTilt, finalY: report.jump.finalY, contacts: report.jump.finalContact });
  check('solid barrier stops chassis without tunneling', report.collision.finalX < -1251 && Math.abs(report.collision.finalSpeed) < 1.5 && report.collision.damage > 0, { x: report.collision.finalX, speed: report.collision.finalSpeed, damage: report.collision.damage });
  check('depleted fuel cannot accelerate the vehicle', Math.abs(report.emptyTank.finalSpeed) < .1 && report.emptyTank.distance < .3, { speed: report.emptyTank.finalSpeed, distance: report.emptyTank.distance });
  check('no browser exceptions', errors.length === 0, errors);
  check('fresh repeated scenarios remain within numeric tolerances', repeatability.accelerationSeconds.every(v=>v<.05)&&repeatability.brakingMeters.every(v=>v<.25)&&repeatability.skidpadRmsMeters.every(v=>v<.25)&&repeatability.bankRollRadians<.02&&repeatability.collisionMeters<.1,repeatability);
  await fs.writeFile(`${output}/report.json`, JSON.stringify({ ...report, repeatability, checks, errors }, null, 2));
  await page.evaluate(async () => { const g = window.kairos; g.advanceTime(0); await g.renderer.scene.whenReadyAsync(); g.advanceTime(0); });
  await page.screenshot({ path: `${output}/course.png` });
  for (const entry of checks) console.log(entry.pass ? 'PASS' : 'FAIL', entry.name, JSON.stringify(entry.details));
  assert.ok(checks.every(c => c.pass), `Physical handling acceptance checks failed; inspect ${output}/report.json`);
} finally { await browser.close(); }
