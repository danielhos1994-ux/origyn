import {ownerAccess} from '@/lib/access';
import {db} from '@/lib/db';
import {config,missing,metaOrigin,metaCallback,COOKIE} from '@/lib/meta';
import {hash,randomHex} from '@/lib/meta-crypto';
export async function POST(req:Request){
 if(req.headers.get('origin')!==metaOrigin()||!await ownerAccess())return new Response('Acesso negado',{status:403});
 try{
 if((await missing()).length)return new Response('Conexão aguardando configuração.',{status:503});
 const c=await config(),state=randomHex(),browser=randomHex(),now=Date.now();
 await db().batch([db().prepare('DELETE FROM meta_oauth_attempts WHERE expires_at < ?').bind(now),db().prepare('INSERT INTO meta_oauth_attempts(state_hash,browser_hash,expires_at) VALUES(?,?,?)').bind(await hash(state),await hash(browser),now+600000)]);
 const u=new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);u.searchParams.set('client_id',c.appId!);u.searchParams.set('redirect_uri',metaCallback());u.searchParams.set('response_type','code');u.searchParams.set('state',state);u.searchParams.set('auth_type','rerequest');
 if(c.configId)u.searchParams.set('config_id',c.configId);else u.searchParams.set('scope','pages_show_list,pages_read_engagement,business_management,instagram_basic,instagram_manage_insights,ads_read');
 return new Response(null,{status:303,headers:{Location:u.href,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':`${COOKIE}=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`}});
 }catch{return new Response('Não foi possível iniciar a conexão. Tente novamente.',{status:503});}
}
