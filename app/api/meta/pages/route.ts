import {ownerAccess,activeClient} from '@/lib/access';
import {db} from '@/lib/db';
import {metaOrigin} from '@/lib/meta';
import {reader,selectedData,MetaReadError} from '@/lib/meta-data';
const headers={'Cache-Control':'no-store'};
export async function GET(){try{if(!await ownerAccess())return Response.json({error:'Acesso negado'},{status:403,headers});const api=await reader();const pages=await api.pages();let diagnostics=null;if(!pages.length){try{diagnostics=await api.permissions();}catch{diagnostics={granted:[],declined:[],error:true};}}return Response.json({pages:pages.map(p=>({id:p.id,name:p.name,instagram:p.instagram_business_account||null})),selected:await selectedData(),diagnostics},{headers});}catch(e){return Response.json({error:e instanceof MetaReadError?e.message:'Não foi possível carregar as páginas.'},{status:503,headers});}}
export async function POST(req:Request){try{
 if(req.headers.get('origin')!==metaOrigin()||!await ownerAccess())return Response.json({error:'Acesso negado'},{status:403,headers});
 if(!await activeClient('pf'))return Response.json({error:'Cliente indisponível'},{status:404,headers});
 const body=await req.json() as {pageId?:string};if(typeof body.pageId!=='string'||!/^\d+$/.test(body.pageId))return Response.json({error:'Página inválida'},{status:400,headers});
 const api=await reader(),page=(await api.pages()).find(p=>p.id===body.pageId);if(!page)return Response.json({error:'Página não autorizada para esta conta.'},{status:403,headers});
 await db().prepare('INSERT INTO meta_client_data(tenant,page_id,page_name,instagram_id,instagram_username) VALUES(?,?,?,?,?) ON CONFLICT(tenant) DO UPDATE SET page_id=excluded.page_id,page_name=excluded.page_name,instagram_id=excluded.instagram_id,instagram_username=excluded.instagram_username,snapshot=NULL,synced_at=NULL').bind('pf',page.id,page.name,page.instagram_business_account?.id||null,page.instagram_business_account?.username||null).run();
 return Response.json({ok:true},{headers});
 }catch(e){return Response.json({error:e instanceof MetaReadError?e.message:'Não foi possível salvar a seleção.'},{status:503,headers});}}
