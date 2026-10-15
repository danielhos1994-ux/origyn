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
const runtimeEnv={};
const cache=new Map();
function mod(file){const path=resolve(file);if(cache.has(path))return cache.get(path).exports;const m={exports:{}};cache.set(path,m);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const localRequire=(id)=>id==='cloudflare:workers'?{env:runtimeEnv}:id==='@/lib/db'?{db:()=>binding}:id==='@/app/auth'?{getUser:async()=>user}:id.startsWith('@/')?mod(id.slice(2)+'.ts'):require(id);vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{crypto,Response,Request,URL,TextEncoder,Uint8Array,console,Date})(localRequire,m,m.exports);return m.exports;}
const access=mod('lib/access.ts'),clients=mod('app/api/clients/route.ts'),workspace=mod('app/api/workspace/route.ts'),shared=mod('app/api/client-share/route.ts');
const request=(path,body,token)=>new Request(`https://origyn.test${path}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://origyn.test',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
assert.equal(await access.ownerAccess(),null);assert.ok(await access.ownerAccess(true));
let r=await clients.GET();assert.equal(r.status,200);assert.equal((await r.json()).clients.length,2);
r=await clients.POST(request('/api/clients',{action:'share',tenant:'pf',label:'Cliente PF'}));assert.equal(r.status,200);const token=(await r.json()).url.split('#')[1];assert.equal(token.length,64);assert.notEqual(sql.prepare('SELECT token_hash FROM client_grants').get().token_hash,token);
user={...user,userId:'client-one'};assert.equal(await access.ownerAccess(true),null);assert.equal((await clients.GET()).status,403);assert.equal((await workspace.GET(new Request('https://origyn.test/api/workspace?tenant=pf'))).status,403);assert.equal((await workspace.POST(request('/api/workspace',{tenant:'pf',kind:'manual',content:'unauthorized'}))).status,403);
r=await shared.POST(request('/api/client-share',{tenant:'lab'},token));assert.equal(r.status,200);const data=await r.json();assert.equal(data.client.id,'pf');assert.ok(data.comments.length>0);assert.ok(data.comments.every(c=>c.tenant==='pf'));assert.equal(data.manual,undefined);assert.equal(data.logs,undefined);
user={...user,userId:'client-two'};assert.equal((await shared.POST(request('/api/client-share',null,token))).status,403);
user={...user,userId:'owner-identity'};const grantId=sql.prepare('SELECT id FROM client_grants').get().id;assert.equal((await clients.POST(request('/api/clients',{action:'revoke',tenant:'lab',grantId}))).status,404);assert.equal((await clients.POST(request('/api/clients',{action:'revoke',tenant:'pf',grantId}))).status,200);
user={...user,userId:'client-one'};assert.equal((await shared.POST(request('/api/client-share',null,token))).status,403);
user={...user,userId:'owner-identity'};assert.equal((await clients.POST(request('/api/clients',{action:'delete',tenant:'pf',confirmation:'wrong'}))).status,400);assert.equal((await clients.POST(request('/api/clients',{action:'delete',tenant:'pf',confirmation:'Películas Fácil'}))).status,200);assert.equal((await workspace.GET(new Request('https://origyn.test/api/workspace?tenant=pf'))).status,404);assert.equal((await (await clients.GET()).json()).clients.length,1);assert.ok(sql.prepare('SELECT count(*) n FROM audit').get().n>=3);
user=null;assert.equal((await shared.POST(request('/api/client-share',null,token))).status,401);assert.equal((await clients.GET()).status,403);
console.log('PASS: owner protection; scoped read-only grants; one-account redemption; cross-client denial; revocation; guarded deletion; audit retention; anonymous rejection.');

runtimeEnv.ORIGYN_PRIVATE_ADMIN_MODE='owner-only';assert.equal((await access.ownerAccess()).userId,'platform-private-owner');assert.equal((await clients.POST(request('/api/clients',{action:'share',tenant:'lab',label:'Blocked'}))).status,503);assert.equal((await shared.POST(request('/api/client-share',null,token))).status,503);console.log('PASS: explicit owner-private platform mode restores admin and blocks every shared-access path.');
