"""Lambda handler for the /generate-v2 endpoint.

Accepts the expanded wizard payload, validates it, determines architecture,
computes cost estimates with unit prices/assumptions/notes, generates diagrams
(Mermaid + .drawio), analyzes warnings, and returns the full enriched response.
"""

import json
import base64
import logging
import os
from datetime import datetime, timezone

from schema_v2 import validate_request, ValidationError
from pricing_service import get_prices, FALLBACK_PRICES
from diagram_generator import generate_mermaid_v2, generate_drawio
from warning_engine import analyze_architecture
from orchestrator import create_pricing_calculator_estimate

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# ==================== CORS Headers ====================

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}


# ==================== Lambda Handler ====================

def lambda_handler(event, context):
    """Handler for POST /generate-v2."""

    # Handle OPTIONS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': '',
        }

    # 1. Parse JSON body
    try:
        body = json.loads(event.get('body', '{}'))
    except (json.JSONDecodeError, TypeError):
        return _error_response(400, 'Invalid JSON body')

    # 2. Validate request schema
    try:
        validated = validate_request(body)
    except ValidationError as e:
        return _validation_error_response(e.errors)

    # 3. Determine architecture (deterministic fallback)
    architecture = decide_architecture(validated)

    # 4. Get prices and compute cost estimate
    prices = get_prices()
    cost_estimate = compute_cost_estimate_v2(validated, architecture, prices)

    # 5. Generate diagrams
    mermaid_src = generate_mermaid_v2(architecture)
    drawio_xml = generate_drawio(architecture, validated['project'])
    drawio_b64 = base64.b64encode(drawio_xml.encode('utf-8')).decode('ascii')
    filename = _build_diagram_filename(validated['project'])

    # 6. Analyze architecture warnings
    warnings = analyze_architecture(validated, architecture, cost_estimate)

    # 7. Build spec
    spec = _build_diagram_spec(architecture)

    # 8. Get provisioning steps
    provisioning_steps = _get_provisioning_steps_v2(validated, architecture)

    # 9. Create AWS Pricing Calculator estimate if requested
    pricing_calculator_url = None
    costs_section = validated.get('costs', {})
    if costs_section.get('create_estimate', False):
        try:
            # Convert V2 cost breakdown to V1 format (service_name -> cost dict)
            cost_breakdown_dict = {}
            for item in cost_estimate.get('breakdown', []):
                service_name = item.get('service', '')
                # Map to the keys expected by build_usage_items
                if 'S3' in service_name:
                    cost_breakdown_dict['S3'] = item['monthly_cost_usd']
                elif 'Glue' in service_name:
                    cost_breakdown_dict['Glue'] = item['monthly_cost_usd']
                elif 'Athena' in service_name:
                    cost_breakdown_dict['Athena'] = item['monthly_cost_usd']
                elif 'Redshift' in service_name:
                    cost_breakdown_dict['Redshift'] = item['monthly_cost_usd']
                elif 'DMS' in service_name:
                    cost_breakdown_dict['DMS'] = item['monthly_cost_usd']
                elif 'API Gateway' in service_name or 'Lambda' in service_name:
                    cost_breakdown_dict['API Gateway (External)'] = item['monthly_cost_usd']
                elif 'QuickSight' in service_name:
                    cost_breakdown_dict['QuickSight'] = item['monthly_cost_usd']

            # Build input_params from the validated request for usage calculation
            input_params = {
                'data_volume_tb': validated.get('sources', {}).get('data_volume_tb', 0),
                'records_per_day_millions': validated.get('sources', {}).get('records_per_day_millions', 0),
                'data_source_count': validated.get('sources', {}).get('data_source_count', 0),
                'dms_cdc_db_count': validated.get('ingestion', {}).get('dms_cdc_db_count', 0),
                'external_api_count': validated.get('analytics', {}).get('external_api_count', 0),
            }

            pricing_calculator_url = create_pricing_calculator_estimate(
                architecture_type=spec.get('architecture_type', 'lakehouse'),
                cost_breakdown=cost_breakdown_dict,
                input_params=input_params,
                prices=prices,
            )
        except Exception as e:
            logger.warning("Failed to create pricing calculator estimate: %s", str(e))

    # 10. Build response
    # 10. Build response
    response = {
        'diagram': {
            'content_base64': drawio_b64,
            'filename': filename,
        },
        'spec_source': 'deterministic',
        'spec': spec,
        'cost_estimate': cost_estimate,
        'warnings': warnings,
        'mermaid_diagram': mermaid_src,
        'provisioning_steps': provisioning_steps,
    }

    if pricing_calculator_url:
        response['pricing_calculator_url'] = pricing_calculator_url

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(response),
    }


