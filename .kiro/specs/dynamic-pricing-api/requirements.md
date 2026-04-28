# Documento de Requisitos — API de Precificação Dinâmica (Dynamic Pricing API)

## Introdução

O Lake House Designer atualmente utiliza constantes de preço hardcoded no `orchestrator.py` para calcular estimativas de custo dos serviços AWS (S3, Glue, Athena, Redshift, DMS, API Gateway, QuickSight). Quando a AWS altera seus preços, a aplicação exibe estimativas desatualizadas.

Esta feature introduz um módulo `PricingService` que consulta a AWS Pricing API (`boto3.client('pricing')`) para obter preços on-demand em tempo real, com cache em memória Lambda e fallback para os valores hardcoded atuais em caso de falha.

## Glossário

- **PricingService**: Módulo/classe Python responsável por buscar, cachear e fornecer preços dinâmicos dos serviços AWS
- **AWS_Pricing_API**: API gratuita da AWS (`pricing:GetProducts`) que retorna preços on-demand atuais para qualquer serviço AWS, disponível exclusivamente na região `us-east-1`
- **Cache_Lambda**: Armazenamento em memória no nível do módulo Python que persiste entre invocações warm da Lambda
- **TTL_Cache**: Tempo de vida (Time-To-Live) do cache, após o qual os preços são buscados novamente na API
- **Preço_Fallback**: Valor hardcoded padrão utilizado quando a AWS Pricing API não está disponível
- **OrchestratorFunction**: Função Lambda principal que processa requisições do Lake House Designer
- **Cold_Start**: Primeira invocação de uma instância Lambda, quando o módulo é carregado pela primeira vez
- **Warm_Invocation**: Invocações subsequentes na mesma instância Lambda, onde variáveis de módulo persistem em memória
- **DPU_Hour**: Unidade de processamento de dados do AWS Glue, cobrada por hora

## Requisitos

### Requisito 1: Criação do Módulo PricingService

**User Story:** Como desenvolvedor do Lake House Designer, eu quero um módulo centralizado de precificação, para que todos os cálculos de custo utilizem preços atualizados da AWS.

#### Critérios de Aceitação

1. THE PricingService SHALL fornecer um método para obter o preço unitário on-demand de um serviço AWS a partir de seu código de serviço e tipo de uso
2. THE PricingService SHALL criar o cliente boto3 da AWS_Pricing_API com `region_name='us-east-1'`
3. THE PricingService SHALL utilizar o método `get_products()` da AWS_Pricing_API para buscar dados de preço
4. THE PricingService SHALL extrair o valor numérico em USD do campo `pricePerUnit` da resposta JSON aninhada retornada pela AWS_Pricing_API
5. WHEN a AWS_Pricing_API retorna múltiplos produtos para um filtro, THE PricingService SHALL selecionar o primeiro produto com preço USD válido maior que zero

### Requisito 2: Cache de Preços em Memória Lambda

**User Story:** Como operador da plataforma, eu quero que os preços sejam cacheados em memória Lambda, para que invocações warm não façam chamadas desnecessárias à API.

#### Critérios de Aceitação

1. THE PricingService SHALL armazenar os preços obtidos em uma variável de nível de módulo no Cache_Lambda
2. WHEN uma Warm_Invocation ocorre e o Cache_Lambda contém preços válidos com TTL_Cache não expirado, THE PricingService SHALL retornar os preços do Cache_Lambda sem consultar a AWS_Pricing_API
3. THE PricingService SHALL definir o TTL_Cache como 24 horas a partir do momento da última busca bem-sucedida
4. WHEN o TTL_Cache expira, THE PricingService SHALL buscar novos preços na AWS_Pricing_API na próxima invocação
5. WHEN um Cold_Start ocorre, THE PricingService SHALL buscar preços na AWS_Pricing_API e popular o Cache_Lambda

### Requisito 3: Fallback para Preços Hardcoded

**User Story:** Como operador da plataforma, eu quero que o sistema continue funcionando com preços padrão quando a API falhar, para que a disponibilidade do serviço não seja comprometida.

#### Critérios de Aceitação

