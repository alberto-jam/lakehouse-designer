# Deploy — Lakehouse Designer V2

Instruções para deploy manual do frontend e backend em produção.

## Pré-requisitos

| Ferramenta | Versão mínima | Instalação |
|------------|---------------|------------|
| Node.js | 18+ | https://nodejs.org |
| AWS CLI | 2.x | https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html |
| SAM CLI | 1.x | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| Python | 3.12 | https://www.python.org/downloads/ |

Credenciais AWS configuradas com permissões para S3, CloudFront, CloudFormation, Lambda e API Gateway:

```bash
aws configure
# ou exporte as variáveis:
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1
```

---

## 1. Deploy do Backend (SAM)

A partir da raiz do projeto:

```bash
cd backend

# Validar template
sam validate --template template.yaml

# Build
sam build --template template.yaml

# Deploy (primeira vez — cria o stack)
sam deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name lakehouse-designer \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    "FrontendBucketName=lakehouse-designer-frontend" \
    "Environment=prd" \
    "TagCliente=FORCEONE" \
    "TagAmbiente=PRD" \
    "TagProjeto=LAKEHOUSE-DESIGNER" \
    "TagAutor=ALBERTO MOREIRA"
```

Após o deploy, obtenha os outputs do stack:

```bash
aws cloudformation describe-stacks \
  --stack-name lakehouse-designer \
  --query "Stacks[0].Outputs" \
  --output table
```

Outputs relevantes:
- **ApiEndpoint** — URL base da API (ex: `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`)
- **FrontendBucketName** — Nome do bucket S3 para o frontend
- **CloudFrontDistributionId** — ID da distribuição CloudFront
- **CloudFrontURL** — URL pública do site

### Upload dos templates Jinja2

```bash
TEMPLATES_BUCKET=$(aws cloudformation describe-stack-resources \
  --stack-name lakehouse-designer \
  --logical-resource-id TemplatesBucket \
  --query 'StackResources[0].PhysicalResourceId' \
  --output text)

aws s3 cp backend/redshift_lakehouse.yaml.j2 "s3://${TEMPLATES_BUCKET}/base/"
aws s3 cp backend/athena_lakehouse.yaml.j2 "s3://${TEMPLATES_BUCKET}/base/"
```

---

## 2. Deploy do Frontend (S3 + CloudFront)

### 2.1 Configurar variáveis de ambiente

Crie o arquivo `frontend/.env` com os valores de produção:

```env
VITE_API_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture
VITE_API_BASE_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
VITE_AWS_REGION=us-east-1
VITE_AWS_IDENTITY_POOL_ID=us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> **Importante:** Substitua os valores `xxxxx` pelos outputs reais do CloudFormation (passo anterior).

### 2.2 Build de produção

```bash
cd frontend
npm ci
npm run build
```

O build gera arquivos estáticos em `frontend/dist/` (HTML, CSS, JS). Não há dependência de servidor Node.js em runtime.

### 2.3 Upload para S3

```bash
FRONTEND_BUCKET="lakehouse-designer-frontend-<ACCOUNT_ID>-us-east-1"

aws s3 sync ./dist/ s3://${FRONTEND_BUCKET} --delete
```

A flag `--delete` remove arquivos antigos que não existem mais no build atual.

### 2.4 Invalidação do cache CloudFront

```bash
CLOUDFRONT_ID="<CloudFrontDistributionId>"

aws cloudfront create-invalidation \
  --distribution-id ${CLOUDFRONT_ID} \
  --paths "/*"
```

A invalidação leva de 1 a 5 minutos para propagar globalmente.

---

## 3. Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `VITE_API_URL` | URL completa do endpoint V1 `/generate-architecture` | `https://xxx.execute-api.us-east-1.amazonaws.com/prod/generate-architecture` |
| `VITE_API_BASE_URL` | URL base da API para endpoints V2 (ex: `/generate-v2`) | `https://xxx.execute-api.us-east-1.amazonaws.com/prod` |
| `VITE_AWS_REGION` | Região AWS para SDK/Cognito | `us-east-1` |
| `VITE_AWS_IDENTITY_POOL_ID` | ID do Identity Pool Cognito | `us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

> As variáveis `VITE_*` são injetadas em tempo de build pelo Vite. Qualquer alteração requer novo build + upload.

---

## 4. Verificação Pós-Deploy

### Frontend

1. Acesse a URL do CloudFront no navegador
2. Verifique que o wizard V2 carrega corretamente (9 passos visíveis na sidebar)
3. Teste navegação SPA: acesse uma rota inexistente e confirme que o fallback para `index.html` funciona (CloudFront retorna 200 para 403/404)

### Backend

1. Teste o endpoint V2 com curl:

```bash
API_ENDPOINT="https://xxxxx.execute-api.us-east-1.amazonaws.com/prod"

curl -X POST "${API_ENDPOINT}/generate-v2" \
  -H "Content-Type: application/json" \
  -d '{
    "project": {"project_name": "test", "environment": "dev", "region": "us-east-1"},
    "sources": {"data_volume_tb": 1, "records_per_day_millions": 1, "data_source_count": 2, "dms_cdc_enabled": false, "source_types": ["CSV"]},
    "ingestion": {"ingestion_pattern": "batch", "batch_frequency": "daily"},
    "storage": {"storage_tiers": ["raw", "curated"], "compression": "snappy", "file_format": "parquet"},
    "analytics": {"query_engine": "athena", "avg_query_complexity": "low", "max_query_latency_sec": 5, "concurrent_users": 10, "external_api_count": 0, "quicksight_enabled": false}
  }'
```

2. Confirme resposta HTTP 200 com campos `diagram`, `spec`, `cost_estimate`, `warnings`

3. Verifique que o endpoint V1 continua funcionando:

```bash
curl -X POST "${API_ENDPOINT}/generate-architecture" \
  -H "Content-Type: application/json" \
  -d '{"data_volume_tb": 1, "query_engine": "athena"}'
```

### Monitoramento

- CloudWatch Logs: verifique logs das Lambdas `OrchestratorFunction` e `GenerateV2Function`
- CloudWatch Alarms: confirme que os alarmes `High5xxErrorAlarm` e `LambdaErrorAlarm` estão configurados

---

## 5. Deploy Automatizado (CI/CD)

O deploy automatizado é executado via GitHub Actions no push para `main`. O workflow está em `.github/workflows/deploy.yaml` e executa:

1. **Backend**: `sam build` → `sam deploy` → upload de templates Jinja2
2. **Frontend**: `npm ci` → cria `.env` com outputs do backend → `npm run build` → `s3 sync` → CloudFront invalidation

Para disparar manualmente: vá em **Actions** → **Deploy Lake House Designer** → **Run workflow**.

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Página em branco após deploy | Verifique se o CloudFront tem custom error responses para 403→200 e 404→200 apontando para `/index.html` |
| Erro CORS no browser | Confirme que o API Gateway tem CORS configurado e que as Lambdas retornam headers `Access-Control-Allow-Origin: *` |
| `VITE_API_BASE_URL` undefined | Recrie o `.env` e execute `npm run build` novamente |
| Timeout na geração V2 | A Lambda tem timeout de 28s. Para payloads complexos, verifique CloudWatch Logs |
| Cache desatualizado | Execute invalidação do CloudFront com `--paths "/*"` |
