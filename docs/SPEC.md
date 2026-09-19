# HEECA BEAUTY — Sistema de Gestão para Salões de Beleza

> Documento de produto (v1, 18/09/2026). Decisões de implementação tomadas a partir dele estão em `docs/DECISOES.md`.

## 1. Visão do Produto

O Heeca Beauty será uma plataforma SaaS de gestão para salões de beleza, permitindo que o estabelecimento centralize sua operação em um único sistema.

O objetivo é oferecer ao salão uma ferramenta simples para administrar: Clientes; Profissionais; Serviços; Agenda; Agendamentos; Comissões; Financeiro; Estoque; WhatsApp; Fidelização; Relacionamento com clientes.

O sistema deverá ser desenvolvido com foco em pequenos e médios salões de beleza, mas com arquitetura preparada para crescer junto com o estabelecimento.

## 2. Conceito

O Heeca Beauty não deve ser apenas uma agenda. A proposta é ser o centro de operações do salão.

```text
                    HEECA BEAUTY
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
    CLIENTES           AGENDA           SERVIÇOS
       │                 │                 │
       ├────────────── PROFISSIONAIS ──────┤
       │                 │                 │
    WHATSAPP          FINANCEIRO        ESTOQUE
       │                 │                 │
       └──────────── FIDELIZAÇÃO ──────────┘
```

## 3. Público-Alvo

Salões de beleza; Studios de beleza; Espaços de estética; Salões femininos; Salões masculinos; Salões unissex; Pequenos centros de beleza; Profissionais que trabalham em conjunto; Salões com profissionais comissionados; Salões com profissionais parceiros.

## 4. Cadastro do Salão

O proprietário/administrador poderá cadastrar: Nome comercial; Razão social; CNPJ; Logo; Fotos; Descrição; Telefone; WhatsApp; E-mail; Instagram; Site; Endereço; Cidade; Horário de funcionamento; Dias de atendimento; Redes sociais; Política de cancelamento; Política de atraso; Informações adicionais.

O salão deverá possuir uma página pública própria. Exemplo: `app.heeca.com.br/beleza/nome-do-salao`

## 5. Profissionais

O administrador poderá cadastrar os profissionais que trabalham no salão.

Dados: Nome; Foto; Telefone; E-mail; Especialidades; Serviços realizados; Horários de atendimento; Dias de trabalho; Comissão; Status ativo/inativo.

Exemplos: Cabeleireiro; Barbeiro; Manicure; Nail Designer; Pedicure; Designer de sobrancelhas; Lash Designer; Maquiador; Esteticista; Massoterapeuta.

## 6. Perfis de Acesso

O sistema deverá possuir controle de permissões.

- **Proprietário** — acesso completo ao salão.
- **Administrador/Gerente** — acesso à gestão operacional e financeira conforme permissão.
- **Recepcionista** — Agenda; Clientes; Agendamentos; Cadastro; WhatsApp.
- **Profissional** — Sua agenda; Seus clientes; Seus atendimentos; Seus serviços; Sua comissão.

Futuramente: permitir criação de permissões personalizadas.

## 7. Cadastro de Serviços

Cada serviço deverá possuir: Nome; Categoria; Descrição; Duração; Preço; Profissionais habilitados; Status; Imagem; Observações.

Categorias:

- **Cabelo** — Corte; Escova; Hidratação; Reconstrução; Coloração; Mechas; Luzes; Progressiva; Botox capilar; Penteado.
- **Unhas** — Manicure; Pedicure; Esmaltação; Esmaltação em gel; Alongamento; Manutenção; Nail art; Blindagem.
- **Sobrancelhas** — Design; Henna; Micropigmentação, quando aplicável.
- **Cílios** — Extensão; Manutenção; Lash lifting.
- **Estética** — Limpeza de pele; Massagem; Procedimentos estéticos; Outros serviços.

O salão poderá criar categorias e serviços personalizados.

## 8. Serviços por Profissional

Um profissional poderá realizar apenas determinados serviços.

```text
Ana                     Mariana                 Carlos
├── Corte               ├── Manicure            ├── Corte Masculino
├── Escova              ├── Pedicure            ├── Barba
├── Hidratação          ├── Esmaltação em Gel   └── Corte + Barba
└── Coloração           └── Nail Art
```

O sistema deverá considerar essa relação na hora de apresentar os horários disponíveis.

## 9. Agenda

Visualizações: Dia; Semana; Mês; Profissional; Salão completo.

