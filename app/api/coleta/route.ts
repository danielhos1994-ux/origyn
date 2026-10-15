import {ownerAccess, activeClient} from '@/lib/access';
import {metaOrigin} from '@/lib/meta';
import {runSync} from '@/lib/sync';
const headers = {'Cache-Control': 'no-store'};
export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') !== metaOrigin() || !(await ownerAccess())) return Response.json({error: 'Acesso negado'}, {status: 403, headers});
    if (!(await activeClient('pf'))) return Response.json({error: 'Cliente indisponível'}, {status: 404, headers});
    const result = await runSync('pf', 'manual');
    return Response.json(result, {status: result.status === 'erro' ? 503 : 200, headers});
  } catch {
    return Response.json({error: 'Não foi possível atualizar agora.'}, {status: 503, headers});
  }
}
