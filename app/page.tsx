import {ownerAccess} from '@/lib/access';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
async function ProtectedDashboard(){if(!await ownerAccess(true))return <main className="empty"><h1>Acesso restrito</h1><p>Use o link de acesso ao cliente enviado pelo administrador.</p></main>;return <Dashboard/>;}
export default function Page(){return <ProtectedDashboard/>;}
