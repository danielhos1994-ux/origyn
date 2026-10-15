const UPDATED = '15 de outubro de 2026';
export function LegalPage({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <main style={{maxWidth: 760, margin: '0 auto', padding: '56px 24px 80px', lineHeight: 1.75, color: '#171717', fontSize: 16}}>
      <img src="/origyn-logo.png" alt="Origyn" style={{height: 36, width: 'auto', marginBottom: 40}} />
      <h1 style={{fontSize: 34, fontWeight: 650, letterSpacing: '-0.02em', margin: '0 0 8px'}}>{title}</h1>
      <p style={{color: '#737373', margin: '0 0 40px'}}>Última atualização: {UPDATED}</p>
      <div className="legal">{children}</div>
      <nav style={{marginTop: 56, paddingTop: 24, borderTop: '1px solid #e5e5e5', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 14}}>
        <a href="/privacidade">Política de Privacidade</a>
        <a href="/termos">Termos de Serviço</a>
        <a href="/exclusao-de-dados">Exclusão de dados</a>
      </nav>
    </main>
  );
}
export const CONTACT = 'daniel.hos1994@gmail.com';
