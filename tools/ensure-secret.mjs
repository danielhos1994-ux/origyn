// Garante que o segredo META_TOKEN_ENCRYPTION_KEY exista no Worker.
// - Só cria se ele ainda NÃO existir (nunca substitui: trocar a chave invalidaria tokens já cifrados).
// - A chave é gerada aqui e enviada direto para a Cloudflare pelo stdin; não é impressa nem gravada.
// - Se não for possível confirmar a lista de segredos, não faz nada (falha segura).
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';

const NAME = 'META_TOKEN_ENCRYPTION_KEY';
const wrangler = (args, input) => spawnSync('npx', ['wrangler', ...args, '--config', 'wrangler.jsonc'], {input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});

const list = wrangler(['secret', 'list', '--format', 'json']);
let names;
try {
  if (list.status !== 0) throw new Error('list failed');
  const start = list.stdout.indexOf('[');
  names = JSON.parse(list.stdout.slice(start)).map(s => s.name);
} catch {
  console.log(`[ensure-secret] Não foi possível listar os segredos; ${NAME} não foi alterado.`);
  process.exit(0);
}

if (names.includes(NAME)) {
  console.log(`[ensure-secret] ${NAME} já existe; mantido.`);
  process.exit(0);
}

const key = randomBytes(32).toString('hex');
const put = wrangler(['secret', 'put', NAME], key + '\n');
if (put.status !== 0) {
  console.log(`[ensure-secret] Falha ao criar ${NAME}.`);
  process.exit(1);
}
console.log(`[ensure-secret] ${NAME} criado com segurança.`);
