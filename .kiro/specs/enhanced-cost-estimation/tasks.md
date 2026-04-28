# Plano de Implementação: Estimativa de Custo Aprimorada (Enhanced Cost Estimation)

## Visão Geral

Implementação incremental dos 3 novos parâmetros de entrada (DMS CDC, Fontes de Coleta Automatizada, APIs Externas) no Lake House Designer, começando pela camada de tipos, passando pelo formulário frontend e finalizando com a lógica de backend.

## Tarefas

- [x] 1. Atualizar interface ArchitectureInput em `frontend/src/services/types.ts`
  - Adicionar os 4 novos campos à interface `ArchitectureInput`: `dms_cdc_enabled` (boolean), `dms_cdc_db_count` (number opcional), `data_source_count` (number) e `external_api_count` (number)
  - Nenhuma alteração necessária em `ArchitectureOutput` — os campos dinâmicos existentes (`services: string[]`, `cost_breakdown_per_service: Record<string, number>`) já suportam os novos serviços
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2. Adicionar novos campos de entrada no `frontend/src/components/Formulario.tsx`
  - [x] 2.1 Atualizar `FormState`, `INITIAL` e a função `set` para suportar os novos campos
    - Adicionar `dms_cdc_enabled: boolean`, `dms_cdc_db_count: string`, `data_source_count: string` e `external_api_count: string` ao `FormState`
    - Definir valores iniciais: `dms_cdc_enabled: false`, `dms_cdc_db_count: ""`, `data_source_count: "0"`, `external_api_count: "0"`
    - _Requisitos: 1.1, 2.1, 3.1_

  - [x] 2.2 Atualizar a função `validate()` com validação condicional
    - Quando `dms_cdc_enabled` é `true`: validar que `dms_cdc_db_count` não está vazio e é um inteiro positivo
    - Para `data_source_count` e `external_api_count`: validar que valores não são negativos
    - Manter validação existente dos 4 campos numéricos obrigatórios inalterada
    - _Requisitos: 1.4, 1.5, 2.2, 3.2_

  - [x] 2.3 Atualizar `handleSubmit()` para incluir novos campos no payload
    - Montar o objeto `ArchitectureInput` com os novos campos
    - Omitir `dms_cdc_db_count` do payload quando `dms_cdc_enabled` é `false`
    - Converter `data_source_count` e `external_api_count` para number com fallback para 0
    - _Requisitos: 4.5, 4.6_

  - [x] 2.4 Adicionar campos JSX ao formulário
    - Adicionar separador visual "Serviços Adicionais (Opcional)" após os 5 campos existentes
    - Adicionar checkbox "DMS CDC (Change Data Capture)" com campo condicional "Quantidade de Bancos de Dados" (visível apenas quando checkbox marcado)
    - Adicionar campo numérico "Fontes de Coleta Automatizada" (padrão 0, min 0)
    - Adicionar campo numérico "APIs de Exposição de Dados Externos" (padrão 0, min 0)
    - Exibir mensagens de erro de validação para cada campo
    - Ao desmarcar o checkbox DMS, limpar o valor de `dms_cdc_db_count`
    - _Requisitos: 1.1, 1.2, 1.3, 2.1, 3.1_

- [x] 3. Checkpoint — Verificar frontend
  - Garantir que o frontend compila sem erros de tipo (`npx tsc --noEmit`)
  - Verificar que os novos campos aparecem corretamente no formulário
  - Perguntar ao usuário se há dúvidas

- [x] 4. Atualizar lógica do backend em `backend/src/orchestrator.py`
  - [x] 4.1 Adicionar função utilitária `safe_int()` e parsing dos novos parâmetros
    - Criar função `safe_int(value, default=0)` que converte para inteiro não-negativo com tratamento de erros
    - No `lambda_handler()`, fazer parsing de `dms_cdc_enabled`, `dms_cdc_db_count`, `data_source_count` e `external_api_count` usando `safe_int()` e valores padrão para compatibilidade retroativa
    - _Requisitos: 10.1, 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 4.2 Adicionar 3 novas funções de cálculo de custo
    - `compute_dms_cost(db_count)`: instância dms.r5.large ($0.192/h × 24h × 30d) + armazenamento (50GB × $0.10/GB) + overhead por tarefa ($10/mês × db_count)
    - `compute_additional_glue_cost(source_count)`: crawler (2 DPU × 0.5h × $0.44 × 30d) + job (2 DPU × 1h × $0.44 × 30d) por fonte
    - `compute_external_api_cost(api_count)`: API Gateway ($3.50/1M req) + Lambda invocações + compute + data transfer (10GB × $0.09/GB) por API
    - _Requisitos: 5.1, 5.4, 6.1, 7.1, 7.4_

  - [x] 4.3 Integrar novos custos no `lambda_handler()` e atualizar lista de serviços
    - Chamar as 3 novas funções de custo condicionalmente e adicionar ao `cost_breakdown`
    - Para Glue: somar custo adicional ao custo base existente
    - Construir lista `services` dinamicamente incluindo "DMS" e "API Gateway (External)" quando aplicável
    - _Requisitos: 5.2, 5.3, 6.2, 6.3, 7.2, 7.3_

  - [x] 4.4 Atualizar `get_mermaid_diagram()` e `get_provisioning_steps()` com parâmetros condicionais
    - Atualizar assinatura de ambas as funções para aceitar `dms_enabled`, `source_count` e `api_count`
    - No diagrama: adicionar nós condicionais de DMS, fontes de dados e API Gateway
    - Nos passos: adicionar instruções condicionais de provisionamento para cada novo serviço
    - Atualizar chamadas no `lambda_handler()` para passar os novos parâmetros
    - Quando todos os novos parâmetros estão nos valores padrão, o comportamento deve ser idêntico ao atual
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 10.2, 10.3_

- [x] 5. Checkpoint final — Verificar integração completa
  - Garantir que o frontend compila sem erros
  - Garantir que o backend não possui erros de sintaxe Python
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

## Notas

- Os componentes de exibição (`ResultadoArquitetura`, `TabelaCusto`, `DiagramaMermaid`) não precisam de alteração — já renderizam dados dinâmicos (Req. 11)
- O pipeline CI/CD faz deploy automático no push para main — nenhuma tarefa de deploy necessária
- Cada tarefa referencia requisitos específicos para rastreabilidade
