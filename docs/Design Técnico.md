Design Técnico – Sistema Gerador de Arquitetura Lake House (Autenticação IAM + CloudFormation)
Ajustando a especificação anterior conforme solicitado:

Autenticação: IAM (via AWS Signature V4) – adequado para uso interno corporativo, integrado ao SSO/AD da empresa.

Saída de IaC: CloudFormation (YAML) em vez de Terraform.

Demais componentes permanecem similares, com adaptações no frontend (uso de AWS4 signer) e no backend (permissões IAM finas).

1. Arquitetura Geral (Atualizada)
text
[Usuário corporativo] → (HTTPS) → CloudFront → S3 (SPA)
                                    ↓
                            API Gateway (REST)
                            (Autorização: AWS_IAM)
                                    ↓
                            Lambda (autorizador custom? não: API Gateway valida sigv4)
                                    ↓
                            Lambda Orchestrator
                                    ↓
            ┌───────────────────────┼───────────────────────┐
            ↓                       ↓                       ↓
       DynamoDB               Base de Regras           Gerador CFN
      (histórico)          (S3/Parameter Store)    → S3 (template YAML)
                                                            ↓
                                                    URL pré-assinada
                                                            ↓
                                                  SPA → download
Mudanças chave:

API Gateway configurado com método AWS_IAM (assinatura SigV4).

Frontend (SPA) usa biblioteca aws4 ou @aws-sdk/credential-providers para assinar requisições.

A geração de infraestrutura usa CloudFormation (YAML) ao invés de Terraform.

2. Componentes Detalhados
2.1 Frontend (SPA)
Tecnologia: React + AWS SDK v3 (apenas para credenciais e assinatura).

Autenticação IAM:

O usuário corporativo já está autenticado no AWS SSO/ADFS ou possui credenciais temporárias (STS).

A SPA usará Credentials obtidas via fromCognitoIdentityPool ou, mais comum em ambiente corporativo, via Amazon Cognito Identity Pool com provedor SAML/SSO OU diretamente via fromTemporaryCredentials assumindo uma Role.

Simplificação: O desenvolvedor da SPA pode utilizar AWS.config.credentials recuperadas do ambiente da empresa (ex: via aws-amplify com autenticação existente).

A SPA assina cada chamada à API Gateway usando SignatureV4 (do pacote @aws-sdk/signature-v4), com o header Authorization.

Hospedagem: Bucket S3 privado + CloudFront com OAI.

2.2 API Gateway
Tipo: REST API.

Método: POST /generate-architecture.

Autorização: AWS_IAM (verifica credenciais SigV4).

Política de recurso (exemplo):

json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "arn:aws:iam::ACCOUNT:role/InternalLakeHouseUsers"
  },
  "Action": "execute-api:Invoke",
  "Resource": "execute-api:/*/POST/generate-architecture"
}
Endpoint: Regional (para menor latência).

2.3 Lógica de Decisão – Lambda Orchestrator
Permanece em Python 3.12, com regras de negócio para recomendar uso de Redshift.

Alterações:

A função terá uma role IAM que permite:

dynamodb:PutItem, dynamodb:GetItem (tabela de histórico).

s3:GetObject (arquivo de regras, se externo).

s3:PutObject (bucket de templates CloudFormation).

Estimativa de custo: mantém simulação local baseada em tabela de preços (ou opcionalmente consulta AWS Pricing API).

Saída JSON (exemplo):

json
{
  "architecture_type": "full_lakehouse_with_redshift",
  "services": ["S3", "Glue", "LakeFormation", "Redshift", "Athena", "QuickSight"],
  "estimated_monthly_cost_usd": 3250,
  "diagram_mermaid": "graph TD; S3-->Glue; Glue-->Redshift;",
  "cfn_template_url": "https://bucket.s3.amazonaws.com/.../template.yaml?signature=...",
  "provisioning_steps": ["aws cloudformation create-stack ..."]
}
2.4 Geração de CloudFormation (YAML)
Implementação: Lambda dedicada (pode ser a mesma ou outra função).

Processo:

Obter template base CFN armazenado no S3 (ex: redshift_lakehouse.yaml.j2).
Usar Jinja2 (ou simples str.replace) para preencher valores dinâmicos:
Nome do bucket S3
Tipo e número de nós do Redshift
Configurações do Glue (Crawler, Database)
Políticas do Lake Formation
Salvar arquivo YAML final em bucket de saída (ex: cfn-templates/).
Gerar URL pré-assinada (válida por 1h).
Retornar URL no JSON.
Exemplo de template base (simplificado):

yaml
AWSTemplateFormatVersion: 2010-09-09
Description: Lake House com Redshift
Parameters:
  DataBucketName:
    Type: String
Resources:
  LakeFormationDataBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Ref DataBucketName
  RedshiftCluster:
    Type: AWS::Redshift::Cluster
    Properties:
      ClusterType: multi-node
      NodeType: ra3.xlplus
      NumberOfNodes: {{ redshift_nodes }}
      ...
  GlueDatabase:
    Type: AWS::Glue::Database
    Properties:
      DatabaseInput:
        Name: lakehouse_db
...
O Lambda substitui {{ redshift_nodes }} pelo valor calculado (ex: 2).

2.5 Permissões IAM para a SPA (via Role)
A empresa deve criar uma role IAM que os usuários internos podem assumir (ex: via AWS SSO). A role deve permitir apenas a ação execute-api:Invoke no recurso da API Gateway.

json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "execute-api:Invoke",
      "Resource": "arn:aws:execute-api:region:account:api-id/*/POST/generate-architecture"
    }
  ]
}
Não é necessário permitir acesso a S3 ou DynamoDB diretamente pelos usuários – todo backend é mediado pela Lambda.

