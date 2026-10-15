// Fila de aprovação: só executa na Meta após ação explícita do proprietário.
// Escopo: apenas comentários (responder/ocultar). Nada de DMs.
import {db} from '@/lib/db';
import {reader, selectedData, MetaReadError, metaDetail} from '@/lib/meta-data';

export const MAX_ACTIONS_PER_HOUR = 30;
// Comentários mais antigos que isso não entram na fila: responder tarde demais prejudica a marca.
export const QUEUE_MAX_AGE_DAYS = 30;
const FB_FORBIDDEN = /\b(dm|direct|messenger|inbox)\b|link (da|na) bio/i;

export type QueueItem = {
  id: string; platform: string; text: string; author: string; date: string; permalink: string | null;
  category: string | null; topic: string | null; action: string | null; reply: string | null;
  priority: string | null; support: number; parent_id: string | null; ad_name: string | null;
  handled_status: string | null; handled_at: number | null; handled_reply: string | null; handled_error: string | null;
};

export async function loadQueue(tenant: string, view: 'pendentes' | 'concluidos') {
  const since = new Date(Date.now() - QUEUE_MAX_AGE_DAYS * 86400000).toISOString();
  const where = view === 'pendentes'
    ? `c.handled_status IS NULL AND c.classified_at IS NOT NULL AND c.suggested_action IN ('responder','ocultar','revisar') AND c.created_at>='${since}'`
    : 'c.handled_status IS NOT NULL';
  const order = view === 'pendentes'
    ? "CASE c.priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, c.created_at DESC"
    : 'c.handled_at DESC';
  const rows = await db().prepare(`SELECT c.id,c.platform,c.text,c.author_name author,c.created_at date,p.permalink,c.category,c.topic,c.suggested_action action,c.suggested_reply reply,c.priority,c.needs_support support,c.parent_id,p.ad_name,c.handled_status,c.handled_at,c.handled_reply,c.handled_error FROM social_comments c LEFT JOIN social_posts p ON p.tenant=c.tenant AND p.id=c.post_id WHERE c.tenant=? AND c.is_own=0 AND ${where} ORDER BY ${order} LIMIT 100`).bind(tenant).all<QueueItem>();
  const counts = await db().prepare("SELECT SUM(CASE WHEN handled_status IS NULL AND classified_at IS NOT NULL AND suggested_action IN ('responder','ocultar','revisar') AND created_at>=? THEN 1 ELSE 0 END) pendentes, SUM(CASE WHEN handled_status IS NOT NULL THEN 1 ELSE 0 END) concluidos FROM social_comments WHERE tenant=? AND is_own=0").bind(since, tenant).first<{pendentes: number | null; concluidos: number | null}>();
  return {items: rows.results, pendentes: counts?.pendentes || 0, concluidos: counts?.concluidos || 0};
}

export type ModerationAction = 'responder' | 'ocultar' | 'descartar';
export class ModerationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

async function log(tenant: string, commentId: string, action: string, text: string | null, result: string, detail: string | null) {
  await db().prepare('INSERT INTO moderation_log(id,tenant,comment_id,action,text,result,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), tenant, commentId, action, text, result, detail, Date.now()).run();
}

export async function moderate(tenant: string, commentId: string, action: ModerationAction, replyText?: string) {
  const c = await db().prepare('SELECT id,platform,text,parent_id,is_own,handled_status FROM social_comments WHERE tenant=? AND id=?').bind(tenant, commentId).first<{id: string; platform: string; text: string; parent_id: string | null; is_own: number; handled_status: string | null}>();
  if (!c || c.is_own) throw new ModerationError('Comentário não encontrado.', 404);
  if (c.handled_status) throw new ModerationError('Este comentário já foi tratado.', 409);

  if (action === 'descartar') {
    await db().prepare("UPDATE social_comments SET handled_status='descartado',handled_at=?,handled_error=NULL WHERE tenant=? AND id=? AND handled_status IS NULL").bind(Date.now(), tenant, commentId).run();
    await log(tenant, commentId, 'descartar', null, 'ok', null);
    return {status: 'descartado'};
  }

  const recent = await db().prepare("SELECT COUNT(*) n FROM moderation_log WHERE tenant=? AND action IN ('responder','ocultar') AND result='ok' AND created_at>?").bind(tenant, Date.now() - 3600000).first<{n: number}>();
  if ((recent?.n || 0) >= MAX_ACTIONS_PER_HOUR) throw new ModerationError(`Limite de ${MAX_ACTIONS_PER_HOUR} ações por hora atingido, para proteger a conta. Tente mais tarde.`, 429);

  let message = '';
  if (action === 'responder') {
    message = (replyText || '').trim();
    if (message.length < 2 || message.length > 1000) throw new ModerationError('A resposta precisa ter entre 2 e 1000 caracteres.');
    if (/https?:\/\/|www\./i.test(message)) throw new ModerationError('Respostas com links não são enviadas automaticamente, para evitar bloqueio por spam.');
    if (c.platform === 'Facebook' && FB_FORBIDDEN.test(message)) throw new ModerationError('No Facebook o manual não permite DM, direct, Messenger ou link da bio. Use “Nos chame”.');
  }

  // Marca como "enviando" para impedir envio duplo em cliques simultâneos.
  const lock = await db().prepare("UPDATE social_comments SET handled_status='enviando',handled_at=? WHERE tenant=? AND id=? AND handled_status IS NULL").bind(Date.now(), tenant, commentId).run();
  if (!lock.meta.changes) throw new ModerationError('Este comentário já está sendo tratado.', 409);

  try {
    const selected = await selectedData();
    if (!selected) throw new MetaReadError('Nenhuma página vinculada.');
    const api = await reader();
    const page = (await api.pages()).find(p => p.id === selected.page_id);
    if (!page?.access_token) throw new MetaReadError('A página vinculada não está mais autorizada. Reconecte a Meta.');
    const token = page.access_token;
    let replyId: string | null = null;
    if (action === 'responder') {
      const target = c.parent_id || c.id; // respostas sempre no fio do comentário principal
      const r = c.platform === 'Instagram'
        ? await api.post<{id?: string}>(`${target}/replies`, {message}, token)
        : await api.post<{id?: string}>(`${target}/comments`, {message}, token);
      replyId = r.id || null;
      await db().prepare("UPDATE social_comments SET handled_status='respondido',handled_at=?,handled_reply=?,meta_reply_id=?,handled_error=NULL WHERE tenant=? AND id=?").bind(Date.now(), message, replyId, tenant, commentId).run();
    } else {
      if (c.platform === 'Instagram') await api.post(`${c.id}`, {hide: 'true'}, token);
      else await api.post(`${c.id}`, {is_hidden: 'true'}, token);
      await db().prepare("UPDATE social_comments SET handled_status='ocultado',handled_at=?,handled_error=NULL WHERE tenant=? AND id=?").bind(Date.now(), tenant, commentId).run();
    }
    await log(tenant, commentId, action, message || null, 'ok', replyId);
    return {status: action === 'responder' ? 'respondido' : 'ocultado'};
  } catch (e) {
    const msg = (e instanceof MetaReadError ? e.message + metaDetail(e) : 'Falha inesperada ao enviar.').slice(0, 400);
    await db().prepare('UPDATE social_comments SET handled_status=NULL,handled_error=? WHERE tenant=? AND id=?').bind(msg, tenant, commentId).run();
    await log(tenant, commentId, action, message || null, 'erro', msg);
    if (!(e instanceof MetaReadError)) console.error('moderate', e);
    throw new ModerationError(msg, 502);
  }
}
