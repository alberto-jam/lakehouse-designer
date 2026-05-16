# Lake House Designer — Frontend

SPA (Single Page Application) construída com React 18+, TypeScript, Vite e Tailwind CSS para gerar recomendações de arquitetura Lake House na AWS. O usuário informa parâmetros de carga de trabalho e recebe uma arquitetura recomendada com estimativa de custo mensal, diagrama visual (Mermaid), passos de provisionamento e link para download do template CloudFormation.

## V2 — Wizard Multi-Etapas

A versão 2 introduz um wizard guiado com nove etapas sequenciais para design de arquiteturas Lakehouse na AWS:

1. **Projeto** — Nome, região AWS e ambiente (dev/staging/prod)
2. **Fontes de Dados** — Volume em TB, registros/dia, formatos (CSV, JSON, Parquet, Avro, ORC)
3. **Ingestão** — DMS CDC, padrão batch/streaming/hybrid, frequência
4. **Storage/Lakehouse** — Camadas (Raw/Curated/Refined), formato de arquivo, compressão, particionamento
5. **Processamento** — Engine ETL (Glue/EMR), complexidade de queries, latência, concorrência
6. **Governança** — Lake Formation, segurança por coluna, criptografia
7. **Analytics/Serving** — Athena, Redshift, QuickSight, APIs externas
8. **Custos** — Região de pricing, orçamento limite, tags de alocação
9. **Resultado** — Diagrama .drawio, preview Mermaid, cost breakdown detalhado, warnings de arquitetura

O wizard utiliza o endpoint `POST /generate-v2` para gerar a arquitetura completa com diagrama, estimativa de custos (incluindo unit prices e assumptions) e warnings consultivos.

## Pré-requisitos

- Node.js 18+
- npm

## Instalação

```bash
npm install
```

## Configuração de Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com os valores adequados:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_API_URL` | URL completa do endpoint V1 (POST /generate-architecture) | `https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture` |
| `VITE_API_BASE_URL` | URL base da API para endpoints V2 (sem trailing slash) | `https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod` |
| `VITE_AWS_REGION` | Região AWS onde a API está implantada | `us-east-1` |
| `VITE_AWS_IDENTITY_POOL_ID` | Cognito Identity Pool ID (acesso não autenticado) | `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

> **Nota:** `VITE_API_BASE_URL` é obrigatória para o wizard V2. O frontend exibirá erro de configuração se não estiver definida.

## Execução Local

```bash
npm run dev
```

O servidor de desenvolvimento Vite será iniciado (por padrão em `http://localhost:5173`). A aplicação suporta Hot Module Replacement (HMR) para desenvolvimento ágil.

## Build de Produção

```bash
npm run build
```

Gera arquivos estáticos (HTML, CSS, JS) no diretório `dist/`. Esses arquivos podem ser servidos por qualquer servidor web estático ou CDN (como CloudFront + S3), sem necessidade de servidor Node.js em runtime.

## Preview do Build

```bash
npm run preview
```

Serve localmente o build de produção para validação antes do deploy.

## Execução de Testes

Watch mode (re-executa ao salvar):

```bash
npm test
```

Execução única (CI/CD):

```bash
npm run test:run
```

## Como Obter Credenciais Temporárias

A aplicação utiliza credenciais temporárias AWS (Access Key ID, Secret Access Key e Session Token) para assinar requisições com AWS Signature V4. Você pode obtê-las de duas formas:

### Via AWS SSO

```bash
# 1. Faça login via SSO
aws sso login --profile <profile>

# 2. Obtenha as credenciais temporárias
aws sts get-session-token
```

### Via STS AssumeRole

```bash
aws sts assume-role \
  --role-arn <role-arn> \
  --role-session-name <session>
```

Após obter as credenciais, copie os valores de **Access Key ID**, **Secret Access Key** e **Session Token** para o modal de credenciais na aplicação. As credenciais são armazenadas em `localStorage` e reutilizadas entre sessões até serem limpas ou substituídas.

## Estrutura do Projeto

```
frontend/src/
├── components/
│   ├── wizard/
│   │   ├── WizardLayout.tsx          # Orquestrador principal do wizard V2
│   │   ├── ProgressBar.tsx           # Indicador de progresso por etapa
│   │   ├── StepSidebar.tsx           # Navegação lateral com status dos passos
│   │   ├── SummaryPanel.tsx          # Resumo das seleções anteriores
│   │   ├── NavigationButtons.tsx     # Botões Voltar/Próximo/Pular/Gerar
│   │   └── steps/                    # Componentes de cada etapa (StepProject, StepSources, etc.)
│   ├── result/
│   │   ├── CostBreakdown.tsx         # Tabela de custos com assumptions e notes
│   │   ├── ArchitectureWarnings.tsx  # Lista de warnings com severidade
│   │   ├── JsonViewer.tsx            # Visualizador JSON com collapse/expand
│   │   └── DiagramDownload.tsx       # Download do arquivo .drawio
│   ├── ui/                           # Primitivos UI (Button, Card, Input, Select, etc.)
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Formulario.tsx                # Formulário V1 (mantido para compatibilidade)
│   ├── DiagramaMermaid.tsx           # Renderizador Mermaid → SVG
│   └── ...
├── hooks/
│   ├── useWizardState.ts             # Gerenciamento de estado do wizard (useReducer)
│   ├── useStepValidation.ts          # Validação por campo com feedback em tempo real
│   └── useGenerateV2.ts              # Hook de chamada à API /generate-v2
├── services/
│   ├── typesV2.ts                    # Interfaces TypeScript V2
│   ├── apiClient.ts                  # Cliente API (V1 + V2)
│   ├── types.ts                      # Interfaces V1
│   └── credentialsService.ts         # Gerenciamento de credenciais AWS
├── App.tsx                           # Componente raiz — V1 e V2 coexistem
├── main.tsx                          # Ponto de entrada React
└── test-setup.ts                     # Configuração do ambiente de testes
```

## Deploy

Os arquivos estáticos gerados em `dist/` são enviados para o bucket S3 do frontend via pipeline de CI/CD (já configurado no backend SAM template `backend/template.yaml`). O CloudFront distribui o conteúdo com OAI (Origin Access Identity).

## Repositório

[github.com/alberto.jam/lakehouse-designer](https://github.com/alberto.jam/lakehouse-designer)
