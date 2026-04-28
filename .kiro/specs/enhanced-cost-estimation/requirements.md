# Documento de Requisitos — Estimativa de Custo Aprimorada (Enhanced Cost Estimation)

## Introdução

O Lake House Designer é um sistema que gera recomendações de arquitetura Lake House na AWS com estimativa de custo mensal. Atualmente, o sistema aceita 5 parâmetros de entrada (volume de dados, registros por dia, complexidade de consulta, latência máxima e usuários simultâneos) e gera uma arquitetura baseada em S3, Glue, Athena e opcionalmente Redshift/QuickSight.

Esta melhoria adiciona 3 novos parâmetros de entrada para tornar a recomendação de arquitetura e a estimativa de custo mais realistas:

1. **DMS CDC (Change Data Capture)** — habilita replicação de dados de bancos relacionais via AWS DMS
2. **Fontes de Coleta Automatizada** — quantidade de origens de dados que necessitam coleta automatizada via AWS Glue
3. **APIs de Exposição de Dados Externos** — quantidade de APIs necessárias para expor dados externamente via API Gateway + Lambda

As alterações impactam o frontend (formulário de entrada e tipos TypeScript), o backend (lógica de decisão, estimativa de custo, diagrama Mermaid e passos de provisionamento) e os tipos compartilhados.

## Glossário

- **Lake_House_Designer**: O sistema completo (frontend + backend) que gera recomendações de arquitetura Lake House na AWS
- **Frontend**: A aplicação SPA React/TypeScript que roda no navegador do usuário
- **Backend**: O serviço serverless composto por API Gateway + Lambda (Python 3.12) + DynamoDB + S3
- **Formulario**: O componente de entrada de dados onde o usuário informa os parâmetros de carga de trabalho
- **Orchestrator**: A função Lambda Python que processa os parâmetros de entrada, decide a arquitetura, calcula custos e gera o diagrama
- **ArchitectureInput**: Interface TypeScript (e correspondente dict Python) que define a estrutura dos parâmetros de entrada
- **ArchitectureOutput**: Interface TypeScript (e correspondente dict Python) que define a estrutura da resposta retornada pelo backend
- **DMS_CDC**: AWS Database Migration Service com Change Data Capture — serviço que replica dados de bancos relacionais para o data lake em tempo quase real
- **Instancia_Replicacao_DMS**: Instância de replicação do AWS DMS (tipo dms.r5.large, ~$0.192/hora) que executa as tarefas de CDC
- **Tarefa_DMS**: Tarefa de migração/replicação do DMS associada a um banco de dados de origem
- **Fontes_Coleta_Automatizada**: Origens de dados que necessitam coleta automatizada via AWS Glue (Crawlers, Jobs e Connectors)
- **Glue_Crawler**: Componente do AWS Glue que descobre e cataloga metadados de uma fonte de dados
- **Glue_Job**: Componente do AWS Glue que executa transformações ETL sobre os dados coletados
- **Glue_Connector**: Componente do AWS Glue que estabelece conexão com uma fonte de dados específica
- **APIs_Externas**: Endpoints de API Gateway + Lambda que expõem dados do data lake para consumidores externos
- **API_Gateway_Externo**: Instância do Amazon API Gateway dedicada a expor dados do data lake para consumidores externos (distinta do API Gateway interno do Lake House Designer)
- **Lambda_Servico_Dados**: Função AWS Lambda que serve dados do data lake em resposta a requisições das APIs externas
- **Tabela_Custo**: O componente que exibe a estimativa de custo mensal por serviço AWS em formato tabular
- **Diagrama_Mermaid**: O texto Mermaid gerado pelo Orchestrator que representa visualmente a arquitetura recomendada
- **DPU**: Data Processing Unit — unidade de processamento do AWS Glue (custo de $0.44/DPU-hora)

## Requisitos

### Requisito 1: Novos Campos de Entrada no Formulário — DMS CDC

**User Story:** Como um usuário do Lake House Designer, eu quero informar se minha arquitetura utiliza DMS CDC e quantos bancos de dados relacionais serão replicados, para que a estimativa de custo inclua os custos de replicação via AWS DMS.

#### Critérios de Aceitação

