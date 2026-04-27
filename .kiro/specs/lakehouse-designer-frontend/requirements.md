# Documento de Requisitos — Lake House Designer Frontend

## Introdução

O Lake House Designer é um sistema interno corporativo que permite aos usuários informar parâmetros de carga de trabalho (volume de dados, latência, concorrência, etc.) e receber uma arquitetura Lake House recomendada na AWS, incluindo estimativa de custo mensal por serviço, diagrama visual e template CloudFormation para provisionamento. Este documento especifica os requisitos do frontend SPA (Single Page Application) construído com React 18+, TypeScript, Vite e Tailwind CSS, que se comunica com um backend serverless existente (API Gateway com autenticação AWS_IAM + Lambda).

## Glossário

- **SPA**: Single Page Application — aplicação web de página única que roda inteiramente no navegador
- **Lake_House_Designer**: O sistema completo (frontend + backend) que gera recomendações de arquitetura Lake House na AWS
- **Frontend**: A aplicação SPA React/TypeScript que roda no navegador do usuário
- **Backend**: O serviço serverless existente composto por API Gateway (AWS_IAM) + Lambda (Python 3.12) + DynamoDB + S3
- **Formulario**: O componente de entrada de dados onde o usuário informa os parâmetros de carga de trabalho
- **Painel_Resultado**: A área da interface que exibe a arquitetura recomendada, custos, diagrama e passos de provisionamento
- **Servico_Credenciais**: O módulo responsável por receber, validar e gerenciar credenciais temporárias AWS informadas manualmente pelo usuário (obtidas via AWS SSO / STS AssumeRole)
- **Modal_Credenciais**: O componente modal/formulário onde o usuário informa suas credenciais temporárias AWS (Access Key ID, Secret Access Key e Session Token)
- **Cliente_API**: O módulo responsável por assinar requisições com AWS Signature V4 e comunicar-se com o backend
- **Renderizador_Mermaid**: O componente que converte texto Mermaid em diagrama visual SVG no navegador
- **Tabela_Custo**: O componente que exibe a estimativa de custo mensal por serviço AWS em formato tabular
- **Botao_Download**: O componente que permite ao usuário baixar o template CloudFormation gerado pelo backend
- **ArchitectureInput**: Interface TypeScript que define a estrutura dos parâmetros de entrada do formulário
- **ArchitectureOutput**: Interface TypeScript que define a estrutura da resposta retornada pelo backend
- **AwsCredentialsInput**: Interface TypeScript que define a estrutura das credenciais AWS informadas pelo usuário (accessKeyId, secretAccessKey, sessionToken)
- **SigV4**: AWS Signature Version 4 — protocolo de assinatura de requisições HTTP para serviços AWS
- **Role_Assumida**: IAM Role assumida pelo usuário corporativo via AWS SSO ou STS AssumeRole, que concede privilégios administrativos incluindo permissão `execute-api:Invoke`
- **Credenciais_Temporarias**: Conjunto de Access Key ID, Secret Access Key e Session Token com validade limitada, obtidos pelo usuário via AWS SSO ou STS AssumeRole antes de acessar o Frontend

## Requisitos

### Requisito 1: Obtenção de Credenciais AWS via Entrada Manual

**User Story:** Como um usuário corporativo interno que acessa a conta AWS através de uma Role assumida via SSO/STS, eu quero informar minhas credenciais temporárias no frontend, para que eu possa utilizar o sistema de forma segura com minhas permissões administrativas existentes.

#### Critérios de Aceitação

