# Roteiro da Análise do app (Provedor de Tecnologia) — app "Heeca Plataforma"

App `1102512862389510` · portfólio Heeca Sistemas (verificação da empresa: **aprovada**) · configuração de login `heeca-portal` (`1415418407445912`).
Caminho na Meta: Painel do app → Casos de uso → Personalizar "Conectar-se com clientes pelo WhatsApp" → **Torne-se um Provedor de Tecnologia** → 2. Análise do app.

Objetivo: acesso avançado a `whatsapp_business_messaging` e `whatsapp_business_management`. A Meta pede **dois vídeos separados** (abaixo), o Básico completo e o envio.

## Antes de gravar (checklist)

- [ ] Configurações → Básico: privacidade, termos, exclusão de dados, domínio e categoria (feito em 18/10/2026) e **ícone 1024×1024** (falta; arquivos em `heeca_plataform/brand/dist/icon`).
- [ ] Número de teste do app: Casos de uso → Personalizar → **Etapa 1. Experimente** (a Meta cria uma conta de teste e um número de teste; é onde ficam o ID do número e o token temporário).
- [ ] Seu WhatsApp pessoal cadastrado como destinatário do número de teste (a Meta pede para verificar o destinatário).
- [ ] **Faça as chamadas de API de teste (vídeo 2, parte A) com 24 h de antecedência.** A Meta avisa que os dados de teste podem levar até 24 h para aparecer no formulário de envio.
- [ ] Gravador de tela (Win+G da Barra de Jogos, ou OBS), 1080p, sem notificações do sistema. Fale em inglês ou coloque legendas; os revisores leem em inglês.
- [ ] **Nunca mostre** segredo do app, token de acesso ou token de usuário do sistema na tela. Antes de gravar, esconda campos de token (o painel mascara a chave secreta; o token da Etapa 1 precisa ficar fora do quadro ou borrado na edição).

## Vídeo 1 — `whatsapp_business_messaging` (1 a 2 min)

Exigência da Meta: mostrar **o seu app enviando a mensagem** e **a interface do WhatsApp (web ou celular) recebendo a mesma mensagem**, num único vídeo.

Roteiro (opção mínima, a que a Meta descreve):
1. Abra o painel do app e a ferramenta de teste da Etapa 1 (passos 1 e 2: selecionar o número de teste e o destinatário).
2. Narre: "This is the Heeca Platform app. It sends WhatsApp notifications — appointment confirmations — on behalf of our business customers through the WhatsApp Cloud API."
3. Mostre o comando de envio (passo 2) e **execute o envio** (template `hello_world` ou um template aprovado do app). Mostre a resposta da API com o `message_id`.
4. Corte para o **WhatsApp recebendo**: celular em gravação de tela (ou WhatsApp Web ao lado) com a mensagem chegando, mostrando o nome do remetente (número de teste) e o texto.
5. Termine com o painel e a mensagem recebida lado a lado.

Opção melhor (mostra o uso real, recomendada se o Notify estiver apontado para a conta de teste):
1. Tela do Heeca Beauty (ambiente de teste): faça um agendamento na página pública de um estabelecimento de teste.
2. Mostre em "Configurações → WhatsApp → Últimas mensagens" a mensagem de confirmação registrada.
3. Corte para o WhatsApp recebendo a confirmação.
4. Isso exige o Notify de **teste** configurado com o ID do número e o token da conta de teste. Não use credenciais de produção de clientes.

Se tiver dúvida, grave **as duas** e envie a opção mínima; a segunda fica como reserva se a Meta pedir mais evidência.

## Vídeo 2 — `whatsapp_business_management` (2 a 3 min, vídeo separado)

Exigência da Meta: (A) **fazer chamadas de API de teste** e (B) gravar **a criação de um modelo (template) de mensagem**, com a criação e o salvamento visíveis.

Parte A — chamadas de API (faça cedo, 24 h antes):
1. Coleção Postman oficial da Meta (link na tela "Instruções para fazer ligações de teste de API"), ou `curl`/Explorador da Graph API.
2. Com o token da Etapa 1, rode chamadas de leitura de gestão, por exemplo:
   - `GET /{waba-id}/phone_numbers`
   - `GET /{waba-id}/message_templates`
   - `GET /{waba-id}/subscribed_apps`
3. Guarde a resposta de cada uma; elas contam como "ligações de teste".

Parte B — criação do modelo (gravar em vídeo):
1. Abra o **WhatsApp Manager** (a tela "Instruções…" tem o botão "Go to WhatsApp Manager") → Modelos de mensagem → Criar modelo.
2. Preencha como um modelo real do Heeca: categoria **Utilidade**, idioma **Português (BR)**, nome `heeca_confirmacao_teste`, corpo do tipo "Olá {{1}}, seu agendamento em {{2}} está confirmado para {{3}}.", com exemplos para as variáveis.
3. Clique em enviar/salvar, mostrando a confirmação e o modelo na lista como "Em análise".
4. Narre: "This is how Heeca creates and manages message templates for appointment notifications."

Observação: o Notify já cria modelos por API (`syncTemplates`, em `heeca_notify/src/lib/meta-onboarding.ts`). Se preferir mostrar a criação pela API em vez do WhatsApp Manager, a Meta aceita desde que a criação e o salvamento apareçam; para a análise, o WhatsApp Manager é o caminho mais seguro.

## Texto sugerido para o formulário de envio (em inglês)

> Heeca is a Brazilian multi-tenant SaaS platform (heeca.com.br) that provides scheduling and management software to small businesses (salons, clinics, spas). We are a Tech Provider: each business connects its own WhatsApp number through Embedded Signup on our customer portal (heeca.com.br/conta/whatsapp). We use `whatsapp_business_management` to onboard customers, manage their WhatsApp Business Accounts and create/sync message templates (appointment confirmation, reminder, reschedule), and `whatsapp_business_messaging` to send those notifications to the businesses' own clients, always for appointments they booked. Messages are sent only to people who gave their number when booking, with opt-out handling. The attached videos show (1) a message sent from our platform and received on WhatsApp, and (2) creation of a message template.

## Depois de enviar

- Acompanhe em "Análise do app" / Caixa de Entrada de alertas. O prazo da Meta varia; costuma levar dias.
- Aprovado: ligar o app (Publicar → modo Ativo), colocar `META_APP_ID` e `META_EMBEDDED_SIGNUP_CONFIG_ID` no portal e `META_APP_SECRET` no cofre do Notify (feito pelo Heeca_Plataform) e testar a conexão de um número real, inclusive com o tipo "Integração do app WhatsApp Business" (coexistência).
- Pendências de código no portal e no Notify estão na mensagem enviada ao Heeca_Plataform em 18/10/2026 (versão v4 do Embedded Signup, evento `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, não registrar número na coexistência, sincronização em 24 h).
