# Origyn

## Escopo da automação (decisão de 15/10/2026)
- Somente **comentários** do Instagram e do Facebook: leitura, classificação, resposta e ocultação.
- **Sem DMs.** Não implementar leitura nem envio de mensagens diretas, nem pedir permissões de mensagens (`pages_messaging`, `instagram_manage_messages`).

## Manual da Películas Fácil (regra principal)
`lib/brand/peliculas-facil.ts` contém o manual de respostas e moderação (versão 15/10/2026): categorias, ação por tipo, temas fechados, respostas padrão e CTA por rede. A ação (responder/ocultar/revisar/ignorar) é aplicada no código a partir da categoria; confiança < 0,6 vai para revisão; no Facebook a resposta nunca menciona DM, Messenger ou link da bio. O texto da aba "Manual da marca" do painel entra como notas adicionais.

## Hospedagem (desde 15/10/2026)
Cloudflare Workers + D1 na conta do proprietário, publicado a partir deste repositório (Workers Builds).
- Build: `pnpm build` · Deploy: `pnpm run deploy` (aplica migrações D1 e publica).
- Login do painel: Cloudflare Access (somente `OWNER_EMAIL`). O app verifica o JWT do Access em `app/auth.ts`.
- Rotas públicas (fora do Access): `/privacidade`, `/termos`, `/exclusao-de-dados`, `/api/meta/callback` e, futuramente, o webhook Meta.
- Configuração não secreta em `wrangler.jsonc`. Segredo `META_TOKEN_ENCRYPTION_KEY` (64 hex) no painel da Cloudflare. A chave secreta do app Meta e a versão Graph são cadastradas cifradas pelo painel em `/conexao-meta`.
- Testes: `pnpm test`.
- O histórico abaixo descreve a fase anterior no ChatGPT Sites e fica como registro.

---

# Histórico — v0.2 (ChatGPT Sites)

Primeira versão privada e funcional de demonstração. Cliente piloto: Películas Fácil. Dados, nomes e métricas fictícios, com referência fixa em 28/09/2026.

## Implementado
- Dashboard, filtros de período e data personalizada, métricas derivadas da mesma base dos comentários.
- Central de comentários com busca e status, edição de resposta, resposta/ocultação simuladas, revisão e retorno à fila.
- Estado de moderação, manual por cliente e histórico persistidos em D1.
- Publicações ordenadas por interação, curtidas ou comentários.
- Relatório por assunto e exportação CSV.
- Segundo workspace vazio para validar a separação de dados.

## Limites da versão
Nenhuma conexão Meta, mensagem publicada, classificação por IA, tarefa automática, convite ou permissão por usuário. As sugestões são exemplos fixos e não mudam com a edição do manual. O histórico identifica o operador da demonstração, sem atribuição individual. A autenticação e restrição ao proprietário são da plataforma Sites. Não ampliar o compartilhamento antes de implementar autenticação e autorização próprias. Identidade PF usa monograma temporário, não a logo oficial.

## Arquitetura desta entrega
Vinext/React com rotas de API compatíveis com Workers, D1 para persistência e Sites para publicação privada. A arquitetura inicialmente proposta Next.js + FastAPI + PostgreSQL ainda não foi implementada. A adaptação permite validar o fluxo nesta hospedagem; avaliar a migração antes da operação multiusuário real.

## Próximos marcos
1. Validar interface e regras com o proprietário.
2. Implementar identidade e permissões granulares por empresa, isolamento servidor e auditoria por usuário.
3. Integração Meta oficial: OAuth, armazenamento seguro de tokens, webhooks verificados e captura idempotente.
4. Classificação e geração de respostas com manual versionado. Comentários devem ser tratados como conteúdo não confiável.
5. Fila de execução com idempotência, tentativas limitadas e reconciliação; primeiro operar em modo de aprovação.
6. Relatórios PDF por marca e validação com dados reais.

## Validação
TypeScript e build de produção. O acesso a um navegador de QA compatível não está disponível nesta sessão; o WebMCP opcional depende de suporte do navegador e não foi validado nele.


