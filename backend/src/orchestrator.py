import json
import os
import logging
import boto3
import time
from decimal import Decimal
from datetime import datetime, timedelta
from jinja2 import Template
from botocore.config import Config

logger = logging.getLogger(__name__)

s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.environ['TABLE_NAME']
TEMPLATES_BUCKET = os.environ['TEMPLATES_BUCKET']
table = dynamodb.Table(TABLE_NAME)

BCM_CLIENT_CONFIG = Config(
    connect_timeout=5,
    read_timeout=10,
    retries={'max_attempts': 1}
)

ESTIMATE_URL_TEMPLATE = (
    "https://us-east-1.console.aws.amazon.com/costmanagement/home"
    "#/pricing-calculator/workload-estimate/{id}"
)

SERVICE_CODE_MAPPING = {
    'S3': {'serviceCode': 'AmazonS3', 'usageType': 'TimedStorage-ByteHrs', 'operation': 'StandardStorage'},
    'Glue': {'serviceCode': 'AWSGlue', 'usageType': 'ETL-DPU-Hour', 'operation': 'ETLJob'},
    'Athena': {'serviceCode': 'AmazonAthena', 'usageType': 'QueryScanned-Bytes', 'operation': 'QueryExecution'},
    'Redshift': {'serviceCode': 'AmazonRedshift', 'usageType': 'Node:ra3.xlplus', 'operation': 'RunComputeNode'},
    'DMS': {'serviceCode': 'AWSDatabaseMigrationSvc', 'usageType': 'dms.r5.large', 'operation': 'ReplicateData'},
    'API Gateway (External)': {'serviceCode': 'AmazonApiGateway', 'usageType': 'ApiGatewayRequest', 'operation': 'RestApiRequest'},
    'QuickSight': {'serviceCode': 'AmazonQuickSight', 'usageType': 'User:Enterprise', 'operation': 'EnterpriseUser'},
}


def safe_int(value, default=0):
    """Converte valor para inteiro não-negativo, retornando default se inválido."""
    try:
        return max(int(value), 0)
    except (TypeError, ValueError):
        return default


