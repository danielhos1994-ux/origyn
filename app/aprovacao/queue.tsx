'use client';
import {useState} from 'react';
import type {QueueItem} from '@/lib/moderation';

const CAT: Record<string, string> = {interesse_compra: 'Interesse de compra', duvida_produto: 'Dúvida de produto', duvida_instalacao: 'Dúvida de instalação', legalidade: 'Legalidade / multa', elogio: 'Elogio', negativo: 'Negativo / prejudicial', ambiguo: 'Ambíguo', spam: 'Spam', outro: 'Outros'};
const ACT: Record<string, string> = {responder: 'Responder', ocultar: 'Ocultar', revisar: 'Revisar'};
const DONE: Record<string, string> = {respondido: 'Respondido', ocultado: 'Ocultado', descartado: 'Descartado', enviando: 'Enviando'};
const day = (v: string | number) => new Date(v).toLocaleString('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'});
function safeLink(v: string | null) {
  try { const u = new URL(v || ''); return u.protocol === 'https:' && /(^|\.)(facebook|instagram)\.com$/.test(u.hostname) ? u.href : undefined; } catch { return undefined; }
}

function Card({item, onDone}: {item: QueueItem; onDone: (id: string) => void}) {
  const [text, setText] = useState(item.reply || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState(item.handled_error || '');
  const [confirmHide, setConfirmHide] = useState(false);
  const link = safeLink(item.permalink);
  async function act(action: 'responder' | 'ocultar' | 'descartar') {
    setBusy(action); setErr('');
    try {
      const r = await fetch('/api/moderacao', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: item.id, action, reply: text})});
      const d = (await r.json()) as {error?: string};
      if (!r.ok) throw new Error(d.error || 'Falha ao enviar.');
      onDone(item.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally { setBusy(null); setConfirmHide(false); }
  }
  const fbWarn = item.platform === 'Facebook' && /\b(dm|direct|messenger|inbox)\b|link (da|na) bio/i.test(text);
  return (
    <article className="aq-card">
      <header className="aq-meta">
        <span className="aq-net">{item.platform}</span>
        {item.ad_name && <span className="aq-flag" title={item.ad_name}>Anúncio</span>}
        <span>{CAT[item.category || ''] || item.category}</span>
        {item.topic && item.topic !== (CAT[item.category || ''] || '').toLowerCase() && <span>{item.topic}</span>}
        {item.priority === 'alta' && <span className="aq-flag">Prioridade alta</span>}
        {!!item.support && <span className="aq-flag">Tratar em privado</span>}
      </header>
      <blockquote className="aq-comment">
        <p>{item.text}</p>
        <footer>{item.author} · {day(item.date)}{link && <> · <a href={link} target="_blank" rel="noopener noreferrer">ver publicação</a></>}</footer>
      </blockquote>
      <p className="aq-suggest">Sugestão pelo manual: <strong>{ACT[item.action || ''] || item.action}</strong></p>
      <label className="aq-label" htmlFor={`r-${item.id}`}>Resposta pública</label>
      <textarea id={`r-${item.id}`} value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={1000} placeholder={item.action === 'responder' ? '' : 'Sem resposta sugerida. Escreva uma, se for responder.'} />
      {fbWarn && <p className="aq-warn">No Facebook o manual não permite DM, Messenger ou link da bio.</p>}
      {err && <p className="aq-error" role="alert">{err}</p>}
      <div className="aq-actions">
        <button className="aq-primary" disabled={!!busy || text.trim().length < 2 || fbWarn} onClick={() => act('responder')}>{busy === 'responder' ? 'Enviando…' : text.trim() === (item.reply || '').trim() ? 'Aprovar e responder' : 'Enviar resposta editada'}</button>
        {!confirmHide
          ? <button disabled={!!busy} onClick={() => setConfirmHide(true)}>Ocultar</button>
          : <button className="aq-danger" disabled={!!busy} onClick={() => act('ocultar')}>{busy === 'ocultar' ? 'Ocultando…' : 'Confirmar ocultação'}</button>}
        <button className="aq-ghost" disabled={!!busy} onClick={() => act('descartar')}>Descartar</button>
      </div>
    </article>
  );
}

export default function Queue({initial}: {initial: QueueItem[]}) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(0);
  if (!items.length) return <section className="aq-empty"><h2>Nada pendente</h2><p>Todos os comentários sugeridos já foram tratados. Novos aparecem aqui após cada coleta.</p></section>;
  return (
    <>
      {done > 0 && <p className="aq-status" role="status">{done} tratado(s) nesta sessão.</p>}
      <div className="aq-list">{items.map(i => <Card key={i.id} item={i} onDone={id => { setItems(xs => xs.filter(x => x.id !== id)); setDone(n => n + 1); }} />)}</div>
    </>
  );
}

export function DoneList({items}: {items: QueueItem[]}) {
  if (!items.length) return <section className="aq-empty"><h2>Nada tratado ainda</h2></section>;
  return (
    <div className="aq-list">
      {items.map(i => (
        <article className="aq-card aq-done" key={i.id}>
          <header className="aq-meta"><span className="aq-net">{i.platform}</span><span className="aq-flag">{DONE[i.handled_status || ''] || i.handled_status}</span>{i.handled_at && <span>{day(i.handled_at)}</span>}</header>
          <blockquote className="aq-comment"><p>{i.text}</p><footer>{i.author} · {day(i.date)}</footer></blockquote>
          {i.handled_reply && <div className="aq-sent"><span>Resposta enviada</span><p>{i.handled_reply}</p></div>}
        </article>
      ))}
    </div>
  );
}
