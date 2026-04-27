Você é um desenvolvedor frontend especialista em React e AWS. Preciso que codifique um SPA (Single Page Application) para um sistema interno corporativo chamado Lake House Designer. Este sistema recebe parâmetros do usuário (volume de dados, latência, concorrência, etc.) e se comunica com um backend serverless (API Gateway + Lambda) que retorna uma arquitetura de Lake House recomendada (com ou sem Redshift) e uma estimativa de custo mensal por serviço.

Requisitos obrigatórios:

Autenticação: Usuários internos assumem uma Role IAM. O frontend deve obter automaticamente credenciais temporárias (access key, secret, session token) do ambiente – assumindo que o navegador já está autenticado na AWS (via SSO, cookies, ou extensão). Na prática, usaremos AWS.config.credentials ou fromCognitoIdentityPool se necessário.

Comunicação com API Gateway: Todas as requisições POST /generate-architecture devem ser assinadas com AWS Signature V4 usando as credenciais obtidas.

Formulário de entrada: Campos mínimos (todos obrigatórios, com validação):

data_volume_tb (número, terabytes)

records_per_day_millions (número, milhões de registros/dia)

avg_query_complexity (select: low, medium, high)

max_query_latency_sec (número, segundos)

concurrent_users (número, usuários simultâneos)

Exibição dos resultados:

Tipo de arquitetura sugerida (ex: "full_lakehouse_with_redshift" ou "light_lakehouse_athena")

Lista de serviços AWS recomendados

Tabela com estimativa de custo mensal por serviço (em USD)

Diagrama em texto (Mermaid) – renderizado visualmente

Passos de provisionamento

Botão para download (futuramente gerará template CloudFormation; inicialmente apenas um placeholder).

Tratamento de erros: Timeout, erro de assinatura, parâmetros inválidos, etc.

Layout responsivo (mobile/desktop) – pode usar Tailwind CSS ou Material-UI.

Entregáveis:

Código fonte completo da SPA (React + TypeScript recomendado) com instruções de build.

Explicação de como obter as credenciais AWS no ambiente corporativo.

Integração com o backend já existente (endpoint será fornecido após deploy).

A API espera um JSON no corpo da requisição e retorna um JSON conforme exemplo abaixo. Use os tipos fornecidos na especificação.

Especificação Técnica Frontend (para Kiro)
1. Stack Tecnológica
Framework: React 18+ com TypeScript

Build tool: Vite (recomendado) ou Create React App

Estilização: Tailwind CSS (ou Material-UI, a critério do desenvolvedor)

Requisições HTTP: Fetch API + biblioteca @aws-sdk/signature-v4 e @aws-sdk/credential-providers para assinatura

Diagramas: mermaid (renderização no navegador)

2. Estrutura de Pastas (exemplo)
text
src/
├── components/
│   ├── Formulario.tsx
│   ├── ResultadoArquitetura.tsx
│   ├── TabelaCusto.tsx
│   ├── DiagramaMermaid.tsx
│   └── BotaoDownload.tsx
├── services/
│   ├── awsAuth.ts        # Obtém credenciais IAM
│   ├── apiClient.ts      # Assina e envia requisição
│   └── types.ts          # Interfaces TypeScript
├── App.tsx
├── main.tsx
└── index.css
3. Obtendo Credenciais AWS (Role Assumida)
Premissa: O usuário já está logado na AWS no mesmo browser (via AWS SSO, CLI, ou extensão "AWS Extender"). Em ambiente corporativo, as credenciais podem estar disponíveis através do objeto global window.AWS ou via chamada ao endpoint http://169.254.170.2 (contêineres) – mas no browser não há acesso direto. Então usaremos a biblioteca @aws-sdk/credential-providers com fromCognitoIdentityPool apenas se houver Identity Pool configurada. Para simplificar, a abordagem mais prática é:

Obter as credenciais via Amazon Cognito Identity Pool usando uma role IAM que pode ser assumida pelo usuário autenticado via SAML/SSO.

Ou, como fallback, o usuário deve fornecer manualmente suas credenciais temporárias (desaconselhado).

Recomendação para o Kiro:
Implementar um hook useAwsCredentials que tenta:

Ler de localStorage (se armazenadas previamente)

Ou usar fromCognitoIdentityPool com um identityPoolId fornecido por variável de ambiente.

Ou usar fromTemporaryCredentials assumindo uma role específica (ex: Role_LakeHouseDesigner).

Como o ambiente é corporativo, o arquiteto da AWS fornecerá o identityPoolId e a role. O Kiro deve deixar configurável via variável de ambiente REACT_APP_IDENTITY_POOL_ID.

Exemplo de código (awsAuth.ts):

typescript
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { Credentials } from "@aws-sdk/types";

let cachedCredentials: Credentials | null = null;

export async function getAwsCredentials(): Promise<Credentials> {
  if (cachedCredentials) {
    // Verifica se as credenciais ainda são válidas (ex: expiration)
    if (cachedCredentials.expiration && cachedCredentials.expiration > new Date()) {
      return cachedCredentials;
    }
  }
  const identityPoolId = import.meta.env.VITE_AWS_IDENTITY_POOL_ID;
  if (!identityPoolId) throw new Error("Identity Pool ID não configurado");
  const provider = fromCognitoIdentityPool({ identityPoolId, clientConfig: { region: "us-east-1" } });
  cachedCredentials = await provider();
  return cachedCredentials;
}
4. Cliente da API – Assinatura SigV4
Usar @aws-sdk/signature-v4 e @aws-crypto/sha256-js.

typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { getAwsCredentials } from "./awsAuth";

const API_URL = import.meta.env.VITE_API_URL; // ex: https://xxxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture

export async function generateArchitecture(payload: ArchitectureInput): Promise<ArchitectureOutput> {
  const credentials = await getAwsCredentials();
  const signer = new SignatureV4({
    credentials,
    service: "execute-api",
    region: "us-east-1",
    sha256: Sha256,
  });
  const url = new URL(API_URL);
  const request = {
    method: "POST",
    protocol: url.protocol.slice(0, -1),
    hostname: url.hostname,
    path: url.pathname,
    headers: {
      "Content-Type": "application/json",
      host: url.hostname,
    },
    body: JSON.stringify(payload),
  };
  const signed = await signer.sign(request);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: signed.headers,
    body: signed.body,
  });
  if (!response.ok) {
    throw new Error(`Erro HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
5. Tipos TypeScript (types.ts)
typescript
export interface ArchitectureInput {
  data_volume_tb: number;
  records_per_day_millions: number;
  avg_query_complexity: "low" | "medium" | "high";
  max_query_latency_sec: number;
  concurrent_users: number;
}

export interface ArchitectureOutput {
  architecture_type: "full_lakehouse_with_redshift" | "light_lakehouse_athena";
  services: string[];
  estimated_monthly_cost_usd: number;
  cost_breakdown_per_service: Record<string, number>;
  diagram_mermaid: string;
  provisioning_steps: string[];
  message: string;
}
6. Componentes Principais
Formulário (Formulario.tsx)
Usar react-hook-form ou estado local.

Validações: números positivos, campos preenchidos.

Botão "Gerar Arquitetura" que chama o serviço, exibe loading, e passa resultado para componente de resultado.

Resultado (ResultadoArquitetura.tsx)
Recebe o objeto ArchitectureOutput.

Exibe tipo de arquitetura e lista de serviços.

Renderiza TabelaCusto (lista de serviço + valor USD).

Renderiza DiagramaMermaid (passa o texto Mermaid).

Lista os passos de provisionamento.

Botão de download (inicialmente apenas um alerta "Em breve").

Diagrama Mermaid
Instalar mermaid.

Usar useEffect para inicializar mermaid e renderizar o diagrama em um div com id.

7. Configuração de Variáveis de Ambiente (.env)
text
VITE_API_URL=https://xxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture
VITE_AWS_REGION=us-east-1
VITE_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
8. Exemplo de Layout (esboço)
Cabeçalho: Título "Lake House Designer"

Área do formulário: Grid responsivo com labels e inputs.

Área de resultado: Cards separados para:

Arquitetura recomendada

Tabela de custos

Diagrama

Próximos passos

Rodapé: mensagem de disclaimer sobre estimativas.

9. Tratamento de Erros
Exibir mensagens amigáveis em caso de falha na obtenção de credenciais, timeout da requisição, ou resposta inválida.

Logar erros no console para debug.

10. Build e Deploy (instruções para integração com GitHub Actions)
O Kiro deve fornecer scripts de build (npm run build) e instruções de como os artefatos estáticos serão enviados para o bucket S3 (já coberto pelo pipeline SAM).

Garantir que o frontend não requeira servidor Node.js em runtime (apenas arquivos estáticos).

Exemplo de Resposta da API (para testes locais)
Simule o backend com um mock durante o desenvolvimento:

json
{
  "architecture_type": "full_lakehouse_with_redshift",
  "services": ["S3", "Glue", "LakeFormation", "Athena", "Redshift", "QuickSight"],
  "estimated_monthly_cost_usd": 3250.50,
  "cost_breakdown_per_service": {
    "S3": 250.00,
    "Glue": 100.00,
    "Athena": 80.00,
    "Redshift": 2790.00,
    "Lake Formation": 0,
    "QuickSight": 30.50
  },
  "diagram_mermaid": "graph TD\nA[S3 Raw] --> B[Glue ETL]\nB --> C[S3 Curated]\nC --> D[Redshift]\nD --> E[QuickSight]\nC --> F[Athena]",
  "provisioning_steps": [
    "Criar bucket S3 para camadas raw/curated",
    "Configurar Lake Formation (administradores, permissões)",
    "Executar Glue Crawler para catálogo",
    "Criar funções de ETL no Glue Jobs",
    "Criar cluster Redshift (2 nós ra3.xlplus) - verificar cotas"
  ],
  "message": "Estimativas baseadas nos parâmetros informados."
}
Critérios de Aceite (para validação do Kiro)
Ao acessar a SPA, nenhum erro de autenticação é apresentado (as credenciais são obtidas silenciosamente ou com fallback claro).

Formulário valida entradas e envia para API.

Resultados são exibidos corretamente, incluindo tabela de custos formatada (moeda USD).

Diagrama Mermaid renderizado visualmente.

Responsivo em diferentes tamanhos de tela.

Código comentado e organizado.

README com instruções de execução local (npm install, variáveis de ambiente mock) e build.

