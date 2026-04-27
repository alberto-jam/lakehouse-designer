# Lake House Designer — Frontend

SPA (Single Page Application) construída com React 18+, TypeScript, Vite e Tailwind CSS para gerar recomendações de arquitetura Lake House na AWS. O usuário informa parâmetros de carga de trabalho e recebe uma arquitetura recomendada com estimativa de custo mensal, diagrama visual (Mermaid), passos de provisionamento e link para download do template CloudFormation.

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
| `VITE_API_URL` | URL do endpoint da API Gateway (POST /generate-architecture) | `https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture` |
| `VITE_AWS_REGION` | Região AWS onde a API está implantada (default: `us-east-1`) | `us-east-1` |

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
│   ├── Header.tsx              # Cabeçalho com título e botão de credenciais
│   ├── Footer.tsx              # Rodapé com disclaimer
│   ├── Formulario.tsx          # Formulário de entrada de parâmetros
│   ├── ModalCredenciais.tsx    # Modal para entrada de credenciais AWS
│   ├── ResultadoArquitetura.tsx # Painel de resultado da arquitetura
│   ├── TabelaCusto.tsx         # Tabela de estimativa de custo por serviço
│   ├── DiagramaMermaid.tsx     # Renderizador de diagramas Mermaid → SVG
│   └── BotaoDownload.tsx       # Botão de download do template CloudFormation
├── services/
│   ├── types.ts                # Interfaces TypeScript (ArchitectureInput, ArchitectureOutput, AwsCredentialsInput)
│   ├── credentialsService.ts   # Gerenciamento de credenciais AWS (localStorage)
│   └── apiClient.ts            # Cliente API com assinatura SigV4
├── App.tsx                     # Componente raiz — orquestra estado e componentes
├── App.css                     # Estilos base
├── main.tsx                    # Ponto de entrada React
├── index.css                   # Diretivas Tailwind CSS
└── test-setup.ts               # Configuração do ambiente de testes
```

## Deploy

Os arquivos estáticos gerados em `dist/` são enviados para o bucket S3 do frontend via pipeline de CI/CD (já configurado no backend SAM template `backend/template.yaml`). O CloudFront distribui o conteúdo com OAI (Origin Access Identity).

## Repositório

[github.com/alberto.jam/lakehouse-designer](https://github.com/alberto.jam/lakehouse-designer)