1. WHEN o Frontend é carregado no navegador e Credenciais_Temporarias válidas não existem em localStorage, THE Frontend SHALL exibir o Modal_Credenciais solicitando ao usuário o preenchimento dos campos Access Key ID, Secret Access Key e Session Token
2. WHEN o usuário preenche os três campos do Modal_Credenciais e clica em "Confirmar", THE Servico_Credenciais SHALL validar que os campos Access Key ID, Secret Access Key e Session Token não estão vazios e armazenar as Credenciais_Temporarias em localStorage
3. WHEN Credenciais_Temporarias válidas já existem em localStorage, THE Servico_Credenciais SHALL reutilizar as credenciais existentes sem exibir o Modal_Credenciais
4. WHEN o usuário clica no botão "Alterar Credenciais" disponível no cabeçalho do Frontend, THE Frontend SHALL exibir o Modal_Credenciais preenchido com as credenciais atuais para permitir atualização
5. IF o usuário tenta confirmar o Modal_Credenciais com campos vazios, THEN THE Modal_Credenciais SHALL exibir mensagem de validação indicando que todos os três campos são obrigatórios
6. WHEN o usuário clica em "Limpar Credenciais" no Modal_Credenciais, THE Servico_Credenciais SHALL remover as Credenciais_Temporarias do localStorage e exibir os campos vazios para nova entrada

### Requisito 2: Comunicação com o Backend via API Assinada

**User Story:** Como um usuário corporativo interno, eu quero que todas as requisições ao backend sejam assinadas com AWS Signature V4, para que a comunicação seja autenticada e segura conforme a política de segurança da empresa.

#### Critérios de Aceitação

1. WHEN o Formulario é submetido com dados válidos, THE Cliente_API SHALL construir uma requisição HTTP POST para o endpoint configurado em `VITE_API_URL` com o corpo no formato JSON contendo os campos de ArchitectureInput
2. WHEN uma requisição é enviada ao Backend, THE Cliente_API SHALL assinar a requisição utilizando `SignatureV4` do pacote `@aws-sdk/signature-v4` com o serviço `execute-api`, a região configurada em `VITE_AWS_REGION` e o hash SHA-256 do pacote `@aws-crypto/sha256-js`
3. WHEN o Backend retorna status HTTP 200, THE Cliente_API SHALL deserializar o corpo da resposta JSON em um objeto ArchitectureOutput
4. IF o Backend retorna status HTTP diferente de 200, THEN THE Cliente_API SHALL lançar um erro contendo o código de status e o texto da resposta
5. IF a requisição ao Backend exceder o tempo limite de resposta, THEN THE Cliente_API SHALL lançar um erro de timeout com mensagem descritiva

### Requisito 3: Formulário de Entrada de Parâmetros

**User Story:** Como um usuário corporativo interno, eu quero preencher um formulário com os parâmetros da minha carga de trabalho, para que o sistema gere uma recomendação de arquitetura Lake House adequada.

#### Critérios de Aceitação

1. THE Formulario SHALL exibir os seguintes campos obrigatórios: `data_volume_tb` (campo numérico para terabytes), `records_per_day_millions` (campo numérico para milhões de registros por dia), `avg_query_complexity` (seletor com opções "low", "medium" e "high"), `max_query_latency_sec` (campo numérico para segundos) e `concurrent_users` (campo numérico para usuários simultâneos)
2. WHEN o usuário tenta submeter o Formulario com campos numéricos contendo valores menores ou iguais a zero, THE Formulario SHALL exibir mensagem de validação indicando que o valor deve ser positivo e impedir o envio
3. WHEN o usuário tenta submeter o Formulario com campos obrigatórios vazios, THE Formulario SHALL exibir mensagem de validação indicando que o campo é obrigatório e impedir o envio
4. WHEN o usuário clica no botão "Gerar Arquitetura" com todos os campos válidos, THE Formulario SHALL enviar os dados ao Cliente_API e exibir um indicador de carregamento (loading)
5. WHILE o Cliente_API está processando a requisição, THE Formulario SHALL desabilitar o botão de submissão para evitar envios duplicados

### Requisito 4: Exibição do Tipo de Arquitetura e Serviços Recomendados

**User Story:** Como um usuário corporativo interno, eu quero visualizar o tipo de arquitetura recomendada e a lista de serviços AWS, para que eu entenda qual solução é mais adequada para minha carga de trabalho.

#### Critérios de Aceitação

