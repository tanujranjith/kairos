/** Standard gamepad mapping, with no dependency on the game or its screen enum. */
export type MenuGamepad = Pick<Gamepad, 'index' | 'id' | 'connected' | 'axes' | 'buttons'>;
export type MenuDirection = 'up' | 'down' | 'left' | 'right';
export type MenuCommand = MenuDirection | 'confirm' | 'back';

/** Never catches up missed repeats after a stalled/background frame. Times are milliseconds. */
export class MenuRepeat {
  private held: string | null = null;
  private next = 0;
  reset() { this.held = null; this.next = 0; }
  take(value: string | null, now: number): boolean {
    if (!value) { this.reset(); return false; }
    if (!Number.isFinite(now)) return false;
    if (this.held === null) { this.held = value; this.next = now + 350; return true; }
    // Switching axes while still held (notably diagonal-stick jitter) cannot bypass the rate.
    this.held = value;
    if (now < this.next) return false;
    this.next = now + 120;
    return true;
  }
}

function direction(pad: MenuGamepad, previous: MenuDirection | null): MenuDirection | null {
  const pressed = (i: number) => pad.buttons[i]?.pressed ?? false;
  const dx = Number(pressed(15)) - Number(pressed(14));
  const dy = Number(pressed(13)) - Number(pressed(12));
  if ([12, 13, 14, 15].some(pressed)) return dy ? (dy > 0 ? 'down' : 'up') : dx ? (dx > 0 ? 'right' : 'left') : null;
  const x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
  const threshold = previous ? .35 : .55;
  if (Math.max(Math.abs(x), Math.abs(y)) < threshold) return null;
  return Math.abs(y) >= Math.abs(x) ? (y > 0 ? 'down' : 'up') : (x > 0 ? 'right' : 'left');
}

/** Pure edge/repeat state, also usable with synthetic pads in verification. */
export class MenuGamepadState {
  private identity: string | null = null;
  private previous: boolean[] = [];
  private heldDirection: MenuDirection | null = null;
  private directionArmed = false;
  private repeat = new MenuRepeat();
  reset() {
    this.identity = null; this.previous = []; this.heldDirection = null;
    this.directionArmed = false; this.repeat.reset();
  }
  sample(pad: MenuGamepad | null, now: number): MenuCommand | null {
    if (!pad?.connected) { this.reset(); return null; }
    const identity = `${pad.index}:${pad.id}`, buttons = pad.buttons.map(b => b.pressed);
    const nextDirection = direction(pad, this.heldDirection);
    if (identity !== this.identity) {
      this.identity = identity; this.previous = buttons; this.heldDirection = nextDirection;
      this.directionArmed = nextDirection === null; this.repeat.reset();
      return null;
    }
    const edge = (i: number) => buttons[i] && !this.previous[i];
    const back = edge(1) || edge(9), confirm = edge(0);
    this.previous = buttons; this.heldDirection = nextDirection;
    if (!nextDirection) this.directionArmed = true;
    const move = this.repeat.take(this.directionArmed ? nextDirection : null, now);
    // One command per sample. Confirm/back are edges only and take priority over movement.
    return back ? 'back' : confirm ? 'confirm' : move ? nextDirection : null;
  }
}

export interface ControllerMenuOptions {
  /** Read live state; keyboard events and mutation callbacks also use these callbacks. */
  isActive: () => boolean;
  /** Stable screen name; changes reset held controls and restore that screen's bookmark. */
  context: () => string;
  onBack: () => void;
}

type FocusTarget = HTMLElement | SVGElement;
type Bookmark = { key: string; index: number };
const selector = 'button, select, input:not([type="hidden"]), [role="button"], [data-controller-focus]';
const focusClass = 'kairos-controller-focus';
// A controller can edit paint without invoking an OS picker that requires trusted mouse input.
const controllerPalette = ['#286fa8', '#27aaa5', '#326f58', '#d3dacc', '#e4e4dc', '#bd9d73', '#b64c3d', '#182128', '#b2bac0'];
const managedKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Space', 'Escape']);

