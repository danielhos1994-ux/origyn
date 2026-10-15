import {ownerAccess,activeClient} from '@/lib/access';
import {db} from '@/lib/db';
import {metaOrigin} from '@/lib/meta';
import {reader,selectedData,importPage,MetaReadError} from '@/lib/meta-data';
export async function POST(req:Request){const headers={'Cache-Control':'no-store'};try{
 if(req.headers.get('origin')!==metaOrigin()||!await ownerAccess())return Response.json({error:'Acesso negado'},{status:403,headers});
 if(!await activeClient('pf'))return Response.json({error:'Cliente indisponível'},{status:404,headers});
 const selected=await selectedData();if(!selected)return Response.json({error:'Selecione a página primeiro.'},{status:400,headers});
 const api=await reader(),page=(await api.pages()).find(p=>p.id===selected.page_id);if(!page)throw new MetaReadError('Esta página não está mais autorizada. Reconecte e confira o acesso.');
 const snapshot=await importPage(page,api),now=Date.now();
 const result=await db().prepare('UPDATE meta_client_data SET snapshot=?,synced_at=? WHERE tenant=? AND page_id=?').bind(JSON.stringify(snapshot),now,'pf',page.id).run();
 if(!result.meta.changes)return Response.json({error:'A seleção mudou durante a importação. Atualize a página.'},{status:409,headers});
 return Response.json({ok:true,snapshot,syncedAt:now},{headers});
 }catch(e){return Response.json({error:e instanceof MetaReadError?e.message:'Não foi possível importar agora. Os dados anteriores foram preservados.'},{status:503,headers});}}