## Atualização v0.2 — visão geral de clientes
- Visão geral com logos oficiais, nome, campo de seguidores (indisponível até a integração Meta) e acesso ao painel por clique.
- Menu por cliente: compartilhar acesso individual, gerar relatório CSV ou para impressão/PDF, controlar/revogar acessos e excluir com confirmação do nome.
- Exclusão lógica persistida remove o cliente e revoga todos os links; mantém auditoria.
- Administrador reconhecido pelo ID estável enviado pelo dispatcher. Na primeira abertura do painel, o proprietário é registrado sob a proteção da política owner-private do Sites. Não ampliar o acesso da plataforma antes dessa primeira abertura.
- APIs administrativas verificam a identidade do proprietário em toda requisição. O modo de leitura tem endpoint próprio e nunca recebe dados de outro cliente ou operações de edição.
- Convites de leitura usam 256 bits aleatórios, hash SHA-256 no banco, validade de 7 dias e vínculo atômico à primeira conta autenticada que abrir o link. Uma conta diferente não pode reutilizar o convite.
- Links não enviam e-mails. A política privada da plataforma permanece intacta: a pessoa precisa de autorização de entrada no Sites além do convite do cliente. Nenhum destinatário foi convidado automaticamente.
- A interface de controle mostra destinatário informado, convite/conta vinculada, validade e revogação. Não identifica a conta por e-mail; o vínculo de autorização usa o ID estável.
- Testes executados com os handlers reais e D1 simulado por SQLite: administrador, anonimato, separação de clientes, vínculo único, revogação, exclusão confirmada e preservação do histórico (`node tests/access.mjs`). Não equivalem a teste do login da plataforma em produção.

## Correção de acesso da hospedagem
Os logs de produção mostraram a ausência de `oai-authenticated-user-id` e respostas 404 na rota de login do dispatcher. Não foi criada uma rota de login substituta. O modo explícito `ORIGYN_PRIVATE_ADMIN_MODE=owner-only` usa a fronteira de acesso do Sites, confirmada como somente proprietário. Nesse modo, criar/resgatar links por cliente fica bloqueado no servidor. Antes de adicionar outros visitantes ou alterar a audiência, desligar esse modo e validar a identidade estável e a autorização por cliente. O painel não redireciona mais para o login indisponível.

## Atualização — preparação OAuth Meta
- Página `/conexao-meta`, início POST e retorno `/api/meta/callback` no projeto existente.
- Validação de origem, proprietário, estado de uso único e cookie do navegador com expiração de dez minutos.
- Token cifrado com AES-256-GCM; credenciais nunca são enviadas ao navegador.
- Requer META_APP_ID, META_APP_SECRET, META_TOKEN_ENCRYPTION_KEY (32 bytes hex), META_GRAPH_VERSION; META_LOGIN_CONFIG_ID é opcional.
- A autorização não seleciona páginas nem sincroniza dados. Comentários, DMs e moderação continuam desativados na Meta; painel permanece demonstrativo.
- A audiência deve continuar exclusivamente do proprietário enquanto o modo privado substitui a identidade individual.
- Teste `node tests/meta.mjs` usa respostas simuladas da Meta; autorização real depende da configuração e do login do proprietário.

## Cadastro protegido da chave Meta
O proprietário pode cadastrar a chave e a versão Graph em `/conexao-meta`. O endpoint POST `/api/meta/config` exige origem exata e acesso de proprietário; não retorna nem registra a chave. A chave é cifrada com AES-GCM e contexto separado antes da persistência no D1. A chave mestra fica como segredo de hospedagem `META_TOKEN_ENCRYPTION_KEY`; não deve ser substituída após cadastrar credenciais. Configuração salva não significa autorização validada.

## Importação Meta em leitura
`/conexao-meta` lista páginas autorizadas, permite vincular uma página ao cliente PF e importar um recorte. `/dados-meta` exibe apenas dados reais, isolados da demonstração. Até 10 posts por rede e 20 comentários por post, sem respostas encadeadas; lacunas de permissão são indicadas. A seleção é revalidada na Meta em toda importação. Tokens não saem do servidor. Falhas totais preservam a importação anterior; falhas por recurso geram avisos. Não há envio, moderação, DMs ou sincronização agendada. Testes usam API simulada; o usuário deve selecionar sua página real após publicar.
