import {LegalPage, CONTACT} from '@/components/legal/legal-page';
export const metadata = {title: 'Política de Privacidade | Origyn'};
export default function Page() {
  return (
    <LegalPage title="Política de Privacidade">
      <h2>Quem somos</h2>
      <p>A Origyn é operada por Daniel Henrique Oliveira Silva, responsável pelo tratamento dos dados descritos aqui. Contato: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      <h2>O que é o serviço</h2>
      <p>A Origyn é um painel de gestão de atendimento em redes sociais usado pela agência para acompanhar e responder interações nas páginas e perfis de seus clientes no Facebook e no Instagram, mediante autorização dos responsáveis por essas contas.</p>
      <h2>Dados tratados</h2>
      <ul>
        <li>Dados de login do painel (endereço de e-mail) fornecidos pelo serviço de autenticação.</li>
        <li>Conteúdo cadastrado no painel: manuais de atendimento, modelos de resposta, configurações e registros de ações.</li>
        <li>Quando a integração com a Meta é autorizada: identificadores de contas e páginas, publicações, comentários, nomes públicos de quem comentou, métricas de interação e credenciais de acesso à API, armazenadas de forma criptografada.</li>
        <li>Registros técnicos de conexão e hospedagem.</li>
        <li>Mensagens e dados enviados voluntariamente em pedidos de suporte ou privacidade.</li>
      </ul>
      <p>Senhas do Facebook ou do Instagram nunca devem ser enviadas à Origyn e não são solicitadas.</p>
      <h2>Finalidades</h2>
      <p>Operar o painel, organizar e responder interações dos clientes da agência, gerar relatórios de atendimento, manter a segurança do serviço e cumprir obrigações legais.</p>
      <h2>Compartilhamento e fornecedores</h2>
      <p>Os dados são processados por fornecedores necessários à operação: Cloudflare (hospedagem, banco de dados e autenticação), Meta (integração com Facebook e Instagram) e Google (e-mail). Esses fornecedores podem operar fora do Brasil. Dados também podem ser fornecidos a autoridades quando exigido por lei. Não vendemos dados pessoais.</p>
      <h2>Retenção</h2>
      <p>Os dados são mantidos pelo tempo necessário à prestação do serviço, ao suporte e às obrigações legais. Pedidos de exclusão são analisados individualmente e qualquer retenção necessária é informada ao solicitante.</p>
      <h2>Seus direitos</h2>
      <p>Nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018), você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, revogação de consentimento e revisão de decisões automatizadas, observadas as condições legais. Veja também a página de <a href="/exclusao-de-dados">exclusão de dados</a>.</p>
      <h2>Atualizações</h2>
      <p>Esta política será revisada sempre que novas integrações forem ativadas ou o tratamento de dados mudar.</p>
    </LegalPage>
  );
}
