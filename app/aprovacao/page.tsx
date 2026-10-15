import {ownerAccess, activeClient} from '@/lib/access';
import {loadQueue, MAX_ACTIONS_PER_HOUR, QUEUE_MAX_AGE_DAYS} from '@/lib/moderation';
import Queue, {DoneList} from './queue';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Fila de aprovação | Origyn'};

export default async function Page({searchParams}: {searchParams: Promise<{ver?: string}>}) {
  if (!(await ownerAccess()) || !(await activeClient('pf'))) return <main className="ix"><h1>Acesso restrito</h1></main>;
  const view = (await searchParams).ver === 'concluidos' ? 'concluidos' : 'pendentes';
  const q = await loadQueue('pf', view);
  return (
    <main className="ix">
      <header className="ix-top">
        <div style={{display: 'flex', gap: 20}}><a href="/" className="ix-crumb">← Painel</a><a href="/inteligencia" className="ix-crumb">Inteligência</a></div>
        <img src="/origyn-logo.png" alt="Origyn" className="ix-logo" />
      </header>
      <div className="ix-head">
        <div>
          <p className="ix-eyebrow">Películas Fácil · Instagram e Facebook</p>
          <h1>Fila de aprovação</h1>
          <p className="ix-lead">Cada ação só é enviada à rede depois do seu clique. Respostas e ocultações seguem o manual; edite o que precisar antes de aprovar.</p>
        </div>
      </div>
      <nav className="ix-filters" aria-label="Visão">
        <div role="group">
          <a href="/aprovacao" aria-current={view === 'pendentes' ? 'true' : undefined}>Pendentes · {q.pendentes}</a>
          <a href="/aprovacao?ver=concluidos" aria-current={view === 'concluidos' ? 'true' : undefined}>Concluídos · {q.concluidos}</a>
        </div>
      </nav>
      <p className="ix-status">Ordenado por prioridade. Só entram comentários dos últimos {QUEUE_MAX_AGE_DAYS} dias. Limite de segurança: {MAX_ACTIONS_PER_HOUR} ações por hora. Sem DMs: apenas respostas públicas e ocultação de comentários.</p>
      {view === 'pendentes' ? <Queue initial={q.items} /> : <DoneList items={q.items} />}
    </main>
  );
}
