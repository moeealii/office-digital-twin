/**
 * Pure logic for the office digital twin. App/components are wiring only.
 *
 * - parseTwin: the typed adapter for GET /api/twin (guards, never casts)
 * - formatters + status derivation for the telemetry panels
 * - sparkline geometry
 * - prayer times (Jafari) for the prayer-station panel
 * - quality selection for the 3D renderer
 */

// ---------------------------------------------------------------------------
// /api/twin snapshot (mirror of sanitize_twin in server/serve.py)
// ---------------------------------------------------------------------------

type TwinMode = 'live' | 'stale' | 'demo';
type TunnelStatus = 'connected' | 'degraded' | 'down';

interface NasInfo {
  platform: string;
  version: string | null;
  uptimeSeconds: number | null;
  cpuModel: string | null;
  cores: number | null;
  cpuTempC: number | null;
  cpuTempMaxC: number | null;
  cpuUsagePct: number | null;
  memTotalBytes: number | null;
  memAvailableBytes: number | null;
  load: number[];
}
interface Disk {
  label: string;
  kind: string;
  sizeBytes: number | null;
  tempC: number | null;
}
export interface Pool {
  name: string;
  status: string | null;
  healthy: boolean | null;
  sizeBytes: number | null;
  allocatedBytes: number | null;
}
interface AppInfo {
  name: string;
  state: string;
  containers: number;
}
export interface Apps {
  total: number;
  running: number;
  containers: number | null;
  list: AppInfo[];
}
export interface Tunnel {
  status: TunnelStatus;
  connections: number;
  edges: string[];
  requestErrors: number | null;
  totalRequests: number | null;
}
export interface Link {
  label: string;
  up: boolean;
  speedMbps: number | null;
  rxKbps: number | null;
  txKbps: number | null;
}
export interface SiteHealth {
  host: string;
  up: boolean;
  status: number | null;
  latencyMs: number | null;
}
interface Cameras {
  streams: number;
  online: number;
}
interface HaEntity {
  label: string;
  domain: string;
  state: number | string;
  unit: string;
}
interface Series {
  cpuTempC: number[];
  cpuUsagePct: number[];
  rxKbps: number[];
  txKbps: number[];
}
type SourceStatus = 'live' | 'stale' | 'unavailable' | 'demo';
export interface SourceMeta {
  status: SourceStatus;
  observedAt: string | null;
  ageSeconds: number | null;
}
interface EnvironmentalReading extends SourceMeta {
  label: 'Aranet4';
  status: Exclude<SourceStatus, 'demo'>;
  sampleIntervalSeconds: number | null;
  co2Ppm: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  batteryPct: number | null;
}
type SourceKey = 'nas' | 'storage' | 'apps' | 'tunnel' | 'network' | 'sites' | 'cameras' | 'homeAssistant';