# ==================== Architecture Decision ====================

def decide_architecture(request: dict) -> dict:
    """Determine architecture services, connections, and layers based on request.

    Uses deterministic logic to select AWS services based on the wizard inputs.
    Returns a dict with 'services', 'connections', and 'layers' keys.
    """
    services = []
    connections = []

    sources = request.get('sources', {})
    ingestion = request.get('ingestion', {})
    storage = request.get('storage', {})
    processing = request.get('processing', {})
    governance = request.get('governance', {})
    analytics = request.get('analytics', {})

    # --- Layers ---
    layers = [
        {'id': 'sources', 'label': 'Fontes de Dados', 'order': 0},
        {'id': 'ingestion', 'label': 'Ingestão', 'order': 1},
        {'id': 'storage', 'label': 'Storage', 'order': 2},
        {'id': 'processing', 'label': 'Processamento', 'order': 3},
        {'id': 'analytics', 'label': 'Analytics / Consumo', 'order': 4},
        {'id': 'governance', 'label': 'Governança', 'order': 5},
    ]

    # --- Sources layer ---
    data_source_count = sources.get('data_source_count', 0)
    if data_source_count > 0:
        services.append({
            'id': 'data_sources',
            'service': 'DataSources',
            'label': f'Fontes de Dados ({data_source_count})',
            'layer': 'sources',
        })

    dms_cdc_enabled = sources.get('dms_cdc_enabled', False)
    if dms_cdc_enabled:
        services.append({
            'id': 'rds_sources',
            'service': 'RDS',
            'label': 'Bancos Relacionais (CDC)',
            'layer': 'sources',
        })

    # --- Ingestion layer ---
    ingestion_pattern = ingestion.get('ingestion_pattern', 'batch')

    if dms_cdc_enabled:
        services.append({
            'id': 'dms',
            'service': 'DMS',
            'label': 'AWS DMS (CDC)',
            'layer': 'ingestion',
        })
        if 'rds_sources' in [s['id'] for s in services]:
            connections.append({
                'from': 'rds_sources',
                'to': 'dms',
                'label': 'CDC',
                'type': 'data_flow',
            })

    if ingestion_pattern in ('streaming', 'hybrid'):
        services.append({
            'id': 'kinesis',
            'service': 'Kinesis',
            'label': 'Amazon Kinesis',
            'layer': 'ingestion',
        })
        if data_source_count > 0:
            connections.append({
                'from': 'data_sources',
                'to': 'kinesis',
                'label': 'Streaming',
                'type': 'data_flow',
            })

    if ingestion_pattern in ('batch', 'hybrid'):
        services.append({
            'id': 'glue_crawlers',
            'service': 'Glue_Crawlers',
            'label': 'Glue Crawlers',
            'layer': 'ingestion',
        })
        if data_source_count > 0 and 'kinesis' not in [s['id'] for s in services]:
            connections.append({
                'from': 'data_sources',
                'to': 'glue_crawlers',
                'label': 'Batch',
                'type': 'data_flow',
            })

    # --- Storage layer ---
    storage_tiers = storage.get('storage_tiers', ['raw', 'curated'])

    if 'raw' in storage_tiers:
        services.append({
            'id': 's3_raw',
            'service': 'S3_Raw',
            'label': 'S3 Raw',
            'layer': 'storage',
        })
        # Connect ingestion to raw
        if dms_cdc_enabled:
            connections.append({
                'from': 'dms',
                'to': 's3_raw',
                'type': 'data_flow',
            })
        if 'kinesis' in [s['id'] for s in services]:
            connections.append({
                'from': 'kinesis',
                'to': 's3_raw',
                'type': 'data_flow',
            })
        if 'glue_crawlers' in [s['id'] for s in services]:
            connections.append({
                'from': 'glue_crawlers',
                'to': 's3_raw',
                'type': 'data_flow',
            })

    if 'curated' in storage_tiers:
        services.append({
            'id': 's3_curated',
            'service': 'S3_Curated',
            'label': 'S3 Curated',
            'layer': 'storage',
        })

    if 'aggregated' in storage_tiers:
        services.append({
            'id': 's3_aggregated',
            'service': 'S3_Aggregated',
            'label': 'S3 Aggregated',
            'layer': 'storage',
        })

    # --- Processing layer ---
    etl_engine = processing.get('etl_engine', 'glue') if processing else 'glue'

    if etl_engine == 'glue':
        services.append({
            'id': 'glue_etl',
            'service': 'Glue',
            'label': 'AWS Glue ETL',
            'layer': 'processing',
        })
    elif etl_engine == 'emr':
        services.append({
            'id': 'emr',
            'service': 'EMR',
            'label': 'Amazon EMR',
            'layer': 'processing',
        })
    elif etl_engine == 'emr_serverless':
        services.append({
            'id': 'emr_serverless',
            'service': 'EMR_Serverless',
            'label': 'EMR Serverless',
            'layer': 'processing',
        })

    # Connect storage to processing
    if 'raw' in storage_tiers:
        etl_id = 'glue_etl' if etl_engine == 'glue' else ('emr' if etl_engine == 'emr' else 'emr_serverless')
        connections.append({
            'from': 's3_raw',
            'to': etl_id,
            'type': 'data_flow',
        })
        if 'curated' in storage_tiers:
            connections.append({
                'from': etl_id,
                'to': 's3_curated',
                'type': 'data_flow',
            })

    # Glue Data Catalog
    services.append({
        'id': 'glue_catalog',
        'service': 'Glue_Catalog',
        'label': 'Glue Data Catalog',
        'layer': 'processing',
    })

    # --- Analytics layer ---
    query_engine = analytics.get('query_engine', 'athena')
    quicksight_enabled = analytics.get('quicksight_enabled', False)
    external_api_count = analytics.get('external_api_count', 0)

    if query_engine in ('athena', 'both'):
        services.append({
            'id': 'athena',
            'service': 'Athena',
            'label': 'Amazon Athena',
            'layer': 'analytics',
        })
        # Connect curated/raw to Athena
        target_storage = 's3_curated' if 'curated' in storage_tiers else 's3_raw'
        connections.append({
            'from': target_storage,
            'to': 'athena',
            'type': 'data_flow',
        })

    if query_engine in ('redshift', 'both'):
        services.append({
            'id': 'redshift',
            'service': 'Redshift',
            'label': 'Amazon Redshift',
            'layer': 'analytics',
        })
        target_storage = 's3_curated' if 'curated' in storage_tiers else 's3_raw'
        connections.append({
            'from': target_storage,
            'to': 'redshift',
            'type': 'data_flow',
        })

    if quicksight_enabled:
        services.append({
            'id': 'quicksight',
            'service': 'QuickSight',
            'label': 'Amazon QuickSight',
            'layer': 'analytics',
        })
        # Connect query engine to QuickSight
        if query_engine in ('redshift', 'both'):
            connections.append({
                'from': 'redshift',
                'to': 'quicksight',
                'type': 'data_flow',
            })
        elif query_engine == 'athena':
            connections.append({
                'from': 'athena',
                'to': 'quicksight',
                'type': 'data_flow',
            })

    if external_api_count > 0:
        services.append({
            'id': 'api_gateway',
            'service': 'API_Gateway',
            'label': 'API Gateway',
            'layer': 'analytics',
        })
        services.append({
            'id': 'lambda_fn',
            'service': 'Lambda',
            'label': 'AWS Lambda',
            'layer': 'analytics',
        })
        connections.append({
            'from': 'api_gateway',
            'to': 'lambda_fn',
            'type': 'data_flow',
        })
        target_storage = 's3_curated' if 'curated' in storage_tiers else 's3_raw'
        connections.append({
            'from': 'lambda_fn',
            'to': target_storage,
            'label': 'Query',
            'type': 'data_flow',
        })

    # --- Governance layer ---
    lake_formation_enabled = governance.get('lake_formation_enabled', True) if governance else True

    if lake_formation_enabled:
        services.append({
            'id': 'lake_formation',
            'service': 'Lake_Formation',
            'label': 'AWS Lake Formation',
            'layer': 'governance',
        })
        # Control connections from Lake Formation to storage
        for tier_id in ['s3_raw', 's3_curated', 's3_aggregated']:
            if tier_id in [s['id'] for s in services]:
                connections.append({
                    'from': 'lake_formation',
                    'to': tier_id,
                    'type': 'control',
                })

    return {
        'services': services,
        'connections': connections,
        'layers': layers,
    }


