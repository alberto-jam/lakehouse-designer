# Plano de Implementação: API de Precificação Dinâmica

## Visão Geral

Introduzir o módulo `pricing_service.py` que consulta a AWS Pricing API para obter preços on-demand em tempo real, com cache em memória Lambda e fallback para valores hardcoded. Atualizar o `orchestrator.py` para consumir preços dinâmicos e adicionar permissões IAM necessárias no `template.yaml`.

## Tarefas

- [x] 1. Adicionar permissões IAM para a Pricing API no `template.yaml`
  - Adicionar uma nova policy inline na `OrchestratorFunction` com as ações `pricing:GetProducts` e `pricing:DescribeServices` no recurso `"*"`
  - A nova policy deve ser adicionada após a policy existente do `bcm-pricing-calculator`
  - _Requisitos: 8.1, 8.2, 8.3_

- [x] 2. Criar o módulo `backend/src/pricing_service.py`
  - Definir o dicionário `FALLBACK_PRICES` com os 7 serviços e seus preços unitários atuais (S3, Glue, Athena, Redshift, DMS, API Gateway, QuickSight)
  - Definir o dicionário `PRICING_CONFIG` com o mapeamento de cada serviço para `ServiceCode` e filtros `TERM_MATCH` (incluindo `usagetype` e `location='US East (N. Virginia)'`)
  - Implementar `fetch_price(pricing_client, service_code, filters)` que chama `get_products()` e extrai o primeiro preço USD > 0 da resposta aninhada, retornando `None` em caso de falha
  - Implementar `load_all_prices()` que executa as 7 chamadas em paralelo via `ThreadPoolExecutor`, usando fallback individual por serviço em caso de falha
  - Implementar `get_prices()` com cache em nível de módulo (TTL 24h) que retorna preços cacheados ou busca novos via `load_all_prices()`
  - Incluir logging: INFO para sucesso total, WARNING para fallback parcial, DEBUG para cache hit
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 10.1, 10.2, 10.3_

- [x] 3. Atualizar `backend/src/orchestrator.py` para usar preços dinâmicos
  - Adicionar `from pricing_service import get_prices` no topo do arquivo
  - Em `lambda_handler()`, chamar `prices = get_prices()` antes do cálculo de custos e passar `prices` para `compute_cost_breakdown()`, `compute_dms_cost()`, `compute_additional_glue_cost()`, `compute_external_api_cost()` e `build_usage_items()`
  - Atualizar `compute_cost_breakdown()` para aceitar `prices` e substituir as constantes `0.023`, `0.44`, `0.005`, `1.0833` e `30.0` pelos valores dinâmicos correspondentes
  - Atualizar `compute_dms_cost()` para aceitar `prices` e substituir a constante `0.176`
  - Atualizar `compute_additional_glue_cost()` para aceitar `prices` e substituir a constante `0.44`
  - Atualizar `compute_external_api_cost()` para aceitar `prices` e substituir a constante `3.50`
  - Atualizar `build_usage_items()` para aceitar `prices` e substituir os divisores hardcoded (0.023, 0.44, 5.0, 1.0833, 0.176, 0.0000035, 18.0) pelos preços dinâmicos, com `safe_divisor()` para proteção contra divisão por zero
  - Manter o formato de resposta JSON inalterado para compatibilidade retroativa
  - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 9.1, 9.2, 9.3_

- [x] 4. Checkpoint — Verificar integração
  - Ensure all tests pass, ask the user if questions arise.
  - Verificar que `template.yaml` é válido (sem erros de sintaxe YAML)
  - Verificar que `pricing_service.py` importa corretamente no `orchestrator.py`
  - Verificar que todas as funções de custo aceitam o parâmetro `prices` com default `None` para compatibilidade retroativa

## Notas

- CI/CD faz deploy automático — não há tarefas de deploy
- Sem tarefas de teste conforme solicitado
- Cada função de custo mantém `prices=None` como default para compatibilidade retroativa