export interface TwinSnapshot {
  mode: TwinMode;
  sources: Record<SourceKey, SourceMeta>;
  environment: EnvironmentalReading;
  generatedAt: string;
  ageSeconds: number;
  nas: NasInfo | null;
  disks: Disk[];
  pools: Pool[];
  apps: Apps;
  tunnel: Tunnel | null;
  links: Link[];
  sites: SiteHealth[];
  cameras: Cameras | null;
  homeAssistant: { entities: HaEntity[] } | null;
  series: Series;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Obj[] => arr(v).filter(isObj);
const nums = (v: unknown): number[] => arr(v).map(num).filter((n): n is number => n !== null);

function parseNas(v: unknown): NasInfo | null {
  if (!isObj(v)) return null;
  return {
    platform: str(v['platform']) ?? 'TrueNAS SCALE',
    version: str(v['version']),
    uptimeSeconds: num(v['uptimeSeconds']),
    cpuModel: str(v['cpuModel']),
    cores: num(v['cores']),
    cpuTempC: num(v['cpuTempC']),
    cpuTempMaxC: num(v['cpuTempMaxC']),
    cpuUsagePct: num(v['cpuUsagePct']),
    memTotalBytes: num(v['memTotalBytes']),
    memAvailableBytes: num(v['memAvailableBytes']),
    load: nums(v['load']),
  };
}

function parseTunnel(v: unknown): Tunnel | null {
  if (!isObj(v)) return null;
  const status = v['status'];
  return {
    status: status === 'connected' || status === 'degraded' ? status : 'down',
    connections: num(v['connections']) ?? 0,
    edges: arr(v['edges']).map(str).filter((s): s is string => s !== null),
    requestErrors: num(v['requestErrors']),
    totalRequests: num(v['totalRequests']),
  };
}

function parseApps(v: unknown): Apps {
  const o = isObj(v) ? v : {};
  const list = objs(o['list']).flatMap((a) => {
    const name = str(a['name']);
    return name === null ? [] : [{ name, state: str(a['state']) ?? 'STOPPED', containers: num(a['containers']) ?? 0 }];
  });
  return {
    total: num(o['total']) ?? list.length,
    running: num(o['running']) ?? list.filter((a) => a.state === 'RUNNING').length,
    containers: num(o['containers']),
    list,
  };
}

function parseHa(v: unknown): { entities: HaEntity[] } | null {
  if (!isObj(v)) return null;
  return {
    entities: objs(v['entities']).flatMap((e) => {
      const label = str(e['label']);
      const domain = str(e['domain']);
      const state = num(e['state']) ?? str(e['state']);
      return label === null || domain === null || state === null
        ? []
        : [{ label, domain, state, unit: str(e['unit']) ?? '' }];
    }),
  };
}

function parseSource(v: unknown): SourceMeta {
  const raw = isObj(v) ? v : {};
  const status = raw['status'];
  const observedAt = str(raw['observedAt']);
  const ageSeconds = num(raw['ageSeconds']);
  const hasTime = observedAt !== null && Number.isFinite(Date.parse(observedAt)) && ageSeconds !== null && ageSeconds >= 0;
  return {
    status: status === 'demo' ? 'demo' : hasTime && (status === 'live' || status === 'stale') ? status : 'unavailable',
    observedAt: hasTime ? observedAt : null,
    ageSeconds: hasTime ? ageSeconds : null,
  };
}

function parseEnvironment(v: unknown): EnvironmentalReading {
  const raw = isObj(v) ? v : {};
  const meta = parseSource(raw);
  const hasReading = ['co2Ppm', 'temperatureC', 'humidityPct', 'pressureHpa', 'batteryPct'].some((key) => num(raw[key]) !== null);
  const status = hasReading && (meta.status === 'live' || meta.status === 'stale') ? meta.status : 'unavailable';
  // Unknown/demo source states NEVER become plausible-looking sensor values.
  const reading = (key: string) => status === 'unavailable' ? null : num(raw[key]);
  return {
    ...meta, status, label: 'Aranet4',
    sampleIntervalSeconds: num(raw['sampleIntervalSeconds']),
    co2Ppm: reading('co2Ppm'), temperatureC: reading('temperatureC'),
    humidityPct: reading('humidityPct'), pressureHpa: reading('pressureHpa'),
    batteryPct: reading('batteryPct'),
  };
}

/** Typed adapter for GET /api/twin. Returns null for anything that is not a
 * schema-1 snapshot; tolerates missing/extra fields field by field. */
export function parseTwin(json: unknown): TwinSnapshot | null {
  if (!isObj(json) || json['schema'] !== 1) return null;
  const mode = json['mode'];
  if (mode !== 'live' && mode !== 'stale' && mode !== 'demo') return null;
  const series = isObj(json['series']) ? json['series'] : {};
  const network = isObj(json['network']) ? json['network'] : {};
  const cams = json['cameras'];
  const sources = isObj(json['sources']) ? json['sources'] : {};
  return {
    mode,
    sources: {
      nas: parseSource(sources['nas']), storage: parseSource(sources['storage']),
      apps: parseSource(sources['apps']), tunnel: parseSource(sources['tunnel']),
      network: parseSource(sources['network']), sites: parseSource(sources['sites']),
      cameras: parseSource(sources['cameras']), homeAssistant: parseSource(sources['homeAssistant']),
    },
    environment: parseEnvironment(json['environment']),
    generatedAt: str(json['generatedAt']) ?? '',
    ageSeconds: num(json['ageSeconds']) ?? 0,
    nas: parseNas(json['nas']),
    disks: objs(json['disks']).map((d, i) => ({
      label: str(d['label']) ?? `Disk ${String(i + 1)}`,
      kind: str(d['kind']) ?? 'HDD',
      sizeBytes: num(d['sizeBytes']),
      tempC: num(d['tempC']),
    })),
    pools: objs(json['pools']).map((p, i) => ({
      name: str(p['name']) ?? `pool ${String(i + 1)}`,
      status: str(p['status']),
      healthy: bool(p['healthy']),
      sizeBytes: num(p['sizeBytes']),
      allocatedBytes: num(p['allocatedBytes']),
    })),
    apps: parseApps(json['apps']),
    tunnel: parseTunnel(json['tunnel']),
    links: objs(network['links']).map((l, i) => ({
      label: str(l['label']) ?? `Uplink ${String(i + 1)}`,
      up: bool(l['up']) ?? false,
      speedMbps: num(l['speedMbps']),
      rxKbps: num(l['rxKbps']),
      txKbps: num(l['txKbps']),
    })),
    sites: objs(json['sites']).flatMap((s) => {
      const host = str(s['host']);
      return host === null
        ? []
        : [{ host, up: bool(s['up']) ?? false, status: num(s['status']), latencyMs: num(s['latencyMs']) }];
    }),
    cameras: isObj(cams) ? { streams: num(cams['streams']) ?? 0, online: num(cams['online']) ?? 0 } : null,
    homeAssistant: parseHa(json['homeAssistant']),
    series: {
      cpuTempC: nums(series['cpuTempC']),
      cpuUsagePct: nums(series['cpuUsagePct']),
      rxKbps: nums(series['rxKbps']),
      txKbps: nums(series['txKbps']),
    },
  };
}

// ---------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------

const DASH = '—';

export function formatBytes(bytes: number | null, digits = 1): string {
  if (bytes === null || bytes < 0) return DASH;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = bytes;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i] ?? 'PB'}`;
}

export function formatUptime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return DASH;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${String(d)}d ${String(h)}h`;
  if (h > 0) return `${String(h)}h ${String(m)}m`;
  return `${String(m)}m`;
}

