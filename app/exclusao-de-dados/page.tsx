import {LegalPage, CONTACT} from '@/components/legal/legal-page';
export const metadata = {title: 'Exclusão de dados | Origyn'};
export default function Page() {
  return (
    <LegalPage title="Exclusão de dados">
      <p>Você pode pedir a exclusão dos seus dados tratados pela Origyn a qualquer momento.</p>
      <h2>Remover a integração com a Meta</h2>
      <ol>
        <li>No Facebook, acesse Configurações e privacidade, depois Configurações e Integrações comerciais.</li>
        <li>Localize a Origyn e clique em Remover.</li>
      </ol>
      <p>Isso interrompe imediatamente novos acessos da Origyn às suas contas.</p>
      <h2>Excluir dados já armazenados</h2>
      <p>Envie um e-mail para <a href={`mailto:${CONTACT}?subject=Exclus%C3%A3o%20de%20dados%20Origyn`}>{CONTACT}</a> com o assunto “Exclusão de dados Origyn”, informando o nome da página ou perfil. Respondemos com a confirmação da exclusão ou a explicação de qualquer retenção exigida por lei.</p>
    </LegalPage>
  );
}
