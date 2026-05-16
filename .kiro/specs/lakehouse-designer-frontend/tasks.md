# Plano de Implementação: Lake House Designer Frontend

## Visão Geral

Implementação incremental do frontend SPA (React 18+ / TypeScript / Vite / Tailwind CSS) para o Lake House Designer, incluindo atualização do backend `template.yaml` com tags AWS obrigatórias. Cada tarefa constrói sobre as anteriores, garantindo que não haja código órfão. O código do frontend será criado no diretório `frontend/`.

## Tarefas

- [x] 1. Atualizar backend/template.yaml com tags AWS obrigatórias
  - Adicionar parâmetros CloudFormation: `TagCliente` (default: FORCEONE), `TagAmbiente` (default: DEV, AllowedValues: DEV/PRD), `TagProjeto` (default: LAKEHOUSE-DESIGNER), `TagAutor` (default: ALBERTO MOREIRA)
  - Aplicar tags `CLIENTE`, `AMBIENTE`, `PROJETO`, `AUTOR` em todos os recursos que suportam tags: `FrontendBucket` (S3), `TemplatesBucket` (S3), `CloudFrontDistribution`, `HistoryTable` (DynamoDB), `TaskTable` (DynamoDB), `OrchestratorFunction` (Lambda), `LakeHouseAPI` (API Gateway), `SnsTopic` (SNS), `High5xxErrorAlarm` e `LambdaErrorAlarm` (CloudWatch Alarms)
  - Utilizar `!Ref` para referenciar os parâmetros de tag em cada recurso
  - _Requisitos: Requisito adicional do usuário (Tags AWS)_

- [x] 2. Scaffolding do projeto frontend com Vite + React + TypeScript + Tailwind CSS
  - [x] 2.1 Inicializar projeto Vite com template React + TypeScript no diretório `frontend/`
    - Criar `package.json` com dependências: `react`, `react-dom`, `@aws-sdk/signature-v4`, `@aws-sdk/protocol-http`, `@aws-crypto/sha256-js`, `mermaid`
    - Criar `package.json` com devDependencies: `typescript`, `@types/react`, `@types/react-dom`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `fast-check`, `jsdom`
    - Criar `tsconfig.json` com configuração strict para React
    - Criar `vite.config.ts` com plugin React
    - _Requisitos: 10.5, 11.5_

  - [x] 2.2 Configurar Tailwind CSS
    - Criar `tailwind.config.js` com content apontando para `./src/**/*.{ts,tsx}`
    - Criar `postcss.config.js` com plugins tailwindcss e autoprefixer
    - Criar `src/index.css` com diretivas `@tailwind base`, `@tailwind components`, `@tailwind utilities`
    - _Requisitos: 9.1_

  - [x] 2.3 Criar arquivos de entrada da aplicação
    - Criar `public/index.html` com meta tags e div root
    - Criar `src/main.tsx` com `ReactDOM.createRoot` renderizando `<App />`
    - Criar `src/App.css` com estilos base mínimos
    - _Requisitos: 10.5_

  - [x] 2.4 Criar arquivo `.env.example` e configuração de ambiente
    - Criar `frontend/.env.example` com `VITE_API_URL=` e `VITE_AWS_REGION=us-east-1`
    - Configurar `vite.config.ts` para suportar variáveis de ambiente `VITE_*`
    - _Requisitos: 11.1, 11.2_

  - [x] 2.5 Configurar Vitest para testes
    - Criar `vitest.config.ts` com environment `jsdom` e globals `true`
    - Criar `src/test-setup.ts` com import de `@testing-library/jest-dom`
    - _Requisitos: 10.5_