export function formatTemp(c: number | null): string {
  return c === null ? DASH : `${c.toFixed(1)}°C`;
}

/** Kilobits/s (netdata's interface unit) → human rate. */
export function formatRate(kbps: number | null): string {
  if (kbps === null) return DASH;
  if (kbps >= 1_000_000) return `${(kbps / 1_000_000).toFixed(2)} Gb/s`;
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mb/s`;
  return `${kbps.toFixed(0)} kb/s`;
}

export function formatAge(seconds: number): string {
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${String(Math.floor(seconds / 60))} min ago`;
  return `${String(Math.floor(seconds / 3600))} h ago`;
}

export function percent(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

export function formatCount(n: number | null): string {
  return n === null ? DASH : n.toLocaleString('en-CA');
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export type Status = 'good' | 'warning' | 'critical' | 'unknown';

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  good: 'Nominal',
  warning: 'Watch',
  critical: 'Alert',
  unknown: 'No signal',
};

/** Worst wins. */
export function worst(statuses: readonly Status[]): Status {
  const rank: Record<Status, number> = { unknown: 0, good: 1, warning: 2, critical: 3 };
  return statuses.reduce<Status>((a, b) => (rank[b] > rank[a] ? b : a), 'unknown');
}

export function tempStatus(c: number | null, warnAt: number, critAt: number): Status {
  if (c === null) return 'unknown';
  if (c >= critAt) return 'critical';
  if (c >= warnAt) return 'warning';
  return 'good';
}

export function poolStatus(p: Pool): Status {
  if (p.status === null && p.healthy === null) return 'unknown';
  if (p.status !== 'ONLINE') return 'critical';
  if (p.healthy === false) return 'warning';
  const used = percent(p.allocatedBytes, p.sizeBytes);
  return used !== null && used >= 90 ? 'warning' : 'good';
}

export function tunnelStatus(t: Tunnel | null): Status {
  if (t === null) return 'unknown';
  return t.status === 'connected' ? 'good' : t.status === 'degraded' ? 'warning' : 'critical';
}

export function sitesStatus(sites: readonly SiteHealth[]): Status {
  if (!sites.length) return 'unknown';
  const down = sites.filter((s) => !s.up).length;
  if (down === 0) return 'good';
  return down === sites.length ? 'critical' : 'warning';
}

export function appsStatus(apps: Apps): Status {
  if (!apps.total) return 'unknown';
  return apps.running === apps.total ? 'good' : apps.running === 0 ? 'critical' : 'warning';
}

export function nasStatus(t: TwinSnapshot): Status {
  return worst([
    tempStatus(t.nas?.cpuTempC ?? null, 70, 85),
    ...t.disks.map((d) => tempStatus(d.tempC, 45, 55)),
    ...t.pools.map(poolStatus),
  ]);
}

export function linksStatus(links: readonly Link[]): Status {
  if (!links.length) return 'unknown';
  return links.some((l) => l.up) ? 'good' : 'critical';
}

export type HotspotId = 'rack' | 'aranet4' | 'prayer' | 'picture-frame' | 'lounge';

/** The glow colour of each hotspot marker. */
export function hotspotStatus(twin: TwinSnapshot | null, id: HotspotId): Status {
  if (twin === null) return 'unknown';
  switch (id) {
    case 'rack':
      return worst([nasStatus(twin), tunnelStatus(twin.tunnel), linksStatus(twin.links)]);
    case 'aranet4':
      // Source availability/freshness only, never an inference from NAS/site health or modeled LCD art.
      return twin.environment.status === 'live' ? 'good' : twin.environment.status === 'stale' ? 'warning' : 'unknown';
    case 'picture-frame':
      return 'good'; // local public-safe preview; never a claim that private household feeds are live
    case 'prayer':
    case 'lounge':
      return 'good'; // computed locally / static facts: always available
  }
}

// ---------------------------------------------------------------------------
// sparklines
// ---------------------------------------------------------------------------

export interface SparkGeometry {
  line: string;
  area: string;
  points: readonly { x: number; y: number; value: number }[];
  min: number;
  max: number;
}

/** SVG path data for a single-series sparkline, padded so a flat line sits mid-height. */
export function sparkline(values: readonly number[], width: number, height: number, pad = 2): SparkGeometry | null {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const flat = max === min;
  const step = (width - pad * 2) / (values.length - 1);
  const points = values.map((value, i) => ({
    x: pad + i * step,
    y: flat ? height / 2 : pad + (1 - (value - min) / span) * (height - pad * 2),
    value,
  }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const area = first && last ? `${line} L${last.x.toFixed(1)} ${String(height)} L${first.x.toFixed(1)} ${String(height)} Z` : '';
  return { line, area, points, min, max };
}

/** Index of the sample nearest an x position (for the hover readout). */
export function nearestIndex(x: number, count: number, width: number, pad = 2): number {
  if (count <= 1) return 0;
  const step = (width - pad * 2) / (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round((x - pad) / step)));
}

// ---------------------------------------------------------------------------
// prayer times — Jafari (Fajr 16°, Maghrib 4°), the praytimes.org algorithm
// with one refinement pass; agrees with aladhan.com method 0 to the minute.
// Ported from the family photo-frame dashboard (js/prayertimes.js).
// ---------------------------------------------------------------------------

interface PrayerDay {
  y: number;
  m: number;
  d: number;
}
export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'sunset' | 'maghrib';
type PrayerTimes = Record<PrayerName, number>;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fix = (a: number, b: number) => {
  const r = a - b * Math.floor(a / b);
  return r < 0 ? r + b : r;
};

function julian(y0: number, m0: number, d: number): number {
  const y = m0 <= 2 ? y0 - 1 : y0;
  const m = m0 <= 2 ? m0 + 12 : m0;
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - fix(RA, 24) };
}

/** Prayer times for a day as fractional local hours (13.5 = 1:30 PM); tz = hours from UTC. */
export function prayerTimes(day: PrayerDay, lat: number, lng: number, tz: number): PrayerTimes {
  const jd = julian(day.y, day.m, day.d) - lng / (15 * 24);
  const noon = (t: number) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const decl = sunPosition(jd + t).decl;
    const T =
      deg(
        Math.acos(
          (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))),
        ),
      ) / 15;
    return noon(t) + (ccw ? -T : T);
  };
  const compute = (g: PrayerTimes): PrayerTimes => ({
    fajr: angleTime(16, g.fajr / 24, true),
    sunrise: angleTime(0.833, g.sunrise / 24, true),
    dhuhr: noon(g.dhuhr / 24),
    sunset: angleTime(0.833, g.sunset / 24, false),
    maghrib: angleTime(4, g.maghrib / 24, false),
  });
  const t = compute(compute({ fajr: 5, sunrise: 6, dhuhr: 12, sunset: 18, maghrib: 18 }));
  const shift = tz - lng / 15;
  return {
    fajr: t.fajr + shift,
    sunrise: t.sunrise + shift,
    dhuhr: t.dhuhr + shift,
    sunset: t.sunset + shift,
    maghrib: t.maghrib + shift,
  };
}

