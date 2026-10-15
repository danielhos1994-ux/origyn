import {env} from 'cloudflare:workers';
import {getUser} from '@/app/auth';
import {db} from '@/lib/db';
export function privateAdminMode(){return (env as unknown as {ORIGYN_PRIVATE_ADMIN_MODE?:string}).ORIGYN_PRIVATE_ADMIN_MODE==='owner-only';}
export async function ownerAccess(bootstrap=false){if(privateAdminMode())return {userId:'platform-private-owner',email:'',displayName:'Proprietário do site privado',fullName:null};const user=await getUser();if(!user)return null;const ownerEmail=((env as unknown as {OWNER_EMAIL?:string}).OWNER_EMAIL||'').trim().toLowerCase();if(ownerEmail&&user.email.toLowerCase()!==ownerEmail)return null;const database=db();
 // Bootstrap is only invoked by the dashboard server page while Sites is owner-private.
 // Keep the platform audience owner-only until this row is initialized.
 if(bootstrap)await database.prepare("INSERT OR IGNORE INTO workspace_owner(key,user_id) VALUES('owner',?)").bind(user.userId).run();
 const row=await database.prepare("SELECT user_id FROM workspace_owner WHERE key='owner'").first<{user_id:string}>();return row?.user_id===user.userId?user:null;
}
export async function activeClient(tenant:string){if(!['pf','lab'].includes(tenant))return false;const row=await db().prepare('SELECT deleted_at FROM client_settings WHERE tenant=?').bind(tenant).first<{deleted_at:string|null}>();return !row?.deleted_at;}
export async function digestToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');}
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
