# Requirements Document

## Introduction

O Lakehouse Designer V2 é a evolução do MVP existente (Data Lake Architect) para uma experiência profissional, consultiva e enterprise. O sistema atual possui um frontend estático em S3 (React/TypeScript/Vite/Tailwind), API Gateway HTTP API, Lambda Python para geração de arquiteturas, Diagram Spec JSON, renderização Draw.io XML e motor determinístico de custos para S3, Athena e Glue.

A V2 transforma o frontend de formulário único em um wizard multi-etapas com nove passos (Projeto, Fontes de Dados, Ingestão, Storage/Lakehouse, Processamento, Governança, Analytics/Serving, Custos, Resultado), mantém hospedagem estática em S3/CloudFront, e enriquece a integração com o motor de custos e a geração de diagramas. O backend ganha um endpoint `/generate-v2` que aceita o payload expandido e retorna diagrama .drawio em base64, cost breakdown detalhado com assumptions/notes, e warnings de arquitetura. O endpoint existente `/generate-architecture` permanece inalterado para compatibilidade retroativa.

## Glossary

- **Wizard**: Layout de formulário multi-etapas sequencial que coleta parâmetros de arquitetura em nove passos
- **WizardLayout**: Componente React responsável por renderizar navegação lateral, barra de progresso, painel de resumo e conteúdo do passo atual
- **Step**: Uma tela individual dentro do wizard que coleta uma categoria específica de inputs de arquitetura
- **ProgressBar**: Indicador visual mostrando a posição atual do usuário dentro dos passos do wizard
- **SummaryPanel**: Painel lateral exibindo resumo em tempo real das seleções feitas nos passos anteriores
- **StepProject**: Componente do passo Projeto (nome, descrição, região AWS, ambiente, tags)
- **StepSources**: Componente do passo Fontes de Dados (tipos de fonte, volumes, formatos)
- **StepIngestion**: Componente do passo Ingestão (DMS CDC, batch, streaming, frequência)
- **StepStorage**: Componente do passo Storage/Lakehouse (camadas raw/curated/refined, formatos, particionamento)
- **StepProcessing**: Componente do passo Processamento (Glue ETL, Spark, complexidade de queries)
- **StepGovernance**: Componente do passo Governança (Lake Formation, catálogo, controle de acesso)
- **StepAnalytics**: Componente do passo Analytics/Serving (Athena, Redshift, QuickSight, APIs externas)
- **StepCosts**: Componente do passo Custos (região de pricing, preferências de estimativa)
- **StepResult**: Componente do passo Resultado (status, downloads, breakdown, warnings)
- **ResultPage**: A visualização final do wizard exibindo status de geração, preview do diagrama, downloads, cost breakdown e warnings
- **GenerateV2Endpoint**: Endpoint POST `/generate-v2` do backend que aceita o payload expandido do wizard
- **DiagramSpec**: Objeto JSON descrevendo a estrutura do diagrama de arquitetura retornado pelo backend
- **CostBreakdown**: Objeto estruturado contendo monthly_total_usd, breakdown por serviço, assumptions, notes, unit_prices, pricing_location e pricing_api_region
- **ArchitectureWarnings**: Lista de mensagens consultivas sobre a arquitetura gerada (limites, anti-patterns, riscos de custo)
- **ApiClient**: Módulo de serviço do frontend que se comunica com a API backend usando fetch e AbortController
- **JsonViewer**: Componente React que exibe JSON formatado com syntax highlighting e collapse/expand
- **CostBreakdownComponent**: Componente React que renderiza a tabela de custos detalhada com assumptions e notes
- **ArchitectureWarningsComponent**: Componente React que renderiza a lista de warnings com indicadores visuais de severidade
- **WizardPayload**: Interface TypeScript que define a estrutura completa do payload enviado ao GenerateV2Endpoint
- **GenerateV2Response**: Interface TypeScript que define a estrutura da resposta retornada pelo GenerateV2Endpoint

## Requirements

### Requirement 1: Layout Wizard Multi-Etapas

**User Story:** Como um arquiteto de dados, eu quero uma interface wizard com múltiplas etapas, para que eu possa fornecer parâmetros de arquitetura de forma estruturada e guiada sem ser sobrecarregado por um formulário único extenso.

#### Acceptance Criteria

