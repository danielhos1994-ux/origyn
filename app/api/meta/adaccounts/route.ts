import {ownerAccess, activeClient} from '@/lib/access';
import {db} from '@/lib/db';
import {metaOrigin} from '@/lib/meta';
import {reader, selectedData, MetaReadError, metaDetail} from '@/lib/meta-data';
const headers = {'Cache-Control': 'no-store'};
type Account = {id: string; name?: string; account_status?: number; business?: {name?: string}};

async function list() {
  const api = await reader();
  const r = await api.get<{data: Account[]}>('me/adaccounts', {fields: 'id,name,account_status,business{name}', limit: '200'});
  return r.data.map(a => ({id: a.id, name: a.name || a.id, active: a.account_status === 1, business: a.business?.name || null}));
}

export async function GET() {
  try {
    if (!(await ownerAccess())) return Response.json({error: 'Acesso negado'}, {status: 403, headers});
    const sel = await selectedData();
    return Response.json({accounts: await list(), selected: sel?.ad_account_id || null}, {headers});
  } catch (e) {
    const msg = e instanceof MetaReadError ? e.message + metaDetail(e) : 'Não foi possível carregar as contas de anúncios.';
    return Response.json({error: msg.includes('#200') || msg.includes('#10') ? 'Sem permissão de leitura de anúncios. Reconecte a Meta aceitando “ads_read”.' : msg}, {status: 503, headers});
  }
}

export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== metaOrigin() || !(await ownerAccess())) return Response.json({error: 'Acesso negado'}, {status: 403, headers});
    if (!(await activeClient('pf'))) return Response.json({error: 'Cliente indisponível'}, {status: 404, headers});
    const b = (await req.json()) as {adAccountId?: unknown};
    const id = typeof b.adAccountId === 'string' ? b.adAccountId : '';
    if (id && !/^act_\d+$/.test(id)) return Response.json({error: 'Conta inválida.'}, {status: 400, headers});
    const acc = id ? (await list()).find(a => a.id === id) : null;
    if (id && !acc) return Response.json({error: 'Conta não autorizada para este usuário.'}, {status: 403, headers});
    const r = await db().prepare('UPDATE meta_client_data SET ad_account_id=?,ad_account_name=? WHERE tenant=?').bind(acc?.id || null, acc?.name || null, 'pf').run();
    if (!r.meta.changes) return Response.json({error: 'Vincule a página antes de escolher a conta de anúncios.'}, {status: 400, headers});
    return Response.json({ok: true}, {headers});
  } catch (e) {
    return Response.json({error: e instanceof MetaReadError ? e.message : 'Não foi possível salvar.'}, {status: 503, headers});
  }
}
