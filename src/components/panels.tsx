import { useState } from 'react';
import { Tag } from '@thealifamily/ui';
import { PRAYER_LOCATION, SCAN_FACTS } from '../data';
import {
  appsStatus,
  formatBytes,
  formatClock,
  formatCount,
  formatDuration,
  formatRate,
  formatTemp,
  formatUptime,
  linksStatus,
  nasStatus,
  percent,
  poolStatus,
  PRAYER_LABEL,
  prayerBoard,
  qiblaBearing,
  sitesStatus,
  tempStatus,
  tunnelStatus,
  type PrayerName,
  type TwinSnapshot,
} from '../lib';
import type { RoomStats } from '../room/engine-api';
import { Meter, PanelSection, Readout, SourceBadge, Sparkline, StatusPill } from './widgets';

const pctLabel = (p: number | null) => (p === null ? '—' : `${p.toFixed(0)}%`);
const temp1 = (v: number) => `${v.toFixed(1)}°C`;
const pct1 = (v: number) => `${v.toFixed(0)}%`;

// ---------------------------------------------------------------------------
// The rack: NAS + storage + tunnel + network, as tabs
// ---------------------------------------------------------------------------

type RackTab = 'system' | 'storage' | 'tunnel' | 'network';
const RACK_TABS: readonly { id: RackTab; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'storage', label: 'Storage' },
  { id: 'tunnel', label: 'Tunnel' },
  { id: 'network', label: 'Network' },
];

export function RackPanel({ twin }: { twin: TwinSnapshot }) {
  const [tab, setTab] = useState<RackTab>('system');
  const statusOf: Record<RackTab, ReturnType<typeof nasStatus>> = {
    system: tempStatus(twin.nas?.cpuTempC ?? null, 70, 85),
    storage: nasStatus(twin),
    tunnel: tunnelStatus(twin.tunnel),
    network: linksStatus(twin.links),
  };
  return (
    <>
      <div className="tabs" role="tablist" aria-label="Rack telemetry">
        {RACK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`rack-tab-${t.id}`}
            aria-selected={tab === t.id}
            tabIndex={tab === t.id ? 0 : -1}
            aria-controls={`rack-pane-${t.id}`}
            onKeyDown={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const at = RACK_TABS.findIndex((x) => x.id === t.id);
              const next = e.key === 'Home' ? 0 : e.key === 'End' ? RACK_TABS.length - 1
                : (at + (e.key === 'ArrowRight' ? 1 : -1) + RACK_TABS.length) % RACK_TABS.length;
              const id = RACK_TABS[next]?.id;
              if (id) {
                setTab(id);
                document.getElementById(`rack-tab-${id}`)?.focus();
              }
            }}
            data-status={statusOf[t.id]}
            onClick={() => {
              setTab(t.id);
            }}
          >
            <span className="tab-led" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`rack-pane-${tab}`} aria-labelledby={`rack-tab-${tab}`} className="tabpane">
        {tab === 'system' ? <><SourceBadge name="NAS" source={twin.sources.nas} /><SystemPane twin={twin} /><AppsPanel twin={twin} /><HomePanel twin={twin} /></> : null}
        {tab === 'storage' ? <><SourceBadge name="Storage" source={twin.sources.storage} /><StoragePane twin={twin} /></> : null}
        {tab === 'tunnel' ? <><SourceBadge name="Tunnel" source={twin.sources.tunnel} /><TunnelPane twin={twin} /><SitesHealthPane twin={twin} /></> : null}
        {tab === 'network' ? <><SourceBadge name="Network" source={twin.sources.network} /><NetworkPane twin={twin} /></> : null}
      </div>
    </>
  );
}