A agenda deverá permitir: Criar agendamento; Reagendar; Cancelar; Confirmar; Bloquear horário; Criar encaixe; Criar recorrência; Visualizar disponibilidade; Identificar conflitos.

## 10. Agendamento Online

```text
Cliente acessa o salão → Escolhe serviço → Escolhe profissional → Escolhe data →
Escolhe horário → Informa seus dados → Confirma agendamento → WhatsApp → Agendamento confirmado
```

O sistema deverá permitir também **Serviço → qualquer profissional disponível**: apresentar os horários disponíveis entre os profissionais habilitados para aquele serviço.

## 11. Agendamento de Múltiplos Serviços

Permitir que o cliente agende mais de um serviço no mesmo atendimento.

```text
Corte        45 min
Escova       40 min
Manicure     50 min
--------------------
Total        2h15
```

O sistema deverá calcular automaticamente: Duração total; Valor total; Profissionais envolvidos; Horários necessários.

Quando os serviços forem realizados por profissionais diferentes, o motor de agenda deverá verificar a disponibilidade de cada profissional.

## 12. Cadastro de Clientes

Nome; Telefone; WhatsApp; E-mail; Data de nascimento; Data do primeiro atendimento; Último atendimento; Próximo atendimento; Serviços realizados; Profissional preferido; Histórico; Observações administrativas.

Histórico de: Agendamentos; Cancelamentos; Faltas; Compras; Pagamentos; Pacotes; Fidelidade.

## 13. WhatsApp

Utilizações: Confirmação; Lembretes; Cancelamentos; Reagendamentos; Divulgação do link; Retorno de clientes; Campanhas; Aviso de aniversário; Aviso de promoções; Recuperação de clientes inativos.

**Confirmação**

> Olá, Maria! 💜 Seu horário no Heeca Beauty está confirmado!
> Serviço: Corte + Escova · Profissional: Ana · Data: 25/09/2026 · Horário: 14:00
> Estamos esperando por você! ✨

**Lembrete**

> Olá, Maria! Passando para lembrar que seu horário está agendado para amanhã às 14h. 💇‍♀️ Até lá!

## 14. Recuperação de Clientes

O sistema deverá identificar clientes que não retornam ao salão (ex.: último atendimento 15/07, hoje 18/09, 65 dias sem atendimento) e gerar a lista **Clientes para reativação**, permitindo enviar campanha pelo WhatsApp.

## 15. Fidelização

Preparar estrutura para programa de fidelidade: Pontos; Cashback; Número de atendimentos; Benefícios; Cupons; Aniversário; Indicação. Ex.: a cada 10 serviços realizados, ganhe um benefício.

## 16. Pacotes

Ex.: **Pacote Beauty** — 4 escovas + 2 hidratações, validade 60 dias. **Pacote Nail** — 3 manutenções + 1 nail art, validade 90 dias.

Controlar: Pacote contratado; Serviços incluídos; Serviços utilizados; Serviços restantes; Validade.

## 17. Comissões

Configurar: Comissão percentual; Comissão fixa; Comissão por serviço; Comissão por profissional; Comissão por período.

```text
Serviço: Corte · Valor: R$ 80,00 · Profissional: Ana · Comissão: 40% → R$ 32,00
```

Dashboard do profissional: Atendimentos; Serviços realizados; Faturamento gerado; Comissão; Valores pagos; Valores pendentes.

## 18. Caixa e Financeiro

Vendas; Recebimentos; Despesas; Formas de pagamento; Fechamento de caixa; Faturamento; Comissões; Contas a receber.

Formas de pagamento: Pix; Dinheiro; Cartão de crédito; Cartão de débito; Transferência; Outros.

## 19. Estoque

Produtos: Shampoos; Condicionadores; Tinturas; Oxidantes; Cremes; Esmaltes; Produtos de estética; Materiais descartáveis.

Controle: Entrada; Saída; Ajuste; Estoque mínimo; Fornecedor; Custo; Produto utilizado por atendimento.

Futuramente: ao registrar uma coloração, baixar automaticamente os produtos utilizados.

## 20. Página Pública do Salão

Mini landing page, mobile-first: Logo; Nome; Fotos; Descrição; Serviços; Profissionais; Preços; Portfólio; Avaliações; Endereço; Instagram; WhatsApp; Botão de agendamento.

## 21. Portfólio

Fotos de cortes, colorações, unhas, maquiagens, penteados, sobrancelhas, antes/depois (quando autorizado). Cada imagem relacionada a Serviço; Profissional; Categoria.

