import {getUser} from '@/app/auth';
import {activeClient,privateAdminMode,digestToken,sameOrigin} from '@/lib/access';
import {db} from '@/lib/db';
import {workspaceData} from '@/lib/workspace-data';
import {tenants} from '@/lib/client-brand';
export async function POST(req:Request){try{if(privateAdminMode())return Response.json({error:'Compartilhamento temporariamente indisponível.'},{status:503});if(!sameOrigin(req))return Response.json({error:'Origem inválida.'},{status:403});const user=await getUser();if(!user)return Response.json({error:'Faça login para acessar.'},{status:401});const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!/^[a-f0-9]{64}$/.test(token))return Response.json({error:'Link inválido.'},{status:403});const database=db(),hash=await digestToken(token),now=new Date().toISOString();
 // Atomic first redemption: only one signed-in identity can claim each invitation.
 await database.prepare('UPDATE client_grants SET user_id=? WHERE token_hash=? AND user_id IS NULL AND revoked_at IS NULL AND expires_at>?').bind(user.userId,hash,now).run();
 const grant=await database.prepare('SELECT tenant FROM client_grants WHERE token_hash=? AND user_id=? AND revoked_at IS NULL AND expires_at>?').bind(hash,user.userId,now).first<{tenant:string}>();if(!grant||!await activeClient(grant.tenant))return Response.json({error:'Este acesso expirou, foi revogado ou pertence a outra conta.'},{status:403});const data=await workspaceData(grant.tenant);return Response.json({client:tenants.find(t=>t.id===grant.tenant),comments:data.comments.map(c=>({...c,...data.states.find(s=>s.id===c.id)})),posts:data.posts},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error(e);return Response.json({error:'Não foi possível carregar este cliente.'},{status:503});}}