/**
 * Instantiate once after Interface, then call update() once per rendered frame (also in drive).
 * Up/down or Tab traverse controls; left/right edit selects/ranges, otherwise traverse.
 * A/Enter/Space activate; B/Menu/Escape call onBack. Native text/color inputs keep keyboard input.
 * Uses ordinary bubbling click/input/change events, so existing delegated UI handlers work.
 * Focus is restored automatically after innerHTML replacement, or immediately with refresh().
 * dispose() removes listeners, the observer and the helper's focus style.
 */
export class ControllerMenuNavigator {
  private readonly document: Document;
  private readonly view: Window;
  private readonly observer: MutationObserver;
  private readonly style: HTMLStyleElement;
  private readonly padState = new MenuGamepadState();
  private readonly keyRepeat = new MenuRepeat();
  private readonly heldKeys = new Set<string>();
  private blockedKeys = new Set<string>();
  private readonly bookmarks = new Map<string, Bookmark>();
  private active = false;
  private context = '';
  private indicated: FocusTarget | null = null;
  private showFocus = false;
  private suspended = false;
  private disposed = false;

  constructor(private readonly root: HTMLElement, private readonly options: ControllerMenuOptions) {
    this.document = root.ownerDocument;
    this.view = this.document.defaultView!;
    this.style = this.document.createElement('style');
    this.style.textContent = `.${focusClass}{outline:2px solid var(--blue,#9dcced)!important;outline-offset:4px!important}g.${focusClass} circle{stroke:#fff;stroke-width:3px}`;
    this.document.head.append(this.style);
    // Capture at document, after the game's window-capture key-rebinding listener.
    this.document.addEventListener('keydown', this.keyDown, true);
    this.document.addEventListener('keyup', this.keyUp, true);
    this.root.addEventListener('focusin', this.focusIn);
    this.root.addEventListener('pointerdown', this.pointerDown, true);
    this.view.addEventListener('blur', this.blur);
    this.view.addEventListener('focus', this.resume);
    this.view.addEventListener('gamepaddisconnected', this.disconnect);
    this.document.addEventListener('visibilitychange', this.visibility);
    this.observer = new MutationObserver(() => this.refresh());
    this.observer.observe(root, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['hidden', 'disabled', 'inert', 'aria-hidden', 'aria-disabled', 'tabindex'] });
  }

  /** Optional pad injection is useful for tests; omitted means the first connected navigator pad. */
  update(now = performance.now(), pad?: MenuGamepad | null) {
    if (this.disposed) return;
    this.refresh();
    if (!this.active) return;
    const focus = this.document.activeElement;
    if (focus && focus !== this.document.body && focus !== this.document.documentElement && !this.root.contains(focus) && !(focus instanceof HTMLCanvasElement)) {
      // A separate dialog owns focus. Re-prime on return so its held confirm cannot leak.
      this.padState.reset();
      return;
    }
    const currentPad = pad === undefined ? Array.from(this.view.navigator.getGamepads?.() ?? []).find(p => p?.connected) ?? null : pad;
    const command = this.padState.sample(currentPad, now);
    if (command) { this.showFocus = true; this.command(command); }
  }

  /** Call directly after a render if synchronous focus restoration is needed. */
  refresh() {
    if (this.disposed) return;
    const active = this.options.isActive() && !this.suspended && !this.document.hidden;
    const context = this.options.context();
    const changed = active !== this.active || context !== this.context;
    if (changed) {
      this.unmark(); this.padState.reset(); this.keyRepeat.reset();
      this.blockedKeys = new Set(this.heldKeys);
      this.active = active; this.context = context;
    }
    if (!active) return;
    const targets = this.targets(), current = this.document.activeElement;
    if (!changed && targets.includes(current as FocusTarget)) {
      this.remember(current as FocusTarget, targets);
      return;
    }
    // Do not steal focus from an external dialog/input. A removed focused node becomes body.
    if (current && current !== this.document.body && current !== this.document.documentElement && !this.root.contains(current)) return;
    const bookmark = this.bookmarks.get(context);
    if (bookmark && targets.length) {
      const target = targets.find((el, i) => this.key(el, targets, i) === bookmark.key)
        ?? targets[Math.min(bookmark.index, targets.length - 1)];
      this.focus(target);
    } else if (changed && this.root.contains(current)) {
      (current as FocusTarget).blur();
    }
  }

  dispose() {
    this.disposed = true; this.observer.disconnect(); this.unmark(); this.style.remove();
    this.document.removeEventListener('keydown', this.keyDown, true);
    this.document.removeEventListener('keyup', this.keyUp, true);
    this.root.removeEventListener('focusin', this.focusIn);
    this.root.removeEventListener('pointerdown', this.pointerDown, true);
    this.view.removeEventListener('blur', this.blur);
    this.view.removeEventListener('focus', this.resume);
    this.view.removeEventListener('gamepaddisconnected', this.disconnect);
    this.document.removeEventListener('visibilitychange', this.visibility);
  }

  private targets(): FocusTarget[] {
    return Array.from(this.root.querySelectorAll<FocusTarget>(selector)).filter(el => {
      if (el.tabIndex < 0 || el.matches(':disabled') || el.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]')) return false;
      if (!el.getClientRects().length) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      for (let ancestor: Element | null = el; ancestor; ancestor = ancestor.parentElement) {
        const css = this.view.getComputedStyle(ancestor);
        if (css.display === 'none' || css.visibility === 'hidden' || css.visibility === 'collapse' || Number(css.opacity) === 0) return false;
      }
      return true;
    });
  }

  private baseKey(el: FocusTarget): string {
    const explicit = el.getAttribute('data-controller-key') ?? el.getAttribute('id');
    if (explicit) return `id:${explicit}`;
    for (const attr of ['data-setting', 'data-custom', 'data-race']) {
      if (el.hasAttribute(attr)) return `${attr}:${el.getAttribute(attr)}`;
    }
    if (el.hasAttribute('data-action')) return JSON.stringify([el.tagName, el.getAttribute('data-action'), el.getAttribute('data-value')]);
    return JSON.stringify([el.tagName, el.getAttribute('type'),
      el.getAttribute('name'), el.getAttribute('aria-label') ?? el.textContent?.trim()]);
  }

  private key(el: FocusTarget, targets: FocusTarget[], index: number): string {
    const base = this.baseKey(el);
    return `${base}:${targets.slice(0, index).filter(other => this.baseKey(other) === base).length}`;
  }

  private remember(el: FocusTarget, targets = this.targets()) {
    const index = targets.indexOf(el);
    if (index < 0) return;
    this.bookmarks.set(this.context, { key: this.key(el, targets, index), index });
    if (this.indicated !== el || !this.showFocus) this.unmark();
    if (this.showFocus && this.indicated !== el) { el.classList.add(focusClass); this.indicated = el; }
  }

  private unmark() { this.indicated?.classList.remove(focusClass); this.indicated = null; }

  private focus(el: FocusTarget) {
    el.focus({ preventScroll: true });
    if (this.document.activeElement !== el) return;
    this.remember(el);
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private command(command: MenuCommand) {
    if (command === 'back') { this.options.onBack(); this.refresh(); return; }
    const targets = this.targets();
    if (!targets.length) return;
    const current = this.document.activeElement as FocusTarget;
    const index = targets.indexOf(current);
    // The first confirm only establishes visible focus; it cannot accidentally launch a session.
    if (index < 0) { this.focus(targets[command === 'up' || command === 'left' ? targets.length - 1 : 0]); return; }
    this.remember(current, targets);
    if (command === 'confirm') this.activate(current);
    else if ((command === 'left' || command === 'right') && this.adjust(current, command === 'right' ? 1 : -1)) { /* edited in place */ }
    else this.focus(targets[(index + (command === 'up' || command === 'left' ? -1 : 1) + targets.length) % targets.length]);
    this.refresh();
  }

  private adjust(el: FocusTarget, step: number): boolean {
    if (el instanceof HTMLSelectElement) {
      const options = Array.from(el.options);
      for (let i = el.selectedIndex + step; i >= 0 && i < options.length; i += step) {
        const option = options[i];
        if (option.disabled || option.hidden || option.closest('optgroup[disabled]')) continue;
        el.selectedIndex = i; this.changed(el); break;
      }
      return true;
    }
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const before = el.value;
      if (el.step === 'any') {
        const min = el.min === '' ? 0 : Number(el.min), max = el.max === '' ? 100 : Number(el.max);
        el.value = String(Math.min(max, Math.max(min, el.valueAsNumber + step * (max - min) / 100)));
      } else if (step > 0) el.stepUp(); else el.stepDown();
      if (el.value !== before) this.changed(el);
      return true;
    }
    if (el instanceof HTMLInputElement && el.type === 'color') {
      const index = controllerPalette.indexOf(el.value.toLowerCase());
      el.value = controllerPalette[(index + step + controllerPalette.length) % controllerPalette.length];
      this.changed(el);
      return true;
    }
    return false;
  }

  private changed(el: HTMLInputElement | HTMLSelectElement) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    // An input handler may replace innerHTML before change; dispatch to its replacement.
    const bookmark = this.bookmarks.get(this.context), targets = this.targets();
    const live = this.root.contains(el) ? el : bookmark ? targets.find((target, i) => this.key(target, targets, i) === bookmark.key) : null;
    live?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private activate(el: FocusTarget) {
    if (el instanceof HTMLSelectElement) { this.adjust(el, 1); return; }
    if (el instanceof HTMLInputElement && el.type === 'color') { this.adjust(el, 1); return; }
    if (el instanceof HTMLInputElement && el.type === 'range') return;
    if (el instanceof HTMLElement) el.click();
    else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: this.view }));
  }

  private keyDown = (event: KeyboardEvent) => {
    if (!managedKeys.has(event.code) || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    this.refresh();
    const wasHeld = this.heldKeys.has(event.code);
    this.heldKeys.add(event.code);
    if (!this.active) return;
    const target = event.target;
    if (target instanceof Element && !this.root.contains(target) && target !== this.document.body && target !== this.document.documentElement && !(target instanceof HTMLCanvasElement)) return;
    if (target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement && !['checkbox', 'range', 'button', 'submit'].includes(target.type))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (this.blockedKeys.has(event.code) || event.repeat && !wasHeld) { this.blockedKeys.add(event.code); return; }
    this.showFocus = true;
    if (event.code === 'Enter' || event.code === 'Space' || event.code === 'Escape') {
      if (!wasHeld && !event.repeat) this.command(event.code === 'Escape' ? 'back' : 'confirm');
    } else if (this.keyRepeat.take(event.code, event.timeStamp)) {
      const command = event.code === 'Tab' ? (event.shiftKey ? 'up' : 'down') : event.code.slice(5).toLowerCase() as MenuDirection;
      this.command(command);
    }
  };
  private keyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.code); this.blockedKeys.delete(event.code);
    if (managedKeys.has(event.code)) this.keyRepeat.reset();
  };
  private focusIn = (event: FocusEvent) => {
    // Synchronize the context before a mouse/Tab focus is recorded on a newly rendered screen.
    if (this.options.context() !== this.context || this.options.isActive() !== this.active) this.refresh();
    if (this.active && event.target instanceof Element) this.remember(event.target as FocusTarget);
  };
  private pointerDown = () => { this.showFocus = false; this.unmark(); };
  private disconnect = () => { this.padState.reset(); };
  private blur = () => { this.suspended = true; this.heldKeys.clear(); this.refresh(); };
  private resume = () => { this.suspended = false; this.refresh(); };
  private visibility = () => { if (this.document.hidden) this.blur(); else this.resume(); };
}