1. WHEN o Backend retorna uma resposta válida, THE Painel_Resultado SHALL exibir o campo `architecture_type` de forma legível (por exemplo, "Full Lakehouse com Redshift" ou "Light Lakehouse com Athena")
2. WHEN o Backend retorna uma resposta válida, THE Painel_Resultado SHALL exibir a lista de serviços AWS recomendados contida no campo `services`
3. WHEN o Backend retorna uma resposta válida, THE Painel_Resultado SHALL exibir a mensagem informativa contida no campo `message`

### Requisito 5: Tabela de Estimativa de Custo Mensal

**User Story:** Como um usuário corporativo interno, eu quero visualizar uma tabela detalhada com a estimativa de custo mensal por serviço AWS em dólares, para que eu possa avaliar o investimento necessário.

#### Critérios de Aceitação

1. WHEN o Backend retorna uma resposta válida, THE Tabela_Custo SHALL exibir uma tabela com duas colunas: nome do serviço AWS e custo mensal estimado em USD
2. WHEN o Backend retorna uma resposta válida, THE Tabela_Custo SHALL exibir uma linha para cada entrada do campo `cost_breakdown_per_service`
3. WHEN o Backend retorna uma resposta válida, THE Tabela_Custo SHALL exibir o custo total mensal estimado (campo `estimated_monthly_cost_usd`) em uma linha de rodapé ou destaque
4. THE Tabela_Custo SHALL formatar todos os valores monetários no padrão USD com duas casas decimais (por exemplo, "$ 2,790.00")


### Requisito 6: Renderização do Diagrama Mermaid

**User Story:** Como um usuário corporativo interno, eu quero visualizar um diagrama visual da arquitetura recomendada, para que eu compreenda rapidamente o fluxo de dados entre os serviços AWS.

#### Critérios de Aceitação

1. WHEN o Backend retorna uma resposta válida contendo o campo `diagram_mermaid`, THE Renderizador_Mermaid SHALL renderizar o texto Mermaid como um diagrama SVG visível no navegador
2. IF o texto Mermaid retornado pelo Backend for inválido ou vazio, THEN THE Renderizador_Mermaid SHALL exibir uma mensagem informando que o diagrama não pôde ser renderizado
3. WHEN o diagrama é renderizado, THE Renderizador_Mermaid SHALL exibir o diagrama com tamanho adequado para leitura sem necessidade de zoom

### Requisito 7: Passos de Provisionamento e Download do Template

**User Story:** Como um usuário corporativo interno, eu quero visualizar os passos de provisionamento e baixar o template CloudFormation, para que eu possa provisionar a infraestrutura recomendada na minha conta AWS.

#### Critérios de Aceitação

1. WHEN o Backend retorna uma resposta válida, THE Painel_Resultado SHALL exibir a lista ordenada de passos de provisionamento contida no campo `provisioning_steps`
2. WHEN o Backend retorna uma resposta válida contendo o campo `cloudformation_template_url` com uma URL pré-assinada, THE Botao_Download SHALL estar habilitado e permitir o download do template CloudFormation ao ser clicado
3. WHEN o usuário clica no Botao_Download com uma URL válida, THE Botao_Download SHALL abrir a URL pré-assinada do S3 para iniciar o download do arquivo YAML
4. IF o campo `cloudformation_template_url` estiver ausente ou vazio na resposta do Backend, THEN THE Botao_Download SHALL estar desabilitado e exibir um texto indicando que o template não está disponível

### Requisito 8: Tratamento de Erros e Feedback ao Usuário

**User Story:** Como um usuário corporativo interno, eu quero receber mensagens de erro claras e informativas quando algo falhar, para que eu saiba como proceder.

#### Critérios de Aceitação

1. IF Credenciais_Temporarias não estiverem configuradas no localStorage ao tentar enviar o Formulario, THEN THE Frontend SHALL exibir o Modal_Credenciais com a mensagem "Informe suas credenciais AWS para continuar."
2. IF a requisição ao Backend falhar por erro de rede, THEN THE Frontend SHALL exibir uma mensagem de erro informando "Erro de conexão. Verifique sua rede e tente novamente."
3. IF a requisição ao Backend retornar erro de assinatura (status 403), THEN THE Frontend SHALL exibir uma mensagem de erro informando "Erro de autorização. Suas credenciais podem ter expirado ou ser inválidas. Clique em 'Alterar Credenciais' para informar novas credenciais."
4. IF a requisição ao Backend exceder o tempo limite, THEN THE Frontend SHALL exibir uma mensagem de erro informando "A requisição excedeu o tempo limite. Tente novamente."
5. WHEN um erro é exibido ao usuário, THE Frontend SHALL registrar os detalhes técnicos do erro no console do navegador para fins de depuração

