import {ownerAccess} from '@/lib/access';
import {db} from '@/lib/db';
import {config,missing,cookie,finish,metaCallback} from '@/lib/meta';
import {hash,encryptToken} from '@/lib/meta-crypto';
export async function GET(req:Request){
 try{
 if(!await ownerAccess())return finish('acesso-negado');
 if((await missing()).length)return finish('configuracao');
 const u=new URL(req.url),state=u.searchParams.get('state')||'',browser=cookie(req);
 if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(browser))return finish('sessao-invalida');
 const attempt=await db().prepare('DELETE FROM meta_oauth_attempts WHERE state_hash=? AND browser_hash=? AND expires_at>=? RETURNING state_hash').bind(await hash(state),await hash(browser),Date.now()).first();
 if(!attempt)return finish('sessao-invalida');
 if(u.searchParams.has('error'))return finish('cancelado');
 const code=u.searchParams.get('code');if(!code||code.length>4096)return finish('sessao-invalida');
 const c=await config();
 const response=await fetch(`https://graph.facebook.com/${c.version}/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.appId!,client_secret:c.secret!,redirect_uri:metaCallback(),code}),signal:AbortSignal.timeout(15000)});
 const token=await response.json() as {access_token?:string;expires_in?:number};if(!response.ok||!token.access_token)return finish('falha-meta');
 // Troca o token curto (horas) por um de longa duração (~60 dias). Se falhar, mantém o curto.
 try{const ex=new URL(`https://graph.facebook.com/${c.version}/oauth/access_token`);ex.searchParams.set('grant_type','fb_exchange_token');ex.searchParams.set('client_id',c.appId!);ex.searchParams.set('client_secret',c.secret!);ex.searchParams.set('fb_exchange_token',token.access_token);
  const exr=await fetch(ex,{signal:AbortSignal.timeout(15000)});const long=await exr.json() as {access_token?:string;expires_in?:number};
  if(exr.ok&&long.access_token){token.access_token=long.access_token;token.expires_in=long.expires_in;}}catch{}
 const identityResponse=await fetch(`https://graph.facebook.com/${c.version}/me?fields=id,name`,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
 const identity=await identityResponse.json() as {id?:string;name?:string};if(!identityResponse.ok||!identity.id)return finish('falha-meta');
 const expires=typeof token.expires_in==='number'&&token.expires_in>0?Date.now()+token.expires_in*1000:null;
 await db().prepare('INSERT INTO meta_connections(id,meta_user_id,display_name,token_ciphertext,expires_at,connected_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET meta_user_id=excluded.meta_user_id,display_name=excluded.display_name,token_ciphertext=excluded.token_ciphertext,expires_at=excluded.expires_at,connected_at=excluded.connected_at').bind('owner',identity.id,identity.name||'',await encryptToken(token.access_token,c.key!),expires,Date.now()).run();
 return finish('autorizado');
 }catch{return finish('falha');}
}