def lambda_handler(event, context):
    # 1. Parse input
    body = json.loads(event.get('body', '{}'))
    volume_tb = body.get('data_volume_tb', 0)
    records_per_day_millions = body.get('records_per_day_millions', 0)
    query_complexity = body.get('avg_query_complexity', 'medium')
    latency_sec = body.get('max_query_latency_sec', 60)
    concurrent_users = body.get('concurrent_users', 5)
    user_id = event.get('requestContext', {}).get('authorizer', {}).get('principalId', 'anonymous')

    # Novos parâmetros com defaults para compatibilidade retroativa
    dms_cdc_enabled = body.get('dms_cdc_enabled', False)
    dms_cdc_db_count = safe_int(body.get('dms_cdc_db_count', 0)) if dms_cdc_enabled else 0
    data_source_count = safe_int(body.get('data_source_count', 0))
    external_api_count = safe_int(body.get('external_api_count', 0))

    # 2. Decisão
    use_redshift = (volume_tb > 10 or
                    (query_complexity == 'high' and latency_sec < 10 and concurrent_users > 10))

    # 3. Gerar template CFN
    template_url = generate_cloudformation_template(use_redshift, volume_tb, user_id)

    # 4. Estimativa de custo
    cost_breakdown = compute_cost_breakdown(volume_tb, records_per_day_millions, use_redshift)

    # Custos condicionais dos novos serviços
    if dms_cdc_enabled and dms_cdc_db_count > 0:
        cost_breakdown['DMS'] = compute_dms_cost(dms_cdc_db_count)

    if data_source_count > 0:
        cost_breakdown['Glue'] = round(cost_breakdown.get('Glue', 0) + compute_additional_glue_cost(data_source_count), 2)

    if external_api_count > 0:
        cost_breakdown['API Gateway (External)'] = compute_external_api_cost(external_api_count)

    total_cost = sum(cost_breakdown.values())

    # 5. Diagrama Mermaid
    diagram = get_mermaid_diagram(use_redshift, dms_cdc_enabled, data_source_count, external_api_count)

    # 6. Lista de serviços
    services = ['S3', 'Glue', 'LakeFormation', 'Athena']
    if use_redshift:
        services += ['Redshift', 'QuickSight']
    if dms_cdc_enabled and dms_cdc_db_count > 0:
        services.append('DMS')
    if external_api_count > 0:
        services.append('API Gateway (External)')

    # 7. Salvar no DynamoDB
    timestamp = datetime.utcnow().isoformat()
    ttl = int((datetime.utcnow() + timedelta(days=90)).timestamp())
    item = {
        'user_id': user_id,
        'timestamp': timestamp,
        'ttl': ttl,
        'input_params': json.loads(json.dumps(body), parse_float=Decimal),
        'output_architecture': 'full_lakehouse_with_redshift' if use_redshift else 'light_lakehouse_athena',
        'cost_estimate': Decimal(str(round(total_cost, 2))),
        'cost_breakdown': {k: Decimal(str(v)) for k, v in cost_breakdown.items()},
        'template_url': template_url
    }
    table.put_item(Item=item)

    # 8. Criar estimativa no AWS Pricing Calculator (não-bloqueante)
    pricing_calculator_url = create_pricing_calculator_estimate(
        architecture_type=item['output_architecture'],
        cost_breakdown=cost_breakdown,
        input_params=body
    )

    # 9. Resposta final
    response = {
        "architecture_type": item['output_architecture'],
        "services": services,
        "estimated_monthly_cost_usd": round(total_cost, 2),
        "cost_breakdown_per_service": cost_breakdown,
        "diagram_mermaid": diagram,
        "provisioning_steps": get_provisioning_steps(use_redshift, dms_cdc_enabled, data_source_count, external_api_count),
        "cloudformation_template_url": template_url,
        "pricing_calculator_url": pricing_calculator_url,
        "message": "Template CloudFormation gerado e disponível por 1 hora."
    }

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-Content-Sha256',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(response)
    }


def generate_cloudformation_template(use_redshift, volume_tb, user_id):
    if use_redshift:
        base_key = "base/redshift_lakehouse.yaml.j2"
    else:
        base_key = "base/athena_lakehouse.yaml.j2"
    try:
        obj = s3_client.get_object(Bucket=TEMPLATES_BUCKET, Key=base_key)
        template_content = obj['Body'].read().decode('utf-8')
    except Exception:
        template_content = get_fallback_template(use_redshift)
    variables = {
        "project_name": f"lakehouse-{user_id[:8]}-{int(time.time())}",
        "data_volume_tb": volume_tb,
        "redshift_node_type": "ra3.xlplus",
        "redshift_node_count": 2 if volume_tb < 50 else 4,
        "environment": "prod",
        "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
    }
    jinja_template = Template(template_content)
    rendered_yaml = jinja_template.render(**variables)
    key = f"generated/{variables['project_name']}.yaml"
    s3_client.put_object(Bucket=TEMPLATES_BUCKET, Key=key, Body=rendered_yaml.encode('utf-8'), ContentType='text/yaml')
    url = s3_client.generate_presigned_url('get_object', Params={'Bucket': TEMPLATES_BUCKET, 'Key': key}, ExpiresIn=3600)
    return url


