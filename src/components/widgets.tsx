import { useId, useState, type ReactNode } from 'react';
import { ProgressBar, StatTile } from '@thealifamily/ui';
import { formatAge, nearestIndex, sparkline, STATUS_LABEL, type SourceMeta, type Status } from '../lib';

const STATUS_ICON: Readonly<Record<Status, string>> = {
  good: '●',
  warning: '▲',
  critical: '■',
  unknown: '○',
};

/** Status is never colour alone: icon + label + colour. */
export function StatusPill({ status, label }: { status: Status; label?: string | undefined }) {
  return (
    <span className="status-pill" data-status={status}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/** Freshness belongs to each source, never to the enclosing NAS snapshot. */
export function SourceBadge({ name, source }: { name: string; source: SourceMeta }) {
  const status: Status = source.status === 'live' ? 'good' : source.status === 'unavailable' ? 'unknown' : 'warning';
  const label = source.status === 'demo' ? 'demo · not live' : source.status;
  return (
    <div className="source-status" role="status">
      <StatusPill status={status} label={`${name} · ${label}`} />
      <span className="hint">
        {source.status === 'demo' ? 'Illustrative fixture' : source.ageSeconds === null ? 'No measured sample'
          : `${source.status === 'unavailable' ? 'Last report' : 'Measured'} ${formatAge(source.ageSeconds)}`}
      </span>
    </div>
  );
}

/** Stat tile (ui StatTile) with an optional status edge. */
export function Readout({ value, label, status }: { value: ReactNode; label: ReactNode; status?: Status | undefined }) {
  return (
    <div className="readout" data-status={status ?? 'unknown'}>
      <StatTile value={value} label={label} />
    </div>
  );
}

/** Meter: ui ProgressBar with a caption row; the fill carries severity. */
export function Meter({
  label,
  value,
  max,
  caption,
  status,
}: {
  label: string;
  value: number | null;
  max: number;
  caption: ReactNode;
  status: Status;
}) {
  return (
    <div className="meter" data-status={status}>
      <div className="meter-row">
        <span className="meter-label">{label}</span>
        <span className="meter-caption">{caption}</span>
      </div>
      {value === null ? <p className="hint">No reading</p> : <ProgressBar value={value} max={max} label={label} />}
    </div>
  );
}

const W = 240;
const H = 44;

/**
 * Single-series sparkline over the last hour (one series: the title names it,
 * no legend). Hover/focus shows a crosshair + readout; the full values are
 * also available to screen readers as a list.
 */
export function Sparkline({
  title,
  values,
  format,
  minutes = 60,
}: {
  title: string;
  values: readonly number[];
  format: (v: number) => string;
  minutes?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const geo = sparkline(values, W, H);
  const latest = values.length ? values[values.length - 1] : undefined;
  const shown = hover !== null ? geo?.points[hover] : undefined;
  const minutesAgo = (i: number) => Math.round(((values.length - 1 - i) / Math.max(1, values.length - 1)) * minutes);
  return (
    <figure className="spark" aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className="spark-head">
        <span className="spark-title">{title}</span>
        <span className="spark-value">
          {shown ? (
            <>
              {format(shown.value)} <small>{hover !== null ? `${String(minutesAgo(hover))} min ago` : ''}</small>
            </>
          ) : latest !== undefined ? (
            format(latest)
          ) : (
            '—'
          )}
        </span>
      </figcaption>
      {geo ? (
        <svg
          className="spark-plot"
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          preserveAspectRatio="none"
          role="slider"
          tabIndex={0}
          aria-label={`${title}: use arrow keys to inspect samples`}
          aria-valuemin={0}
          aria-valuemax={values.length - 1}
          aria-valuenow={hover ?? values.length - 1}
          aria-valuetext={`${format(shown?.value ?? latest ?? 0)}, ${String(minutesAgo(hover ?? values.length - 1))} minutes ago`}
          onFocus={() => { setHover(values.length - 1); }}
          onBlur={() => { setHover(null); }}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            setHover((i) => e.key === 'Home' ? 0 : e.key === 'End' ? values.length - 1
              : Math.max(0, Math.min(values.length - 1, (i ?? values.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))));
          }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(nearestIndex(((e.clientX - r.left) / r.width) * W, values.length, W));
          }}
          onPointerLeave={() => {
            setHover(null);
          }}
        >
          <path className="spark-area" d={geo.area} />
          <path className="spark-line" d={geo.line} vectorEffect="non-scaling-stroke" />
          {shown ? (
            <>
              <line className="spark-cross" x1={shown.x} x2={shown.x} y1={0} y2={H} vectorEffect="non-scaling-stroke" />
              <circle className="spark-dot" cx={shown.x} cy={shown.y} r={4} />
            </>
          ) : null}
        </svg>
      ) : (
        <p className="spark-empty">collecting…</p>
      )}
      <details className="spark-data">
        <summary>View samples</summary>
        <table>
          <thead><tr><th scope="col">Minutes ago</th><th scope="col">Reading</th></tr></thead>
          <tbody>{values.map((v, i) => (
            <tr key={`m${String(minutesAgo(i))}`}><th scope="row">{String(minutesAgo(i))}</th><td>{format(v)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}

/** Section heading inside a panel, mission-control style. */
export function PanelSection({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel-section">
      <header className="panel-section-head">
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
