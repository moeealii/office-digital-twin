import type { RoomEngine, TidyState } from '../room/engine-api';

export default function TidyTools({ state, engine, toggle }: { state: TidyState; engine: RoomEngine; toggle: () => void }) {
  return (
    <>
      {state.enabled && state.bounds ? <div className="tidy-outline" aria-hidden="true" style={{ left: state.bounds.x, top: state.bounds.y, width: state.bounds.width, height: state.bounds.height }} /> : null}
      <aside className="tidy-tools" aria-label="Tidy tools">
        <div className="tidy-heading"><strong>{state.preparing ? 'Preparing Tidy…' : state.enabled ? 'Tidy mode' : 'Your tidied room'}</strong>
          <button type="button" onClick={toggle} disabled={state.preparing}>{state.enabled ? 'Done' : 'Keep tidying'}</button></div>
        <p role="status">{state.error ?? (state.lastHidden ? `Swept away: ${state.lastHidden}` : state.selection ? `Target: ${state.selection}` : 'Point or tap an item to sweep it away. Drag to orbit.')}</p>
        <div className="tidy-actions">
          <button type="button" onClick={() => { engine.undoTidy(); }} disabled={!state.hiddenCount}>Undo</button>
          <button type="button" onClick={() => { engine.restoreTidy(); }} disabled={!state.hiddenCount}>Restore all</button>
          <button type="button" aria-pressed={!state.muted} onClick={() => { engine.muteTidy(!state.muted); }}>{state.muted ? 'Sound muted' : 'Sweep sound on'}</button>
          <span>{state.hiddenCount} hidden · this session only</span>
        </div>
        {state.enabled && !state.preparing ? <>
          <div className="tidy-options">
            <label><input type="checkbox" checked={state.parts} onChange={(e) => { engine.configureTidy(e.currentTarget.checked, state.shell); }} /> Individual parts</label>
            <label><input type="checkbox" checked={state.shell} onChange={(e) => { engine.configureTidy(state.parts, e.currentTarget.checked); }} /> Include room shell</label>
          </div>
          <div className="tidy-select">
            <label htmlFor="tidy-item">Choose an item (keyboard/touch)</label>
            <select id="tidy-item" value={state.selectedId} onChange={(e) => { engine.selectTidy(e.currentTarget.value); }}>
              <option value="">Select an item…</option>
              {state.items.map((item) => <option key={item.id} value={item.id} disabled={item.hidden}>{item.label}{item.hidden ? ' · hidden' : ''}</option>)}
            </select>
            <button type="button" disabled={!state.selection} onClick={() => { engine.hideTidySelection(); }}>Sweep selected</button>
          </div>
        </> : null}
      </aside>
    </>
  );
}

