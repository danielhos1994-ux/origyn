// Consultas do relatório de inteligência (somente leitura do banco).
import {db} from '@/lib/db';
import {DOUBT_CATEGORIES, COMPLAINT_CATEGORIES} from '@/lib/brand/peliculas-facil';

export const PERIODS = [
  {value: '7', label: '7 dias'},
  {value: '30', label: '30 dias'},
  {value: '90', label: '90 dias'},
  {value: '0', label: 'Tudo'},
] as const;
export const NETWORKS = [
  {value: 'todas', label: 'Todas'},
  {value: 'Instagram', label: 'Instagram'},
  {value: 'Facebook', label: 'Facebook'},
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  interesse_compra: 'Interesse de compra',
  duvida_produto: 'Dúvida de produto',
  duvida_instalacao: 'Dúvida de instalação',
  legalidade: 'Legalidade / multa',
  elogio: 'Elogio / prova social',
  negativo: 'Negativo / prejudicial',
  ambiguo: 'Ambíguo',
  spam: 'Spam / off-topic',
  outro: 'Marcações e outros',
};
export const ACTION_LABEL: Record<string, string> = {responder: 'Responder', ocultar: 'Ocultar', revisar: 'Revisar', ignorar: 'Ignorar'};

export type Example = {id: string; text: string; author: string; platform: string; date: string; permalink: string | null; summary: string | null; reply: string | null; action: string | null; support: number | null};
export type TopicRow = {topic: string; n: number; examples: Example[]};
export type Insights = {
  total: number;
  classified: number;
  pending: number;
  byCategory: {category: string; n: number}[];
  sentiment: {positivo: number; neutro: number; negativo: number};
  doubts: TopicRow[];
  complaints: TopicRow[];
  attention: (Example & {category: string})[];
  actions: {action: string; n: number}[];
  lastRun: {status: string; finished_at: number | null; started_at: number; new_comments: number; classified: number; message: string | null} | null;
  firstComment: string | null;
};

export function parseFilters(sp: {dias?: string; rede?: string}) {
  const dias = PERIODS.some(p => p.value === sp.dias) ? sp.dias! : '30';
  const rede = NETWORKS.some(n => n.value === sp.rede) ? sp.rede! : 'todas';
  return {dias, rede};
}

export async function loadInsights(tenant: string, dias: string, rede: string): Promise<Insights> {
  const since = dias === '0' ? '0000' : new Date(Date.now() - Number(dias) * 86400000).toISOString();
  const net = rede === 'todas' ? null : rede;
  const where = 'c.tenant=? AND c.is_own=0 AND c.created_at>=? AND (? IS NULL OR c.platform=?)';
  const args = [tenant, since, net, net];
  const d = db();

  const totals = await d.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN c.classified_at IS NOT NULL THEN 1 ELSE 0 END) classified, SUM(CASE WHEN c.sentiment='positivo' THEN 1 ELSE 0 END) pos, SUM(CASE WHEN c.sentiment='neutro' THEN 1 ELSE 0 END) neu, SUM(CASE WHEN c.sentiment='negativo' THEN 1 ELSE 0 END) neg FROM social_comments c WHERE ${where}`).bind(...args).first<{total: number; classified: number | null; pos: number | null; neu: number | null; neg: number | null}>();
  const byCategory = (await d.prepare(`SELECT c.category category, COUNT(*) n FROM social_comments c WHERE ${where} AND c.category IS NOT NULL GROUP BY c.category ORDER BY n DESC`).bind(...args).all<{category: string; n: number}>()).results;

  const cols = 'c.id, c.text, c.author_name author, c.platform, c.created_at date, p.permalink, c.summary, c.suggested_reply reply, c.suggested_action action, c.needs_support support';
  async function topics(cats: string[]): Promise<TopicRow[]> {
    const inCats = `c.category IN (${cats.map(() => '?').join(',')})`;
    const rows = (await d.prepare(`SELECT c.topic topic, COUNT(*) n FROM social_comments c WHERE ${where} AND ${inCats} GROUP BY c.topic ORDER BY n DESC, MAX(c.created_at) DESC LIMIT 8`).bind(...args, ...cats).all<{topic: string; n: number}>()).results;
    const out: TopicRow[] = [];
    for (const r of rows) {
      const ex = (await d.prepare(`SELECT ${cols} FROM social_comments c LEFT JOIN social_posts p ON p.tenant=c.tenant AND p.id=c.post_id WHERE ${where} AND ${inCats} AND c.topic=? ORDER BY c.created_at DESC LIMIT 3`).bind(...args, ...cats, r.topic).all<Example>()).results;
      out.push({topic: r.topic || 'outros', n: r.n, examples: ex});
    }
    return out;
  }

  const attention = (await d.prepare(`SELECT ${cols}, c.category FROM social_comments c LEFT JOIN social_posts p ON p.tenant=c.tenant AND p.id=c.post_id WHERE ${where} AND c.priority='alta' ORDER BY c.created_at DESC LIMIT 12`).bind(...args).all<Example & {category: string}>()).results;
  const actions = (await d.prepare(`SELECT c.suggested_action action, COUNT(*) n FROM social_comments c WHERE ${where} AND c.suggested_action IS NOT NULL GROUP BY c.suggested_action ORDER BY n DESC`).bind(...args).all<{action: string; n: number}>()).results;
  const lastRun = await d.prepare('SELECT status, finished_at, started_at, new_comments, classified, message FROM sync_runs WHERE tenant=? ORDER BY started_at DESC LIMIT 1').bind(tenant).first<Insights['lastRun'] & object>();
  const first = await d.prepare('SELECT MIN(created_at) m FROM social_comments WHERE tenant=? AND is_own=0').bind(tenant).first<{m: string | null}>();

  const total = totals?.total || 0, classified = totals?.classified || 0;
  return {
    total,
    classified,
    pending: total - classified,
    byCategory,
    sentiment: {positivo: totals?.pos || 0, neutro: totals?.neu || 0, negativo: totals?.neg || 0},
    doubts: await topics(DOUBT_CATEGORIES),
    complaints: await topics(COMPLAINT_CATEGORIES),
    attention,
    actions,
    lastRun: lastRun ?? null,
    firstComment: first?.m ?? null,
  };
}

export function safeLink(value?: string | null) {
  try {
    const u = new URL(value || '');
    return u.protocol === 'https:' && ['facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com'].includes(u.hostname) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