1. THE WizardLayout SHALL renderizar nove passos sequenciais: Projeto, Fontes de Dados, Ingestão, Storage/Lakehouse, Processamento, Governança, Analytics/Serving, Custos, Resultado
2. WHEN o usuário completa um passo obrigatório e clica em "Próximo", THE WizardLayout SHALL avançar para o próximo passo na sequência
3. WHEN o usuário clica em "Voltar", THE WizardLayout SHALL retornar ao passo anterior preservando os dados já preenchidos naquele passo
4. THE WizardLayout SHALL exibir uma ProgressBar indicando a posição atual do passo em relação ao total de nove passos
5. THE WizardLayout SHALL exibir um SummaryPanel lateral mostrando um resumo somente-leitura das seleções feitas nos passos completados
6. WHEN o usuário está no primeiro passo (Projeto), THE WizardLayout SHALL ocultar o botão "Voltar"
7. WHEN o usuário está no passo Resultado, THE WizardLayout SHALL ocultar o botão "Próximo" e exibir o botão "Gerar Arquitetura"
8. THE WizardLayout SHALL renderizar a navegação lateral como sidebar com indicadores visuais distintos para passos completados, passo atual e passos pendentes

### Requirement 2: Componentes de Passo e Validação de Formulário

**User Story:** Como um arquiteto de dados, eu quero que cada etapa do wizard valide meus inputs antes de permitir progressão, para que eu submeta apenas dados válidos ao backend.

#### Acceptance Criteria

1. THE Wizard SHALL implementar cada passo como um componente React separado: StepProject, StepSources, StepIngestion, StepStorage, StepProcessing, StepGovernance, StepAnalytics, StepCosts, StepResult
2. WHEN o usuário clica em "Próximo" em um passo com campos obrigatórios, THE Step SHALL validar todos os campos obrigatórios e exibir mensagens de erro inline para valores inválidos ou ausentes
3. IF a validação falhar em um passo, THEN THE WizardLayout SHALL impedir a navegação para o próximo passo e manter o foco no passo atual
4. WHILE o usuário está preenchendo um passo, THE Step SHALL fornecer feedback em tempo real para validação de campo (formato, intervalo, obrigatoriedade)
5. WHERE um passo possui campos opcionais, THE Step SHALL permitir progressão sem preenchimento dos campos opcionais

### Requirement 3: Passo Projeto (StepProject)

**User Story:** Como um arquiteto de dados, eu quero definir informações básicas do projeto no primeiro passo, para que a arquitetura gerada seja contextualizada com nome, região e ambiente.

#### Acceptance Criteria

1. THE StepProject SHALL exibir campos para: nome do projeto (texto, obrigatório), descrição (texto, opcional), região AWS (seletor com regiões disponíveis, obrigatório) e ambiente (seletor com opções dev/staging/prod, obrigatório)
2. WHEN o usuário seleciona uma região AWS, THE StepProject SHALL armazenar a região selecionada para uso no cálculo de custos e no SummaryPanel
3. IF o campo nome do projeto estiver vazio ao clicar "Próximo", THEN THE StepProject SHALL exibir mensagem de validação "Nome do projeto é obrigatório"
4. THE StepProject SHALL validar que o nome do projeto contém apenas caracteres alfanuméricos, hífens e underscores

### Requirement 4: Passo Fontes de Dados (StepSources)

**User Story:** Como um arquiteto de dados, eu quero especificar as fontes de dados do meu data lake, para que o sistema dimensione corretamente a ingestão e o armazenamento.

#### Acceptance Criteria

1. THE StepSources SHALL exibir campos para: volume total de dados em TB (numérico, obrigatório), quantidade de registros por dia em milhões (numérico, obrigatório), quantidade de fontes de dados (numérico, obrigatório) e formatos de dados predominantes (multi-seletor: CSV, JSON, Parquet, Avro, ORC)
2. WHEN o usuário informa volume de dados, THE StepSources SHALL validar que o valor é um número positivo maior que zero
3. IF o campo volume total estiver vazio ou com valor menor ou igual a zero, THEN THE StepSources SHALL exibir mensagem de validação indicando que o valor deve ser positivo
4. THE StepSources SHALL exibir no SummaryPanel o volume total e a quantidade de fontes informados

### Requirement 5: Passo Ingestão (StepIngestion)

