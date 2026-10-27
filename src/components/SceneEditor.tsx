import { useCallback, useEffect, useState } from 'react';
import { Button, TextButton, SceneEditorHost, type SceneEditorSession } from '@thealifamily/ui';
import type { RoomSceneEditor, SceneNavigation, SceneSaveStatus } from '../room/scene-editor-api';

export default function SceneEditor({ active, editor, preparing, error, close, failed }: {
  active: boolean; editor: RoomSceneEditor | null; preparing: boolean; error: string | null;
  close: () => void; failed: (error: unknown) => void;
}) {
  const [connectedEditor, setConnectedEditor] = useState<RoomSceneEditor | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState(false);
  const ready = useCallback((session: SceneEditorSession) => {
    if (editor) { editor.connect(session); setConnectedEditor(editor); }
  }, [editor]);
  const resetScene = editor?.bridge.capabilities?.resetScene;
  const reset = () => {
    if (!editor || !resetScene || connectedEditor !== editor || resetting) return;
    setResetting(true); setResetError(false);
    void Promise.resolve().then(resetScene).then(() => editor.save())
      .catch(() => { setResetError(true); }).finally(() => { setResetting(false); });
  };
  const [navigation, setNavigation] = useState<SceneNavigation>({ mode: 'orbit', locked: false, canLook: false, message: null });
  const [saved, setSaved] = useState<SceneSaveStatus>({ state: 'unsaved', message: 'Edits autosave in this browser.' });
  useEffect(() => editor?.onNavigation(setNavigation), [editor]);
  useEffect(() => editor?.onSave(setSaved), [editor]);
  return <aside className="scene-editor-panel" hidden={!active} aria-label="Scene editor" data-navigation-locked={navigation.locked}>
    <div className="scene-editor-panel-heading">
      <strong>Scene editor · {navigation.mode === 'first-person' ? 'First-person' : 'Orbit'}</strong>
      {navigation.locked ? <p role="status">WASD move · R/F up/down · Esc to edit</p> : <>
        <div className="scene-editor-actions">
          <TextButton onClick={() => { editor?.setNavigationMode('first-person'); }}>First-person</TextButton>
          <TextButton onClick={() => { editor?.setNavigationMode('orbit'); }}>Orbit</TextButton>
          {editor && navigation.mode === 'first-person' && navigation.canLook ? <Button onClick={() => { editor.startNavigation(); }}>Look around</Button> : null}
          <Button disabled={!editor || preparing || resetting || saved.state === 'saving' || saved.state === 'restoring'} onClick={() => { void editor?.save(); }}>Save</Button>
          <Button disabled={!editor || connectedEditor !== editor || !resetScene || preparing || resetting || saved.state === 'saving' || saved.state === 'restoring'} onClick={reset}>{resetting ? 'Resetting…' : 'Reset scene'}</Button>
          <TextButton onClick={close}>Close editor</TextButton>
        </div>
        <p role="status" aria-live="polite">{preparing ? 'Preparing original objects and saved edits…' : saved.message}</p>
        {navigation.mode === 'first-person' && !navigation.canLook ? <p>Eye-level view · drag or pinch with native touch orbit.</p> : null}
        {navigation.message ? <p role="status">{navigation.message}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        {resetError ? <p role="alert">Could not reset the room. Try again.</p> : null}
      </>}
    </div>
    <SceneEditorHost active={active && !preparing && !error} bridge={editor?.bridge ?? null} onReady={ready} onError={failed} />
  </aside>;
}
