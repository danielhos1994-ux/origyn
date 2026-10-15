import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const require=createRequire(import.meta.url),sql=new DatabaseSync(':memory:');
for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync(`drizzle/${f}`,'utf8'));
let user={userId:'owner-identity',email:'owner@example.test',displayName:'Owner',fullName:null};
const binding={prepare(query){let values=[];return {bind(...v){values=v;return this},async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:r.changes}}},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}}}},async batch(statements){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
const runtimeEnv={APP_ORIGIN:'https://origyn.example.workers.dev',META_APP_ID:'123456',META_APP_SECRET:'s',META_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),META_GRAPH_VERSION:'v26.0'};
const cache=new Map();
function mod(file){const path=resolve(file);if(cache.has(path))return cache.get(path).exports;const m={exports:{}};cache.set(path,m);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const localRequire=(id)=>id==='cloudflare:workers'?{env:runtimeEnv}:id==='@/lib/db'?{db:()=>binding}:id==='@/app/auth'?{getUser:async()=>user}:id.startsWith('@/')?mod(id.slice(2)+'.ts'):require(id);vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{crypto,Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,console,Date,URLSearchParams,AbortSignal,fetch:(...args)=>mockFetch(...args)})(localRequire,m,m.exports);return m.exports;}
let mockFetch=async()=>{throw new Error('no fetch')};
const crypt=mod('lib/meta-crypto.ts');
sql.prepare("INSERT INTO meta_connections(id,meta_user_id,display_name,token_ciphertext,expires_at,connected_at) VALUES('owner','1','Owner',?,NULL,0)").run(await crypt.encryptToken('user-token','a'.repeat(64)));
sql.prepare("INSERT INTO meta_client_data(tenant,page_id,page_name,instagram_id,instagram_username) VALUES('pf','555','PF','666','pf')").run();
const ins=(id,platform,parent=null,own=0,created=new Date(Date.now()-86400000).toISOString())=>sql.prepare("INSERT INTO social_comments(tenant,id,platform,post_id,parent_id,author_name,text,created_at,collected_at,is_own,category,suggested_action,suggested_reply,classified_at,priority) VALUES('pf',?,?,'p',?,'a','Quanto custa?',?,0,?,'duvida_produto','responder','O valor varia 💙 Nos chame',1,'media')").run(id,platform,parent,created,own);
ins('ig1','Instagram');ins('ig2','Instagram','ig1');ins('fb1','Facebook');ins('fb2','Facebook');ins('own1','Instagram',null,1);ins('d1','Instagram');ins('old1','Instagram',null,0,'2025-01-01T00:00:00.000Z');
const writes=[];
mockFetch=async(url,o={})=>{const u=new URL(url);const path=u.pathname.replace(/^\/v\d+\.0\//,'');
 if(path==='me/accounts')return Response.json({data:[{id:'555',name:'PF',access_token:'page-token',instagram_business_account:{id:'666',username:'pf'}}]});
 assert.equal(o.method,'POST');const body=new URLSearchParams(o.body);assert.ok(body.get('appsecret_proof'));assert.equal(o.headers.Authorization,'Bearer page-token');writes.push([path,Object.fromEntries(body)]);
 if(path==='fb2')return Response.json({error:{code:200,message:'(#200) Permissions error'}},{status:403});
 return Response.json(path.endsWith('replies')||path.endsWith('comments')?{id:'reply_'+path}:{success:true});
};
const m=mod('lib/moderation.ts'),route=mod('app/api/moderacao/route.ts');
await mod('lib/access.ts').ownerAccess(true);
const req=(b,o='https://origyn.example.workers.dev')=>new Request('https://origyn.example.workers.dev/api/moderacao',{method:'POST',headers:{Origin:o,'Content-Type':'application/json'},body:JSON.stringify(b)});
// Origem e proprietário
assert.equal((await route.POST(req({id:'ig1',action:'responder',reply:'Oi'},'https://evil.test'))).status,403);
// Instagram: responde no fio do comentário principal
let r=await route.POST(req({id:'ig1',action:'responder',reply:'O valor varia 💙 Nos chame no DM'}));assert.equal(r.status,200);
assert.deepEqual(writes.at(-1)[0],'ig1/replies');assert.equal(writes.at(-1)[1].message,'O valor varia 💙 Nos chame no DM');
r=await route.POST(req({id:'ig2',action:'responder',reply:'Resposta'}));assert.equal(writes.at(-1)[0],'ig1/replies');
// Idempotência: não envia duas vezes
const n=writes.length;r=await route.POST(req({id:'ig1',action:'responder',reply:'De novo'}));assert.equal(r.status,409);assert.equal(writes.length,n);
// Facebook: bloqueia DM/link da bio antes de chamar a Meta
r=await route.POST(req({id:'fb1',action:'responder',reply:'Nos chame no DM'}));assert.equal(r.status,400);assert.equal(writes.length,n);
r=await route.POST(req({id:'fb1',action:'responder',reply:'Veja em https://x.com'}));assert.equal(r.status,400);
// Facebook: ocultar usa is_hidden
r=await route.POST(req({id:'fb1',action:'ocultar'}));assert.equal(r.status,200);assert.deepEqual(writes.at(-1),['fb1',{is_hidden:'true',appsecret_proof:writes.at(-1)[1].appsecret_proof}]);
// Erro da Meta: volta para a fila com motivo e não marca como tratado
r=await route.POST(req({id:'fb2',action:'ocultar'}));assert.equal(r.status,502);const fb2=sql.prepare("SELECT handled_status,handled_error FROM social_comments WHERE id='fb2'").get();assert.equal(fb2.handled_status,null);assert.ok(fb2.handled_error.includes('permissões'));
// Descartar não chama a Meta; comentário próprio é recusado
const n2=writes.length;r=await route.POST(req({id:'d1',action:'descartar'}));assert.equal(r.status,200);assert.equal(writes.length,n2);
assert.equal((await route.POST(req({id:'own1',action:'responder',reply:'x y'}))).status,404);
// Fila e registro
const q=await m.loadQueue('pf','pendentes');assert.deepEqual(q.items.map(i=>i.id),['fb2']);assert.equal(q.concluidos,4);
assert.equal(sql.prepare("SELECT COUNT(*) n FROM moderation_log WHERE result='ok'").get().n,4);
// Limite por hora
for(let i=0;i<30;i++)sql.prepare("INSERT INTO moderation_log(id,tenant,comment_id,action,result,created_at) VALUES(?,'pf','x','responder','ok',?)").run('l'+i,Date.now());
r=await route.POST(req({id:'fb2',action:'ocultar'}));assert.equal(r.status,429);
user=null;assert.equal((await route.POST(req({id:'fb2',action:'ocultar'}))).status,403);
console.log('PASS: approval queue — owner-only, IG/FB reply threading, hide per network, no double send, FB DM/link block, Meta errors back to queue, discard local-only, hourly limit, audit log.');