## 22. Avaliações

Após o atendimento o cliente poderá avaliar: Atendimento; Profissional; Serviço; Experiência geral. Publicação depende da configuração do salão.

## 23. Dashboard

**Hoje** — Agendamentos; Clientes; Faturamento; Cancelamentos; Faltas; Profissionais trabalhando.

**Mês** — Faturamento; Número de atendimentos; Clientes novos; Clientes recorrentes; Serviço mais vendido; Profissional com maior faturamento; Ticket médio; Taxa de ocupação da agenda.

## 24. Indicadores

- Ticket médio = Faturamento ÷ número de atendimentos
- Taxa de ocupação = Horas ocupadas ÷ horas disponíveis
- Retenção = Clientes que retornaram ÷ clientes atendidos
- No-show = Faltas ÷ agendamentos

## 25. Políticas do Salão

Política de cancelamento; Tolerância de atraso; Política de faltas; Regras para acompanhantes; Sinal de agendamento; Prazo de cancelamento; Regras de reagendamento; Política de utilização de pacotes.

## 26. Notificações Automáticas

Eventos: Novo agendamento; Confirmação; Cancelamento; Reagendamento; Lembrete; Falta; Aniversário; Cliente inativo; Pacote próximo do vencimento; Estoque baixo; Fechamento de caixa.

Canais futuros: WhatsApp; E-mail; SMS; Push notification.

## 27. Multiunidade

```text
Heeca Beauty
├── Unidade Santo André   (Profissionais, Agenda, Clientes)
└── Unidade São Caetano   (Profissionais, Agenda, Clientes)
```

O administrador poderá visualizar cada unidade, consolidado, faturamento, profissionais, agendamentos.

## 28. Estrutura do MVP

1. **Autenticação** — Cadastro; Login; Recuperação de senha; Controle de acesso.
2. **Salão** — Dados; Logo; Horários; Endereço; WhatsApp.
3. **Profissionais** — Cadastro; Serviços; Horários; Comissões.
4. **Serviços** — CRUD; Categorias; Preços; Duração.
5. **Agenda** — Dia; Semana; Mês; Profissional; Bloqueios; Agendamentos.
6. **Clientes** — Cadastro; Histórico; Contato.
7. **Agendamento Online** — Página pública; Serviço; Profissional; Data; Horário; Confirmação.
8. **WhatsApp** — Confirmação; Lembretes; Cancelamento; Reagendamento.
9. **Dashboard** — Agendamentos; Faturamento; Clientes; Indicadores básicos.

## 29. Segunda Fase

Comissões avançadas; Financeiro; Caixa; Pacotes; Fidelidade; Portfólio; Avaliações; Recuperação de clientes; Campanhas; Estoque.

## 30. Terceira Fase

Multiunidade; Aplicativo; Pagamento online; Sinal; Assinaturas; Integração com Instagram; IA; CRM; Marketing automatizado; Relatórios avançados; Previsão de demanda; Sugestão de horários; Lista de espera inteligente.

## 31. Requisitos Técnicos

Arquitetura SaaS multi-tenant: Vários salões; Várias unidades; Vários profissionais; Várias agendas; Diferentes níveis de acesso; Isolamento completo dos dados; API organizada; Banco relacional; Logs; Auditoria; Webhooks; Integração WhatsApp; Sistema de notificações; Controle de assinaturas; Billing; Mobile-first.

O motor de agenda deverá ser desenvolvido de forma reutilizável para outros produtos Heeca.

## 32. Integração com o Ecossistema Heeca

```text
                     HEECA CORE
       ┌─────────────────┼──────────────────┐
   Heeca Auth        Heeca Notify      Heeca Billing
       └─────────────────┼──────────────────┘
                    Heeca Beauty
       ┌──────────┬──────┼──────┬───────────┐
     Agenda    Clientes  CRM  Financeiro  Estoque
```

Consumir os serviços compartilhados da plataforma sempre que possível: não redesenvolver autenticação, notificações, cobrança, usuários, empresas.

## 33. Resultado Esperado

**Proprietário:** cadastrar o salão → profissionais → serviços → horários → divulgar o link → receber agendamentos → confirmar pelo WhatsApp → atender → registrar pagamento → acompanhar faturamento e comissões.

**Cliente:** encontrar o salão → escolher o serviço → escolher o profissional → escolher o horário → confirmar → receber lembrete → comparecer.

> **Heeca Beauty** — Seu salão. Sua agenda. Seus clientes. Tudo em um só lugar.
