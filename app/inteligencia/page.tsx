import {ownerAccess, activeClient} from '@/lib/access';
import {classifierConfigured} from '@/lib/classifier';
import {loadInsights, parseFilters, PERIODS, NETWORKS, CATEGORY_LABEL, ACTION_LABEL, safeLink, type TopicRow, type Example} from '@/lib/insights';
import RefreshButton from './refresh-button';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Inteligência de comentários | Origyn'};

const fmt = (n: number) => n.toLocaleString('pt-BR');
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0);
const when = (v: string | number) => new Date(v).toLocaleString('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'});
const day = (v: string) => new Date(v).toLocaleDateString('pt-BR', {day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo'});

function Quote({c}: {c: Example}) {
  const link = safeLink(c.permalink);
  return (
    <blockquote className="ix-quote">
      <p>{c.text}</p>
      <footer>
        {c.author} · {c.platform} · {day(c.date)}
        {link && <> · <a href={link} target="_blank" rel="noopener noreferrer">ver publicação</a></>}
      </footer>
    </blockquote>
  );
}

function Ranking({title, rows, empty}: {title: string; rows: TopicRow[]; empty: string}) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <section className="ix-card">
      <h2>{title}</h2>
      {!rows.length ? <p className="ix-muted">{empty}</p> : (
        <ol className="ix-rank">
          {rows.map((r, i) => (
            <li key={r.topic}>
              <details>
                <summary title={`${r.topic}: ${r.n} comentário(s)`}>
                  <span className="ix-pos">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ix-topic">
                    <span className="ix-topic-row"><strong>{r.topic}</strong><em>{fmt(r.n)}</em></span>
                    <span className="ix-bar"><span style={{width: `${(r.n / max) * 100}%`}} /></span>
                  </span>
                </summary>
                <div className="ix-examples">{r.examples.map(c => <Quote key={c.id} c={c} />)}</div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function Page({searchParams}: {searchParams: Promise<{dias?: string; rede?: string}>}) {
  if (!(await ownerAccess()) || !(await activeClient('pf'))) return <main className="ix"><h1>Acesso restrito</h1></main>;
  const {dias, rede} = parseFilters(await searchParams);
  const data = await loadInsights('pf', dias, rede);
  const hasKey = classifierConfigured();
  const cat = (k: string) => data.byCategory.find(c => c.category === k)?.n || 0;
  const sentTotal = data.sentiment.positivo + data.sentiment.neutro + data.sentiment.negativo;
  const maxCat = Math.max(1, ...data.byCategory.map(c => c.n));
  const href = (d: string, r: string) => `/inteligencia?dias=${d}&rede=${encodeURIComponent(r)}`;

  return (
    <main className="ix">
      <header className="ix-top">
        <a href="/" className="ix-crumb">← Painel</a>
        <img src="/origyn-logo.png" alt="Origyn" className="ix-logo" />
      </header>

      <div className="ix-head">
        <div>
          <p className="ix-eyebrow">Películas Fácil · Instagram e Facebook</p>
          <h1>Inteligência de comentários</h1>
          <p className="ix-lead">O que os clientes perguntam e reclamam, agrupado por tema a partir dos comentários reais.</p>
        </div>
        <RefreshButton />
      </div>

      <nav className="ix-filters" aria-label="Filtros">
        <div role="group" aria-label="Período">{PERIODS.map(p => <a key={p.value} href={href(p.value, rede)} aria-current={p.value === dias ? 'true' : undefined}>{p.label}</a>)}</div>
        <div role="group" aria-label="Rede">{NETWORKS.map(n => <a key={n.value} href={href(dias, n.value)} aria-current={n.value === rede ? 'true' : undefined}>{n.label}</a>)}</div>
      </nav>

      <p className="ix-status">
        {data.lastRun ? <>Última atualização: {when(data.lastRun.finished_at || data.lastRun.started_at)} · {data.lastRun.status === 'ok' ? 'concluída' : data.lastRun.status === 'executando' ? 'em andamento' : data.lastRun.status}{data.lastRun.message ? ` · ${data.lastRun.message}` : ''}.</> : 'Nenhuma coleta registrada ainda.'}
        {' '}Coleta automática a cada 15 minutos · somente leitura, nenhuma resposta é enviada.
      </p>

      {!hasKey && <div className="ix-alert" role="note"><strong>Classificação aguardando a chave da Anthropic.</strong> Os comentários já estão sendo coletados; os temas aparecem assim que a chave for cadastrada na Cloudflare.</div>}

      {!data.total ? (
        <section className="ix-card ix-empty"><h2>Sem comentários neste recorte</h2><p className="ix-muted">Clique em “Atualizar agora” para fazer a primeira coleta ou amplie o período.</p></section>
      ) : (
        <>
          <section className="ix-kpis" aria-label="Resumo">
            <div><span>Comentários</span><strong>{fmt(data.total)}</strong><small>{data.pending ? `${fmt(data.pending)} aguardando classificação` : 'todos classificados'}</small></div>
            <div><span>Dúvidas</span><strong>{fmt(cat('duvida'))}</strong><small>{pct(cat('duvida'), data.classified)}% dos classificados</small></div>
            <div><span>Reclamações</span><strong>{fmt(cat('reclamacao'))}</strong><small>{pct(cat('reclamacao'), data.classified)}% dos classificados</small></div>
            <div><span>Sentimento</span><strong>{pct(data.sentiment.positivo, sentTotal)}%</strong><small>positivo · {pct(data.sentiment.negativo, sentTotal)}% negativo</small></div>
          </section>

          <div className="ix-grid">
            <Ranking title="Maiores dúvidas" rows={data.doubts} empty="Nenhuma dúvida classificada no período." />
            <Ranking title="Maiores queixas" rows={data.complaints} empty="Nenhuma reclamação classificada no período." />
          </div>

          <div className="ix-grid">
            <section className="ix-card">
              <h2>Distribuição por tipo</h2>
              {!data.byCategory.length ? <p className="ix-muted">Aguardando classificação.</p> : (
                <ul className="ix-dist">
                  {data.byCategory.map(c => (
                    <li key={c.category} title={`${CATEGORY_LABEL[c.category] || c.category}: ${c.n}`}>
                      <span>{CATEGORY_LABEL[c.category] || c.category}</span>
                      <span className="ix-bar"><span style={{width: `${(c.n / maxCat) * 100}%`}} /></span>
                      <em>{fmt(c.n)}</em>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="ix-card">
              <h2>Precisam de atenção</h2>
              {!data.attention.length ? <p className="ix-muted">Nenhum comentário de prioridade alta no período.</p> : (
                <ul className="ix-attn">
                  {data.attention.map(c => (
                    <li key={c.id}>
                      <div className="ix-tags"><span>{CATEGORY_LABEL[c.category] || c.category}</span>{c.action && <span>Sugestão: {ACTION_LABEL[c.action] || c.action}</span>}</div>
                      <Quote c={c} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          {data.firstComment && <p className="ix-foot">Base coletada desde {day(data.firstComment).replace(/\.$/, '')}. Classificação feita por IA; confira os exemplos antes de decisões importantes.</p>}
        </>
      )}
    </main>
  );
}
