import {LegalPage, CONTACT} from '@/components/legal/legal-page';
export const metadata = {title: 'Termos de Serviço | Origyn'};
export default function Page() {
  return (
    <LegalPage title="Termos de Serviço">
      <h2>Uso do serviço</h2>
      <p>A Origyn é um painel de uso interno da agência e de clientes convidados. O acesso é pessoal, restrito a pessoas autorizadas e pode ser revogado a qualquer momento.</p>
      <h2>Integração com a Meta</h2>
      <p>A conexão com Facebook e Instagram só ocorre após autorização expressa de quem administra as contas. A autorização pode ser removida a qualquer momento nas configurações de Integrações comerciais do Facebook. O uso dos dados segue os termos e políticas da plataforma Meta.</p>
      <h2>Responsabilidades</h2>
      <p>O usuário é responsável pelas respostas, regras de atendimento e configurações que aprovar no painel. Ações automáticas só são executadas dentro das regras definidas para cada cliente.</p>
      <h2>Disponibilidade</h2>
      <p>O serviço é oferecido no estado em que se encontra e pode passar por mudanças, interrupções para manutenção ou atualizações.</p>
      <h2>Contato</h2>
      <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
    </LegalPage>
  );
}