def get_fallback_template(use_redshift):
    if use_redshift:
        return """AWSTemplateFormatVersion: 2010-09-09
Description: Lake House with Redshift - Generated by Lake House Designer
Parameters:
  ProjectName:
    Type: String
Resources:
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${ProjectName}-data"
  RedshiftCluster:
    Type: AWS::Redshift::Cluster
    Properties:
      ClusterIdentifier: !Sub "${ProjectName}-redshift"
      NodeType: {{ redshift_node_type }}
      NumberOfNodes: {{ redshift_node_count }}
"""
    else:
        return """AWSTemplateFormatVersion: 2010-09-09
Description: Lake House with Athena - Generated by Lake House Designer
Parameters:
  ProjectName:
    Type: String
Resources:
  S3Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${ProjectName}-data"
  GlueDatabase:
    Type: AWS::Glue::Database
    Properties:
      DatabaseInput:
        Name: !Sub "${ProjectName}_db"
"""


def compute_cost_breakdown(volume_tb, records_per_day_millions, use_redshift):
    cost = {}
    cost['S3'] = round(volume_tb * 1024 * 0.023 + (records_per_day_millions * 1e6 * 30) * 0.0000004, 2)
    cost['Glue'] = round(2 * 30 * 0.44, 2)
    cost['Athena'] = round(200 * 30 * 0.005, 2)
    if use_redshift:
        cost['Redshift'] = round(2 * 2.208 * 24 * 30, 2)
        cost['QuickSight'] = 30.0
    else:
        cost['Redshift'] = 0.0
        cost['QuickSight'] = 0.0
    cost['Lake Formation'] = 0.0
    return cost


def compute_dms_cost(db_count):
    """Custo mensal de AWS DMS CDC.
    - Instância dms.r5.large: $0.192/h × 24h × 30d = ~$138.24
    - Armazenamento logs CDC: 50GB × $0.10/GB = $5.00
    - Overhead por tarefa: ~$10/mês × db_count
    """
    instance_cost = 0.192 * 24 * 30
    storage_cost = 50 * 0.10
    task_cost = db_count * 10.0
    return round(instance_cost + storage_cost + task_cost, 2)


def compute_additional_glue_cost(source_count):
    """Custo adicional de Glue por fonte de coleta automatizada.
    Por fonte:
    - Crawler: 2 DPU × 0.5h × $0.44 × 1 exec/dia × 30d = $13.20
    - Job: 2 DPU × 1h × $0.44 × 1 exec/dia × 30d = $26.40
    Total por fonte: ~$39.60/mês
    """
    crawler_cost = 2 * 0.5 * 0.44 * 1 * 30
    job_cost = 2 * 1.0 * 0.44 * 1 * 30
    return round(source_count * (crawler_cost + job_cost), 2)


def compute_external_api_cost(api_count):
    """Custo mensal de APIs externas (API Gateway + Lambda + Data Transfer).
    Por API (premissa: 1M req/mês):
    - API Gateway: $3.50/1M req
    - Lambda invocações: $0.20/1M
    - Lambda compute (128MB, 200ms): ~$0.42/1M
    - Data Transfer Out: 10GB × $0.09/GB = $0.90
    Total por API: ~$5.02/mês
    """
    api_gw = 3.50
    lambda_invocations = 0.20
    lambda_compute = 1_000_000 * 0.125 * 0.2 * 0.0000166667
    data_transfer = 10 * 0.09
    cost_per_api = api_gw + lambda_invocations + lambda_compute + data_transfer
    return round(api_count * cost_per_api, 2)


def get_mermaid_diagram(use_redshift, dms_enabled=False, source_count=0, api_count=0):
    lines = ["graph TD"]

    if dms_enabled:
        lines.append("    DB[(Bancos Relacionais)] --> DMS[AWS DMS CDC]")
        lines.append("    DMS --> A[S3 Raw]")

    if source_count > 0:
        lines.append("    SRC[Fontes de Dados] --> GLUE_C[Glue Crawlers/Jobs]")
        lines.append("    GLUE_C --> A[S3 Raw]")

    lines.append("    A[S3 Raw] --> B[Glue ETL]")
    lines.append("    B --> C[S3 Curated]")

    if use_redshift:
        lines.append("    C --> D[Redshift]")
        lines.append("    D --> E[QuickSight]")

    lines.append("    C --> F[Athena]")

    if api_count > 0:
        lines.append("    C --> APIGW[API Gateway External]")
        lines.append("    APIGW --> LAMBDA[Lambda Serviço Dados]")

    return "\n".join(lines)


