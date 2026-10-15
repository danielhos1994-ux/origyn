import {db} from '@/lib/db';
import {config} from '@/lib/meta';
import {decryptToken} from '@/lib/meta-crypto';
export class MetaReadError extends Error {meta?:{code?:number;subcode?:number;message?:string};constructor(message:string,meta?:{code?:number;subcode?:number;message?:string}){super(message);this.meta=meta;}}
// Detalhe técnico seguro para exibir ao proprietário (sem tokens nem URLs).
export function metaDetail(e:unknown){if(!(e instanceof MetaReadError)||!e.meta)return '';const m=(e.meta.message||'').replace(/access_token=[^&\s]+/gi,'access_token=…').replace(/https?:\/\/\S+/g,'').slice(0,200);return ` [Meta ${e.meta.code??'?'}${e.meta.subcode?'/'+e.meta.subcode:''}${m?': '+m:''}]`;}
type PageAccount={id:string;name:string;access_token?:string;instagram_business_account?:{id:string;username?:string}};
export type RealPost={id:string;platform:string;text:string;date:string;url?:string;likes:number|null;commentCount:number|null;comments:{id:string;text:string;name:string;date:string}[]};
export type Snapshot={page:{id:string;name:string;followers:number|null};instagram:{id:string;username:string;followers:number|null}|null;posts:RealPost[];warnings:string[]};
export async function reader(){
 const c=await config();
 const row=await db().prepare('SELECT token_ciphertext,expires_at FROM meta_connections WHERE id=?').bind('owner').first<{token_ciphertext:string;expires_at:number|null}>();
 if(!row||row.expires_at!==null&&row.expires_at<=Date.now())throw new MetaReadError('A autorização expirou ou está ausente. Conecte novamente com a Meta.');
 const token=await decryptToken(row.token_ciphertext,c.key!);
 async function get<T>(path:string,params:Record<string,string>={},accessToken=token):Promise<T>{
  const url=new URL(`https://graph.facebook.com/${c.version}/${path}`);
  for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(c.secret!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const proof=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(accessToken))),b=>b.toString(16).padStart(2,'0')).join('');
  url.searchParams.set('appsecret_proof',proof);
  let response:Response;try{response=await fetch(url,{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(12000)});}catch{throw new MetaReadError('A Meta demorou a responder. Tente novamente.');}
  const body=await response.json() as T & {error?:{code?:number;error_subcode?:number;message?:string}};
  if(!response.ok||body.error){const meta={code:body.error?.code,subcode:body.error?.error_subcode,message:body.error?.message};if(body.error?.code===190)throw new MetaReadError('A autorização da Meta não está válida. Conecte novamente.',meta);throw new MetaReadError('A Meta não liberou esta leitura. Confira as permissões e o acesso à página.',meta);}
  return body;
 }
 async function pages(){
  const results:PageAccount[]=[];let after:string|undefined;
  for(let i=0;i<10;i++){
   const data=await get<{data:PageAccount[];paging?:{next?:string;cursors?:{after?:string}}}>('me/accounts',{fields:'id,name,access_token,instagram_business_account{id,username}',limit:'100',...(after?{after}:{})});
   results.push(...data.data);if(!data.paging?.next)return results;
   after=data.paging.cursors?.after;if(!after)break;
  }
  throw new MetaReadError('A lista de páginas excedeu o limite desta importação. Restrinja as páginas autorizadas e tente novamente.');
 }
 async function permissions(){
  const r=await get<{data:{permission:string;status:string}[]}>('me/permissions');
  return {granted:r.data.filter(p=>p.status==='granted').map(p=>p.permission),declined:r.data.filter(p=>p.status!=='granted').map(p=>p.permission)};
 }
 // Escrita (responder/ocultar comentários). Usada somente pela fila de aprovação, após ação explícita do proprietário.
 async function post<T>(path:string,params:Record<string,string>,accessToken:string):Promise<T>{
  const url=new URL(`https://graph.facebook.com/${c.version}/${path}`);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(c.secret!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const proof=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(accessToken))),b=>b.toString(16).padStart(2,'0')).join('');
  const body=new URLSearchParams({...params,appsecret_proof:proof});
  let response:Response;try{response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(15000)});}catch{throw new MetaReadError('A Meta demorou a responder. Nada foi confirmado; confira na rede antes de tentar de novo.');}
  const out=await response.json() as T & {error?:{code?:number;error_subcode?:number;message?:string}};
  if(!response.ok||out.error){const meta={code:out.error?.code,subcode:out.error?.error_subcode,message:out.error?.message};if(out.error?.code===190)throw new MetaReadError('A autorização da Meta não está válida. Conecte novamente.',meta);if(out.error?.code===10||out.error?.code===200)throw new MetaReadError('A Meta não liberou esta ação. Reconecte a Meta aceitando as permissões de comentários.',meta);throw new MetaReadError('A Meta recusou a ação.',meta);}
  return out;
 }
 return {get,pages,permissions,post};
}
const count=(n:unknown)=>typeof n==='number'?n:null;
export async function importPage(page:PageAccount,api:Awaited<ReturnType<typeof reader>>):Promise<Snapshot>{
 if(!page.access_token)throw new MetaReadError('A Meta não forneceu acesso de leitura a esta página.');
 const warnings:string[]=[],posts:RealPost[]=[];
 const profile=await api.get<{followers_count?:number}>(page.id,{fields:'id,name,followers_count'},page.access_token);
 const snapshot:Snapshot={page:{id:page.id,name:page.name,followers:count(profile.followers_count)},instagram:null,posts,warnings};
 type FbPost={id:string;message?:string;created_time:string;permalink_url?:string;reactions?:{summary?:{total_count?:number}};comments?:{summary?:{total_count?:number}}};
 let feed:{data:FbPost[]}|null=null;
 try{feed=await api.get<{data:FbPost[]}>(page.id+'/posts',{fields:'id,message,created_time,permalink_url,reactions.limit(0).summary(total_count),comments.limit(0).summary(true)',limit:'10'},page.access_token);}
 catch(e){
  // Tenta sem os contadores para separar problema de campo de problema de permissão.
  try{feed=await api.get<{data:FbPost[]}>(page.id+'/posts',{fields:'id,message,created_time,permalink_url',limit:'10'},page.access_token);warnings.push('Contagens de reações/comentários do Facebook indisponíveis.'+metaDetail(e));}
  catch(e2){warnings.push('Publicações do Facebook indisponíveis nesta leitura.'+metaDetail(e2));}
 }
 if(feed){
  for(const p of feed.data){const post:RealPost={id:p.id,platform:'Facebook',text:p.message||'Publicação sem texto',date:p.created_time,url:p.permalink_url,likes:count(p.reactions?.summary?.total_count),commentCount:count(p.comments?.summary?.total_count),comments:[]};
   try{const r=await api.get<{data:{id:string;message?:string;from?:{name:string};created_time:string}[]}>(p.id+'/comments',{fields:'id,message,from,created_time',limit:'20'},page.access_token);post.comments=r.data.map(c=>({id:c.id,text:c.message||'',name:c.from?.name||'Autor não informado',date:c.created_time}));}catch(e){warnings.push('Comentários de uma ou mais publicações do Facebook não ficaram disponíveis.'+metaDetail(e));}
   posts.push(post);
  }
 }
 const ig=page.instagram_business_account;
 if(ig){
  try{const p=await api.get<{id:string;username?:string;followers_count?:number}>(ig.id,{fields:'id,username,followers_count'},page.access_token);snapshot.instagram={id:p.id,username:p.username||ig.username||'',followers:count(p.followers_count)};}catch(e){warnings.push('Perfil do Instagram indisponível nesta leitura.'+metaDetail(e));}
  try{const feed=await api.get<{data:{id:string;caption?:string;timestamp:string;permalink?:string;like_count?:number;comments_count?:number}[]}>(ig.id+'/media',{fields:'id,caption,timestamp,permalink,like_count,comments_count',limit:'10'},page.access_token);
   for(const p of feed.data){const post:RealPost={id:p.id,platform:'Instagram',text:p.caption||'Publicação sem legenda',date:p.timestamp,url:p.permalink,likes:count(p.like_count),commentCount:count(p.comments_count),comments:[]};
    try{const r=await api.get<{data:{id:string;text?:string;username?:string;timestamp:string}[]}>(p.id+'/comments',{fields:'id,text,username,timestamp',limit:'20'},page.access_token);post.comments=r.data.map(c=>({id:c.id,text:c.text||'',name:c.username||'Autor não informado',date:c.timestamp}));}catch(e){warnings.push('Comentários do Instagram não ficaram disponíveis. A permissão de comentários pode estar pendente.'+metaDetail(e));}
    posts.push(post);
   }
  }catch(e){warnings.push('Publicações do Instagram indisponíveis nesta leitura.'+metaDetail(e));}
 }
 snapshot.warnings=[...new Set(warnings)];return snapshot;
}
export async function selectedData(){return db().prepare('SELECT page_id,page_name,instagram_id,instagram_username,snapshot,synced_at FROM meta_client_data WHERE tenant=?').bind('pf').first<{page_id:string;page_name:string;instagram_id:string|null;instagram_username:string|null;snapshot:string|null;synced_at:number|null}>();}
