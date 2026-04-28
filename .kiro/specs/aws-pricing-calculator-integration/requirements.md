# Documento de Requisitos — Integração com AWS Pricing Calculator

## Introdução

O Lake House Designer atualmente calcula custos internamente usando fórmulas hardcoded. Para solicitar créditos à AWS, os usuários precisam de estimativas oficiais criadas no AWS Pricing Calculator — a AWS exige que as estimativas sejam feitas no console do Pricing Calculator.

Esta feature integra o Lake House Designer com a API BCM Pricing Calculator (`bcm-pricing-calculator` no boto3), permitindo a criação programática de estimativas de custo que ficam visíveis no console AWS. Após gerar a arquitetura, o sistema cria automaticamente um Workload Estimate na conta AWS e retorna a URL do console para o usuário.

## Glossário

- **BCM_Pricing_Calculator_API**: API da AWS (serviço `bcm-pricing-calculator` no boto3) que permite criar e gerenciar estimativas de custo programaticamente. Operações principais: `create_workload_estimate` e `batch_create_workload_estimate_usage`.
- **Workload_Estimate**: Recurso criado via BCM_Pricing_Calculator_API que representa uma estimativa de custo para um conjunto de serviços AWS. Possui um `id` único e fica visível no console AWS.
- **Usage_Item**: Item individual de uso de serviço adicionado a um Workload_Estimate via `batch_create_workload_estimate_usage`. Contém `serviceCode`, `usageType`, `operation`, `amount` e `key`.
- **Service_Code_Mapping**: Mapeamento entre os serviços do Lake House Designer (S3, Glue, Athena, etc.) e os códigos de serviço/tipo de uso aceitos pela BCM_Pricing_Calculator_API.
- **Estimate_URL**: URL do console AWS no formato `https://us-east-1.console.aws.amazon.com/costmanagement/home#/pricing-calculator/workload-estimate/{id}` que permite visualizar o Workload_Estimate.
- **OrchestratorFunction**: Função Lambda principal do backend que processa requisições de arquitetura, calcula custos e gera templates CloudFormation.
- **ArchitectureOutput**: Interface TypeScript que define a estrutura de resposta do backend para o frontend.
- **ResultadoArquitetura**: Componente React que exibe os resultados da arquitetura gerada, incluindo custos, diagrama e botões de ação.
- **BotaoPricingCalculator**: Novo componente React que renderiza o botão para abrir o Workload_Estimate no console AWS.
- **Cost_Breakdown**: Dicionário `cost_breakdown_per_service` retornado pelo backend contendo o custo mensal estimado por serviço AWS.

## Requisitos

### Requisito 1: Criação do Workload Estimate via BCM API

**User Story:** Como usuário do Lake House Designer, eu quero que o sistema crie automaticamente uma estimativa no AWS Pricing Calculator após gerar a arquitetura, para que eu possa usar a estimativa oficial ao solicitar créditos à AWS.

#### Critérios de Aceitação

1. WHEN a OrchestratorFunction finaliza o cálculo de custos com sucesso, THE OrchestratorFunction SHALL chamar `create_workload_estimate` na BCM_Pricing_Calculator_API com um nome descritivo e `rateType` apropriado.
2. WHEN o Workload_Estimate é criado com sucesso, THE OrchestratorFunction SHALL chamar `batch_create_workload_estimate_usage` para adicionar Usage_Items correspondentes a cada serviço presente no Cost_Breakdown.
3. THE OrchestratorFunction SHALL gerar o nome do Workload_Estimate no formato `LakeHouse-{architecture_type}-{timestamp_ISO8601}` para identificação no console AWS.
4. WHEN o Workload_Estimate e os Usage_Items são criados com sucesso, THE OrchestratorFunction SHALL construir a Estimate_URL usando o `id` retornado pela API e incluí-la no campo `pricing_calculator_url` da resposta.

### Requisito 2: Mapeamento de Serviços para BCM API

