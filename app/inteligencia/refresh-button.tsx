'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function RefreshButton() {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const router = useRouter();
  async function run() {
    setBusy(true);
    setMsg('Buscando comentários e classificando…');
    try {
      const r = await fetch('/api/coleta', {method: 'POST'});
      const d = (await r.json()) as {error?: string; status?: string; newComments?: number; classified?: number; message?: string};
      if (!r.ok) throw new Error(d.error || d.message || 'Falha ao atualizar.');
      setMsg(d.status === 'ignorado' ? d.message || '' : `${d.newComments} novos · ${d.classified} classificados${d.message ? ' · ' + d.message : ''}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Falha ao atualizar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ix-refresh">
      <button onClick={run} disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar agora'}</button>
      {msg && <span role="status">{msg}</span>}
    </div>
  );
}