- [x] 3. Implementar tipos TypeScript e serviço de credenciais
  - [x] 3.1 Criar `src/services/types.ts` com interfaces TypeScript
    - Definir `ArchitectureInput` com campos: `data_volume_tb`, `records_per_day_millions`, `avg_query_complexity`, `max_query_latency_sec`, `concurrent_users`
    - Definir `ArchitectureOutput` com campos: `architecture_type`, `services`, `estimated_monthly_cost_usd`, `cost_breakdown_per_service`, `diagram_mermaid`, `provisioning_steps`, `message`, `cloudformation_template_url`
    - Definir `AwsCredentialsInput` com campos: `accessKeyId`, `secretAccessKey`, `sessionToken`
    - _Requisitos: 10.1, 10.2, 10.3_

  - [x] 3.2 Criar `src/services/credentialsService.ts`
    - Implementar `getCredentials(): AwsCredentialsInput | null` — lê do localStorage, retorna null se ausente ou JSON inválido
    - Implementar `saveCredentials(creds): boolean` — valida que os 3 campos não são vazios/whitespace, salva no localStorage, retorna true/false
    - Implementar `clearCredentials(): void` — remove do localStorage
    - Implementar `hasCredentials(): boolean` — verifica existência e não-vazio
    - Usar chave `lakehouse_aws_credentials` no localStorage
    - _Requisitos: 1.2, 1.3, 1.5, 1.6_

  - [x]* 3.3 Escrever teste de propriedade para round-trip de credenciais
    - **Propriedade 1: Round-trip de credenciais**
    - Criar `src/services/__tests__/credentialsService.property.test.ts`
    - Para quaisquer 3 strings não-vazias, `saveCredentials` seguido de `getCredentials` deve retornar os mesmos valores
    - Usar `fast-check` com mínimo de 100 iterações
    - **Valida: Requisito 1.2**

  - [x]* 3.4 Escrever teste de propriedade para rejeição de credenciais vazias
    - **Propriedade 2: Rejeição de credenciais vazias ou whitespace**
    - Criar teste no mesmo arquivo `credentialsService.property.test.ts`
    - Para qualquer conjunto onde pelo menos uma string é vazia/whitespace, `saveCredentials` deve retornar false e localStorage não deve ser alterado
    - **Valida: Requisito 1.5**

  - [ ]* 3.5 Escrever testes unitários para credentialsService
    - Criar `src/services/__tests__/credentialsService.test.ts`
    - Testar cenários: salvar e recuperar credenciais válidas, limpar credenciais, hasCredentials retorna false quando vazio, JSON inválido no localStorage retorna null
    - _Requisitos: 1.2, 1.3, 1.5, 1.6_

- [x] 4. Checkpoint — Verificar que tipos e serviço de credenciais estão corretos
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 5. Implementar cliente API com SigV4
  - [x] 5.1 Criar `src/services/apiClient.ts`
    - Implementar `generateArchitecture(payload, credentials): Promise<ArchitectureOutput>`
    - Criar instância de `SignatureV4` com service `execute-api`, região de `VITE_AWS_REGION`, sha256 `Sha256`
    - Construir `HttpRequest` com método POST, hostname/path extraídos de `VITE_API_URL`, body JSON do payload
    - Assinar requisição com `signer.sign(request)`
    - Executar `fetch` com `AbortController` e timeout de 30 segundos
    - Tratar erros: timeout → mensagem descritiva, HTTP 403 → mensagem de autorização, outros HTTP → código + texto, TypeError → erro de conexão
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 5.2 Escrever teste de propriedade para serialização do corpo da requisição
    - **Propriedade 3: Serialização do corpo da requisição preserva ArchitectureInput**
    - Criar `src/services/__tests__/apiClient.property.test.ts`
    - Para qualquer `ArchitectureInput` válido, o corpo JSON da requisição deve conter todos os campos com os mesmos valores
    - **Valida: Requisito 2.1**

  - [ ]* 5.3 Escrever teste de propriedade para deserialização da resposta
    - **Propriedade 4: Deserialização da resposta preserva ArchitectureOutput**
    - Para qualquer `ArchitectureOutput` válido serializado como JSON, a deserialização deve produzir objeto equivalente
    - **Valida: Requisito 2.3**

  - [ ]* 5.4 Escrever teste de propriedade para erros HTTP
    - **Propriedade 5: Erros HTTP contêm código de status e texto**
    - Para qualquer código de status diferente de 200 e qualquer texto de resposta, o erro lançado deve conter o código e o texto
    - **Valida: Requisito 2.4**

  - [ ]* 5.5 Escrever testes unitários para apiClient
    - Criar `src/services/__tests__/apiClient.test.ts`
    - Testar cenários: resposta 200 válida, erro 403, timeout, erro de rede (TypeError)
    - Usar mocks para `fetch` e `SignatureV4`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Checkpoint — Verificar que serviços (credenciais + API client) estão corretos
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 7. Implementar componentes de layout (Header e Footer)
  - [x] 7.1 Criar `src/components/Header.tsx`
    - Exibir título "Lake House Designer"
    - Botão "Alterar Credenciais" que chama prop `onOpenCredentials`
    - Estilização com Tailwind CSS, responsivo
    - _Requisitos: 9.4, 1.4_

  - [x] 7.2 Criar `src/components/Footer.tsx`
    - Exibir disclaimer: "As estimativas de custo são aproximadas e podem variar conforme o uso real dos serviços AWS."
    - Estilização com Tailwind CSS
    - _Requisitos: 9.5_

  - [ ]* 7.3 Escrever testes unitários para Header e Footer
    - Criar `src/components/__tests__/Header.test.tsx` e `src/components/__tests__/Footer.test.tsx`
    - Testar: Header exibe título e botão funciona; Footer exibe texto de disclaimer
    - _Requisitos: 9.4, 9.5_