### Requisito 9: Layout Responsivo

**User Story:** Como um usuário corporativo interno, eu quero acessar o Lake House Designer em diferentes dispositivos e tamanhos de tela, para que eu possa utilizar o sistema tanto no desktop quanto em dispositivos móveis.

#### Critérios de Aceitação

1. THE Frontend SHALL utilizar Tailwind CSS para estilização e responsividade
2. WHEN o Frontend é exibido em telas com largura igual ou superior a 768px (desktop/tablet), THE Frontend SHALL exibir o Formulario e o Painel_Resultado lado a lado ou em layout de grid otimizado para telas largas
3. WHEN o Frontend é exibido em telas com largura inferior a 768px (mobile), THE Frontend SHALL empilhar o Formulario e o Painel_Resultado verticalmente em coluna única
4. THE Frontend SHALL exibir um cabeçalho com o título "Lake House Designer" visível em todos os tamanhos de tela
5. THE Frontend SHALL exibir um rodapé com uma mensagem de disclaimer informando que as estimativas são aproximadas

### Requisito 10: Tipagem TypeScript e Estrutura do Projeto

**User Story:** Como um desenvolvedor, eu quero que o código do frontend utilize tipagem TypeScript rigorosa e siga uma estrutura de pastas organizada, para que a manutenção e evolução do sistema sejam facilitadas.

#### Critérios de Aceitação

1. THE Frontend SHALL definir a interface `ArchitectureInput` com os campos: `data_volume_tb` (number), `records_per_day_millions` (number), `avg_query_complexity` ("low" | "medium" | "high"), `max_query_latency_sec` (number) e `concurrent_users` (number)
2. THE Frontend SHALL definir a interface `ArchitectureOutput` com os campos: `architecture_type` ("full_lakehouse_with_redshift" | "light_lakehouse_athena"), `services` (string[]), `estimated_monthly_cost_usd` (number), `cost_breakdown_per_service` (Record<string, number>), `diagram_mermaid` (string), `provisioning_steps` (string[]), `message` (string) e `cloudformation_template_url` (string opcional)
3. THE Frontend SHALL definir a interface `AwsCredentialsInput` com os campos: `accessKeyId` (string), `secretAccessKey` (string) e `sessionToken` (string)
4. THE Frontend SHALL organizar o código-fonte na seguinte estrutura de pastas: `src/components/` para componentes React, `src/services/` para módulos de credenciais, cliente API e tipos TypeScript
5. THE Frontend SHALL utilizar React 18+ com TypeScript e Vite como ferramenta de build

### Requisito 11: Configuração de Ambiente e Desenvolvimento Local

**User Story:** Como um desenvolvedor, eu quero que o projeto seja configurável via variáveis de ambiente e possua instruções claras para execução local, para que eu possa desenvolver e testar o frontend de forma independente do backend.

#### Critérios de Aceitação

1. THE Frontend SHALL ler a URL do endpoint da API a partir da variável de ambiente `VITE_API_URL`
2. THE Frontend SHALL ler a região AWS a partir da variável de ambiente `VITE_AWS_REGION`
3. THE Frontend SHALL incluir um arquivo README.md com instruções de instalação (`npm install`), configuração de variáveis de ambiente (`VITE_API_URL` e `VITE_AWS_REGION`), execução local (`npm run dev`) e build de produção (`npm run build`)
4. THE Frontend SHALL incluir no README.md instruções sobre como obter credenciais temporárias via AWS SSO ou STS AssumeRole para uso no Modal_Credenciais
5. THE Frontend SHALL gerar apenas arquivos estáticos (HTML, CSS, JS) no build de produção, sem necessidade de servidor Node.js em runtime