function SystemPane({ twin }: { twin: TwinSnapshot }) {
  const nas = twin.nas;
  if (!nas) return <p className="empty">The NAS did not report system data.</p>;
  const memUsed = nas.memTotalBytes !== null && nas.memAvailableBytes !== null ? nas.memTotalBytes - nas.memAvailableBytes : null;
  const memPct = percent(memUsed, nas.memTotalBytes);
  return (
    <>
      <div className="readouts">
        <Readout value={formatTemp(nas.cpuTempC)} label="CPU temp" status={tempStatus(nas.cpuTempC, 70, 85)} />
        <Readout value={formatUptime(nas.uptimeSeconds)} label="Uptime" />
        <Readout value={pctLabel(nas.cpuUsagePct)} label="CPU load" />
        <Readout value={nas.load[0]?.toFixed(2) ?? '—'} label="Load avg (1 min)" />
      </div>
      <Sparkline title="CPU temperature · last hour" values={twin.series.cpuTempC} format={temp1} />
      <Sparkline title="CPU utilisation · last hour" values={twin.series.cpuUsagePct} format={pct1} />
      <Meter
        label="Memory in use"
        value={memPct}
        max={100}
        caption={`${formatBytes(memUsed)} of ${formatBytes(nas.memTotalBytes)} · ZFS cache counts as used`}
        status="good"
      />
      <dl className="facts">
        <div>
          <dt>Platform</dt>
          <dd>
            {nas.platform} {nas.version ?? ''}
          </dd>
        </div>
        <div>
          <dt>CPU</dt>
          <dd>
            {nas.cpuModel ?? '—'}
            {nas.cores ? ` · ${String(nas.cores)} cores` : ''}
          </dd>
        </div>
        <div>
          <dt>Hottest this hour</dt>
          <dd>{formatTemp(nas.cpuTempMaxC)}</dd>
        </div>
      </dl>
    </>
  );
}

function StoragePane({ twin }: { twin: TwinSnapshot }) {
  return (
    <>
      {twin.pools.map((p) => {
        const used = percent(p.allocatedBytes, p.sizeBytes);
        const st = poolStatus(p);
        return (
          <PanelSection key={p.name} title={`Pool “${p.name}”`} aside={<StatusPill status={st} label={p.status ?? undefined} />}>
            <Meter
              label="Capacity used"
              value={used}
              max={100}
              caption={`${formatBytes(p.allocatedBytes)} of ${formatBytes(p.sizeBytes)} (${pctLabel(used)})`}
              status={used !== null && used >= 80 ? 'warning' : 'good'}
            />
          </PanelSection>
        );
      })}
      <PanelSection title="Drive temperatures" aside={<span className="hint">warn 45° · alert 55°</span>}>
        <div className="disks">
          {twin.disks.map((d) => (
            <Meter
              key={d.label}
              label={`${d.label} · ${d.kind} · ${formatBytes(d.sizeBytes, 0)}`}
              value={d.tempC}
              max={60}
              caption={formatTemp(d.tempC)}
              status={tempStatus(d.tempC, 45, 55)}
            />
          ))}
        </div>
      </PanelSection>
    </>
  );
}

function TunnelPane({ twin }: { twin: TwinSnapshot }) {
  const t = twin.tunnel;
  if (!t) return <p className="empty">No tunnel data.</p>;
  return (
    <>
      <div className="tunnel-hero" data-status={tunnelStatus(t)}>
        <div className="tunnel-links" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} data-on={i < t.connections} />
          ))}
        </div>
        <div>
          <p className="tunnel-state">{t.status}</p>
          <p className="hint">
            {String(t.connections)} of 4 Cloudflare connections ready
            {t.edges.length ? ` · edge ${t.edges.join(', ')}` : ''}
          </p>
        </div>
      </div>
      <div className="readouts">
        <Readout value={formatCount(t.totalRequests)} label="Requests since restart" />
        <Readout value={formatCount(t.requestErrors)} label="Request errors" status={t.requestErrors ? 'warning' : 'good'} />
      </div>
    </>
  );
}