/** Hours from UTC for an IANA zone at an instant (e.g. Toronto: -4 EDT, -5 EST). */
export function zoneOffsetHours(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 900000) / 4;
}

/** Calendar day in a zone. */
export function zoneDay(at: Date, timeZone: string): PrayerDay {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get('year'), m: get('month'), d: get('day') };
}

export function formatClock(hours: number): string {
  const total = Math.round(fix(hours, 24) * 60) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h % 12 || 12)}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const PRAYER_LABEL: Readonly<Record<PrayerName, string>> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  sunset: 'Sunset',
  maghrib: 'Maghrib',
};

export interface PrayerBoard {
  times: PrayerTimes;
  next: { name: PrayerName; inMinutes: number; tomorrow: boolean };
}

/** Today's times in the zone plus the next prayer (Fajr/Dhuhr/Maghrib; sunrise/sunset are markers). */
export function prayerBoard(now: Date, lat: number, lng: number, timeZone: string): PrayerBoard {
  const tz = zoneOffsetHours(now, timeZone);
  const day = zoneDay(now, timeZone);
  const times = prayerTimes(day, lat, lng, tz);
  const nowHours = fix(now.getTime() / 3_600_000 + tz, 24);
  const order: PrayerName[] = ['fajr', 'dhuhr', 'maghrib'];
  const upcoming = order.find((p) => times[p] > nowHours);
  if (upcoming) {
    return { times, next: { name: upcoming, inMinutes: Math.round((times[upcoming] - nowHours) * 60), tomorrow: false } };
  }
  return { times, next: { name: 'fajr', inMinutes: Math.round((24 - nowHours + times.fajr) * 60), tomorrow: true } };
}