1. THE Formulario SHALL exibir um campo de alternância (toggle/checkbox) com o rótulo "DMS CDC (Change Data Capture)" e as opções "Sim" e "Não", com valor padrão "Não"
2. WHEN o usuário ativa o toggle de DMS CDC para "Sim", THE Formulario SHALL exibir um campo numérico adicional com o rótulo "Quantidade de Bancos de Dados" para informar o número de bancos relacionais que fornecerão dados via CDC
3. WHEN o toggle de DMS CDC está configurado como "Não", THE Formulario SHALL ocultar o campo "Quantidade de Bancos de Dados" e não enviar o valor ao Backend
4. WHEN o usuário tenta submeter o Formulario com DMS CDC ativado e o campo "Quantidade de Bancos de Dados" contendo valor menor ou igual a zero, THE Formulario SHALL exibir mensagem de validação indicando que o valor deve ser positivo e impedir o envio
5. WHEN o usuário tenta submeter o Formulario com DMS CDC ativado e o campo "Quantidade de Bancos de Dados" vazio, THE Formulario SHALL exibir mensagem de validação indicando que o campo é obrigatório e impedir o envio

### Requisito 2: Novos Campos de Entrada no Formulário — Fontes de Coleta Automatizada

**User Story:** Como um usuário do Lake House Designer, eu quero informar a quantidade de fontes de dados que necessitam coleta automatizada, para que a estimativa de custo inclua os custos adicionais de Glue Crawlers, Jobs e Connectors.

#### Critérios de Aceitação

1. THE Formulario SHALL exibir um campo numérico com o rótulo "Fontes de Coleta Automatizada" para informar a quantidade de origens de dados que necessitam coleta automatizada, com valor padrão 0
2. WHEN o usuário tenta submeter o Formulario com o campo "Fontes de Coleta Automatizada" contendo valor negativo, THE Formulario SHALL exibir mensagem de validação indicando que o valor deve ser zero ou positivo e impedir o envio
3. WHEN o campo "Fontes de Coleta Automatizada" contém valor 0, THE Formulario SHALL permitir o envio sem adicionar custos de coleta automatizada à estimativa

### Requisito 3: Novos Campos de Entrada no Formulário — APIs de Exposição de Dados Externos

**User Story:** Como um usuário do Lake House Designer, eu quero informar a quantidade de APIs necessárias para expor dados externamente, para que a estimativa de custo inclua os custos de API Gateway, Lambda e transferência de dados.

#### Critérios de Aceitação

1. THE Formulario SHALL exibir um campo numérico com o rótulo "APIs de Exposição de Dados Externos" para informar a quantidade de APIs necessárias para expor dados do data lake, com valor padrão 0
2. WHEN o usuário tenta submeter o Formulario com o campo "APIs de Exposição de Dados Externos" contendo valor negativo, THE Formulario SHALL exibir mensagem de validação indicando que o valor deve ser zero ou positivo e impedir o envio
3. WHEN o campo "APIs de Exposição de Dados Externos" contém valor 0, THE Formulario SHALL permitir o envio sem adicionar custos de APIs externas à estimativa

### Requisito 4: Atualização da Interface ArchitectureInput

**User Story:** Como um desenvolvedor, eu quero que a interface ArchitectureInput inclua os novos campos de entrada, para que o contrato entre frontend e backend suporte os novos parâmetros.

#### Critérios de Aceitação

1. THE ArchitectureInput SHALL incluir o campo `dms_cdc_enabled` do tipo booleano para indicar se DMS CDC está habilitado
2. THE ArchitectureInput SHALL incluir o campo `dms_cdc_db_count` do tipo numérico opcional para indicar a quantidade de bancos de dados quando DMS CDC está habilitado
3. THE ArchitectureInput SHALL incluir o campo `data_source_count` do tipo numérico para indicar a quantidade de fontes de coleta automatizada
4. THE ArchitectureInput SHALL incluir o campo `external_api_count` do tipo numérico para indicar a quantidade de APIs de exposição de dados externos
5. WHEN `dms_cdc_enabled` é `false`, THE ArchitectureInput SHALL omitir ou ignorar o campo `dms_cdc_db_count`
6. FOR ALL objetos ArchitectureInput válidos, serializar para JSON e deserializar de volta SHALL produzir um objeto equivalente ao original (propriedade round-trip)

### Requisito 5: Estimativa de Custo para DMS CDC

**User Story:** Como um usuário do Lake House Designer, eu quero que a estimativa de custo inclua os custos de AWS DMS quando CDC está habilitado, para que eu tenha uma visão realista do investimento necessário.

#### Critérios de Aceitação