**User Story:** Como um arquiteto de dados, eu quero configurar os mecanismos de ingestão, para que o sistema recomende os serviços AWS adequados para captura de dados.

#### Acceptance Criteria

1. THE StepIngestion SHALL exibir campos para: DMS CDC habilitado (toggle, padrão desabilitado), quantidade de bancos para CDC (numérico, condicional ao toggle), modo de ingestão batch (toggle), modo de ingestão streaming (toggle) e frequência de ingestão (seletor: horária, diária, tempo-real)
2. WHEN o usuário habilita DMS CDC, THE StepIngestion SHALL exibir o campo de quantidade de bancos e torná-lo obrigatório
3. WHEN o usuário desabilita DMS CDC, THE StepIngestion SHALL ocultar o campo de quantidade de bancos e limpar seu valor
4. IF DMS CDC está habilitado e quantidade de bancos é zero ou vazio, THEN THE StepIngestion SHALL exibir mensagem de validação "Informe a quantidade de bancos para CDC"

### Requirement 6: Passo Storage/Lakehouse (StepStorage)

**User Story:** Como um arquiteto de dados, eu quero definir a estratégia de armazenamento em camadas, para que o sistema configure corretamente as zonas do data lake.

#### Acceptance Criteria

1. THE StepStorage SHALL exibir campos para: camadas habilitadas (multi-seletor: Raw, Curated, Refined), formato de armazenamento preferido (seletor: Parquet, ORC, Delta Lake, Iceberg), estratégia de particionamento (seletor: por data, por região, por cliente, customizado) e política de retenção em dias (numérico, padrão 90)
2. THE StepStorage SHALL pré-selecionar as camadas Raw e Curated como padrão
3. WHEN o usuário seleciona formato Delta Lake ou Iceberg, THE StepStorage SHALL exibir nota informativa sobre compatibilidade com Athena e Glue
4. THE StepStorage SHALL validar que pelo menos uma camada está selecionada

### Requirement 7: Passo Processamento (StepProcessing)

**User Story:** Como um arquiteto de dados, eu quero configurar os parâmetros de processamento, para que o sistema dimensione corretamente os recursos de ETL e query.

#### Acceptance Criteria

1. THE StepProcessing SHALL exibir campos para: complexidade média de queries (seletor: low, medium, high), latência máxima de query em segundos (numérico, obrigatório), usuários concorrentes (numérico, obrigatório) e quantidade de APIs externas para exposição de dados (numérico, padrão 0)
2. WHEN o usuário informa latência máxima menor que 1 segundo com complexidade high, THE StepProcessing SHALL exibir warning informativo sobre a necessidade provável de Redshift
3. IF campos obrigatórios estiverem vazios, THEN THE StepProcessing SHALL exibir mensagens de validação inline
4. THE StepProcessing SHALL validar que usuários concorrentes é um número inteiro positivo

### Requirement 8: Passo Governança (StepGovernance)

**User Story:** Como um arquiteto de dados, eu quero definir requisitos de governança, para que o sistema inclua Lake Formation e controles de acesso na arquitetura.

#### Acceptance Criteria

1. THE StepGovernance SHALL exibir campos para: Lake Formation habilitado (toggle, padrão habilitado), catálogo Glue habilitado (toggle, padrão habilitado), controle de acesso por coluna (toggle, padrão desabilitado) e tags de classificação de dados (input de tags, opcional)
2. WHERE Lake Formation está habilitado, THE StepGovernance SHALL incluir Lake Formation na lista de serviços da arquitetura
3. THE StepGovernance SHALL permitir progressão sem alterações (todos os campos possuem valores padrão)

### Requirement 9: Passo Analytics/Serving (StepAnalytics)

**User Story:** Como um arquiteto de dados, eu quero configurar a camada de analytics e serving, para que o sistema recomende os serviços de consulta e visualização adequados.

#### Acceptance Criteria

1. THE StepAnalytics SHALL exibir campos para: Athena habilitado (toggle, padrão habilitado), Redshift habilitado (toggle, padrão desabilitado), quantidade de nós Redshift (numérico, condicional, mínimo 2), QuickSight habilitado (toggle, padrão desabilitado) e APIs externas para exposição (numérico, padrão 0)
2. WHEN o usuário habilita Redshift, THE StepAnalytics SHALL exibir o campo de quantidade de nós com valor mínimo 2
3. WHEN o usuário desabilita Redshift, THE StepAnalytics SHALL ocultar o campo de quantidade de nós e limpar seu valor
4. IF Redshift está habilitado e quantidade de nós é menor que 2, THEN THE StepAnalytics SHALL exibir mensagem de validação "Mínimo de 2 nós Redshift"

