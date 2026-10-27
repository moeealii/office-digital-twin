import * as THREE from 'three';
import type { TidyState } from '../src/room/engine-api';
import { SweepSound } from './sweep-sound';

export interface TidyOptions {
  canvas: HTMLCanvasElement; camera: THREE.Camera;
  load: () => Promise<THREE.Group>; activate: (group: THREE.Group) => void;
  shellRoots: () => readonly THREE.Object3D[];
  request: () => void; changed: (state: TidyState) => void;
  sweep?: () => void;
}
export interface TidyController {
  enable(on: boolean): Promise<void>; undo(): void; restore(): void;
  configure(parts: boolean, shell: boolean): void; select(id: string): void; hide(): void;
  mute(value: boolean): void; hidden(node: THREE.Object3D): boolean; anchor(names: readonly string[]): boolean;
  dispose(): void;
}
const AREAS = new Set(['moe-office', 'desk-west', 'desk-east', 'desk-clusterb', 'lounge', 'fireplace-wall', 'prayer-station', 'boucle-corner']);
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const physics = (node: THREE.Object3D) => {
  const tag: unknown = node.userData['physics'];
  return object(tag) && (tag['type'] === 'dynamic' || tag['type'] === 'static');
};
const group = (node: THREE.Object3D) => 'isGroup' in node && node.isGroup === true;
const human = (name: string) => { const s = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_:]+/g, ' ').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Modeled part'; };
// Original local artwork; cursor is requested only after Tidy is actually enabled.
const BROOM = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M9 24 22 4" stroke="#24170d" stroke-width="5"/><path d="m9 24 13-20" stroke="#d6a264" stroke-width="3"/><path d="m7 20 9 6-7 12L0 31Z" fill="#efc367" stroke="#24170d" stroke-width="1.5"/><path d="m5 26-3 6m7-4-3 7m7-5-3 7" stroke="#916a32"/><path d="m27 18 3-7h4l-3 9 8 12-15 4-5-10Z" fill="#b1c9bd" stroke="#24170d" stroke-width="1.5"/><path d="m21 29 15-4" stroke="#477965"/></svg>`;
const CURSOR = `url("data:image/svg+xml,${encodeURIComponent(BROOM)}") 7 31, crosshair`;

