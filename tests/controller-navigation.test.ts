import { afterEach, describe, expect, it, vi } from 'vitest';
import { MenuGamepadState, MenuRepeat, type MenuGamepad } from '../src/ui/controller-navigation';
import { Input } from '../src/core/input';
import { defaultSave } from '../src/content/vehicles';

function pad(pressed: number[] = [], axes = [0, 0], id = 'test-pad'): MenuGamepad {
  return { index: 0, id, connected: true, axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) };
}

describe('menu gamepad edges and repeats', () => {
  it('requires release of held confirm and back on initial connection', () => {
    const state = new MenuGamepadState();
    expect(state.sample(pad([0, 1, 9]), 0)).toBeNull();
    expect(state.sample(pad([0, 1, 9]), 1000)).toBeNull();
    state.sample(pad(), 1100);
    expect(state.sample(pad([0]), 1200)).toBe('confirm');
    expect(state.sample(pad([0]), 5000)).toBeNull();
    state.sample(pad(), 5100);
    expect(state.sample(pad([9]), 5200)).toBe('back');
  });
  it('does not navigate a menu with a stick held while driving', () => {
    const state = new MenuGamepadState();
    state.sample(pad([], [1, 0]), 0);
    expect(state.sample(pad([], [1, 0]), 1000)).toBeNull();
    state.sample(pad(), 1100);
    expect(state.sample(pad([], [1, 0]), 1200)).toBe('right');
  });
  it('repeats after 350ms then at most once every 120ms, without catching up', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([13]), 10)).toBe('down');
    expect(state.sample(pad([13]), 359)).toBeNull();
    expect(state.sample(pad([13]), 360)).toBe('down');
    expect(state.sample(pad([13]), 479)).toBeNull();
    expect(state.sample(pad([13]), 480)).toBe('down');
    expect(state.sample(pad([13]), 90000)).toBe('down');
    expect(state.sample(pad([13]), 90001)).toBeNull();
  });
  it('uses stick hysteresis to avoid repeat resets from deadzone jitter', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([], [.54, 0]), 10)).toBeNull();
    expect(state.sample(pad([], [.56, 0]), 20)).toBe('right');
    expect(state.sample(pad([], [.4, 0]), 370)).toBe('right');
    expect(state.sample(pad([], [.34, 0]), 380)).toBeNull();
    expect(state.sample(pad([], [.4, 0]), 390)).toBeNull();
  });
  it('bounds navigation when a held diagonal stick alternates its dominant axis', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([], [.8, .7]), 10)).toBe('right');
    for (let time = 20; time < 360; time += 10) {
      expect(state.sample(pad([], time % 20 ? [.8, .7] : [.7, .8]), time)).toBeNull();
    }
    expect(state.sample(pad([], [.7, .8]), 360)).toBe('down');
    expect(state.sample(pad([], [.8, .7]), 370)).toBeNull();
  });
  it('gives D-pad priority over stick and cancels opposing D-pad buttons', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([12], [1, 0]), 10)).toBe('up');
    expect(state.sample(pad([12, 13], [1, 0]), 20)).toBeNull();
  });
  it('suppresses held actions after screen resets, disconnects and pad replacement', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([0]), 10)).toBe('confirm');
    state.reset();
    expect(state.sample(pad([0, 13]), 20)).toBeNull();
    expect(state.sample(null, 30)).toBeNull();
    expect(state.sample(pad([0, 13]), 40)).toBeNull();
    expect(state.sample(pad([0, 13], [0, 0], 'replacement'), 50)).toBeNull();
    state.sample(pad([], [0, 0], 'replacement'), 60);
    expect(state.sample(pad([0], [0, 0], 'replacement'), 70)).toBe('confirm');
  });
  it('emits one command on chords and does not defer the suppressed confirm', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([0, 1, 13]), 10)).toBe('back');
    expect(state.sample(pad([0]), 20)).toBeNull();
  });
  it('ignores gameplay triggers and non-menu face buttons', () => {
    const state = new MenuGamepadState();
    state.sample(pad(), 0);
    expect(state.sample(pad([2, 3, 4, 5, 6, 7]), 10)).toBeNull();
  });
  it('handles absent axes/buttons and disconnected pad snapshots', () => {
    const state = new MenuGamepadState();
    const empty = { ...pad(), axes: [], buttons: [] };
    expect(state.sample(empty, 0)).toBeNull();
    expect(state.sample(empty, 10)).toBeNull();
    expect(state.sample({ ...pad([0]), connected: false }, 20)).toBeNull();
  });
  it('resets repeats on release and rejects non-finite timestamps', () => {
    const repeat = new MenuRepeat();
    expect(repeat.take('down', NaN)).toBe(false);
    expect(repeat.take('down', 0)).toBe(true);
    expect(repeat.take('down', 20)).toBe(false);
    repeat.take(null, 30);
    expect(repeat.take('down', 40)).toBe(true);
  });
});