### Requirement 10: Passo Custos (StepCosts)

**User Story:** Como um arquiteto de dados, eu quero configurar preferências de estimativa de custo, para que o cálculo utilize a região e os parâmetros corretos de pricing.

#### Acceptance Criteria

1. THE StepCosts SHALL exibir campos para: região de pricing (seletor com regiões AWS, padrão us-east-1), criar estimativa no AWS Pricing Calculator (toggle, padrão desabilitado) e notas adicionais para o relatório de custos (textarea, opcional)
2. THE StepCosts SHALL exibir um resumo prévio dos serviços que serão estimados com base nas seleções dos passos anteriores
3. WHEN o usuário altera a região de pricing, THE StepCosts SHALL atualizar o SummaryPanel com a nova região selecionada
4. THE StepCosts SHALL permitir progressão sem alterações (todos os campos possuem valores padrão)

### Requirement 11: Passo Resultado (StepResult) e Outputs

**User Story:** Como um arquiteto de dados, eu quero visualizar todos os resultados da geração em uma única tela, para que eu tenha uma visão completa da decisão de arquitetura.

#### Acceptance Criteria

1. WHEN a geração é iniciada, THE StepResult SHALL exibir um indicador de status (loading) com barra de progresso e desabilitar submissões repetidas
2. WHEN o backend retorna resposta com sucesso, THE StepResult SHALL exibir: status de sucesso, botão de download do arquivo .drawio, preview do diagrama, CostBreakdownComponent, ArchitectureWarningsComponent, JsonViewer com o DiagramSpec e seção de notes/audit trail
3. THE StepResult SHALL decodificar o conteúdo base64 do campo diagram.content_base64 e disparar download do navegador com o filename do campo diagram.filename ao clicar no botão de download
4. IF o conteúdo do diagrama estiver vazio ou malformado, THEN THE StepResult SHALL exibir mensagem de erro indicando que o diagrama não pôde ser renderizado
5. THE StepResult SHALL organizar as seções de output em hierarquia clara: status, preview do diagrama, ações de download, cost breakdown, warnings, spec JSON e notes/audit trail

### Requirement 12: Componente CostBreakdown

**User Story:** Como um arquiteto de dados, eu quero um breakdown detalhado de custos com assumptions e notes, para que eu entenda a base de pricing e possa comunicar aos stakeholders.

#### Acceptance Criteria

1. WHEN o backend retorna dados de cost_estimate, THE CostBreakdownComponent SHALL exibir o monthly_total_usd em destaque
2. THE CostBreakdownComponent SHALL exibir uma tabela de breakdown por serviço com colunas: nome do serviço, custo mensal em USD e preço unitário utilizado
3. THE CostBreakdownComponent SHALL exibir a lista de assumptions como bullet points legíveis
4. THE CostBreakdownComponent SHALL exibir notes e entradas de audit trail com timestamps quando disponíveis
5. THE CostBreakdownComponent SHALL exibir pricing_location e pricing_api_region utilizados no cálculo
6. THE CostBreakdownComponent SHALL formatar todos os valores monetários no padrão USD com duas casas decimais

### Requirement 13: Componente ArchitectureWarnings

**User Story:** Como um arquiteto de dados, eu quero ver warnings consultivos sobre a arquitetura gerada, para que eu identifique potenciais problemas antes de provisionar.

#### Acceptance Criteria

1. WHEN o backend retorna warnings na resposta, THE ArchitectureWarningsComponent SHALL renderizar cada warning como item de lista com indicador visual
2. THE ArchitectureWarningsComponent SHALL distinguir visualmente níveis de severidade dos warnings usando indicadores coloridos (info, warning, critical)
3. IF o backend retorna zero warnings, THEN THE StepResult SHALL ocultar a seção ArchitectureWarnings completamente

### Requirement 14: Componente JsonViewer

**User Story:** Como um arquiteto de dados, eu quero visualizar o DiagramSpec JSON com formatação e syntax highlighting, para que eu possa inspecionar os detalhes técnicos da arquitetura gerada.