def get_provisioning_steps(use_redshift, dms_enabled=False, source_count=0, api_count=0):
    steps = [
        "1. Fazer upload do template CloudFormation no console AWS ou via CLI",
        "2. Executar `aws cloudformation create-stack --stack-name lakehouse-designer --template-body file://template.yaml`",
        "3. Após criação, configurar Lake Formation com permissões"
    ]
    if use_redshift:
        steps.insert(1, "1b. Verificar cotas de Redshift no console (limite de nós)")

    if dms_enabled:
        steps.append("Configurar instância de replicação DMS (dms.r5.large)")
        steps.append("Criar endpoints de origem (bancos relacionais) e destino (S3) no DMS")
        steps.append("Criar e iniciar tarefas de migração/CDC para cada banco de dados")

    if source_count > 0:
        steps.append("Configurar Glue Connectors para cada fonte de dados adicional")
        steps.append("Criar Glue Crawlers para catalogação automática das fontes")
        steps.append("Criar Glue Jobs para processamento ETL das fontes adicionais")

    if api_count > 0:
        steps.append("Criar API Gateway (REST) para exposição de dados externos")
        steps.append("Criar funções Lambda para servir dados do data lake")
        steps.append("Configurar permissões IAM para acesso Lambda → S3/Athena")

    return steps


# ==================== BCM PRICING CALCULATOR ====================

def build_estimate_name(architecture_type):
    """Gera nome do Workload Estimate compatível com a API ([a-zA-Z0-9-]+, max 64)."""
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%SZ")
    safe_type = architecture_type.replace("_", "-")
    name = f"LakeHouse-{safe_type}-{ts}"
    return name[:64]


def build_estimate_url(workload_estimate_id):
    """Constrói a URL do console AWS para o Workload Estimate."""
    return ESTIMATE_URL_TEMPLATE.format(id=workload_estimate_id)


def build_usage_items(cost_breakdown):
    """Converte cost_breakdown em lista de Usage Items para a BCM API.
    Omite serviços com custo zero ou sem mapeamento."""
    account_id = boto3.client('sts').get_caller_identity()['Account']
    items = []
    for service_name, cost in cost_breakdown.items():
        if cost <= 0:
            continue
        mapping = SERVICE_CODE_MAPPING.get(service_name)
        if not mapping:
            continue
        items.append({
            'serviceCode': mapping['serviceCode'],
            'usageType': mapping['usageType'],
            'operation': mapping['operation'],
            'key': f"LakeHouse-{service_name.replace(' ', '-')}",
            'amount': float(cost),
            'usageAccountId': account_id,
        })
    return items


def create_pricing_calculator_estimate(architecture_type, cost_breakdown, input_params):
    """Cria Workload Estimate na BCM Pricing Calculator.
    Retorna URL do console ou None em caso de falha."""
    try:
        bcm_client = boto3.client(
            'bcm-pricing-calculator',
            region_name='us-east-1',
            config=BCM_CLIENT_CONFIG
        )
        name = build_estimate_name(architecture_type)

        # 1. Criar Workload Estimate
        create_resp = bcm_client.create_workload_estimate(
            name=name,
            rateType='BEFORE_DISCOUNTS'
        )
        estimate_id = create_resp['id']

        # 2. Adicionar Usage Items
        usage_items = build_usage_items(cost_breakdown)
        if usage_items:
            bcm_client.batch_create_workload_estimate_usage(
                workloadEstimateId=estimate_id,
                usage=usage_items
            )

        return build_estimate_url(estimate_id)

    except Exception as e:
        logger.error("Falha ao criar Workload Estimate na BCM Pricing Calculator: %s", str(e))
        return None