# ==================== Cost Estimate ====================

def compute_cost_estimate_v2(request: dict, architecture: dict, prices: dict) -> dict:
    """Compute detailed cost estimate with unit prices, assumptions, notes.

    Returns a dict matching the CostEstimate TypeScript interface:
    - monthly_total_usd
    - breakdown (list of service cost items)
    - assumptions
    - notes
    - unit_prices
    - pricing_location
    - pricing_api_region
    """
    sources = request.get('sources', {})
    analytics = request.get('analytics', {})
    ingestion = request.get('ingestion', {})
    costs_section = request.get('costs', {}) or {}

    volume_tb = sources.get('data_volume_tb', 1)
    records_per_day_millions = sources.get('records_per_day_millions', 1)
    data_source_count = sources.get('data_source_count', 0)
    dms_cdc_enabled = sources.get('dms_cdc_enabled', False)
    dms_cdc_db_count = sources.get('dms_cdc_db_count', 0) if dms_cdc_enabled else 0

    query_engine = analytics.get('query_engine', 'athena')
    redshift_node_count = max(analytics.get('redshift_node_count', 2) or 2, 2)
    quicksight_enabled = analytics.get('quicksight_enabled', False)
    external_api_count = analytics.get('external_api_count', 0)
    concurrent_users = analytics.get('concurrent_users', 5)

    pricing_region = costs_section.get('pricing_region', 'us-east-1')

    # Determine if using fallback or dynamic prices
    is_fallback = (prices == FALLBACK_PRICES)

    # Build breakdown
    breakdown = []
    unit_prices = {}

    # S3 Storage
    s3_gb = volume_tb * 1024
    s3_put_requests = records_per_day_millions * 1e6 * 30
    s3_storage_cost = s3_gb * prices['s3']
    s3_put_cost = s3_put_requests * 0.000005  # $5 per million PUT requests
    s3_total = round(s3_storage_cost + s3_put_cost, 2)
    breakdown.append({
        'service': 'Amazon S3',
        'monthly_cost_usd': s3_total,
        'unit_price': prices['s3'],
        'unit': '$/GB-mês',
        'quantity': s3_gb,
    })
    unit_prices['S3'] = prices['s3']

    # Glue ETL
    glue_dpus = 2
    glue_hours_per_run = 1
    glue_runs_per_day = 1
    glue_monthly_hours = glue_dpus * glue_hours_per_run * glue_runs_per_day * 30
    # Additional Glue for data sources
    if data_source_count > 0:
        crawler_hours = data_source_count * 2 * 0.5 * 30  # 2 DPU × 0.5h × 30 days
        job_hours = data_source_count * 2 * 1.0 * 30  # 2 DPU × 1h × 30 days
        glue_monthly_hours += crawler_hours + job_hours
    glue_cost = round(glue_monthly_hours * prices['glue'], 2)
    breakdown.append({
        'service': 'AWS Glue',
        'monthly_cost_usd': glue_cost,
        'unit_price': prices['glue'],
        'unit': '$/DPU-hora',
        'quantity': glue_monthly_hours,
    })
    unit_prices['Glue'] = prices['glue']

    # Athena
    if query_engine in ('athena', 'both'):
        # Estimate: concurrent_users queries/day × avg 1GB scanned × 30 days
        athena_tb_scanned = (concurrent_users * 1 * 30) / 1024  # GB to TB
        athena_cost = round(athena_tb_scanned * prices['athena'], 2)
        breakdown.append({
            'service': 'Amazon Athena',
            'monthly_cost_usd': athena_cost,
            'unit_price': prices['athena'],
            'unit': '$/TB escaneado',
            'quantity': round(athena_tb_scanned, 4),
        })
        unit_prices['Athena'] = prices['athena']

    # Redshift
    if query_engine in ('redshift', 'both'):
        redshift_hours = redshift_node_count * 24 * 30
        redshift_cost = round(redshift_hours * prices['redshift'], 2)
        breakdown.append({
            'service': 'Amazon Redshift',
            'monthly_cost_usd': redshift_cost,
            'unit_price': prices['redshift'],
            'unit': '$/nó-hora',
            'quantity': redshift_hours,
        })
        unit_prices['Redshift'] = prices['redshift']

    # DMS
    if dms_cdc_enabled and dms_cdc_db_count > 0:
        dms_instance_cost = prices['dms'] * 24 * 30
        dms_storage_cost = 50 * 0.10  # 50GB logs
        dms_task_cost = dms_cdc_db_count * 10.0
        dms_total = round(dms_instance_cost + dms_storage_cost + dms_task_cost, 2)
        breakdown.append({
            'service': 'AWS DMS',
            'monthly_cost_usd': dms_total,
            'unit_price': prices['dms'],
            'unit': '$/hora instância',
            'quantity': 24 * 30,
        })
        unit_prices['DMS'] = prices['dms']

    # QuickSight
    if quicksight_enabled:
        qs_users = max(concurrent_users, 1)
        qs_cost = round(qs_users * prices['quicksight'], 2)
        breakdown.append({
            'service': 'Amazon QuickSight',
            'monthly_cost_usd': qs_cost,
            'unit_price': prices['quicksight'],
            'unit': '$/usuário-mês',
            'quantity': qs_users,
        })
        unit_prices['QuickSight'] = prices['quicksight']

    # API Gateway + Lambda
    if external_api_count > 0:
        api_gw_cost = external_api_count * prices['api_gateway']
        lambda_cost = external_api_count * (0.20 + 0.42)  # invocations + compute per 1M req
        data_transfer = external_api_count * 10 * 0.09  # 10GB × $0.09
        api_total = round(api_gw_cost + lambda_cost + data_transfer, 2)
        breakdown.append({
            'service': 'API Gateway + Lambda',
            'monthly_cost_usd': api_total,
            'unit_price': prices['api_gateway'],
            'unit': '$/milhão requisições',
            'quantity': external_api_count,
        })
        unit_prices['API Gateway'] = prices['api_gateway']

    # Lake Formation (no direct cost)
    breakdown.append({
        'service': 'AWS Lake Formation',
        'monthly_cost_usd': 0.0,
        'unit_price': 0.0,
        'unit': 'sem custo direto',
        'quantity': 1,
    })

    # Calculate total
    monthly_total_usd = round(sum(item['monthly_cost_usd'] for item in breakdown), 2)

    # Assumptions
    assumptions = [
        f'Volume de dados: {volume_tb} TB armazenados no S3',
        f'Registros por dia: {records_per_day_millions} milhões',
        f'Glue ETL: {glue_dpus} DPUs × {glue_hours_per_run}h × {glue_runs_per_day} execução/dia × 30 dias',
        f'Usuários concorrentes: {concurrent_users}',
        'Athena: estimativa de 1 GB escaneado por query por usuário/dia' if query_engine in ('athena', 'both') else None,
        f'Redshift: {redshift_node_count} nós ra3.xlplus × 24h × 30 dias' if query_engine in ('redshift', 'both') else None,
        f'DMS CDC: 1 instância dms.r5.large + 50GB logs + {dms_cdc_db_count} tarefas' if dms_cdc_enabled else None,
        f'APIs externas: {external_api_count} APIs × 1M requisições/mês' if external_api_count > 0 else None,
        'Preços On-Demand sem descontos (Reserved/Savings Plans)',
        '730 horas/mês (24h × 30.4 dias)',
    ]
    assumptions = [a for a in assumptions if a is not None]

    # Notes
    notes = []
    if is_fallback:
        notes.append('Preços fallback (hardcoded) utilizados - AWS Price List API indisponível')
    else:
        notes.append('Preços dinâmicos obtidos da AWS Price List API')

    notes.append(f'Cálculo realizado em: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")}')
    notes.append(f'Região de pricing: {pricing_region}')

    # Pricing location mapping
    region_location_map = {
        'us-east-1': 'US East (N. Virginia)',
        'us-east-2': 'US East (Ohio)',
        'us-west-1': 'US West (N. California)',
        'us-west-2': 'US West (Oregon)',
        'eu-west-1': 'Europe (Ireland)',
        'eu-central-1': 'Europe (Frankfurt)',
        'ap-southeast-1': 'Asia Pacific (Singapore)',
        'ap-northeast-1': 'Asia Pacific (Tokyo)',
        'sa-east-1': 'South America (São Paulo)',
    }
    pricing_location = region_location_map.get(pricing_region, 'US East (N. Virginia)')

    return {
        'monthly_total_usd': monthly_total_usd,
        'breakdown': breakdown,
        'assumptions': assumptions,
        'notes': notes,
        'unit_prices': unit_prices,
        'pricing_location': pricing_location,
        'pricing_api_region': 'us-east-1',
    }


