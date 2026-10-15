// Entrada do Worker: delega as páginas ao vinext e adiciona a rotina agendada (cron).
import handler from 'vinext/server/fetch-handler';
import {runSync} from '../lib/sync';

type Ctx = {waitUntil(p: Promise<unknown>): void};

export default {
  fetch(request: Request, env: unknown, ctx: Ctx) {
    return (handler as unknown as {fetch: (r: Request, e: unknown, c: Ctx) => Promise<Response>}).fetch(request, env, ctx);
  },
  async scheduled(_controller: unknown, _env: unknown, ctx: Ctx) {
    ctx.waitUntil(runSync('pf', 'cron'));
  },
};