1. WHEN `dms_cdc_enabled` é `true`, THE Orchestrator SHALL calcular o custo mensal de DMS incluindo: custo da Instancia_Replicacao_DMS (tipo dms.r5.large a $0.192/hora × 24 horas × 30 dias), custo de armazenamento para logs de CDC e custo proporcional ao número de Tarefas_DMS (uma por banco de dados informado em `dms_cdc_db_count`)
2. WHEN `dms_cdc_enabled` é `true`, THE Orchestrator SHALL incluir "DMS" na lista de serviços do campo `services` da resposta ArchitectureOutput
3. WHEN `dms_cdc_enabled` é `false`, THE Orchestrator SHALL atribuir custo zero para DMS no campo `cost_breakdown_per_service` e não incluir "DMS" na lista de serviços
4. THE Orchestrator SHALL incluir o custo de DMS como uma entrada separada com a chave "DMS" no campo `cost_breakdown_per_service` da resposta ArchitectureOutput

### Requisito 6: Estimativa de Custo para Fontes de Coleta Automatizada

**User Story:** Como um usuário do Lake House Designer, eu quero que a estimativa de custo reflita o número de fontes de coleta automatizada, para que eu entenda o impacto de cada fonte adicional no custo total de Glue.

#### Critérios de Aceitação

1. WHEN `data_source_count` é maior que zero, THE Orchestrator SHALL calcular o custo adicional de Glue incluindo: custo de Glue_Crawlers (DPU-horas por execução × execuções por dia × 30 dias × número de fontes), custo de Glue_Jobs (DPU-horas por execução × execuções por dia × 30 dias × número de fontes) e custo de Glue_Connectors por fonte
2. WHEN `data_source_count` é maior que zero, THE Orchestrator SHALL somar o custo adicional de Glue ao custo base de Glue já existente no campo `cost_breakdown_per_service`
3. WHEN `data_source_count` é zero, THE Orchestrator SHALL manter o custo de Glue inalterado em relação ao cálculo base existente

### Requisito 7: Estimativa de Custo para APIs de Exposição de Dados Externos

**User Story:** Como um usuário do Lake House Designer, eu quero que a estimativa de custo inclua os custos de API Gateway e Lambda quando APIs externas são necessárias, para que eu tenha uma visão completa do investimento.

#### Critérios de Aceitação

1. WHEN `external_api_count` é maior que zero, THE Orchestrator SHALL calcular o custo mensal de APIs externas incluindo: custo de requisições do API_Gateway_Externo, custo de invocações e duração das funções Lambda_Servico_Dados e custo de transferência de dados de saída (data transfer out)
2. WHEN `external_api_count` é maior que zero, THE Orchestrator SHALL incluir "API Gateway (External)" na lista de serviços do campo `services` da resposta ArchitectureOutput
3. WHEN `external_api_count` é zero, THE Orchestrator SHALL atribuir custo zero para APIs externas no campo `cost_breakdown_per_service` e não incluir "API Gateway (External)" na lista de serviços
4. THE Orchestrator SHALL incluir o custo de APIs externas como uma entrada separada com a chave "API Gateway (External)" no campo `cost_breakdown_per_service` da resposta ArchitectureOutput

### Requisito 8: Atualização do Diagrama Mermaid

**User Story:** Como um usuário do Lake House Designer, eu quero que o diagrama de arquitetura reflita os novos serviços quando habilitados, para que eu visualize o fluxo completo de dados incluindo DMS, fontes de coleta e APIs externas.

#### Critérios de Aceitação

1. WHEN `dms_cdc_enabled` é `true`, THE Orchestrator SHALL incluir no Diagrama_Mermaid os nós representando os bancos de dados relacionais de origem, a Instancia_Replicacao_DMS e o fluxo de dados do DMS para o S3 Raw
2. WHEN `data_source_count` é maior que zero, THE Orchestrator SHALL incluir no Diagrama_Mermaid um nó representando as fontes de coleta automatizada conectadas ao Glue ETL
3. WHEN `external_api_count` é maior que zero, THE Orchestrator SHALL incluir no Diagrama_Mermaid os nós representando o API_Gateway_Externo e as funções Lambda_Servico_Dados conectadas ao data lake (S3 Curated ou Athena)
4. WHEN nenhum dos novos parâmetros está ativo (DMS CDC desabilitado, fontes de coleta = 0, APIs externas = 0), THE Orchestrator SHALL gerar o Diagrama_Mermaid idêntico ao formato atual sem alterações

### Requisito 9: Atualização dos Passos de Provisionamento

**User Story:** Como um usuário do Lake House Designer, eu quero que os passos de provisionamento incluam instruções para os novos serviços quando habilitados, para que eu saiba como provisionar a infraestrutura completa.