export function createTidyController(options: TidyOptions): TidyController {
  const { canvas, camera, request, changed } = options;
  const sound = new SweepSound();
  let root: THREE.Group | null = null;
  let enabled = false, preparing = false, parts = false, shell = false, muted = false;
  let selected: THREE.Object3D | null = null;
  let error: string | null = null, lastHidden: string | null = null;
  const ids = new Map<THREE.Object3D, string>(), nodes = new Map<string, THREE.Object3D>();
  const hidden = new Map<THREE.Object3D, boolean>();
  const history: THREE.Object3D[] = [];
  const ray = new THREE.Raycaster(), point = new THREE.Vector2();
  let press: { id: number; x: number; y: number; moved: boolean; target: THREE.Object3D | null } | null = null;
  const pointers = new Set<number>();
  let multiTouch = false;
  const label = (node: THREE.Object3D) => human(node.name ? node.name : node.parent?.name ?? 'Modeled part');
  const concealed = (node: THREE.Object3D) => {
    for (let n: THREE.Object3D | null = node; n; n = n.parent) if (hidden.has(n)) return true;
    return false;
  };
  const architecture = (node: THREE.Object3D) => {
    for (let n: THREE.Object3D | null = node; n && n !== root; n = n.parent) {
      if (/^(prayer|mihrab|cabinet|tv-|electric-fireplace|bar-cart|sofa|tufted|boucle)/i.test(n.name)) return false;
      if (options.shellRoots().includes(n) || /^(wall|ceiling|floor|window|blind|baseboard|crown|door|pot-light|outlet)/i.test(n.name)) return true;
    }
    return false;
  };
  const target = (node: THREE.Object3D): THREE.Object3D | null => {
    if (parts) return shell || !architecture(node) ? node : null;
    let named: THREE.Object3D | null = null;
    for (let n: THREE.Object3D | null = node; n && n !== root; n = n.parent) {
      if (physics(n)) return shell || !architecture(n) ? n : null;
      if (!named && group(n) && n.name && !AREAS.has(n.name)) named = n;
    }
    const result = named ?? node;
    return shell || !architecture(result) ? result : null;
  };
  const bounds = () => {
    if (!selected || concealed(selected)) return null;
    root?.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(selected);
    if (box.isEmpty()) return null;
    const rect = canvas.getBoundingClientRect();
    const points = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(camera));
    const xs = points.map((p) => (p.x * 0.5 + 0.5) * rect.width), ys = points.map((p) => (-p.y * 0.5 + 0.5) * rect.height);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };
  const emit = () => {
    const items = [...nodes].filter(([, n]) => n.name && !AREAS.has(n.name) && target(n) === n)
      .map(([id, n]) => ({ id, label: label(n), hidden: concealed(n) })).sort((a, b) => a.label.localeCompare(b.label));
    changed({ enabled, preparing, hiddenCount: hidden.size, selection: selected ? label(selected) : null, selectedId: selected ? ids.get(selected) ?? '' : '',
      lastHidden, parts, shell, muted, error, bounds: enabled ? bounds() : null, items });
  };
  const pick = (event: PointerEvent) => {
    if (!root) return null;
    const rect = canvas.getBoundingClientRect();
    point.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateMatrixWorld(true); root.updateMatrixWorld(true); ray.setFromCamera(point, camera);
    for (const hit of ray.intersectObject(root, true)) {
      let visible = true;
      for (let n: THREE.Object3D | null = hit.object; n; n = n.parent) if (!n.visible) { visible = false; break; }
      if (visible && !concealed(hit.object)) return target(hit.object); // do not pick through a protected wall
    }
    return null;
  };
  const hide = () => {
    if (!enabled || !selected || concealed(selected) || (!shell && architecture(selected))) return;
    hidden.set(selected, selected.visible); history.push(selected); selected.visible = false;
    lastHidden = label(selected); selected = null;
    if (!muted) { if (options.sweep) options.sweep(); else sound.play(); }
    emit(); request();
  };
  const down = (event: PointerEvent) => {
    if (!enabled || preparing) return;
    pointers.add(event.pointerId);
    if (pointers.size > 1) { multiTouch = true; press = null; selected = null; emit(); return; }
    if (multiTouch || event.button !== 0) return;
    selected = pick(event); press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, target: selected }; emit();
  };
  const move = (event: PointerEvent) => {
    if (!enabled || preparing || multiTouch || (press && event.pointerId !== press.id)) return;
    if (press) { if (!press.moved && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { press.moved = true; selected = null; emit(); } return; }
    selected = pick(event); emit();
  };
  const up = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (multiTouch) { press = null; if (!pointers.size) multiTouch = false; return; }
    const gesture = press; press = null;
    if (!enabled || gesture?.id !== event.pointerId || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) return;
    selected = gesture.target; hide();
  };
  const cancel = (event: PointerEvent) => { pointers.delete(event.pointerId); if (!pointers.size) multiTouch = false; press = null; selected = null; emit(); };
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  return {
    async enable(on) {
      enabled = on; error = null; selected = null; press = null; pointers.clear(); multiTouch = false;
      if (on && !root) {
        preparing = true; emit();
        try {
          root = await options.load();
          root.traverse((n) => { if (n !== root) { const id = `item-${ids.size + 1}`; ids.set(n, id); nodes.set(id, n); } });
        } catch { enabled = false; error = 'Could not prepare Tidy mode. The original room is unchanged.'; }
        preparing = false;
      }
      if (enabled && root) options.activate(root);
      canvas.style.cursor = enabled ? CURSOR : '';
      emit(); request();
    },
    undo() { const n = history.pop(); if (n) { n.visible = hidden.get(n) ?? true; hidden.delete(n); lastHidden = null; selected = null; emit(); request(); } },
    restore() { for (const [n, visible] of hidden) n.visible = visible; hidden.clear(); history.length = 0; selected = null; lastHidden = null; emit(); request(); },
    configure(p, s) { parts = p; shell = s; selected = null; press = null; emit(); },
    select(id) { const n = nodes.get(id); selected = n && !concealed(n) && (shell || !architecture(n)) ? n : null; emit(); },
    hide,
    mute(value) { muted = value; sound.muted = value; emit(); },
    hidden: concealed,
    anchor(names) { const node = names.map((name) => root?.getObjectByName(name)).find((n) => n !== undefined); return !node || !concealed(node); },
    dispose() {
      canvas.style.cursor = ''; sound.dispose();
      canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel);
    },
  };
}

