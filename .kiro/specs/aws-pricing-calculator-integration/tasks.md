# Plano de Implementação: Integração com AWS Pricing Calculator

## Visão Geral

Implementação incremental da integração com a API BCM Pricing Calculator. Cada tarefa constrói sobre a anterior, começando pela infraestrutura IAM, passando pela lógica backend, e finalizando com a exibição no frontend.

## Tarefas

- [x] 1. Adicionar permissões IAM no template SAM
  - Adicionar política inline na seção `Policies` da `OrchestratorFunction` em `backend/template.yaml`
  - Permissões: `bcm-pricing-calculator:CreateWorkloadEstimate` e `bcm-pricing-calculator:CreateWorkloadEstimateUsage`
  - Recurso: `arn:aws:bcm-pricing-calculator:*:${AWS::AccountId}:*`
  - _Requisitos: 6.1, 6.2, 6.3_

- [x] 2. Adicionar constantes, imports e funções auxiliares no orchestrator
  - [x] 2.1 Adicionar imports (`logging`, `botocore.config.Config`), logger, `BCM_CLIENT_CONFIG`, `ESTIMATE_URL_TEMPLATE` e `SERVICE_CODE_MAPPING` no nível de módulo de `backend/src/orchestrator.py`
    - _Requisitos: 2.1, 2.2_
  - [x] 2.2 Implementar funções `build_estimate_name()`, `build_estimate_url()` e `build_usage_items()` em `backend/src/orchestrator.py`
    - `build_estimate_name`: gera nome `[a-zA-Z0-9-]+` com máx 64 chars
    - `build_usage_items`: omite serviços com custo zero, mapeia via `SERVICE_CODE_MAPPING`
    - _Requisitos: 1.3, 2.3, 2.4, 9.1_
  - [x] 2.3 Implementar `create_pricing_calculator_estimate()` em `backend/src/orchestrator.py`
    - Cria cliente boto3 `bcm-pricing-calculator` com região `us-east-1` e timeouts (connect=5s, read=10s)
    - Chama `create_workload_estimate` e `batch_create_workload_estimate_usage`
    - Retorna URL do console ou `None` em caso de falha (try/except isolado com logging)
    - _Requisitos: 1.1, 1.2, 1.4, 3.1, 3.2, 3.3, 3.4, 8.1, 8.2_

- [x] 3. Integrar chamada BCM no `lambda_handler` e adicionar `pricing_calculator_url` à resposta
  - Chamar `create_pricing_calculator_estimate()` após salvar no DynamoDB (passo 7.5)
  - Adicionar `pricing_calculator_url` ao dicionário `response`
  - _Requisitos: 1.4, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

- [x] 4. Adicionar campo `pricing_calculator_url` à interface `ArchitectureOutput`
  - Adicionar `pricing_calculator_url?: string` em `frontend/src/services/types.ts`
  - _Requisitos: 4.1, 9.3_

- [x] 5. Criar componente `BotaoPricingCalculator`
  - Criar `frontend/src/components/BotaoPricingCalculator.tsx`
  - Estado ativo: botão verde "Ver no AWS Pricing Calculator" que abre URL em nova aba
  - Estado desabilitado: botão cinza "Estimativa não disponível" quando URL é null/vazia
  - Seguir padrão visual do `BotaoDownload` existente
  - _Requisitos: 5.1, 5.2, 5.3, 5.5_

- [x] 6. Integrar `BotaoPricingCalculator` no `ResultadoArquitetura`
  - Importar e renderizar `BotaoPricingCalculator` em `frontend/src/components/ResultadoArquitetura.tsx`
  - Posicionar após a seção "Template CloudFormation"
  - _Requisitos: 5.4_

- [x] 7. Checkpoint — Verificar compilação e integração
  - Garantir que o frontend compila sem erros (`npm run build`)
  - Validar que `backend/template.yaml` é um template SAM válido
  - Verificar que todos os componentes estão conectados corretamente
  - Perguntar ao usuário se há dúvidas ou ajustes necessários