#### Critérios de Aceitação

1. WHEN `dms_cdc_enabled` é `true`, THE Orchestrator SHALL incluir nos passos de provisionamento instruções para: criar a Instancia_Replicacao_DMS, configurar as Tarefas_DMS para cada banco de dados e configurar os endpoints de origem e destino do DMS
2. WHEN `data_source_count` é maior que zero, THE Orchestrator SHALL incluir nos passos de provisionamento instruções para: configurar Glue_Connectors para cada fonte de dados, criar Glue_Crawlers para catalogação e criar Glue_Jobs para processamento ETL
3. WHEN `external_api_count` é maior que zero, THE Orchestrator SHALL incluir nos passos de provisionamento instruções para: criar o API_Gateway_Externo com os endpoints necessários, criar as funções Lambda_Servico_Dados e configurar permissões de acesso ao data lake

### Requisito 10: Compatibilidade com Parâmetros Existentes

**User Story:** Como um usuário do Lake House Designer, eu quero que o sistema continue funcionando corretamente com os parâmetros existentes quando os novos parâmetros não são informados, para que a funcionalidade atual não seja afetada.

#### Critérios de Aceitação

1. WHEN o Backend recebe uma requisição sem os campos `dms_cdc_enabled`, `dms_cdc_db_count`, `data_source_count` e `external_api_count`, THE Orchestrator SHALL tratar os valores como: `dms_cdc_enabled` = false, `data_source_count` = 0 e `external_api_count` = 0
2. WHEN os novos parâmetros possuem valores padrão (DMS CDC desabilitado, fontes = 0, APIs = 0), THE Orchestrator SHALL produzir uma resposta idêntica à resposta gerada pelo sistema antes desta melhoria para os mesmos parâmetros base
3. THE Orchestrator SHALL manter o cálculo de custo existente para S3, Glue (base), Athena, Redshift, QuickSight e Lake Formation inalterado quando os novos parâmetros possuem valores padrão

### Requisito 11: Exibição dos Novos Custos na Tabela

**User Story:** Como um usuário do Lake House Designer, eu quero visualizar os custos dos novos serviços (DMS, Glue adicional, API Gateway External) na tabela de custos, para que eu entenda o impacto de cada componente no custo total.

#### Critérios de Aceitação

1. WHEN o Backend retorna custos para DMS no campo `cost_breakdown_per_service`, THE Tabela_Custo SHALL exibir uma linha com o serviço "DMS" e o respectivo custo mensal formatado em USD
2. WHEN o Backend retorna custos para APIs externas no campo `cost_breakdown_per_service`, THE Tabela_Custo SHALL exibir uma linha com o serviço "API Gateway (External)" e o respectivo custo mensal formatado em USD
3. THE Tabela_Custo SHALL exibir o custo total mensal atualizado (campo `estimated_monthly_cost_usd`) incluindo os custos dos novos serviços na linha de rodapé

### Requisito 12: Parsing e Serialização dos Novos Parâmetros

**User Story:** Como um desenvolvedor, eu quero que o parsing dos novos parâmetros no backend seja robusto e consistente, para que valores inválidos ou ausentes sejam tratados corretamente.

#### Critérios de Aceitação

1. WHEN o Orchestrator recebe o campo `dms_cdc_enabled` como valor booleano, THE Orchestrator SHALL interpretar `true` como CDC habilitado e `false` como CDC desabilitado
2. WHEN o Orchestrator recebe o campo `dms_cdc_db_count` como valor numérico inteiro positivo e `dms_cdc_enabled` é `true`, THE Orchestrator SHALL utilizar o valor para calcular o número de Tarefas_DMS
3. WHEN o Orchestrator recebe o campo `data_source_count` como valor numérico inteiro não-negativo, THE Orchestrator SHALL utilizar o valor para calcular os custos adicionais de Glue
4. WHEN o Orchestrator recebe o campo `external_api_count` como valor numérico inteiro não-negativo, THE Orchestrator SHALL utilizar o valor para calcular os custos de APIs externas
5. IF o Orchestrator recebe valores não-numéricos ou negativos para `dms_cdc_db_count`, `data_source_count` ou `external_api_count`, THEN THE Orchestrator SHALL tratar os valores como 0 e continuar o processamento sem erro
6. FOR ALL combinações válidas de parâmetros de entrada (base + novos), serializar a entrada como JSON e deserializar de volta SHALL produzir valores equivalentes aos originais (propriedade round-trip)