**User Story:** Como usuário do Lake House Designer, eu quero que todos os serviços da minha arquitetura sejam incluídos na estimativa do Pricing Calculator, para que a estimativa oficial reflita o custo total da solução.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL mapear cada serviço presente no Cost_Breakdown para o `serviceCode` e `usageType` correspondente na BCM_Pricing_Calculator_API usando o Service_Code_Mapping.
2. THE Service_Code_Mapping SHALL incluir mapeamentos para os seguintes serviços: S3 (`AmazonS3`/`TimedStorage-ByteHrs`), Glue (`AWSGlue`/`Crawl-DPU-Hour` e `ETL-DPU-Hour`), Athena (`AmazonAthena`/`QueryScanned-Bytes`), Redshift (`AmazonRedshift`/`Node:ra3.xlplus`), DMS (`AWSDatabaseMigrationSvc`/`dms.r5.large`), API Gateway (`AmazonApiGateway`/`ApiGatewayRequest`), Lambda (`AWSLambda`/`Lambda-GB-Second`) e QuickSight (`AmazonQuickSight`/`User:Enterprise`).
3. WHEN um serviço do Cost_Breakdown possui custo igual a zero, THE OrchestratorFunction SHALL omitir o Usage_Item correspondente do Workload_Estimate.
4. THE OrchestratorFunction SHALL calcular o `amount` de cada Usage_Item com base nos parâmetros de entrada da arquitetura e nas premissas de uso definidas no Service_Code_Mapping.

### Requisito 3: Resiliência e Tratamento de Erros da BCM API

**User Story:** Como usuário do Lake House Designer, eu quero que o sistema continue funcionando normalmente mesmo quando a integração com o Pricing Calculator falhar, para que eu não perca a funcionalidade existente.

#### Critérios de Aceitação

1. IF a chamada `create_workload_estimate` falhar por qualquer motivo (permissões insuficientes, serviço indisponível, throttling, erro de rede), THEN THE OrchestratorFunction SHALL registrar o erro no log, definir `pricing_calculator_url` como `null` na resposta e retornar o restante da resposta normalmente.
2. IF a chamada `batch_create_workload_estimate_usage` falhar após a criação do Workload_Estimate, THEN THE OrchestratorFunction SHALL registrar o erro no log, definir `pricing_calculator_url` como `null` na resposta e retornar o restante da resposta normalmente.
3. THE OrchestratorFunction SHALL encapsular todas as chamadas à BCM_Pricing_Calculator_API em um bloco try/except dedicado, separado da lógica principal de geração de arquitetura.
4. WHEN a integração com a BCM_Pricing_Calculator_API falha, THE OrchestratorFunction SHALL manter o tempo de resposta total abaixo do timeout configurado da Lambda (28 segundos), utilizando timeout de conexão de 5 segundos e timeout de leitura de 10 segundos no cliente boto3.

### Requisito 4: Atualização da Interface ArchitectureOutput

**User Story:** Como desenvolvedor do frontend, eu quero que a resposta do backend inclua a URL do Pricing Calculator como campo opcional, para que eu possa exibir o botão de acesso condicionalmente.

#### Critérios de Aceitação

1. THE ArchitectureOutput SHALL incluir o campo `pricing_calculator_url` do tipo `string` opcional (pode ser `null` ou ausente).
2. WHEN o Workload_Estimate é criado com sucesso, THE OrchestratorFunction SHALL retornar `pricing_calculator_url` com a Estimate_URL válida.
3. WHEN a criação do Workload_Estimate falha ou a permissão não está configurada, THE OrchestratorFunction SHALL retornar `pricing_calculator_url` como `null`.
4. THE ArchitectureOutput SHALL manter todos os campos existentes inalterados (`architecture_type`, `services`, `estimated_monthly_cost_usd`, `cost_breakdown_per_service`, `diagram_mermaid`, `provisioning_steps`, `message`, `cloudformation_template_url`).

### Requisito 5: Botão de Acesso ao Pricing Calculator no Frontend

**User Story:** Como usuário do Lake House Designer, eu quero ver um botão "Ver no AWS Pricing Calculator" nos resultados da arquitetura, para que eu possa abrir a estimativa oficial diretamente no console AWS.

#### Critérios de Aceitação