describe('driving Input controller transitions', () => {
  afterEach(() => vi.unstubAllGlobals());
  const setup = () => {
    const events = new EventTarget();
    let current: MenuGamepad | null = pad();
    vi.stubGlobal('window', events);
    vi.stubGlobal('navigator', { getGamepads: () => [current] });
    const input = new Input(() => defaultSave().settings);
    const actions: string[] = [];
    input.onAction = action => actions.push(action);
    const poll = (next: MenuGamepad | null) => { current = next; return input.poll(1 / 60, 0); };
    return { input, actions, poll, events };
  };
  it('clear empties previousButtons and requires release before actions resume', () => {
    const { input, actions, poll } = setup();
    poll(pad()); poll(pad([1])); expect(actions).toEqual(['camera']);
    input.clear();
    expect((input as unknown as { previousButtons: boolean[] }).previousButtons).toEqual([]);
    poll(pad([1, 3, 9])); expect(actions).toEqual(['camera']);
    poll(pad()); poll(pad([9])); expect(actions).toEqual(['camera', 'pause']);
  });
  it('clears on a disconnect event and rearms after reconnection', () => {
    const { input, actions, poll, events } = setup();
    poll(pad()); poll(pad([3])); input.keys.add('KeyW');
    events.dispatchEvent(new Event('gamepaddisconnected'));
    expect(input.keys.size).toBe(0);
    expect((input as unknown as { previousButtons: boolean[] }).previousButtons).toEqual([]);
    expect(input.lastDevice).toBe('keyboard');
    poll(pad([3])); expect(actions).toEqual(['map']);
    poll(pad()); poll(pad([3])); expect(actions).toEqual(['map', 'map']);
  });
  it('detects a missed disconnect event and replacement at the same index', () => {
    const { actions, poll } = setup();
    poll(pad()); poll(pad([1])); poll(null); poll(pad([1]));
    poll(pad([9], [0, 0], 'replacement')); expect(actions).toEqual(['camera']);
    poll(pad([], [0, 0], 'replacement')); poll(pad([9], [0, 0], 'replacement'));
    expect(actions).toEqual(['camera', 'pause']);
  });
  it('does not overwrite clear called synchronously from an action callback', () => {
    const { input, actions, poll } = setup();
    input.onAction = action => { actions.push(action); input.clear(); };
    poll(pad()); poll(pad([2, 3, 9]));
    expect(actions).toEqual(['reset']);
    expect((input as unknown as { previousButtons: boolean[] }).previousButtons).toEqual([]);
    poll(pad([2, 3, 9])); expect(actions).toEqual(['reset']);
  });
  it('continues continuous steering/trigger input while suppressing initial action edges', () => {
    const { actions, poll } = setup();
    const frame = poll(pad([7, 9], [1, 0]));
    expect(frame.throttle).toBeGreaterThan(0); expect(frame.steer).toBeGreaterThan(0);
    expect(actions).toEqual([]);
  });
});