2.6 Configuração CORS para requisições assinadas
API Gateway deve responder com Access-Control-Allow-Origin: https://app.meudominio.com e headers corretos para preflight. Cuidado: preflight (OPTIONS) não carrega assinatura – deve ser público ou usar Mock integração.

3. Fluxo Completo com IAM
Usuário corporativo faz login no AWS SSO / AD federado, obtém credenciais temporárias (access key, secret, session token).

SPA carrega e obtém essas credenciais (via aws-amplify ou aws-sdk com provedor customizado).

Usuário preenche parâmetros no formulário.

SPA constrói a requisição HTTP para a URL da API Gateway, assina com SignatureV4 usando as credenciais.

API Gateway valida a assinatura e encaminha para Lambda Orchestrator.

Lambda processa regras, gera recomendação, armazena no DynamoDB.

Lambda (ou Step Function) gera template CloudFormation YAML, salva em S3, e retorna URL pré-assinada.

SPA exibe arquitetura e botão de download. O usuário faz o download do template.

O usuário (ou pipeline) executa aws cloudformation create-stack --template-url ... para provisionar a lake house.

4. Considerações de Segurança (IAM)
Role da Lambda deve aderir ao princípio do menor privilégio. Exemplo de política:

json
{
  "Effect": "Allow",
  "Action": [
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "*"
},
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:Query"
  ],
  "Resource": "arn:aws:dynamodb:.../table/LakeHouseHistory"
},
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": [
    "arn:aws:s3:::internal-cfn-templates/*",
    "arn:aws:s3:::lakehouse-rules-bucket/*"
  ]
}
API Gateway log de acesso habilitado (CloudWatch) para rastrear quem chamou.

Bucket de templates CFN: Privado, com ciclo de vida (expirar após 7 dias). Acesso somente via URL pré-assinada.

Nunca expor chaves de acesso no frontend – as credenciais são temporárias e obtidas via SSO/STS.

5. Estimativa de Custo (Ajustada – sem Cognito)
Serviço	Custo mensal (USD)
S3 (SPA + templates)	~0,50
CloudFront	~4,00
API Gateway (10k calls)	~1,00
Lambda (2 funções)	~2,50
DynamoDB	~1,50
Step Functions (opcional)	~2,50
Total	~12 USD
(Cognito removido; IAM não tem custo adicional.)

6. Exemplo de Requisição Assinada (Frontend)
Usando @aws-sdk/signature-v4 e @aws-sdk/credential-providers:

typescript
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";

const credentials = await fromCognitoIdentityPool({
  identityPoolId: "us-east-1:xxx", // Opcional, se usar identidade federada
  clientConfig: { region: "us-east-1" }
})();

const signer = new SignatureV4({
  credentials,
  service: "execute-api",
  region: "us-east-1",
  sha256: Sha256,
});

const request = {
  method: "POST",
  protocol: "https:",
  hostname: "api-id.execute-api.us-east-1.amazonaws.com",
  path: "/prod/generate-architecture",
  headers: {
    "Content-Type": "application/json",
    host: "api-id.execute-api.us-east-1.amazonaws.com",
  },
  body: JSON.stringify({ data_volume_tb: 50, ... }),
};

const signed = await signer.sign(request);
fetch(signed.url, { method: "POST", body: signed.body, headers: signed.headers });
7. Template de CloudFormation Gerado (Exemplo de saída)
yaml
AWSTemplateFormatVersion: 2010-09-09
Description: Lake House Architecture - Redshift Included
Parameters:
  Environment:
    Type: String
    Default: dev
Resources:
  RawDataBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "raw-${Environment}-company"
  LakeFormationPermissions:
    Type: AWS::LakeFormation::DataLakeSettings
    Properties:
      Admins:
        - DataLakePrincipalIdentifier: !GetAtt MyGlueRole.Arn
  RedshiftCluster:
    Type: AWS::Redshift::Cluster
    Properties:
      ClusterIdentifier: !Sub "lakehouse-${Environment}"
      NodeType: ra3.xlplus
      NumberOfNodes: 2
      ClusterType: multi-node
      MasterUsername: !Ref AdminUser
      MasterUserPassword: !Ref AdminPassword
      IamRoles:
        - !GetAtt RedshiftSpectrumRole.Arn
  GlueDatabase:
    Type: AWS::Glue::Database
    Properties:
      DatabaseInput:
        Name: !Sub "lakehouse_${Environment}"
Outputs:
  RedshiftEndpoint:
    Value: !GetAtt RedshiftCluster.Endpoint.Address
8. Plano de Implementação (Revisado)
Fase	Tarefas	Duração
1	Bucket S3 + CloudFront + SPA estático	1 dia
2	API Gateway (AWS_IAM) + Lambda de decisão	2 dias
3	Integração DynamoDB + lógica regras	1 dia
4	Geração CloudFormation YAML (Jinja2)	2 dias
5	Frontend: integração com SigV4 e assinatura	2 dias
6	Testes IAM (roles, permissões) + monitoramento	1 dia
Total		9 dias
9. Observações Finais
O uso de autenticação IAM pressupõe que os usuários internos já possuem credenciais AWS (via SSO, roles assumidas). Se não, pode-se combinar com Cognito Identity Pool federado ao AD.

CloudFormation é a ferramenta nativa da AWS para IaC; a geração via templates YAML permite fácil integração com pipelines (CodePipeline, Git).

O sistema permanece completamente serverless, sem necessidade de gerenciar servidores.