#### Acceptance Criteria

1. THE JsonViewer SHALL renderizar o DiagramSpec JSON com indentação de 2 espaços e syntax highlighting
2. THE JsonViewer SHALL suportar collapse/expand de seções do JSON
3. THE JsonViewer SHALL exibir o JSON dentro de um container com scroll horizontal para linhas longas
4. WHEN o usuário clica em "Copiar JSON", THE JsonViewer SHALL copiar o conteúdo completo para o clipboard do navegador

### Requirement 15: Backend Endpoint /generate-v2

**User Story:** Como aplicação frontend, eu quero um endpoint `/generate-v2` que aceite o payload expandido do wizard, para que o backend processe todos os nove passos de parâmetros e retorne resultados enriquecidos.

#### Acceptance Criteria

1. THE GenerateV2Endpoint SHALL aceitar requisição POST no path `/generate-v2` com corpo JSON contendo campos de todos os nove passos do wizard (WizardPayload)
2. THE GenerateV2Endpoint SHALL retornar resposta JSON contendo: diagram.content_base64 (string), diagram.filename (string), spec_source (string), spec (DiagramSpec JSON), cost_estimate (CostBreakdown) e warnings (ArchitectureWarnings)
3. THE GenerateV2Endpoint SHALL operar independentemente do endpoint existente `/generate-architecture` sem modificar seu comportamento ou contrato
4. WHEN a variável de ambiente do SageMaker Endpoint não estiver configurada, THE GenerateV2Endpoint SHALL utilizar lógica de fallback determinístico para gerar a arquitetura sem erro
5. IF o corpo da requisição falhar na validação de schema, THEN THE GenerateV2Endpoint SHALL retornar HTTP 422 com resposta de erro estruturada listando campos inválidos
6. THE GenerateV2Endpoint SHALL retornar o objeto cost_estimate contendo: monthly_total_usd, breakdown (por serviço), assumptions, notes, unit_prices (preços unitários utilizados), pricing_location e pricing_api_region

### Requirement 16: Motor de Custos Enriquecido

**User Story:** Como um arquiteto de dados, eu quero que o motor de custos retorne informações detalhadas incluindo preços unitários e assumptions, para que eu tenha transparência total sobre como os custos foram calculados.

#### Acceptance Criteria

1. THE GenerateV2Endpoint SHALL calcular custos utilizando preços dinâmicos da AWS Price List API com fallback para preços hardcoded quando a API não estiver disponível
2. THE GenerateV2Endpoint SHALL incluir no cost_estimate.unit_prices um mapeamento de cada serviço para seu preço unitário utilizado no cálculo
3. THE GenerateV2Endpoint SHALL incluir no cost_estimate.assumptions uma lista de premissas utilizadas no cálculo (horas por mês, DPUs por job, GB escaneados por query)
4. THE GenerateV2Endpoint SHALL incluir no cost_estimate.notes entradas de auditoria indicando se preços dinâmicos ou fallback foram utilizados para cada serviço
5. THE GenerateV2Endpoint SHALL incluir no cost_estimate.pricing_location a localização AWS utilizada para consulta de preços (ex: "US East (N. Virginia)")
6. THE GenerateV2Endpoint SHALL incluir no cost_estimate.pricing_api_region a região da API de pricing utilizada (ex: "us-east-1")

### Requirement 17: Design Visual Enterprise

**User Story:** Como um usuário enterprise, eu quero um design visual profissional e sóbrio com hierarquia clara de informações, para que a ferramenta transmita confiança e seja apropriada para ambientes corporativos.

#### Acceptance Criteria

1. THE WizardLayout SHALL utilizar uma paleta de cores sóbria e profissional com variantes de botão primário e secundário
2. THE Wizard SHALL ser responsivo, adaptando layout de desktop (sidebar + conteúdo) para mobile (empilhado) em breakpoints padrão (768px)
3. THE Wizard SHALL exibir estados de loading, error e success com tratamentos visuais distintos para cada estado
4. THE WizardLayout SHALL renderizar cards com bordas sutis, sombras leves e espaçamento consistente
5. THE WizardLayout SHALL não depender de backend para renderizar o shell da UI, navegação do wizard ou inputs de formulário