1. THE PricingService SHALL manter um dicionário de Preço_Fallback contendo os valores hardcoded atuais para cada serviço: S3 ($0.023/GB), Glue ($0.44/DPU-hora), Athena ($5.00/TB), Redshift ($1.0833/hora por nó), DMS ($0.176/hora), API Gateway ($3.50/milhão de requisições), QuickSight ($18.00/usuário-mês)
2. IF a AWS_Pricing_API retorna um erro ou timeout, THEN THE PricingService SHALL retornar o Preço_Fallback correspondente ao serviço solicitado
3. IF a AWS_Pricing_API retorna uma resposta sem preço USD válido, THEN THE PricingService SHALL retornar o Preço_Fallback correspondente ao serviço solicitado
4. WHEN o PricingService utiliza um Preço_Fallback, THE PricingService SHALL registrar uma mensagem de log no nível WARNING indicando o serviço e o motivo do fallback
5. WHEN o PricingService obtém preços dinâmicos com sucesso, THE PricingService SHALL registrar uma mensagem de log no nível INFO indicando que preços dinâmicos foram carregados

### Requisito 4: Busca Paralela de Preços

**User Story:** Como operador da plataforma, eu quero que as buscas de preço ocorram em paralelo, para que a latência adicional no cold start seja minimizada.

#### Critérios de Aceitação

1. WHEN o PricingService precisa buscar preços de múltiplos serviços, THE PricingService SHALL executar as chamadas `get_products()` de forma concorrente utilizando `concurrent.futures.ThreadPoolExecutor`
2. THE PricingService SHALL buscar preços para os 7 serviços (S3, Glue, Athena, Redshift, DMS, API Gateway, QuickSight) em paralelo em uma única operação de inicialização
3. IF uma chamada individual `get_products()` falha durante a busca paralela, THEN THE PricingService SHALL utilizar o Preço_Fallback para o serviço que falhou sem afetar a busca dos demais serviços

### Requisito 5: Mapeamento de Serviços para a Pricing API

**User Story:** Como desenvolvedor do Lake House Designer, eu quero um mapeamento claro entre os serviços do Lake House e os filtros da Pricing API, para que os preços corretos sejam obtidos.

#### Critérios de Aceitação

1. THE PricingService SHALL utilizar os seguintes filtros para cada serviço na chamada `get_products()`:
   - S3: `ServiceCode='AmazonS3'`, filtro `usagetype='USE1-TimedStorage-ByteHrs'` → preço em $/GB-mês
   - Glue: `ServiceCode='AWSGlue'`, filtro `usagetype='USE1-Crawler-DPU-Hour'` → preço em $/DPU-hora
   - Athena: `ServiceCode='AmazonAthena'`, filtro `usagetype='USE1-DataScannedInTB'` → preço em $/TB
   - Redshift: `ServiceCode='AmazonRedshift'`, filtro `usagetype='CS:ra3.xlplus'` → preço em $/hora por nó
   - DMS: `ServiceCode='AWSDatabaseMigrationSvc'`, filtro `usagetype='InstanceUsg:dms.r5.large'` → preço em $/hora
   - API Gateway: `ServiceCode='AmazonApiGateway'`, filtro `usagetype='USE1-ApiGatewayRequest'` → preço em $/requisição
   - QuickSight: `ServiceCode='AmazonQuickSight'`, filtro `usagetype='USE1-User:Enterprise'` → preço em $/usuário-mês
2. THE PricingService SHALL passar o filtro `location='US East (N. Virginia)'` em todas as chamadas `get_products()` para garantir preços da região us-east-1

### Requisito 6: Substituição de Preços Hardcoded nas Funções de Custo

