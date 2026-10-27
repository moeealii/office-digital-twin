import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SceneNavigation } from '../src/room/scene-editor-api';

/** Native Three mouse-look and free-flight; no replacement camera-motion implementation. */
export function createSceneNavigation(options: {
  camera: THREE.PerspectiveCamera; canvas: HTMLCanvasElement; orbit: OrbitControls;
  request: () => void; enterFirstPerson: () => void; navigating: (locked: boolean) => void;
}) {
  const { camera, canvas, orbit, request } = options;
  const look = new PointerLockControls(camera, canvas);
  look.minPolarAngle = 0.03; look.maxPolarAngle = Math.PI - 0.03;
  const canLook = typeof canvas.requestPointerLock === 'function' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
  let mode: SceneNavigation['mode'] = canLook ? 'first-person' : 'orbit';
  let active = false, locked = false, entered = false, disposed = false, message: string | null = null;
  let fly: FlyControls | null = null, previousTime = 0;
  const listeners = new Set<(state: SceneNavigation) => void>();
  const state = (): SceneNavigation => ({ mode, locked, canLook, message });
  const emit = () => { for (const listener of listeners) listener(state()); request(); };
  const syncOrbit = () => {
    const distance = Math.max(0.4, Math.min(4, camera.position.distanceTo(orbit.target)));
    orbit.target.copy(camera.position).addScaledVector(look.getDirection(new THREE.Vector3()), distance);
  };
  const releaseFly = () => {
    fly?.dispose(); fly = null; previousTime = 0;
    canvas.style.touchAction = 'none'; // FlyControls.disconnect clears its inline value.
  };
  const stop = () => {
    releaseFly(); locked = false;
    if (canvas.ownerDocument.pointerLockElement === canvas) look.unlock();
    options.navigating(false);
  };
  const onLock = () => {
    if (!active || mode !== 'first-person' || disposed) { look.unlock(); return; }
    releaseFly(); locked = true; message = null;
    // Recreate on every lock: disabled native keyup must never leave a held move
    // vector behind after Escape, window blur or editor closing.
    fly = new FlyControls(camera, canvas); fly.movementSpeed = 1.6; fly.rollSpeed = 0; fly.dragToLook = true;
    orbit.enabled = false; options.navigating(true);
    performance.mark('office:editor:fpv-start', { detail: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } }); emit();
  };
  const onUnlock = () => {
    releaseFly(); locked = false; syncOrbit();
    orbit.enabled = !active || mode === 'orbit' || !canLook;
    options.navigating(false);
    performance.mark('office:editor:fpv-end', { detail: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray() } }); emit();
  };
  const escape = (event: KeyboardEvent) => { if (locked && event.code === 'Escape') look.unlock(); };
  const changed = () => { request(); };
  const blur = () => { if (locked) { stop(); emit(); } };
  const visibility = () => { if (document.hidden) blur(); };
  look.addEventListener('lock', onLock); look.addEventListener('unlock', onUnlock); look.addEventListener('change', changed);
  window.addEventListener('blur', blur); window.addEventListener('keydown', escape); document.addEventListener('visibilitychange', visibility);
  return {
    state,
    subscribe(listener: (value: SceneNavigation) => void) { listeners.add(listener); listener(state()); return () => { listeners.delete(listener); }; },
    setEnabled(value: boolean) {
      if (disposed || active === value) return;
      active = value;
      if (!value) { stop(); syncOrbit(); orbit.enabled = true; }
      else {
        if (mode === 'first-person' && !entered) { entered = true; options.enterFirstPerson(); }
        orbit.enabled = mode === 'orbit' || !canLook;
      }
      emit();
    },
    setMode(value: SceneNavigation['mode']) {
      if (disposed || mode === value) return;
      stop(); syncOrbit(); mode = value; message = null;
      if (value === 'first-person') { entered = true; options.enterFirstPerson(); }
      orbit.enabled = !active || value === 'orbit' || !canLook; emit();
    },
    startLook() {
      if (!active || mode !== 'first-person' || !canLook || disposed) return;
      message = null;
      // PointerLockControls.lock drops the browser's returned rejection promise;
      // request the standard API directly and let its native controller own look.
      try { void Promise.resolve(canvas.requestPointerLock()).catch(() => { message = 'Mouse look could not start. Orbit is still available.'; emit(); }); }
      catch { message = 'Mouse look could not start. Orbit is still available.'; emit(); }
    },
    firstPerson() { return active && mode === 'first-person' && canLook; },
    update(time: number): boolean {
      if (!active || !locked || !fly) return false;
      const delta = previousTime ? Math.max(0, Math.min(0.05, (time - previousTime) / 1000)) : 0;
      previousTime = time; fly.update(delta); return true;
    },
    dispose() {
      if (disposed) return;
      stop(); disposed = true; orbit.enabled = true;
      look.removeEventListener('lock', onLock); look.removeEventListener('unlock', onUnlock); look.removeEventListener('change', changed);
      look.dispose(); window.removeEventListener('blur', blur); window.removeEventListener('keydown', escape); document.removeEventListener('visibilitychange', visibility); listeners.clear();
    },
  };
}
