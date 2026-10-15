'use client';
import {useState} from 'react';
type Acc = {id: string; name: string; active: boolean; business: string | null};
export default function AdAccountSelector({current}: {current: string | null}) {
  const [accs, setAccs] = useState<Acc[] | null>(null), [sel, setSel] = useState(current || ''), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  async function load() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/meta/adaccounts', {cache: 'no-store'}); const d = (await r.json()) as {accounts?: Acc[]; selected?: string | null; error?: string};
      if (!r.ok) throw new Error(d.error); setAccs(d.accounts || []); setSel(d.selected || ''); if (!d.accounts?.length) setMsg('Nenhuma conta de anúncios encontrada para este usuário.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha ao carregar.'); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/meta/adaccounts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({adAccountId: sel})}); const d = (await r.json()) as {error?: string};
      if (!r.ok) throw new Error(d.error); setMsg(sel ? 'Conta salva. Comentários dos anúncios ativos entram a partir da próxima coleta.' : 'Leitura de anúncios desativada.');
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Falha ao salvar.'); } finally { setBusy(false); }
  }
  const btn = {padding: '12px 18px', borderRadius: 8, background: '#7639cb', color: 'white', border: 0, margin: '8px 8px 8px 0'};
  return (
    <section style={{padding: 24, border: '1px solid #594475', borderRadius: 16, margin: '24px 0'}}>
      <h2>Comentários de anúncios</h2>
      <p>Escolha a conta de anúncios da Películas Fácil. O Origyn só lê os anúncios ativos para encontrar os comentários; não altera campanhas nem verba.</p>
      <button style={btn} onClick={load} disabled={busy}>{busy ? 'Aguarde…' : 'Carregar contas de anúncios'}</button>
      {accs && accs.length > 0 && <>
        <select value={sel} onChange={e => setSel(e.target.value)} disabled={busy} style={{display: 'block', width: '100%', padding: 12, background: '#16121f', color: 'white', border: '1px solid #746185', borderRadius: 8, margin: '8px 0'}}>
          <option value="">Não ler anúncios</option>
          {accs.map(a => <option key={a.id} value={a.id}>{a.name}{a.business ? ` · ${a.business}` : ''}{a.active ? '' : ' · inativa'} ({a.id})</option>)}
        </select>
        <button style={btn} onClick={save} disabled={busy}>Salvar conta</button>
      </>}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}
