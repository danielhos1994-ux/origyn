import {env} from 'cloudflare:workers';
import {db} from '@/lib/db';
import {decryptSecret} from '@/lib/meta-crypto';
export function metaOrigin(){const o=((env as unknown as {APP_ORIGIN?:string}).APP_ORIGIN||'').replace(/\/$/,'');if(!/^https:\/\/[a-z0-9.-]+$/i.test(o))throw new Error('APP_ORIGIN ausente ou inválido');return o;}
export function metaCallback(){return metaOrigin()+'/api/meta/callback';}
export const COOKIE='__Host-origyn-meta';
export function environmentConfig(){const e=env as unknown as Record<string,string|undefined>;return {appId:e.META_APP_ID,secret:e.META_APP_SECRET,key:e.META_TOKEN_ENCRYPTION_KEY,version:e.META_GRAPH_VERSION,configId:e.META_LOGIN_CONFIG_ID};}
export async function config(){
 const c=environmentConfig();
 const saved=await db().prepare('SELECT secret_ciphertext,graph_version FROM meta_app_config WHERE id=?').bind('owner').first<{secret_ciphertext:string;graph_version:string}>();
 if(saved){c.secret=await decryptSecret(saved.secret_ciphertext,c.key||'');c.version=saved.graph_version;}
 return c;
}
export async function missing(){const c=await config();return [!/^\d+$/.test(c.appId||'')&&'ID do aplicativo',!c.secret&&'Chave secreta do aplicativo',!/^[a-f0-9]{64}$/i.test(c.key||'')&&'Chave de proteção dos tokens',!/^v\d+\.\d+$/.test(c.version||'')&&'Versão da API'].filter(Boolean) as string[];}
export function cookie(req:Request){return req.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';}
export function finish(status:string){return new Response(null,{status:303,headers:{Location:metaOrigin()+'/conexao-meta?status='+status,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':COOKIE+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});}
