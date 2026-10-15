// Coleta contínua de publicações e comentários (Facebook + Instagram) — somente leitura.
// Escopo: apenas comentários. Nada de DMs (decisão de 15/10/2026).
import {db} from '@/lib/db';
import {reader, selectedData, MetaReadError, metaDetail} from '@/lib/meta-data';

const POSTS_PER_NETWORK = 25;
const COMMENT_PAGES = 3;
const RECENT_MS = 3 * 86400000;
// Os posts mais novos têm os comentários relidos a cada rodada, mesmo sem mudança na contagem
// (a Meta às vezes atualiza o contador com atraso).
const ALWAYS_REFRESH = 8;
const MAX_ADS = 30;

type Api = Awaited<ReturnType<typeof reader>>;
export type CollectResult = {posts: number; newComments: number; warnings: string[]};

const iso = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};
const num = (v: unknown) => (typeof v === 'number' ? v : null);

async function upsertPost(tenant: string, p: {id: string; platform: string; text: string; permalink?: string; createdAt: string; reactions: number | null; commentsCount: number | null; ad?: string | null}, rank = 99) {
  const prev = await db().prepare('SELECT comments_count, updated_at FROM social_posts WHERE tenant=? AND id=?').bind(tenant, p.id).first<{comments_count: number | null; updated_at: number}>();
  await db()
    .prepare('INSERT INTO social_posts(tenant,id,platform,text,permalink,created_at,reactions,comments_count,updated_at,ad_name) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET text=excluded.text,permalink=excluded.permalink,reactions=excluded.reactions,comments_count=excluded.comments_count,updated_at=excluded.updated_at,ad_name=COALESCE(excluded.ad_name,social_posts.ad_name)')
    .bind(tenant, p.id, p.platform, p.text, p.permalink ?? null, p.createdAt, p.reactions, p.commentsCount, Date.now(), p.ad ?? null)
    .run();
  // Busca comentários só quando há novidade: post novo, contagem mudou ou post recente.
  if (rank < ALWAYS_REFRESH) return true;
  if (!p.commentsCount) return false;
  if (!prev) return true;
  if (prev.comments_count !== p.commentsCount) return true;
  return Date.now() - new Date(p.createdAt).getTime() < RECENT_MS;
}

