import type { FocusOptions, HotspotId } from './lib';
import type { AnchorSpec, CameraPose } from './room/engine-api';

export interface Hotspot {
  id: HotspotId;
  /** Short marker label. */
  label: string;
  /** Panel kicker + title. */
  kicker: string;
  title: string;
  /** One-paragraph caption used in the guided tour and the panel header. */
  blurb: string;
  anchor: AnchorSpec;
  focus: FocusOptions;
}

/**
 * The hotspots, in guided-tour order. Anchors name objects in the room
 * source (3d-model-anything demos/moe-office/items). Broad room areas have
 * RoomPlan fallbacks; hardware stops without one require their genuine modeled object.
 *
 * There is no server rack in the office: the NAS lives elsewhere in the
 * house. The "rack" is the network corner under the west desk (eero 6 router
 * + PC tower), drawn with an uplink beam to wherever the NAS is.
 */
export const HOTSPOTS: readonly Hotspot[] = [
  {
    id: 'rack',
    label: 'The rack',
    kicker: 'Network corner · uplink to the NAS',
    title: 'The rack',
    blurb:
      'The eero and the tower under the desk are the office end of the homelab. The beam traces the uplink to the TrueNAS box that runs every family site, the photo library and the house AI.',
    anchor: { id: 'rack', names: ['eero-6', 'pc-tower'], fallback: [-1.97, 0.76, 2.5], lift: 0.14 },
    focus: { distance: 1.7, height: 1.55, yaw: -12, drop: 0.25 },
  },
  {
    id: 'aranet4',
    label: 'Aranet4',
    kicker: 'Office air · on top of the portable A/C',
    title: 'Office air · Aranet4',
    blurb:
      'The Aranet4 sits on top of the air conditioner. Real CO₂, temperature, humidity, pressure and battery readings appear here only when a sensor source is connected; the modeled LCD is illustrative, not live telemetry.',
    anchor: { id: 'aranet4', names: ['aranet4'], lift: 0.02 },
    // The actual appliance/sensor front is +Z rotated -.17rad; this centre-side swing faces it.
    focus: { distance: 1.25, height: 1.12, yaw: 38, drop: 0.05 },
  },
  {
    id: 'prayer',
    label: 'Prayer station',
    kicker: 'Carved cabinet · prayer rug · rehal',
    title: 'The prayer station',
    blurb:
      'The carved cabinet with its mihrab crest, the green rug draped over it, the beads and the rehal. Prayer times are computed in your browser for the Toronto area (Jafari method).',
    anchor: { id: 'prayer', names: ['mihrab-crest', 'prayer-unit', 'prayer-station'], fallback: [-2.65, 1.6, 0.8], lift: 0.1 },
    focus: { distance: 2.0, height: 1.5, yaw: 0, drop: 0.55 },
  },
  {
    id: 'picture-frame',
    label: 'Picture frame',
    kicker: 'Home HQ · interactive public-safe demo',
    title: 'The picture frame',
    blurb:
      'Approach the actual desk display and interact with Home HQ. Cards, photos and cameras use clearly labelled synthetic demo data, never private household feeds.',
    anchor: { id: 'picture-frame', names: ['frame-screen'], fallback: [-1.315, 0.98, 2.276], lift: 0.01 },
    focus: { distance: 1.5, height: 1.35, yaw: 12, drop: 0.2 },
  },
  {
    id: 'lounge',
    label: 'Lounge',
    kicker: 'Tufted sofa · marble table · divider',
    title: 'The lounge',
    blurb:
      'Where the room was measured. The whole office is a LiDAR capture rebuilt object by object in code: no photogrammetry mesh, every piece modeled from the photos.',
    anchor: { id: 'lounge', names: ['tufted-sofa', 'lounge'], fallback: [2.52, 0.9, 0.39], lift: 0.15 },
    focus: { distance: 2.4, height: 1.6, yaw: 0, drop: 0.4 },
  },
];

/** Opening shot: straight down through the ceiling, high above the room. */
export const INTRO_POSE: CameraPose = { position: [0.4, 13, 3.2], target: [0, 0.4, 0] };

/** Seconds per guided-tour stop. */
export const TOUR_STOP_SECONDS = 9;

/** Scan provenance (from the capture bundle; see BRIEF.md in the room repo). */
export const SCAN_FACTS = { device: "Public geometry snapshot", captured: "Private captures withheld", photos: 0, depthFrames: 0, coveragePct: 0, roomMeters: "5.95 x 5.42 m", ceilingMeters: 2.44 } as const;

/** Prayer-time location: rounded Greater Toronto Area centre (city-level only). */
export const PRAYER_LOCATION = { lat: 43.6, lng: -79.6, timeZone: 'America/Toronto', label: 'Greater Toronto Area' } as const;
