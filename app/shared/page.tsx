import {getUser} from '@/app/auth';
import {privateAdminMode} from '@/lib/access';
import SharedClient from './shared-client';
export const dynamic='force-dynamic';
async function Protected(){if(privateAdminMode()||!await getUser())return <main className="empty"><h1>Compartilhamento indisponível</h1><p>O acesso por cliente aguarda a ativação da identificação de usuários nesta hospedagem.</p></main>;return <SharedClient/>;}
export default function Page(){return <Protected/>;}
