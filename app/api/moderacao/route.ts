import {ownerAccess, activeClient} from '@/lib/access';
import {metaOrigin} from '@/lib/meta';
import {moderate, ModerationError, type ModerationAction} from '@/lib/moderation';
const headers = {'Cache-Control': 'no-store'};
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== metaOrigin() || !(await ownerAccess())) return Response.json({error: 'Acesso negado'}, {status: 403, headers});
    if (!(await activeClient('pf'))) return Response.json({error: 'Cliente indisponível'}, {status: 404, headers});
    const b = (await req.json()) as {id?: unknown; action?: unknown; reply?: unknown};
    if (typeof b.id !== 'string' || !['responder', 'ocultar', 'descartar'].includes(String(b.action))) return Response.json({error: 'Pedido inválido.'}, {status: 400, headers});
    const r = await moderate('pf', b.id, b.action as ModerationAction, typeof b.reply === 'string' ? b.reply : undefined);
    return Response.json(r, {headers});
  } catch (e) {
    if (e instanceof ModerationError) return Response.json({error: e.message}, {status: e.status, headers});
    return Response.json({error: 'Não foi possível concluir agora.'}, {status: 503, headers});
  }
}