# ==================== Helper Functions ====================

def _build_diagram_filename(project: dict) -> str:
    """Build the .drawio filename from project metadata."""
    project_name = project.get('project_name', 'lakehouse')
    date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    return f'lakehouse-{project_name}-{date_str}.drawio'


def _build_diagram_spec(architecture: dict) -> dict:
    """Build the DiagramSpec object from architecture."""
    services = architecture.get('services', [])

    # Determine architecture type
    service_ids = [s['service'] for s in services]
    if 'Redshift' in service_ids and 'Athena' in service_ids:
        arch_type = 'full_lakehouse_redshift_athena'
    elif 'Redshift' in service_ids:
        arch_type = 'full_lakehouse_with_redshift'
    else:
        arch_type = 'light_lakehouse_athena'

    return {
        'architecture_type': arch_type,
        'services': architecture.get('services', []),
        'connections': architecture.get('connections', []),
        'layers': architecture.get('layers', []),
    }


def _get_provisioning_steps_v2(request: dict, architecture: dict) -> list:
    """Generate provisioning steps based on the architecture."""
    services = architecture.get('services', [])
    service_ids = [s['id'] for s in services]

    sources = request.get('sources', {})
    analytics = request.get('analytics', {})
    governance = request.get('governance', {}) or {}

    steps = [
        'Criar bucket S3 para data lake com estrutura de camadas (raw/curated/aggregated)',
        'Configurar Glue Data Catalog e criar database para o projeto',
        'Criar Glue Crawlers para catalogação automática dos dados',
    ]

    if 'dms' in service_ids:
        steps.append('Configurar instância de replicação AWS DMS (dms.r5.large)')
        steps.append('Criar endpoints de origem (bancos relacionais) e destino (S3) no DMS')
        steps.append('Criar e iniciar tarefas de migração/CDC para cada banco de dados')

    if 'kinesis' in service_ids:
        steps.append('Criar Kinesis Data Stream para ingestão em tempo real')
        steps.append('Configurar Kinesis Firehose para entrega no S3')

    steps.append('Criar Glue Jobs para processamento ETL (raw → curated)')

    if 'emr' in service_ids or 'emr_serverless' in service_ids:
        steps.append('Provisionar cluster EMR ou configurar EMR Serverless para processamento')

    if governance.get('lake_formation_enabled', True):
        steps.append('Configurar AWS Lake Formation com permissões de acesso granular')

    if 'athena' in service_ids:
        steps.append('Configurar Amazon Athena workgroup com limites de scan')

    if 'redshift' in service_ids:
        redshift_nodes = analytics.get('redshift_node_count', 2)
        steps.append(f'Provisionar cluster Amazon Redshift ({redshift_nodes} nós ra3.xlplus)')
        steps.append('Criar Redshift Spectrum external schema apontando para Glue Catalog')

    if 'quicksight' in service_ids:
        steps.append('Configurar Amazon QuickSight com data sources (Athena/Redshift)')

    if 'api_gateway' in service_ids:
        steps.append('Criar API Gateway (REST) para exposição de dados externos')
        steps.append('Criar funções Lambda para servir dados do data lake')
        steps.append('Configurar permissões IAM para acesso Lambda → S3/Athena')

    steps.append('Configurar CloudWatch Alarms e dashboards de monitoramento')
    steps.append('Executar testes de integração e validar pipeline end-to-end')

    return steps


def _error_response(status_code: int, message: str) -> dict:
    """Build an error response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': message}),
    }


def _validation_error_response(errors: list) -> dict:
    """Build a 422 validation error response with CORS headers."""
    return {
        'statusCode': 422,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'error': 'validation_error',
            'message': 'Request body validation failed',
            'fields': errors,
        }),
    }