function NetworkPane({ twin }: { twin: TwinSnapshot }) {
  return (
    <>
      <ul className="links">
        {twin.links.map((l) => (
          <li key={l.label} data-up={l.up}>
            <StatusPill status={l.up ? 'good' : 'unknown'} label={l.up ? 'Link up' : 'Unplugged'} />
            <span className="link-name">{l.label}</span>
            <span className="link-speed">{l.speedMbps ? `${String(l.speedMbps)} Mb/s` : '—'}</span>
            {l.up ? (
              <span className="link-rate">
                ↓ {formatRate(l.rxKbps)} · ↑ {formatRate(l.txKbps)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <Sparkline title="Inbound · last hour" values={twin.series.rxKbps} format={formatRate} />
      <Sparkline title="Outbound · last hour" values={twin.series.txKbps} format={formatRate} />
      <p className="hint">
        The office side is an eero 6 mesh point; the NAS hangs off it over gigabit Ethernet. Interface names and
        addresses are never published.
      </p>
    </>
  );
}

function SitesList({ twin }: { twin: TwinSnapshot }) {
  return (
    <PanelSection title="Sites behind the tunnel" aside={<StatusPill status={sitesStatus(twin.sites)} />}>
      <SourceBadge name="Public sites" source={twin.sources.sites} />
      <ul className="sites">
        {twin.sites.map((s) => (
          <li key={s.host} data-up={s.up}>
            <span className="site-led" aria-hidden="true" />
            <a href={`https://${s.host}/`} target="_blank" rel="noreferrer">
              {s.host.replace('.thealifamily.ca', '')}
              <span className="site-domain">.thealifamily.ca</span>
            </a>
            <span className="site-meta">
              {s.up ? 'up' : 'down'} · {s.latencyMs === null ? '—' : `${String(s.latencyMs)} ms`}
            </span>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}

// ---------------------------------------------------------------------------
// other hotspots
// ---------------------------------------------------------------------------

export function EnvironmentPanel({ twin }: { twin: TwinSnapshot }) {
  const air = twin.environment;
  return (
    <PanelSection title="Sensor readings">
      <SourceBadge name="Aranet4" source={air} />
      <div className="environment readouts">
        <Readout value={air.co2Ppm === null ? '—' : `${formatCount(air.co2Ppm)} ppm`} label="CO₂ concentration" />
        <Readout value={formatTemp(air.temperatureC)} label="Temperature" />
        <Readout value={air.humidityPct === null ? '—' : `${air.humidityPct.toFixed(1)}% RH`} label="Relative humidity" />
        <Readout value={air.pressureHpa === null ? '—' : `${air.pressureHpa.toFixed(1)} hPa`} label="Pressure" />
        <Readout value={air.batteryPct === null ? '—' : `${air.batteryPct.toFixed(0)}%`} label="Battery" />
      </div>
      <p className="hint">
        {air.status === 'unavailable' ? 'No Aranet4 reading is available. No sensor values are simulated.'
          : air.status === 'stale' ? 'Last measured sample shown — this is not a current reading.'
          : 'Measured by the Aranet4; freshness uses the sensor’s own measurement time.'}
        {' '}The modeled LCD is static artwork, not a live sample. NAS and room-air sources are independent; missing measurements stay blank.
      </p>
    </PanelSection>
  );
}

function SitesHealthPane({ twin }: { twin: TwinSnapshot }) {
  const up = twin.sites.filter((s) => s.up).length;
  const lat = twin.sites.map((s) => s.latencyMs).filter((v): v is number => v !== null);
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null;
  return (
    <>
      <div className="readouts">
        <Readout value={`${String(up)}/${String(twin.sites.length)}`} label="Sites up" status={sitesStatus(twin.sites)} />
        <Readout value={avg === null ? '—' : `${String(avg)} ms`} label="Avg response" />
      </div>
      <SitesList twin={twin} />
      <p className="hint">Checked from the public internet, through Cloudflare, once a minute.</p>
    </>
  );
}

function AppsPanel({ twin }: { twin: TwinSnapshot }) {
  const { apps } = twin;
  const BLURB: Readonly<Record<string, string>> = {
    cloudflared: 'the tunnel that publishes the sites',
    hermes: 'the family AI agent',
    immich: 'the photo library',
  };
  return (
    <>
      <div className="readouts">
        <Readout value={`${String(apps.running)}/${String(apps.total)}`} label="Apps running" status={appsStatus(apps)} />
        <Readout value={formatCount(apps.containers)} label="Containers up" />
      </div>
      <PanelSection title="TrueNAS apps">
        <SourceBadge name="Apps" source={twin.sources.apps} />
        <ul className="apps">
          {apps.list.map((a) => (
            <li key={a.name}>
              <StatusPill status={a.state === 'RUNNING' ? 'good' : 'warning'} label={a.state.toLowerCase()} />
              <span className="app-name">{a.name}</span>
              <span className="app-meta">
                {BLURB[a.name] ?? 'self-hosted app'} · {String(a.containers)} container{a.containers === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      </PanelSection>
      <p className="hint">Plus compose stacks outside the app catalog: this sites server, the photo-frame services and the camera bridge.</p>
    </>
  );
}

const PRAYERS: readonly PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'sunset', 'maghrib'];

export function PrayerPanel({ now }: { now: Date }) {
  const { lat, lng, timeZone, label } = PRAYER_LOCATION;
  const board = prayerBoard(now, lat, lng, timeZone);
  const qibla = qiblaBearing(lat, lng);
  return (
    <>
      <div className="prayer-next">
        <p className="eyebrow-mono">Next prayer</p>
        <p className="prayer-name">{PRAYER_LABEL[board.next.name]}</p>
        <p className="hint">
          in {formatDuration(board.next.inMinutes)}
          {board.next.tomorrow ? ' (tomorrow)' : ''} · at {formatClock(board.times[board.next.name])} Toronto time
        </p>
      </div>
      <ol className="prayer-times">
        {PRAYERS.map((p) => (
          <li key={p} data-next={p === board.next.name && !board.next.tomorrow} data-marker={p === 'sunrise' || p === 'sunset'}>
            <span>{PRAYER_LABEL[p]}</span>
            <span>{formatClock(board.times[p])}</span>
          </li>
        ))}
      </ol>
      <div className="qibla">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="29" />
          <text x="32" y="12">
            N
          </text>
          <g transform={`rotate(${qibla.toFixed(1)} 32 32)`}>
            <path d="M32 9 L36 32 L32 28 L28 32 Z" />
          </g>
        </svg>
        <p>
          Qibla <strong>{qibla.toFixed(0)}°</strong> from north
          <br />
          <span className="hint">
            {label} · Jafari (Fajr 16°, Maghrib 4°)
          </span>
        </p>
      </div>
    </>
  );
}

function HomePanel({ twin }: { twin: TwinSnapshot }) {
  const cams = twin.cameras;
  return (
    <>
      <SourceBadge name="Camera bridge" source={twin.sources.cameras} />
      <div className="readouts">
        <Readout
          value={cams ? `${String(cams.online)}/${String(cams.streams)}` : '—'}
          label="Camera streams live"
          status={cams ? (cams.online === cams.streams ? 'good' : 'warning') : 'unknown'}
        />
        <Readout value={twin.homeAssistant ? String(twin.homeAssistant.entities.length) : '—'} label="HA entities" />
      </div>
      <PanelSection
        title="Home Assistant"
        aside={<StatusPill status={twin.homeAssistant ? 'good' : 'unknown'} label={twin.homeAssistant ? 'connected' : 'not connected'} />}
      >
        <SourceBadge name="Home Assistant" source={twin.sources.homeAssistant} />
        {twin.homeAssistant?.entities.length ? (
          <ul className="entities">
            {twin.homeAssistant.entities.map((e) => (
              <li key={e.label}>
                <span>{e.label}</span>
                <span>
                  {typeof e.state === 'number' ? e.state.toFixed(1) : e.state} {e.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">
            No Home Assistant feed is connected. The twin is wired for it: allowlisted, read-only sensor readings
            (labels only, never entity ids) will show up here.
          </p>
        )}
      </PanelSection>
      <p className="hint">Camera feeds stay private; only the count of live streams is published.</p>
    </>
  );
}

export function ScanPanel({ stats }: { stats: RoomStats | null }) {
  return (
    <>
      <div className="readouts">
        <Readout value={SCAN_FACTS.photos} label="Posed photos" />
        <Readout value={formatCount(SCAN_FACTS.depthFrames)} label="Depth frames" />
        <Readout value={`${String(SCAN_FACTS.coveragePct)}%`} label="Scan coverage" />
        <Readout value={stats ? formatCount(stats.triangles) : '—'} label="Triangles" />
      </div>
      <dl className="facts">
        <div>
          <dt>Captured</dt>
          <dd>
            {SCAN_FACTS.captured} · {SCAN_FACTS.device}
          </dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>
            {SCAN_FACTS.roomMeters}, {SCAN_FACTS.ceilingMeters} m ceiling
          </dd>
        </div>
        <div>
          <dt>Scene</dt>
          <dd>{stats ? `${formatCount(stats.objects)} named parts · ${formatCount(stats.meshes)} meshes · built in ${(stats.buildMs / 1000).toFixed(1)} s on your device` : '—'}</dd>
        </div>
      </dl>
      <p className="hint">
        Rebuilt in Three.js from a single LiDAR room capture: walls and openings from RoomPlan, then every object
        modeled by hand in code against the photos. Nothing here is a scanned mesh.
      </p>
      <div className="tags">
        <Tag label="three.js" />
        <Tag label="roomplan" />
        <Tag label="procedural" />
      </div>
    </>
  );
}