- [x] 8. Implementar ModalCredenciais
  - [x] 8.1 Criar `src/components/ModalCredenciais.tsx`
    - Receber props: `isOpen`, `onClose`, `onSave`, `onClear`, `initialValues`, `message`
    - Exibir overlay modal com 3 campos: Access Key ID, Secret Access Key, Session Token
    - Validar que nenhum campo está vazio ao clicar "Confirmar"
    - Exibir mensagem de validação inline se campos vazios
    - Preencher campos com `initialValues` quando disponível
    - Botão "Limpar Credenciais" chama `onClear`
    - Botão "Confirmar" chama `onSave` com os valores
    - Estilização com Tailwind CSS, responsivo
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6_

  - [x]* 8.2 Escrever testes unitários para ModalCredenciais
    - Criar `src/components/__tests__/ModalCredenciais.test.tsx`
    - Testar: exibe quando isOpen=true, oculta quando isOpen=false, preenche com initialValues, exibe validação para campos vazios, chama onSave e onClear corretamente
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 1.6_

- [x] 9. Implementar Formulario
  - [x] 9.1 Criar `src/components/Formulario.tsx`
    - Receber props: `onSubmit`, `loading`
    - Renderizar 5 campos com labels em português: "Volume de Dados (TB)", "Registros por Dia (milhões)", "Complexidade de Consulta" (select: low/medium/high), "Latência Máxima (segundos)", "Usuários Simultâneos"
    - Validação: campos numéricos > 0, todos obrigatórios
    - Mensagens de erro inline por campo
    - Botão "Gerar Arquitetura" desabilitado quando `loading === true`
    - Spinner/indicador de carregamento quando loading
    - Estilização com Tailwind CSS, responsivo
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x]* 9.2 Escrever teste de propriedade para validação do formulário
    - **Propriedade 6: Validação do formulário rejeita entrada inválida**
    - Criar `src/components/__tests__/Formulario.property.test.tsx`
    - Para qualquer estado do formulário com pelo menos um campo numérico ≤ 0 ou campo vazio, a submissão deve ser impedida
    - **Valida: Requisitos 3.2, 3.3**

  - [x]* 9.3 Escrever testes unitários para Formulario
    - Criar `src/components/__tests__/Formulario.test.tsx`
    - Testar: renderiza todos os 5 campos, desabilita botão durante loading, exibe validação para campos inválidos, chama onSubmit com dados válidos
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 10. Checkpoint — Verificar que componentes de entrada estão corretos
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 11. Implementar componentes de resultado
  - [x] 11.1 Criar `src/components/TabelaCusto.tsx`
    - Receber props: `costBreakdown` (Record<string, number>), `totalCost` (number)
    - Renderizar tabela HTML com colunas "Serviço" e "Custo Mensal (USD)"
    - Formatar valores com `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
    - Linha de rodapé com custo total em destaque
    - Estilização com Tailwind CSS
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 11.2 Escrever teste de propriedade para renderização da tabela de custos
    - **Propriedade 8: Renderização completa da tabela de custos**
    - Criar `src/components/__tests__/TabelaCusto.property.test.tsx`
    - Para qualquer Record<string, number>, o componente deve renderizar uma linha para cada entrada com nome do serviço e valor formatado em USD
    - **Valida: Requisitos 5.1, 5.2**

  - [ ]* 11.3 Escrever teste de propriedade para formatação monetária
    - **Propriedade 9: Formatação monetária em USD**
    - Para qualquer número não-negativo, a formatação deve produzir string no padrão USD com duas casas decimais
    - **Valida: Requisito 5.4**

  - [x] 11.4 Criar `src/components/DiagramaMermaid.tsx`
    - Receber prop: `chart` (string)
    - Usar `mermaid.render()` via `useEffect` para converter texto Mermaid em SVG
    - Exibir SVG renderizado em container responsivo
    - Se texto inválido ou vazio, exibir "Não foi possível renderizar o diagrama."
    - Inicializar mermaid com `{ startOnLoad: false, theme: 'default' }`
    - _Requisitos: 6.1, 6.2, 6.3_

  - [ ]* 11.5 Escrever testes unitários para DiagramaMermaid
    - Criar `src/components/__tests__/DiagramaMermaid.test.tsx`
    - Testar: exibe mensagem de erro para texto inválido/vazio, chama mermaid.render para texto válido
    - _Requisitos: 6.1, 6.2_

  - [x] 11.6 Criar `src/components/BotaoDownload.tsx`
    - Receber prop: `templateUrl` (string opcional)
    - Se URL presente e não vazia: botão habilitado, abre URL em nova aba via `window.open`
    - Se URL ausente ou vazia: botão desabilitado com texto "Template não disponível"
    - Estilização com Tailwind CSS
    - _Requisitos: 7.2, 7.3, 7.4_

  - [ ]* 11.7 Escrever testes unitários para BotaoDownload
    - Criar `src/components/__tests__/BotaoDownload.test.tsx`
    - Testar: habilitado com URL, desabilitado sem URL, chama window.open ao clicar
    - _Requisitos: 7.2, 7.3, 7.4_

  - [x] 11.8 Criar `src/components/ResultadoArquitetura.tsx`
    - Receber prop: `result` (ArchitectureOutput)
    - Renderizar seções: tipo de arquitetura (formatado legível), lista de serviços, mensagem, TabelaCusto, DiagramaMermaid, passos de provisionamento (lista ordenada), BotaoDownload
    - Formatar `architecture_type`: `full_lakehouse_with_redshift` → "Full Lakehouse com Redshift", `light_lakehouse_athena` → "Light Lakehouse com Athena"
    - Estilização com Tailwind CSS, responsivo
    - _Requisitos: 4.1, 4.2, 4.3, 7.1_

  - [ ]* 11.9 Escrever teste de propriedade para renderização de serviços
    - **Propriedade 7: Renderização completa da lista de serviços**
    - Criar `src/components/__tests__/ResultadoArquitetura.property.test.tsx`
    - Para qualquer array de strings de serviços, o componente deve renderizar todos os nomes no DOM
    - **Valida: Requisito 4.2**

  - [ ]* 11.10 Escrever teste de propriedade para passos de provisionamento
    - **Propriedade 10: Renderização completa e ordenada dos passos de provisionamento**
    - Para qualquer array de strings de passos, o componente deve renderizar todos na mesma ordem
    - **Valida: Requisito 7.1**

  - [x]* 11.11 Escrever testes unitários para ResultadoArquitetura
    - Criar `src/components/__tests__/ResultadoArquitetura.test.tsx`
    - Testar: exibe tipo de arquitetura formatado, lista de serviços, mensagem, tabela de custos, diagrama, passos, botão download
    - _Requisitos: 4.1, 4.2, 4.3, 7.1_

- [x] 12. Checkpoint — Verificar que componentes de resultado estão corretos
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 13. Orquestrar App.tsx e integrar todos os componentes
  - [x] 13.1 Implementar `src/App.tsx`
    - Gerenciar estado: `showCredentialsModal`, `result`, `loading`, `error`, `credentialsMessage`
    - No mount (`useEffect`): verificar se credenciais existem via `hasCredentials()`, se não, abrir modal
    - Implementar `handleSubmit(data: ArchitectureInput)`: verificar credenciais → limpar erro → setar loading → chamar `generateArchitecture` → setar resultado ou erro → desligar loading
    - Implementar `handleCredentialsSave(creds)`: chamar `saveCredentials` → fechar modal
    - Implementar `handleCredentialsClear()`: chamar `clearCredentials` → limpar campos do modal
    - Implementar `handleOpenCredentialsModal()`: abrir modal com credenciais atuais
    - Compor layout: `Header` → `ModalCredenciais` → área de erro → `Formulario` → `ResultadoArquitetura` → `Footer`
    - Layout responsivo com Tailwind CSS: grid/flex para desktop, coluna para mobile
    - _Requisitos: 1.1, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.2, 9.3_

  - [x]* 13.2 Escrever testes de integração para App.tsx
    - Criar `src/__tests__/App.test.tsx`
    - Testar fluxos: app carrega sem credenciais → modal aparece; app carrega com credenciais → formulário visível; submissão com erro 403 → mensagem de erro exibida
    - Usar mocks para apiClient e credentialsService
    - _Requisitos: 1.1, 1.3, 8.1, 8.3_

- [x] 14. Criar README.md com instruções completas
  - Criar `frontend/README.md` em português com seções:
    - Descrição do projeto
    - Pré-requisitos (Node.js 18+, npm)
    - Instalação (`npm install`)
    - Configuração de variáveis de ambiente (`VITE_API_URL`, `VITE_AWS_REGION`) com instruções para copiar `.env.example` para `.env`
    - Execução local (`npm run dev`)
    - Build de produção (`npm run build`) — gera arquivos estáticos em `dist/`
    - Execução de testes (`npm test`)
    - Como obter credenciais temporárias via AWS SSO ou STS AssumeRole
    - Estrutura do projeto
  - _Requisitos: 11.3, 11.4, 11.5_

- [x] 15. Checkpoint final — Verificar integração completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude definidas no documento de design
- Testes unitários validam exemplos específicos e casos de borda
- O código do frontend deve ser criado no diretório `frontend/` do workspace
- As tags AWS (CLIENTE, AMBIENTE, PROJETO, AUTOR) devem ser aplicadas a todos os recursos que suportam tags no `backend/template.yaml`
