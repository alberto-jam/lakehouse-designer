Você é o Kiro atuando como engenheiro full-stack AWS/React/Python.

Contexto:
Existe uma V1 funcional de um MVP chamado Data Lake Architect MVP. A aplicação possui:
- Frontend estático hospedado em S3.
- API Gateway HTTP API.
- Lambda Python que recebe inputs de arquitetura de Data Lake AWS.
- Geração de Diagram Spec JSON.
- Renderização para arquivo Draw.io XML.
- Motor determinístico inicial de custos para S3, Athena e Glue.

Objetivo da V2:
Evoluir o frontend para um layout profissional, consultivo e enterprise, mantendo hospedagem como site estático no S3, e melhorar a integração com o motor de custos e a geração de diagramas.

MCPs disponíveis:
- awslabs-aws-documentation-mcp-server
- awslabs.billing-cost-management-mcp-server
- awslabs.aws-pricing-mcp-server

Use os MCPs sempre que precisar validar:
- APIs e parâmetros AWS.
- Boas práticas de arquitetura AWS.
- Pricing por região.
- Filtros do AWS Price List API.
- Custos reais e recursos de Billing/Cost Management.

Requisitos de frontend:
1. Criar uma interface profissional em Vite + React + TypeScript.
2. Usar layout em wizard com etapas:
   - Projeto
   - Fontes de dados
   - Ingestão
   - Storage/Lakehouse
   - Processamento
   - Governança
   - Analytics/Serving
   - Custos
   - Resultado
3. Manter build estático compatível com S3 Static Website/CloudFront.
4. Implementar validações de formulário.
5. Exibir resumo lateral com os principais parâmetros.
6. Exibir resultado com:
   - status da geração
   - download do .drawio
   - Diagram Spec JSON
   - breakdown de custos
   - assumptions
   - notes/audit trail
   - warnings de arquitetura
7. Separar componentes React:
   - App
   - WizardLayout
   - StepProject
   - StepSources
   - StepIngestion
   - StepStorage
   - StepProcessing
   - StepGovernance
   - StepAnalytics
   - StepCosts
   - StepResult
   - CostBreakdown
   - ArchitectureWarnings
   - JsonViewer
8. Criar configuração por ambiente via .env:
   - VITE_API_BASE_URL

Requisitos de UX/UI:
- Visual enterprise.
- Cards claros.
- Navegação lateral por etapas.
- Barra de progresso.
- Botões primários/secundários.
- Estados loading/error/success.
- Layout responsivo.
- Paleta sóbria e profissional.
- Não depender de backend para renderizar a UI.

Requisitos de backend:
1. Preservar compatibilidade com o endpoint POST /generate.
2. Aceitar payload expandido com novos campos do wizard.
3. Retornar:
   - diagram.content_base64
   - diagram.filename
   - spec_source
   - spec
   - cost_estimate
   - warnings
4. Melhorar cost_estimate para incluir:
   - monthly_total_usd
   - breakdown
   - assumptions
   - notes
   - unit prices usados
   - pricing_location
   - pricing API region
5. Não quebrar fallback determinístico quando SageMaker Endpoint não estiver configurado.

Entregáveis esperados:
- Estrutura de projeto atualizada.
- Código React/TypeScript.
- Ajustes no Lambda Python, se necessários.
- README.md com comandos de build/deploy.
- DEPLOY.md com upload para S3 e configuração do VITE_API_BASE_URL.
- Lista de validações feitas com os MCPs.