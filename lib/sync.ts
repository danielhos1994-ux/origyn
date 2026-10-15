// Orquestra uma rodada: coleta (Meta, leitura) + classificação (Claude). Nenhuma ação é enviada às redes.
import {db} from '@/lib/db';
import {collect} from '@/lib/collector';
import {classifyPending} from '@/lib/classifier';
import {MetaReadError} from '@/lib/meta-data';

const LOCK_MS = 10 * 60000;

export type SyncSummary = {status: 'ok' | 'parcial' | 'erro' | 'ignorado'; newComments: number; classified: number; message: string};

export async function runSync(tenant = 'pf', trigger: 'cron' | 'manual' = 'cron'): Promise<SyncSummary> {
  const now = Date.now();
  // Rodadas interrompidas (ex.: aba fechada) não ficam presas como 'executando'.
  await db().prepare("UPDATE sync_runs SET status='interrompida',finished_at=? WHERE tenant=? AND status='executando' AND started_at<=?").bind(now, tenant, now - LOCK_MS).run();
  const running = await db().prepare("SELECT id FROM sync_runs WHERE tenant=? AND status='executando' AND started_at>?").bind(tenant, now - LOCK_MS).first();
  if (running) return {status: 'ignorado', newComments: 0, classified: 0, message: 'Já existe uma atualização em andamento.'};
  const id = crypto.randomUUID();
  await db().prepare("INSERT INTO sync_runs(id,tenant,trigger,started_at,status) VALUES(?,?,?,?,'executando')").bind(id, tenant, trigger, now).run();
  let summary: SyncSummary;
  try {
    const c = await collect(tenant);
    const k = await classifyPending(tenant);
    const notes = [...c.warnings, ...(k.skipped ? [k.skipped] : []), ...k.errors];
    summary = {status: notes.length ? 'parcial' : 'ok', newComments: c.newComments, classified: k.classified, message: notes.join(' ').slice(0, 900)};
  } catch (e) {
    summary = {status: 'erro', newComments: 0, classified: 0, message: (e instanceof MetaReadError ? e.message : 'Falha inesperada na atualização.').slice(0, 900)};
    if (!(e instanceof MetaReadError)) console.error('runSync', e);
  }
  await db().prepare('UPDATE sync_runs SET finished_at=?,status=?,new_comments=?,classified=?,message=? WHERE id=?').bind(Date.now(), summary.status, summary.newComments, summary.classified, summary.message, id).run();
  // Mantém só o histórico recente de execuções.
  await db().prepare('DELETE FROM sync_runs WHERE tenant=? AND started_at<?').bind(tenant, now - 30 * 86400000).run();
  return summary;
}
