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
const runtimeEnv={APP_ORIGIN:'https://origyn.example.workers.dev'};
const cache=new Map();
function mod(file){const path=resolve(file);if(cache.has(path))return cache.get(path).exports;const m={exports:{}};cache.set(path,m);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const localRequire=(id)=>id==='cloudflare:workers'?{env:runtimeEnv}:id==='@/lib/db'?{db:()=>binding}:id==='@/app/auth'?{getUser:async()=>user}:id.startsWith('@/')?mod(id.slice(2)+'.ts'):require(id);vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{crypto,Response,Request,URL,TextEncoder,TextDecoder,Uint8Array,console,Date,URLSearchParams,AbortSignal,fetch:(...args)=>mockFetch(...args)})(localRequire,m,m.exports);return m.exports;}

const access=mod('lib/access.ts'),start=mod('app/api/meta/start/route.ts'),callback=mod('app/api/meta/callback/route.ts');
await access.ownerAccess(true);
const origin='https://origyn.example.workers.dev';
const post=(o=origin)=>new Request(origin+'/api/meta/start',{method:'POST',headers:{Origin:o}});
assert.equal((await start.POST(post())).status,503);
Object.assign(runtimeEnv,{META_APP_ID:'123456',META_APP_SECRET:'test-secret',META_TOKEN_ENCRYPTION_KEY:'a'.repeat(64),META_GRAPH_VERSION:'v25.0'});
assert.equal((await start.POST(post('https://attacker.test'))).status,403);
let calls=0;
let mockFetch=async(url)=>{calls++;const u=new URL(url);if(u.pathname.endsWith('/me'))return Response.json({id:'123',name:'Teste'});if(u.searchParams.get('grant_type')==='fb_exchange_token')return Response.json({access_token:'test-long-token',expires_in:5184000});return Response.json({access_token:'test-sensitive-token',expires_in:3600});};
async function attempt(){const r=await start.POST(post());assert.equal(r.status,303);const url=new URL(r.headers.get('location'));assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/meta/callback');assert.ok(!url.searchParams.get('scope').includes('manage_comments'));assert.ok(url.searchParams.get('scope').includes('business_management'));assert.equal(url.searchParams.get('auth_type'),'rerequest');const cookie=r.headers.get('set-cookie').split(';')[0];return {state:url.searchParams.get('state'),cookie};}
function req(a,extra='&code=test-code'){return new Request(origin+'/api/meta/callback?state='+a.state+extra,{headers:{Cookie:a.cookie}});}
let a=await attempt();let r=await callback.GET(req({...a,cookie:'__Host-origyn-meta='+'b'.repeat(64)}));assert.ok(r.headers.get('location').endsWith('sessao-invalida'));assert.equal(calls,0);
r=await callback.GET(req(a));assert.ok(r.headers.get('location').endsWith('autorizado'));assert.equal(calls,3);
const saved=sql.prepare('SELECT * FROM meta_connections').get();assert.equal(saved.meta_user_id,'123');assert.ok(!saved.token_ciphertext.includes('test-sensitive-token'));assert.ok(!saved.token_ciphertext.includes('test-long-token'));assert.ok(saved.expires_at>Date.now()+86400000*30);assert.equal(JSON.parse(saved.token_ciphertext).iv.length,12);
r=await callback.GET(req(a));assert.ok(r.headers.get('location').endsWith('sessao-invalida'));assert.equal(calls,3);
a=await attempt();r=await callback.GET(req(a,'&error=access_denied'));assert.ok(r.headers.get('location').endsWith('cancelado'));assert.equal(sql.prepare('SELECT token_ciphertext FROM meta_connections').get().token_ciphertext,saved.token_ciphertext);
a=await attempt();sql.exec('UPDATE meta_oauth_attempts SET expires_at=0');r=await callback.GET(req(a));assert.ok(r.headers.get('location').endsWith('sessao-invalida'));
user=null;assert.equal((await start.POST(post())).status,403);
console.log('PASS: missing configuration, origin and owner checks, read-only scopes, browser binding, encrypted storage, replay rejection, expiry and cancellation preservation.');

user={userId:'owner-identity'};
const setup=mod('app/api/meta/config/route.ts');
function setupRequest(secret='c'.repeat(32),originHeader=origin){return new Request(origin+'/api/meta/config',{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({app_secret:secret,graph_version:'v25.0'})});}
assert.equal((await setup.POST(setupRequest('c'.repeat(32),'https://attacker.test'))).status,403);
assert.ok((await setup.POST(setupRequest('wrong'))).headers.get('location').endsWith('dados-invalidos'));
assert.equal(sql.prepare('SELECT count(*) n FROM meta_app_config').get().n,0);
r=await setup.POST(setupRequest());assert.ok(r.headers.get('location').endsWith('configuracao-salva'));
assert.ok(!sql.prepare('SELECT secret_ciphertext FROM meta_app_config').get().secret_ciphertext.includes('c'.repeat(32)));
assert.equal((await mod('lib/meta.ts').config()).secret,'c'.repeat(32));
assert.deepEqual(Array.from(await mod('lib/meta.ts').missing()),[]);
user=null;assert.equal((await setup.POST(setupRequest())).status,403);
console.log('PASS: configuration authorization, CSRF checks, input validation, encrypted secret persistence and server-only decryption.');

user={userId:'owner-identity'};
const pagesRoute=mod('app/api/meta/pages/route.ts'),syncRoute=mod('app/api/meta/sync/route.ts');
let rejectProfile=false;
mockFetch=async(url,options)=>{
 assert.equal(options.method,undefined); // All requests to Meta are reads.
 const u=new URL(url);assert.equal(u.origin,'https://graph.facebook.com');assert.ok(u.searchParams.get('appsecret_proof'));assert.ok(options.headers.Authorization);
 const path=u.pathname.replace(/^\/v\d+\.0\//,'');
 if(path==='me/accounts')return Response.json({data:[{id:'555',name:'PF authorized',access_token:'page-token',instagram_business_account:{id:'666',username:'pf'}}]});
 if(path==='555'){if(rejectProfile)return Response.json({error:{code:190}},{status:400});return Response.json({id:'555',name:'PF authorized',followers_count:42});}
 if(path==='555/posts'&&u.searchParams.get('fields').includes('reactions'))return Response.json({error:{code:100,message:'Tried accessing nonexisting field (reactions)'}},{status:400});if(path==='555/posts')return Response.json({data:[{id:'555_1',message:'Real post',created_time:'2026-09-30T00:00:00Z',likes:{summary:{total_count:2}},comments:{summary:{total_count:1}}}]});
 if(path==='555_1/comments')return Response.json({data:[{id:'comment1',message:'Read only',created_time:'2026-09-30T00:00:00Z',from:{name:'Reader'}}]});
 if(path==='666')return Response.json({id:'666',username:'pf',followers_count:12});
 if(path==='666/media')return Response.json({data:[{id:'777',caption:'Instagram post',timestamp:'2026-09-30T00:00:00Z'}]});
 if(path==='777/comments')return Response.json({error:{code:200}},{status:403});
 throw new Error('Unexpected path');
};
const selectRequest=id=>new Request(origin+'/api/meta/pages',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({pageId:id})});
r=await pagesRoute.GET();assert.equal(r.status,200);let listing=await r.json();assert.equal(listing.pages[0].id,'555');assert.ok(!JSON.stringify(listing).includes('page-token'));
assert.equal((await pagesRoute.POST(selectRequest('999'))).status,403);
assert.equal((await pagesRoute.POST(selectRequest('555'))).status,200);
const syncRequest=()=>new Request(origin+'/api/meta/sync',{method:'POST',headers:{Origin:origin}});
r=await syncRoute.POST(syncRequest());assert.equal(r.status,200);let synced=await r.json();assert.equal(synced.snapshot.posts.length,2);assert.equal(synced.snapshot.posts[0].comments[0].text,'Read only');assert.equal(synced.snapshot.warnings.length,2);assert.ok(synced.snapshot.warnings.some(w=>w.includes('[Meta 100: Tried accessing nonexisting field (reactions)]')));assert.ok(!synced.snapshot.warnings.join().includes('page-token'));assert.ok(!JSON.stringify(synced).includes('page-token'));
await syncRoute.POST(syncRequest());assert.equal(sql.prepare('SELECT count(*) n FROM meta_client_data').get().n,1);
const prior=sql.prepare('SELECT snapshot FROM meta_client_data').get().snapshot;
rejectProfile=true;assert.equal((await syncRoute.POST(syncRequest())).status,503);assert.equal(sql.prepare('SELECT snapshot FROM meta_client_data').get().snapshot,prior);
const fullMock=mockFetch;mockFetch=async(url,o)=>{const p=new URL(url).pathname.replace(/^\/v\d+\.0\//,'');if(p==='me/accounts')return Response.json({data:[]});if(p==='me/permissions')return Response.json({data:[{permission:'pages_show_list',status:'granted'},{permission:'business_management',status:'declined'}]});return fullMock(url,o);};
r=await pagesRoute.GET();listing=await r.json();assert.equal(listing.pages.length,0);assert.deepEqual(listing.diagnostics.granted,['pages_show_list']);assert.deepEqual(listing.diagnostics.declined,['business_management']);mockFetch=fullMock;
console.log('PASS: long-lived token exchange, rerequest + business_management, permission diagnostics on empty page list.');
user=null;assert.equal((await pagesRoute.GET()).status,403);assert.equal((await syncRoute.POST(syncRequest())).status,403);
console.log('PASS: authorized page selection, no token exposure, GET-only Meta reads, partial-permission warnings, idempotent snapshots and preservation on failure.');
