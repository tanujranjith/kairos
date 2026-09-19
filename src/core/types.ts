export type V3 = { x: number; y: number; z: number };
export type Drive = 'FWD' | 'RWD' | 'AWD';
export type VehicleClass = 'ROAD' | 'GT' | 'FORMULA';
export type Weather = 'Clear' | 'Cloudy' | 'Overcast' | 'Rain';
export type Quality = 'Low' | 'Medium' | 'High' | 'Ultra';
export type Screen = 'home' | 'garage' | 'customize' | 'motorsport' | 'settings' | 'map' | 'pause' | 'results' | 'drive';
export type SessionKind = 'Free Drive' | 'Practice' | 'Qualifying' | 'Quick Race' | 'Race Weekend';
export interface VehicleDefinition {
  id: string; name: string; subtitle: string; class: VehicleClass; drive: Drive; color: string;
  mass: number; power: number; torque: number; redline: number; gears: number[]; finalDrive: number;
  wheelbase: number; track: number; length: number; width: number; height: number; wheelRadius: number;
  spring: number; damper: number; travel: number; grip: number; drag: number; downforce: number;
  tank: number; topSpeed: number; zeroTo100: number; description: string;
}
export interface InputFrame { throttle: number; brake: number; steer: number; handbrake: boolean; shift: number; reverse: boolean }
export interface WheelState { load: number; compression: number; slip: number; angle: number; omega: number; temperature: number; wear: number; contact: boolean }
export interface VehicleState {
  id: string; position: V3; velocity: V3; yaw: number; speed: number; rpm: number; gear: number;
  steer: number; fuel: number; wheels: WheelState[]; grounded: boolean; surface: string; damage: number;
  absActive: boolean; tcActive: boolean; distance: number;
}
export interface Settings {
  quality: Quality; resolution: number; volume: number; music: boolean; weather: Weather; time: number; timeRate: number;
  traffic: number; automatic: boolean; abs: boolean; tc: boolean; esc: boolean; deadzone: number;
  steerSensitivity: number; units: 'mph' | 'km/h'; camera: number; showTelemetry: boolean;
  bindings: Record<string, string>;
}
export interface Customization { paint: string; wheels: string; livery: number; brakeBias: number; aero: number }
export interface SaveGame {
  version: 1; selected: string; settings: Settings; customization: Record<string, Customization>;
  records: Record<string, number>; discovered: string[]; distance: number; visits: string[];
}
export interface RoadPoint extends V3 { s: number; yaw: number; curvature: number }
export interface Road {
  id: string; name: string; points: RoadPoint[]; width: number; lanes: number; speed: number;
  loop: boolean; kind: 'road' | 'highway' | 'circuit' | 'pit' | 'test'; length: number;
}
export interface NearestRoad { road: Road; index: number; point: RoadPoint; distance: number; lateral: number; progress: number }
export interface WorldCellManifest { id: string; cx: number; cz: number; bounds: [number, number, number, number]; seed: number }
export interface Landmark { id: string; name: string; type: 'scenic' | 'garage' | 'service' | 'circuit' | 'speed' | 'trial' | 'drift' | 'handling'; x: number; z: number; description: string; target?: number; end?: { x: number; z: number } }
export interface RaceSessionConfig { kind: SessionKind; laps: number; entrants: number; difficulty: number; position: number; vehicleClass: VehicleClass }
export interface RacerProgress { id: string; name: string; lap: number; checkpoint: number; progress: number; lastProgress: number; lapStart: number; best: number; last: number; sectorStart: number; sectors: number[]; valid: boolean; warnings: number; penalty: number; finished: boolean; finishTime: number; pit: boolean }
export interface RaceState { phase: 'idle' | 'practice' | 'qualifying' | 'grid' | 'countdown' | 'racing' | 'finished'; elapsed: number; remaining: number; countdown: number; flag: string; entrants: RacerProgress[]; session: RaceSessionConfig }
export interface GameSnapshot { screen: Screen; mode: SessionKind; renderer: string; player: VehicleState; race: RaceState; fps: number; cells: number; traffic: number; wetness: number; time: number }
