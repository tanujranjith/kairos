import { Vector3 } from '@babylonjs/core';
import type { Kairos } from '../app';
import { DEFAULT_SETTINGS, VEHICLES, vehicleById } from '../content/vehicles';
import { HANDLING, HANDLING_FEATURES, featureHeight, handlingSpawn } from '../content/handling-course';
import { FIXED_DT, Vehicle, neutralInput } from '../sim/physics';
import { clamp, wrap } from '../core/math';
import type { InputFrame } from '../core/types';

type Trace = { t: number; x: number; y: number; z: number; speed: number; contact: number; tilt: number };
type Stats = { seconds: number; distance: number; peakSpeed: number; peakTilt: number; minY: number; maxY: number; airborneSeconds: number; maxAirborne: number; peakVerticalSpeed: number; trace: Trace[] };
const dt = FIXED_DT;

/** Development-only physical rig. No position/force correction is applied during any test. */
export async function runHandlingValidation(game: Kairos) {
  game.advanceTime(0);
  await game.startDrive(true);
  const settings = { ...structuredClone(DEFAULT_SETTINGS), volume: 0, traffic: 0, timeRate: 0 };
  let vehicle = game.player, wetness = 0, elapsed = 0;
  for (let x = -1950; x <= -1030; x += 180) for (const z of [1750, 1930]) game.world.ensure({ x, y: HANDLING.height, z });
  const step = (input: InputFrame) => {
    vehicle.preStep(input, settings, wetness, dt);
    game.physics.step(dt);
    vehicle.postStep(dt);
    elapsed += dt;
    const s = vehicle.state;
    if (![s.position.x, s.position.y, s.position.z, s.speed, s.rpm, ...s.wheels.map(w => w.load)].every(Number.isFinite)) throw new Error('Non-finite vehicle state');
  };
  const prepare = (x: number, z: number, yaw = Math.PI / 2, id = 'velara', wet = 0) => {
    game.player.dispose();
    vehicle = game.player = new Vehicle(game.physics, vehicleById(id), 'player', handlingSpawn(x, z, yaw), yaw);
    wetness = wet;elapsed = 0;
    for (let i = 0; i < 240; i++) step({ ...neutralInput(), brake: 1 });
    elapsed = 0;
    return vehicle;
  };
  const setSpeed = (speed: number) => {
    const yaw = vehicle.state.yaw;
    vehicle.body.setLinearVelocity(new Vector3(Math.sin(yaw) * speed, 0, Math.cos(yaw) * speed));
    // Synchronize telemetry with the explicit initial condition before a stop-loop checks it.
    vehicle.state.speed = speed;
    vehicle.state.velocity = { x: Math.sin(yaw) * speed, y: 0, z: Math.cos(yaw) * speed };
    vehicle.state.wheels.forEach(w => { w.omega = speed / vehicle.definition.wheelRadius; });
  };
  const run = (seconds: number, control: (t: number) => InputFrame, observe?: () => void) => {
    const start = vehicle.state.distance;
    const result: Stats = { seconds: 0, distance: 0, peakSpeed: 0, peakTilt: 0, minY: Infinity, maxY: -Infinity, airborneSeconds: 0, maxAirborne: 0, peakVerticalSpeed: 0, trace: [] };
    let air = 0;
    for (let i = 0; i < Math.round(seconds / dt); i++) {
      step(control(i * dt));observe?.();
      const s = vehicle.state, up = Vector3.TransformNormal(Vector3.Up(), vehicle.node.computeWorldMatrix(true));
      const tilt = Math.acos(clamp(up.y, -1, 1));
      const contacts = s.wheels.filter(w => w.contact).length;
      if (!contacts) { air += dt;result.airborneSeconds += dt; } else air = 0;
      result.maxAirborne = Math.max(result.maxAirborne, air);
      result.peakTilt = Math.max(result.peakTilt, tilt);
      result.peakSpeed = Math.max(result.peakSpeed, Math.abs(s.speed));
      result.minY = Math.min(result.minY, s.position.y);result.maxY = Math.max(result.maxY, s.position.y);
      result.peakVerticalSpeed = Math.max(result.peakVerticalSpeed, Math.abs(s.velocity.y));
      if (i % 120 === 0) result.trace.push({ t: i * dt, x: s.position.x, y: s.position.y, z: s.position.z, speed: s.speed, contact: contacts, tilt });
    }
    result.seconds = seconds;result.distance = vehicle.state.distance - start;
    return result;
  };
  const follow = (target: { x: number; z: number }, targetSpeed: number, lookahead: number): InputFrame => {
    const s = vehicle.state, error = wrap(Math.atan2(target.x - s.position.x, target.z - s.position.z) - s.yaw);
    const maxSteer = clamp(.57 / (1 + Math.abs(s.speed) * .055), .115, .57);
    return { ...neutralInput(), steer: clamp(Math.atan(2 * vehicle.definition.wheelbase * Math.sin(error) / lookahead) / maxSteer, -1, 1), throttle: clamp((targetSpeed - s.speed) * .2, 0, .65), brake: clamp((s.speed - targetSpeed) * .15, 0, 1) };
  };
  const lane = (z: number, speed: number) => () => {
    const look = 7 + Math.abs(vehicle.state.speed) * .5;
    return follow({ x: vehicle.state.position.x + look, z }, speed, look);
  };
  const report: Record<string, unknown> = { environment: 'Development-host Havok at 120 Hz on authored Northstar physical surfaces; fixed-input numerical checks, rendering suspended. Not a laptop FPS or endurance certification.' };

  const acceleration = [];
  for (const d of VEHICLES) {
    prepare(-1940, 1940, Math.PI / 2, d.id);
    let timeTo100: number | null = null;
    const stats = run(10, () => ({ ...neutralInput(), throttle: 1 }), () => { if (timeTo100 === null && vehicle.state.speed >= 100 / 3.6) timeTo100 = elapsed; });
    acceleration.push({ id: d.id, timeTo100, finalSpeed: vehicle.state.speed, grounded: vehicle.state.grounded, ...stats });
  }
  report.acceleration = acceleration;

  const braking = [];
  for (const condition of ['dry', 'wet', 'worn'] as const) {
    prepare(-1900, 1940, Math.PI / 2, 'velara', condition === 'wet' ? 1 : 0);
    if (condition === 'worn') vehicle.state.wheels.forEach(w => { w.wear = 0; });
    setSpeed(30);
    const start = vehicle.state.position.x;
    while (vehicle.state.speed > .25 && elapsed < 15) step({ ...neutralInput(), brake: 1 });
    braking.push({ condition, seconds: elapsed, distance: vehicle.state.position.x - start, finalSpeed: vehicle.state.speed, grounded: vehicle.state.grounded });
  }
  report.braking = braking;

  prepare(-1900, 1940);const still = { ...vehicle.state.position };
  const lowSpeed = run(30, () => neutralInput());
  report.lowSpeed = { ...lowSpeed, displacement: Math.hypot(vehicle.state.position.x - still.x, vehicle.state.position.z - still.z), finalSpeed: vehicle.state.speed };

  prepare(-1660, 1825);const slopeStart = { ...vehicle.state.position };
  const slope = run(20, () => ({ ...neutralInput(), brake: 1 }));
  report.slope = { ...slope, displacement: Math.hypot(vehicle.state.position.x - slopeStart.x, vehicle.state.position.z - slopeStart.z), finalSpeed: vehicle.state.speed };

  const circles = [];
  for (const wet of [0, 1]) {
    const center = HANDLING.skidpad, radius = center.radius;
    prepare(center.x, center.z + radius, Math.PI / 2, 'velara', wet);
    let sum = 0, maxError = 0, count = 0;
    const stats = run(50, () => {
      const s = vehicle.state, angle = Math.atan2(s.position.x - center.x, s.position.z - center.z), look = 8 + Math.abs(s.speed) * .5;
      return follow({ x: center.x + Math.sin(angle + look / radius) * radius, z: center.z + Math.cos(angle + look / radius) * radius }, 16, look);
    }, () => {
      if (elapsed < 5) return;
      const error = Math.abs(Math.hypot(vehicle.state.position.x - center.x, vehicle.state.position.z - center.z) - radius);
      sum += error * error;maxError = Math.max(maxError, error);count++;
    });
    circles.push({ wetness: wet, rmsRadiusError: Math.sqrt(sum / count), maxRadiusError: maxError, temperatures: vehicle.state.wheels.map(w => w.temperature), ...stats });
  }
  report.skidpad = circles;

  prepare(-1940, HANDLING.slalom.z);
  let slalomError = 0, slalomCount = 0, coneClearance = Infinity;
  const wave = (x: number) => HANDLING.slalom.z + HANDLING.slalom.amplitude * Math.cos((x - HANDLING.slalom.x) / HANDLING.slalom.spacing * Math.PI);
  const slalom = run(43, () => {
    const look = 5 + Math.abs(vehicle.state.speed) * .35, x = vehicle.state.position.x + look;
    return follow({ x, z: wave(x) }, 12, look);
  }, () => {
    const p = vehicle.state.position;
    if (p.x < HANDLING.slalom.x - 10) return;
    slalomError += (p.z - wave(p.x)) ** 2;slalomCount++;
    for (let i = 0; i < HANDLING.slalom.count; i++) coneClearance = Math.min(coneClearance, Math.hypot(p.x - HANDLING.slalom.x - i * HANDLING.slalom.spacing, p.z - HANDLING.slalom.z));
  });
  report.slalom = { ...slalom, rmsPathError: Math.sqrt(slalomError / slalomCount), coneClearance };

  prepare(-1890, 1790);setSpeed(12);
  report.bumps = run(18, lane(1790, 12));
  prepare(-1645, 1784.42);setSpeed(9);
  report.curb = run(12, lane(1784.42, 9));
  prepare(-1925, 1752);setSpeed(16);
  let bankRoll = 0, bankSamples = 0, bankError = 0;
  const bank = run(37, lane(1752, 16), () => {
    const p = vehicle.state.position;
    if (p.x < -1820 || p.x > -1420) return;
    bankRoll += vehicle.node.rotationQuaternion!.toEulerAngles().z;bankSamples++;bankError = Math.max(bankError, Math.abs(p.z - 1752));
  });
  report.bank = { ...bank, meanRoll: bankRoll / bankSamples, maxLaneError: bankError, authoredHeightDifference: featureHeight(HANDLING_FEATURES[1], -1700, 1754) - featureHeight(HANDLING_FEATURES[1], -1700, 1750) };
  prepare(-1565, 1790);setSpeed(16);
  const jump = run(5, lane(1790, 16));
  report.jump = { ...jump, finalContact: vehicle.state.wheels.filter(w => w.contact).length, finalY: vehicle.state.position.y };

  prepare(-1270, 1940);setSpeed(12);
  const collision = run(5, () => neutralInput());
  report.collision = { ...collision, finalX: vehicle.state.position.x, finalSpeed: vehicle.state.speed, damage: vehicle.state.damage };
  prepare(-1900, 1940);vehicle.state.fuel = 0;
  report.emptyTank = { ...run(5, () => ({ ...neutralInput(), throttle: 1 })), finalSpeed: vehicle.state.speed };
  prepare(HANDLING.spawn.x, HANDLING.spawn.z);
  game.advanceTime(0);
  return report;
}