**User Story:** Como desenvolvedor do Lake House Designer, eu quero que todas as funções de cálculo de custo utilizem preços dinâmicos, para que as estimativas reflitam os preços atuais da AWS.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL substituir a constante `0.023` em `compute_cost_breakdown()` pelo preço dinâmico de S3 obtido do PricingService
2. THE OrchestratorFunction SHALL substituir a constante `0.44` em `compute_cost_breakdown()` e `compute_additional_glue_cost()` pelo preço dinâmico de Glue obtido do PricingService
3. THE OrchestratorFunction SHALL substituir a constante `0.005` (derivada de $5.00/TB) em `compute_cost_breakdown()` pelo preço dinâmico de Athena obtido do PricingService
4. THE OrchestratorFunction SHALL substituir a constante `1.0833` em `compute_cost_breakdown()` pelo preço dinâmico de Redshift obtido do PricingService
5. THE OrchestratorFunction SHALL substituir a constante `0.176` em `compute_dms_cost()` pelo preço dinâmico de DMS obtido do PricingService
6. THE OrchestratorFunction SHALL substituir as constantes `3.50` e `0.0000166667` em `compute_external_api_cost()` pelos preços dinâmicos de API Gateway e Lambda obtidos do PricingService
7. THE OrchestratorFunction SHALL substituir a constante `30.0` (QuickSight) em `compute_cost_breakdown()` pelo preço dinâmico de QuickSight obtido do PricingService

### Requisito 7: Atualização da Função build_usage_items para BCM Calculator

**User Story:** Como desenvolvedor do Lake House Designer, eu quero que a função `build_usage_items()` utilize preços dinâmicos na divisão custo/preço, para que as quantidades de uso enviadas ao BCM Calculator sejam precisas.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL substituir os divisores hardcoded em `build_usage_items()` (0.023, 0.44, 5.0, 1.0833, 0.176, 0.0000035, 18.0) pelos preços dinâmicos correspondentes obtidos do PricingService
2. IF o preço dinâmico de um serviço for zero, THEN THE OrchestratorFunction SHALL utilizar o Preço_Fallback correspondente como divisor para evitar divisão por zero

### Requisito 8: Permissões IAM para a Pricing API

**User Story:** Como operador da plataforma, eu quero que a Lambda tenha permissões para acessar a Pricing API, para que as consultas de preço funcionem em produção.

#### Critérios de Aceitação

1. THE template.yaml SHALL incluir a permissão `pricing:GetProducts` na política IAM da OrchestratorFunction
2. THE template.yaml SHALL incluir a permissão `pricing:DescribeServices` na política IAM da OrchestratorFunction
3. THE template.yaml SHALL restringir as permissões de pricing ao recurso `"*"` conforme exigido pela API (a Pricing API não suporta ARNs de recurso específicos)

### Requisito 9: Compatibilidade Retroativa

**User Story:** Como consumidor da API do Lake House Designer, eu quero que o formato de resposta permaneça idêntico, para que nenhuma alteração no frontend seja necessária.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL manter o mesmo formato de resposta JSON com os campos `architecture_type`, `services`, `estimated_monthly_cost_usd`, `cost_breakdown_per_service`, `diagram_mermaid`, `provisioning_steps`, `cloudformation_template_url`, `pricing_calculator_url` e `message`
2. THE OrchestratorFunction SHALL retornar valores numéricos no campo `cost_breakdown_per_service` com a mesma estrutura de chaves utilizada atualmente
3. WHEN o PricingService utiliza Preço_Fallback para todos os serviços, THE OrchestratorFunction SHALL produzir estimativas de custo idênticas às produzidas pelo sistema antes desta melhoria

### Requisito 10: Observabilidade e Monitoramento

**User Story:** Como operador da plataforma, eu quero visibilidade sobre o uso de preços dinâmicos versus fallback, para que eu possa monitorar a saúde da integração com a Pricing API.

#### Critérios de Aceitação

1. WHEN o PricingService carrega preços dinâmicos com sucesso para todos os serviços, THE PricingService SHALL registrar uma mensagem de log no nível INFO contendo a quantidade de serviços carregados e o tempo total da operação em milissegundos
2. WHEN o PricingService utiliza Preço_Fallback para um ou mais serviços, THE PricingService SHALL registrar uma mensagem de log no nível WARNING contendo a lista de serviços em fallback
3. WHEN o Cache_Lambda é utilizado (hit), THE PricingService SHALL registrar uma mensagem de log no nível DEBUG indicando cache hit e o tempo restante do TTL_Cache em minutos
