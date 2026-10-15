import {ownerAccess} from '@/lib/access';
import {db} from '@/lib/db';
import {environmentConfig,metaOrigin} from '@/lib/meta';
import {encryptToken} from '@/lib/meta-crypto';
function result(status:string){return new Response(null,{status:303,headers:{Location:metaOrigin()+'/conexao-meta?status='+status,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});}
export async function POST(req:Request){
 try{
  if(req.headers.get('origin')!==metaOrigin()||!await ownerAccess())return new Response('Acesso negado',{status:403,headers:{'Cache-Control':'no-store'}});
  const c=environmentConfig();
  if(!/^[a-f0-9]{64}$/i.test(c.key||'')||!c.appId)return result('configuracao');
  if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return result('dados-invalidos');
  if(Number(req.headers.get('content-length')||0)>2048)return result('dados-invalidos');
  const body=await req.text();if(body.length>2048)return result('dados-invalidos');
  const form=new URLSearchParams(body),secret=(form.get('app_secret')||'').trim(),version=(form.get('graph_version')||'').trim();
  if(!/^[a-f0-9]{32}$/i.test(secret)||!/^v[1-9]\d?\.0$/.test(version))return result('dados-invalidos');
  const encrypted=await encryptToken(secret,c.key!,'origyn-meta-app-secret-v1');
  await db().batch([
   db().prepare('INSERT INTO meta_app_config(id,secret_ciphertext,graph_version,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET secret_ciphertext=excluded.secret_ciphertext,graph_version=excluded.graph_version,updated_at=excluded.updated_at').bind('owner',encrypted,version,Date.now()),
   db().prepare('DELETE FROM meta_oauth_attempts')
  ]);
  return result('configuracao-salva');
 }catch{return result('falha-configuracao');}
}
