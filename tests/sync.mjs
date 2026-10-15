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
sql.prepare("INSERT INTO manuals(tenant,content) VALUES('pf','Tom cordial.')").run();
const sync=mod('lib/sync.ts'),coleta=mod('app/api/coleta/route.ts'),insights=mod('lib/insights.ts');
const recent=new Date(Date.now()-3600000).toISOString();
let fbCount=2,anthropicCalls=0,lastAnthropicBody=null,metaCalls=[];
mockFetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.origin==='https://api.anthropic.com'){
  anthropicCalls++;assert.equal(options.method,'POST');assert.equal(options.headers['x-api-key'],'sk-test');const body=JSON.parse(options.body);lastAnthropicBody=body;
  assert.equal(body.tool_choice.name,'registrar_classificacoes');assert.ok(body.messages[0].content.includes('<comentarios>'));
  const ids=JSON.parse(body.messages[0].content.split('<comentarios>')[1].split('</comentarios>')[0]).map(c=>c.id);
  return Response.json({content:[{type:'tool_use',name:'registrar_classificacoes',input:{itens:ids.map(id=>({id,category:id.includes('q')?'duvida_produto':id.includes('bad')?'negativo':'elogio',sentiment:id.includes('bad')?'negativo':'positivo',topic:id.includes('q')?'Preço do kit':id.includes('bad')?'prazo e entrega':'resultado / elogio',summary:'resumo',priority:'media',needs_support:id.includes('bad'),suggested_reply:id.includes('bad')?'Sentimos muito':'O valor varia conforme o modelo 💙 Nos chame no DM com o modelo e o ano.',confidence:0.9}))}}]});
 }
 assert.equal(options.method,undefined);metaCalls.push(u.pathname);
 const path=u.pathname.replace(/^\/v\d+\.0\//,'');
 if(path==='me/accounts')return Response.json({data:[{id:'555',name:'PF',access_token:'page-token',instagram_business_account:{id:'666',username:'pf'}}]});
 if(path==='555/posts')return Response.json({data:[{id:'555_1',message:'Post FB',created_time:recent,permalink_url:'https://www.facebook.com/p/1',reactions:{summary:{total_count:5}},comments:{summary:{total_count:fbCount}}}]});
 if(path==='555_1/comments')return Response.json({data:[{id:'fb_q1',message:'Quanto custa?',from:{id:'9',name:'Ana'},created_time:recent},{id:'fb_own',message:'Chamamos no direct',from:{id:'555',name:'PF'},created_time:recent,parent:{id:'fb_q1'}},...(fbCount>2?[{id:'fb_bad1',message:'Meu pedido não chegou',from:{id:'8',name:'Bia'},created_time:recent}]:[])]});
 if(path==='666/media')return Response.json({data:[{id:'777',caption:'Post IG',timestamp:recent,permalink:'https://www.instagram.com/p/x',like_count:3,comments_count:1}]});
 if(path==='777/comments')return Response.json({data:[{id:'ig_q2',text:'Serve no Onix?',username:'cliente',timestamp:recent,replies:{data:[{id:'ig_own',text:'Serve sim!',username:'pf',timestamp:recent}]}}]});
 throw new Error('Unexpected path '+path);
};
// 1) Sem chave: coleta funciona, classificação fica pendente.
let r=await sync.runSync('pf','manual');
assert.equal(r.newComments,4);assert.equal(r.classified,0);assert.equal(r.status,'parcial');assert.ok(r.message.includes('Nenhuma IA'));assert.equal(anthropicCalls,0);
const own=sql.prepare("SELECT id FROM social_comments WHERE is_own=1 ORDER BY id").all().map(x=>x.id);assert.deepEqual(own,['fb_own','ig_own']);
assert.equal(sql.prepare("SELECT parent_id FROM social_comments WHERE id='ig_own'").get().parent_id,'ig_q2');
// 1b) Modo gratuito: Workers AI classifica quando não há chave da Anthropic.
let aiCalls=0;runtimeEnv.AI={async run(model,input){aiCalls++;assert.equal(model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');assert.equal(input.response_format.type,'json_schema');const ids=JSON.parse(input.messages[1].content.split('<comentarios>')[1].split('</comentarios>')[0]).map(c=>c.id);return {response:{itens:ids.map(id=>({id,category:'duvida_produto',sentiment:'neutro',topic:'Preço do kit',summary:'s',priority:'baixa',needs_support:false,suggested_reply:'Nos chame 💙',confidence:0.8}))}};}};
r=await sync.runSync('pf','cron');assert.equal(r.classified,2);assert.equal(aiCalls,1);assert.equal(r.status,'ok');
assert.equal(sql.prepare("SELECT model FROM social_comments WHERE id='fb_q1'").get().model,'@cf/meta/llama-3.3-70b-instruct-fp8-fast');
// Cota gratuita esgotada: mensagem clara, coleta preservada.
sql.exec("UPDATE social_comments SET classified_at=NULL");
runtimeEnv.AI={async run(){throw new Error('4006: you have used up your daily free allocation of 10,000 neurons')}};
r=await sync.runSync('pf','cron');assert.equal(r.status,'parcial');assert.ok(r.message.includes('Cota gratuita'));
delete runtimeEnv.AI;
// 2) Com chave: classifica só comentários de terceiros, sem reprocessar.
runtimeEnv.ANTHROPIC_API_KEY='sk-test';
r=await sync.runSync('pf','cron');assert.equal(r.newComments,0);assert.equal(r.classified,2);assert.equal(r.status,'ok');assert.equal(anthropicCalls,1);
assert.ok(!JSON.stringify(lastAnthropicBody).includes('Chamamos no direct'));assert.ok(lastAnthropicBody.messages[0].content.includes('Tom cordial.'));
const q1=sql.prepare("SELECT topic,suggested_action,suggested_reply FROM social_comments WHERE id='fb_q1'").get();assert.equal(q1.topic,'preço do kit');assert.equal(q1.suggested_action,'responder');
assert.ok(!/DM/i.test(q1.suggested_reply),'Facebook nunca menciona DM');assert.ok(q1.suggested_reply.includes('Nos chame'));
assert.ok(/no DM/.test(sql.prepare("SELECT suggested_reply FROM social_comments WHERE id='ig_q2'").get().suggested_reply),'Instagram pode usar DM');
// 3) Novo comentário: idempotente, só o novo vai para a IA.
fbCount=3;r=await sync.runSync('pf','cron');assert.equal(r.newComments,1);assert.equal(r.classified,1);assert.equal(anthropicCalls,2);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM social_comments').get().n,5);
// 4) Sem novidade: não busca comentários de novo para post antigo e inalterado.
sql.exec("UPDATE social_posts SET created_at='2026-01-01T00:00:00.000Z'");
const before=metaCalls.length;
mockFetch=((orig)=>async(url,o)=>{const u=new URL(url);if(u.pathname.endsWith('/posts'))return Response.json({data:[{id:'555_1',message:'Post FB',created_time:'2026-01-01T00:00:00Z',reactions:{summary:{total_count:5}},comments:{summary:{total_count:3}}}]});if(u.pathname.endsWith('/media'))return Response.json({data:[{id:'777',caption:'Post IG',timestamp:'2026-01-01T00:00:00Z',like_count:3,comments_count:1}]});return orig(url,o);})(mockFetch);
r=await sync.runSync('pf','cron');assert.equal(r.newComments,0);assert.ok(!metaCalls.slice(before).some(p=>p.includes('comments')));
// 5) Erro da IA não quebra a coleta; trava evita execuções simultâneas.
sql.exec("UPDATE social_comments SET classified_at=NULL WHERE id='fb_q1'");
const okFetch=mockFetch;mockFetch=async(url,o)=>new URL(url).origin==='https://api.anthropic.com'?Response.json({error:{type:'overloaded_error',message:'Overloaded'}},{status:529}):okFetch(url,o);
r=await sync.runSync('pf','cron');assert.equal(r.status,'parcial');assert.ok(r.message.includes('Anthropic 529'));assert.ok(!r.message.includes('sk-test'));
mockFetch=okFetch;
sql.prepare("INSERT INTO sync_runs(id,tenant,trigger,started_at,status) VALUES('lock','pf','cron',?,'executando')").run(Date.now());
r=await sync.runSync('pf','cron');assert.equal(r.status,'ignorado');sql.exec("DELETE FROM sync_runs WHERE id='lock'");
// 6) Relatório agrupa e ignora comentários próprios.
const ins=await insights.loadInsights('pf','30','todas');
assert.equal(ins.total,3);assert.equal(ins.doubts[0].topic,'preço do kit');assert.equal(ins.complaints[0].topic,'prazo e entrega');assert.equal(ins.attention.length,1);assert.equal(ins.attention[0].id,'fb_bad1');
const igOnly=await insights.loadInsights('pf','30','Instagram');assert.equal(igOnly.total,1);
// 7) Rota manual protegida.
await mod('lib/access.ts').ownerAccess(true);
const post=(o='https://origyn.example.workers.dev')=>new Request('https://origyn.example.workers.dev/api/coleta',{method:'POST',headers:{Origin:o}});
assert.equal((await coleta.POST(post('https://evil.test'))).status,403);
assert.equal((await coleta.POST(post())).status,200);
user=null;assert.equal((await coleta.POST(post())).status,403);
const bad=sql.prepare("SELECT suggested_action,suggested_reply,needs_support,priority FROM social_comments WHERE id='fb_bad1'").get();assert.equal(bad.suggested_action,'ocultar');assert.equal(bad.suggested_reply,null);assert.equal(bad.needs_support,1);assert.equal(bad.priority,'alta');
const cls=mod('lib/classifier.ts');
let v=cls.applyPolicy({id:'x',category:'duvida_produto',topic:'tema inventado',sentiment:'neutro',summary:'',priority:'baixa',suggested_reply:'Oi',confidence:0.4},'Instagram');assert.equal(v.action,'revisar');assert.equal(v.topic,'outros');assert.equal(v.reply,'');
v=cls.applyPolicy({id:'x',category:'invalida',confidence:0.9},'Instagram');assert.equal(v.category,'ambiguo');assert.equal(v.action,'revisar');assert.equal(v.priority,'alta');
v=cls.applyPolicy({id:'x',category:'interesse_compra',topic:'preço do kit',confidence:0.95,suggested_reply:'Que bom! 💙 Acesse o link da bio ou chame pelo Messenger.'},'Facebook');assert.ok(!/link da bio|messenger/i.test(v.reply));
console.log('PASS: manual da Películas Fácil — ações por tipo, revisão em ambiguidade, temas fechados, CTA por rede, suporte privado para problema real.');
console.log('PASS: incremental FB+IG collection, own-reply detection, idempotency, Claude classification (untrusted data, no own comments), AI failure isolation, run lock, insights grouping and protected manual sync.');