/** Initial great-circle bearing from a point to the Kaaba, degrees from north. */
export function qiblaBearing(lat: number, lng: number): number {
  const kLat = rad(21.4225);
  const kLng = rad(39.8262);
  const p = rad(lat);
  const dl = kLng - rad(lng);
  const y = Math.sin(dl);
  const x = Math.cos(p) * Math.tan(kLat) - Math.sin(p) * Math.cos(dl);
  return fix(deg(Math.atan2(y, x)), 360);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${String(h)}h ${String(m)}m` : `${String(m)} min`;
}

// ---------------------------------------------------------------------------
// renderer quality + tour
// ---------------------------------------------------------------------------

export interface DeviceHints {
  coarsePointer: boolean;
  width: number;
  cores: number | undefined;
  memoryGb: number | undefined;
  saveData: boolean;
  /** ?quality=high|low override */
  override: string | null;
}

export function chooseQuality(h: DeviceHints): 'high' | 'low' {
  if (h.override === 'high' || h.override === 'low') return h.override;
  if (h.saveData) return 'low';
  if (h.memoryGb !== undefined && h.memoryGb < 4) return 'low';
  if (h.cores !== undefined && h.cores < 4) return 'low';
  if (h.coarsePointer && h.width < 900) return 'low';
  return 'high';
}

export function stepTour(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

// ---------------------------------------------------------------------------
// camera framing
// ---------------------------------------------------------------------------

export type Vec3 = readonly [number, number, number];

export interface FocusOptions {
  /** Horizontal distance from the anchor (m). */
  distance: number;
  /** Camera height above the floor (m). */
  height: number;
  /** Swing the viewpoint around the anchor (degrees, + = counter-clockwise from above). */
  yaw: number;
  /** Lower the look-at point below the marker (m). */
  drop: number;
}

/** A viewpoint that looks at `anchor` from the room-centre side, so the
 * camera stays inside the room and the walls behind the object stay up. */
export function focusPose(anchor: Vec3, o: FocusOptions): { position: Vec3; target: Vec3 } {
  const [ax, ay, az] = anchor;
  let dx = -ax;
  let dz = -az;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const a = (o.yaw * Math.PI) / 180;
  const rx = dx * Math.cos(a) - dz * Math.sin(a);
  const rz = dx * Math.sin(a) + dz * Math.cos(a);
  return {
    position: [ax + rx * o.distance, o.height, az + rz * o.distance],
    target: [ax, ay - o.drop, az],
  };
}
