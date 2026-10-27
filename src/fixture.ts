import type { TwinSnapshot } from './lib';
/** Synthetic, generic local demo; no household device inventory or measurements. */
export function demoTwin(nowMs: number): TwinSnapshot {
  const demo = { status: 'demo' as const, observedAt: null, ageSeconds: null };
  const unavailable = { status: 'unavailable' as const, observedAt: null, ageSeconds: null };
  return {
    mode: 'demo', generatedAt: new Date(nowMs).toISOString(), ageSeconds: 0,
    sources: { nas: demo, storage: demo, apps: demo, tunnel: unavailable, network: demo,
      sites: unavailable, cameras: unavailable, homeAssistant: unavailable },
    environment: { ...unavailable, label: 'Aranet4', sampleIntervalSeconds: null,
      co2Ppm: null, temperatureC: null, humidityPct: null, pressureHpa: null, batteryPct: null },
    nas: { platform: 'Example NAS', version: 'demo', uptimeSeconds: 3600,
      cpuModel: 'Example processor', cores: 4, cpuTempC: 35, cpuTempMaxC: 45,
      cpuUsagePct: 12, memTotalBytes: 16000000000, memAvailableBytes: 8000000000,
      load: [0.1, 0.2, 0.3] },
    disks: [{ label: 'Example disk', kind: 'HDD', sizeBytes: 1000000000000, tempC: 30 }],
    pools: [{ name: 'example', status: 'ONLINE', healthy: true,
      sizeBytes: 1000000000000, allocatedBytes: 250000000000 }],
    apps: { total: 0, running: 0, containers: 0, list: [] },
    tunnel: null,
    links: [{ label: 'Example link', up: true, speedMbps: 1000, rxKbps: 100, txKbps: 10 }],
    sites: [], cameras: { streams: 0, online: 0 }, homeAssistant: null,
    series: { cpuTempC: [34,35,34,35], cpuUsagePct: [10,12,11,12],
      rxKbps: [80,100,90,100], txKbps: [8,10,9,10] },
  };
}