### Requirement 18: Build Estático e Compatibilidade de Deploy

**User Story:** Como um engenheiro DevOps, eu quero que o frontend V2 permaneça como build estático deployável em S3/CloudFront, para que a infraestrutura e pipeline de deploy existentes continuem funcionando.

#### Acceptance Criteria

1. THE Wizard frontend SHALL produzir build estático via `npm run build` (tsc + vite build) sem dependências de server-side rendering
2. THE Wizard frontend SHALL ler a URL base da API a partir da variável de ambiente VITE_API_BASE_URL em tempo de build
3. THE Wizard frontend SHALL funcionar corretamente quando servido do S3 atrás do CloudFront com roteamento SPA fallback (index.html para 404/403)
4. THE Wizard frontend SHALL gerar apenas arquivos estáticos (HTML, CSS, JS) no build de produção sem necessidade de servidor Node.js em runtime

### Requirement 19: Compatibilidade Retroativa do Backend

**User Story:** Como um consumidor existente da API, eu quero que o endpoint original `/generate-architecture` permaneça inalterado, para que minhas integrações continuem funcionando sem modificação.

#### Acceptance Criteria

1. THE Backend SHALL preservar o endpoint POST `/generate-architecture` existente com seu schema de request e response atual
2. THE Backend SHALL não modificar o comportamento, regras de validação ou formato de resposta do endpoint `/generate-architecture` existente
3. THE GenerateV2Endpoint SHALL ser registrado como rota separada no API Gateway sem afetar a configuração de rotas existente

### Requirement 20: Cliente API do Frontend

**User Story:** Como um desenvolvedor frontend, eu quero que o cliente API suporte o novo endpoint `/generate-v2` com tratamento de erros e timeout, para que o wizard se comunique de forma confiável com o backend.

#### Acceptance Criteria

1. THE ApiClient SHALL expor uma função para chamar o endpoint `/generate-v2` com o WizardPayload completo
2. THE ApiClient SHALL utilizar AbortController com timeout configurável para a requisição generate-v2
3. IF a requisição exceder o timeout, THEN THE ApiClient SHALL lançar erro com mensagem amigável de timeout
4. IF o backend retornar HTTP 422, THEN THE ApiClient SHALL parsear a resposta de erro estruturada e surfacear erros de validação por campo
5. IF ocorrer erro de rede, THEN THE ApiClient SHALL lançar erro com mensagem amigável de conectividade
6. WHEN VITE_API_BASE_URL não estiver configurada, THE ApiClient SHALL exibir erro de configuração claro ao invés de fazer requisições para URL indefinida

### Requirement 21: Configuração de Ambiente

**User Story:** Como um desenvolvedor, eu quero configuração específica por ambiente via arquivos .env, para que eu possa alternar entre backends local, staging e produção sem alterações de código.

#### Acceptance Criteria

1. THE Wizard frontend SHALL utilizar VITE_API_BASE_URL do arquivo .env para construir URLs de requisição à API
2. THE Wizard frontend SHALL fornecer um arquivo .env.example documentando todas as variáveis de ambiente necessárias
3. THE Wizard frontend SHALL incluir um README.md com instruções de instalação, configuração de variáveis de ambiente, execução local e build de produção
4. THE Wizard frontend SHALL incluir um DEPLOY.md com instruções de upload para S3 e configuração do VITE_API_BASE_URL

### Requirement 22: Documentação e Entregáveis

**User Story:** Como um desenvolvedor ou operador, eu quero documentação clara de build e deploy, para que eu possa construir e publicar o frontend V2 de forma autônoma.

#### Acceptance Criteria

1. THE projeto SHALL incluir README.md com comandos: `npm install`, `npm run dev`, `npm run build` e `npm run preview`
2. THE projeto SHALL incluir DEPLOY.md com instruções de: build de produção, upload para S3, configuração de VITE_API_BASE_URL e invalidação de cache CloudFront
3. THE projeto SHALL manter estrutura de componentes organizada com separação clara: App, WizardLayout, StepProject, StepSources, StepIngestion, StepStorage, StepProcessing, StepGovernance, StepAnalytics, StepCosts, StepResult, CostBreakdown, ArchitectureWarnings, JsonViewer
4. THE projeto SHALL incluir lista de validações realizadas com MCPs (aws-documentation, aws-pricing, billing-cost-management)