1. WHEN o campo `pricing_calculator_url` está presente e não é vazio na resposta, THE ResultadoArquitetura SHALL exibir o componente BotaoPricingCalculator com o texto "Ver no AWS Pricing Calculator" em estado ativo.
2. WHEN o campo `pricing_calculator_url` está ausente, é `null` ou é uma string vazia, THE ResultadoArquitetura SHALL exibir o componente BotaoPricingCalculator em estado desabilitado com o texto "Estimativa não disponível".
3. WHEN o usuário clica no BotaoPricingCalculator em estado ativo, THE BotaoPricingCalculator SHALL abrir a Estimate_URL em uma nova aba do navegador.
4. THE BotaoPricingCalculator SHALL ser renderizado na seção de resultados após o botão de download do template CloudFormation.
5. THE BotaoPricingCalculator SHALL seguir o mesmo padrão visual do componente BotaoDownload existente (cores, tamanho, espaçamento).

### Requisito 6: Permissões IAM para BCM Pricing Calculator

**User Story:** Como administrador da infraestrutura, eu quero que as permissões necessárias para a BCM Pricing Calculator API estejam incluídas no template CloudFormation, para que a Lambda possa criar estimativas sem configuração manual adicional.

#### Critérios de Aceitação

1. THE template CloudFormation (template.yaml) SHALL incluir as permissões `bcm-pricing-calculator:CreateWorkloadEstimate` e `bcm-pricing-calculator:BatchCreateWorkloadEstimateUsage` na política IAM da OrchestratorFunction.
2. THE permissão IAM SHALL ser adicionada como uma nova política inline na seção `Policies` da OrchestratorFunction, separada das políticas existentes.
3. THE permissão IAM SHALL restringir o recurso ao escopo `arn:aws:bcm-pricing-calculator:*:${AWS::AccountId}:*` para seguir o princípio de menor privilégio.

### Requisito 7: Compatibilidade Retroativa

**User Story:** Como usuário existente do Lake House Designer, eu quero que toda a funcionalidade atual continue operando normalmente após a adição da integração com o Pricing Calculator, para que minha experiência não seja afetada negativamente.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL continuar retornando todos os campos existentes da resposta (`architecture_type`, `services`, `estimated_monthly_cost_usd`, `cost_breakdown_per_service`, `diagram_mermaid`, `provisioning_steps`, `message`, `cloudformation_template_url`) com os mesmos valores calculados independentemente do resultado da integração com a BCM_Pricing_Calculator_API.
2. WHEN a OrchestratorFunction recebe uma requisição de um cliente que não processa o campo `pricing_calculator_url`, THE resposta SHALL ser compatível (o campo adicional é ignorado por clientes antigos).
3. THE tempo de resposta da OrchestratorFunction SHALL aumentar no máximo 15 segundos em relação ao tempo atual quando a BCM_Pricing_Calculator_API está disponível, e zero segundos adicionais quando a API está indisponível (devido ao tratamento de erro com timeout).

### Requisito 8: Criação do Estimate na Mesma Conta AWS

**User Story:** Como usuário do Lake House Designer, eu quero que a estimativa seja criada na mesma conta AWS onde a Lambda executa, para que eu possa visualizá-la no console da minha conta.

#### Critérios de Aceitação

1. THE OrchestratorFunction SHALL criar o cliente boto3 para `bcm-pricing-calculator` sem especificar região ou credenciais explícitas, utilizando as credenciais da role de execução da Lambda.
2. THE Estimate_URL SHALL usar a região `us-east-1` no path do console, pois a BCM_Pricing_Calculator_API opera globalmente a partir dessa região.

### Requisito 9: Serialização e Parsing da Estimate URL

**User Story:** Como desenvolvedor, eu quero que a URL do Pricing Calculator seja serializada e parseada corretamente entre backend e frontend, para garantir integridade dos dados.

#### Critérios de Aceitação

1. FOR ALL Workload_Estimate IDs válidos retornados pela BCM_Pricing_Calculator_API, a Estimate_URL construída pela OrchestratorFunction SHALL seguir o formato `https://us-east-1.console.aws.amazon.com/costmanagement/home#/pricing-calculator/workload-estimate/{id}` (propriedade round-trip: construir URL → extrair ID → reconstruir URL produz resultado idêntico).
2. THE OrchestratorFunction SHALL serializar a Estimate_URL como string JSON válida na resposta.
3. THE frontend SHALL parsear o campo `pricing_calculator_url` da resposta JSON e utilizá-lo diretamente como href para abertura em nova aba.