async function insertComment(tenant: string, c: {id: string; platform: string; postId: string; parentId?: string | null; authorName: string; authorId?: string | null; text: string; createdAt: string; isOwn: boolean}) {
  // A Meta repete o mesmo comentário em publicações ligadas (ids diferentes): guarda só uma vez.
  const dup = await db().prepare('SELECT 1 FROM social_comments WHERE tenant=? AND platform=? AND text=? AND author_name=? AND substr(created_at,1,10)=? AND id<>? LIMIT 1').bind(tenant, c.platform, c.text.slice(0, 4000), c.authorName.slice(0, 200), c.createdAt.slice(0, 10), c.id).first();
  if (dup) return 0;
  const r = await db()
    .prepare('INSERT OR IGNORE INTO social_comments(tenant,id,platform,post_id,parent_id,author_name,author_id,text,created_at,collected_at,is_own) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(tenant, c.id, c.platform, c.postId, c.parentId ?? null, c.authorName.slice(0, 200), c.authorId ?? null, c.text.slice(0, 4000), c.createdAt, Date.now(), c.isOwn ? 1 : 0)
    .run();
  return r.meta.changes ? 1 : 0;
}

async function paged<T>(api: Api, path: string, params: Record<string, string>, token: string) {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < COMMENT_PAGES; i++) {
    const r = await api.get<{data: T[]; paging?: {next?: string; cursors?: {after?: string}}}>(path, {...params, ...(after ? {after} : {})}, token);
    out.push(...r.data);
    after = r.paging?.next ? r.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}

export async function collect(tenant = 'pf'): Promise<CollectResult> {
  const selected = await selectedData();
  if (!selected) throw new MetaReadError('Nenhuma página vinculada a este cliente.');
  const api = await reader();
  const page = (await api.pages()).find(p => p.id === selected.page_id);
  if (!page?.access_token) throw new MetaReadError('A página vinculada não está mais autorizada. Reconecte a Meta.');
  const token = page.access_token;
  const warnings: string[] = [];
  let posts = 0, newComments = 0;

  type FbPost = {id: string; message?: string; created_time: string; permalink_url?: string; reactions?: {summary?: {total_count?: number}}; comments?: {summary?: {total_count?: number}}};
  type IgMedia = {id: string; caption?: string; timestamp: string; permalink?: string; like_count?: number; comments_count?: number};
  type IgComment = {id: string; text?: string; username?: string; timestamp: string; from?: {id?: string; username?: string}; replies?: {data: IgComment[]}};
  const FB_FIELDS = 'id,message,created_time,permalink_url,reactions.limit(0).summary(total_count),comments.limit(0).summary(true)';
  const IG_FIELDS = 'id,caption,timestamp,permalink,like_count,comments_count';
  const ig = page.instagram_business_account;

  async function fbPost(p: FbPost, rank: number, ad: string | null = null) {
    posts++;
    const fetchComments = await upsertPost(tenant, {id: p.id, platform: 'Facebook', text: p.message || '', permalink: p.permalink_url, createdAt: iso(p.created_time), reactions: num(p.reactions?.summary?.total_count), commentsCount: num(p.comments?.summary?.total_count), ad}, rank);
    if (!fetchComments) return;
    try {
      const comments = await paged<{id: string; message?: string; from?: {id?: string; name?: string}; created_time: string; parent?: {id: string}}>(api, p.id + '/comments', {fields: 'id,message,from{id,name},created_time,parent{id}', filter: 'stream', order: 'reverse_chronological', limit: '100'}, token);
      for (const c of comments) {
        if (!c.message) continue;
        newComments += await insertComment(tenant, {id: c.id, platform: 'Facebook', postId: p.id, parentId: c.parent?.id, authorName: c.from?.name || 'Autor não informado', authorId: c.from?.id, text: c.message, createdAt: iso(c.created_time), isOwn: c.from?.id === page!.id});
      }
    } catch (e) {
      warnings.push('Comentários do Facebook incompletos.' + metaDetail(e));
    }
  }

  async function igMedia(m: IgMedia, rank: number, ad: string | null = null) {
    posts++;
    const fetchComments = await upsertPost(tenant, {id: m.id, platform: 'Instagram', text: m.caption || '', permalink: m.permalink, createdAt: iso(m.timestamp), reactions: num(m.like_count), commentsCount: num(m.comments_count), ad}, rank);
    if (!fetchComments) return;
    try {
      const comments = await paged<IgComment>(api, m.id + '/comments', {fields: 'id,text,username,timestamp,from{id,username},replies{id,text,username,timestamp,from{id,username}}', limit: '50'}, token);
      const own = (c: IgComment) => !!ig?.username && (c.username || c.from?.username) === ig.username;
      for (const c of comments) {
        if (c.text) newComments += await insertComment(tenant, {id: c.id, platform: 'Instagram', postId: m.id, authorName: c.username || c.from?.username || 'Autor não informado', authorId: c.from?.id, text: c.text, createdAt: iso(c.timestamp), isOwn: own(c)});
        for (const r of c.replies?.data || []) {
          if (r.text) newComments += await insertComment(tenant, {id: r.id, platform: 'Instagram', postId: m.id, parentId: c.id, authorName: r.username || r.from?.username || 'Autor não informado', authorId: r.from?.id, text: r.text, createdAt: iso(r.timestamp), isOwn: own(r)});
        }
      }
    } catch (e) {
      warnings.push('Comentários do Instagram incompletos.' + metaDetail(e));
    }
  }

  // Facebook (feed)
  try {
    const feed = await api.get<{data: FbPost[]}>(page.id + '/posts', {fields: FB_FIELDS, limit: String(POSTS_PER_NETWORK)}, token);
    for (const [rank, p] of feed.data.entries()) await fbPost(p, rank);
  } catch (e) {
    warnings.push('Publicações do Facebook indisponíveis.' + metaDetail(e));
  }

  // Instagram (feed)
  if (ig) {
    try {
      const media = await api.get<{data: IgMedia[]}>(ig.id + '/media', {fields: IG_FIELDS, limit: String(POSTS_PER_NETWORK)}, token);
      for (const [rank, m] of media.data.entries()) await igMedia(m, rank);
    } catch (e) {
      warnings.push('Publicações do Instagram indisponíveis.' + metaDetail(e));
    }
  }

  // Anúncios (conta de anúncios escolhida em /conexao-meta). Somente leitura dos anúncios.
  if (selected.ad_account_id) {
    try {
      const ads = await api.get<{data: {id: string; name?: string; creative?: {effective_object_story_id?: string; effective_instagram_media_id?: string}}[]}>(
        `${selected.ad_account_id}/ads`,
        {fields: 'id,name,creative{effective_object_story_id,effective_instagram_media_id}', effective_status: '["ACTIVE"]', limit: String(MAX_ADS)},
      );
      const seen = new Set<string>();
      for (const ad of ads.data) {
        const label = (ad.name || 'Anúncio').slice(0, 120);
        const story = ad.creative?.effective_object_story_id;
        const igId = ad.creative?.effective_instagram_media_id;
        try {
          if (story && story.startsWith(page.id + '_') && !seen.has(story)) {
            seen.add(story);
            await fbPost(await api.get<FbPost>(story, {fields: FB_FIELDS}, token), 0, label);
          }
          if (igId && ig && !seen.has(igId)) {
            seen.add(igId);
            await igMedia(await api.get<IgMedia>(igId, {fields: IG_FIELDS}, token), 0, label);
          }
        } catch (e) {
          warnings.push('Comentários de um ou mais anúncios indisponíveis.' + metaDetail(e));
        }
      }
    } catch (e) {
      warnings.push('Anúncios indisponíveis. Reconecte a Meta aceitando a leitura de anúncios.' + metaDetail(e));
    }
  }
  return {posts, newComments, warnings: [...new Set(warnings)]};
}
