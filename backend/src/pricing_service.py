import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import boto3

logger = logging.getLogger(__name__)

# Cache em nível de módulo (persiste entre invocações warm)
_price_cache: dict = {}
_cache_timestamp: float = 0.0
CACHE_TTL_SECONDS: int = 86400  # 24 horas

# Preços fallback (valores hardcoded atuais)
FALLBACK_PRICES: dict = {
    's3': 0.023,
    'glue': 0.44,
    'athena': 5.0,
    'redshift': 1.0833,
    'dms': 0.176,
    'api_gateway': 3.50,
    'quicksight': 18.0,
}

# Mapeamento de serviços para filtros da Pricing API
PRICING_CONFIG: dict = {
    's3': {
        'ServiceCode': 'AmazonS3',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'USE1-TimedStorage-ByteHrs'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'glue': {
        'ServiceCode': 'AWSGlue',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'USE1-Crawler-DPU-Hour'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'athena': {
        'ServiceCode': 'AmazonAthena',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'USE1-DataScannedInTB'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'redshift': {
        'ServiceCode': 'AmazonRedshift',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'CS:ra3.xlplus'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'dms': {
        'ServiceCode': 'AWSDatabaseMigrationSvc',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'InstanceUsg:dms.r5.large'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'api_gateway': {
        'ServiceCode': 'AmazonApiGateway',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'USE1-ApiGatewayRequest'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
    'quicksight': {
        'ServiceCode': 'AmazonQuickSight',
        'filters': [
            {'Type': 'TERM_MATCH', 'Field': 'usagetype', 'Value': 'USE1-User:Enterprise'},
            {'Type': 'TERM_MATCH', 'Field': 'location', 'Value': 'US East (N. Virginia)'},
        ],
    },
}


def _create_pricing_client():
    return boto3.client('pricing', region_name='us-east-1')


def fetch_price(pricing_client, service_code, filters):
    """Busca preço unitário USD via get_products(). Retorna None se falhar."""
    try:
        response = pricing_client.get_products(
            ServiceCode=service_code,
            Filters=filters,
            FormatVersion='aws_v1',
            MaxResults=10,
        )
        for price_item_json in response.get('PriceList', []):
            price_item = json.loads(price_item_json)
            terms = price_item.get('terms', {}).get('OnDemand', {})
            for term_value in terms.values():
                for dim_value in term_value.get('priceDimensions', {}).values():
                    usd = dim_value.get('pricePerUnit', {}).get('USD')
                    if usd:
                        price = float(usd)
                        if price > 0:
                            return price
        return None
    except Exception as e:
        logger.warning("Erro ao buscar preço para %s: %s", service_code, str(e))
        return None


def load_all_prices():
    """Busca preços de todos os 7 serviços em paralelo. Fallback individual por serviço."""
    start_time = time.time()
    pricing_client = _create_pricing_client()
    prices = dict(FALLBACK_PRICES)
    fallback_services = []

    def _fetch_one(service_key):
        config = PRICING_CONFIG[service_key]
        price = fetch_price(pricing_client, config['ServiceCode'], config['filters'])
        return service_key, price

    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = {executor.submit(_fetch_one, key): key for key in PRICING_CONFIG}
        for future in as_completed(futures):
            service_key, price = future.result()
            if price is not None:
                prices[service_key] = price
            else:
                fallback_services.append(service_key)

    elapsed_ms = (time.time() - start_time) * 1000
    if fallback_services:
        logger.warning("Preços fallback utilizados para: %s", ', '.join(fallback_services))
    else:
        logger.info("Preços dinâmicos carregados para %d serviços em %.0fms", len(PRICING_CONFIG), elapsed_ms)

    return prices


def get_prices():
    """Retorna preços cacheados ou busca novos se TTL expirou."""
    global _price_cache, _cache_timestamp

    now = time.time()
    if _price_cache and (now - _cache_timestamp) < CACHE_TTL_SECONDS:
        remaining_min = (CACHE_TTL_SECONDS - (now - _cache_timestamp)) / 60
        logger.debug("Cache hit de preços. TTL restante: %.0f minutos", remaining_min)
        return dict(_price_cache)

    _price_cache = load_all_prices()
    _cache_timestamp = now
    return dict(_price_cache)
