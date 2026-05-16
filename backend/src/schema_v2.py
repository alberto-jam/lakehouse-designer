"""Schema validation for the /generate-v2 endpoint.

Validates the expanded wizard payload structure, enforcing required sections,
field types, value ranges, and enum constraints. Returns structured errors
compatible with the ValidationErrorResponse contract (HTTP 422).
"""

import re
from typing import Any


# Valid enum values
VALID_ENVIRONMENTS = {'dev', 'staging', 'prod'}
VALID_INGESTION_PATTERNS = {'batch', 'streaming', 'hybrid'}
VALID_BATCH_FREQUENCIES = {'hourly', 'daily', 'weekly'}
VALID_COMPRESSIONS = {'snappy', 'gzip', 'zstd', 'none'}
VALID_FILE_FORMATS = {'parquet', 'orc', 'iceberg', 'delta'}
VALID_STORAGE_TIERS = {'raw', 'curated', 'refined', 'aggregated'}
VALID_ETL_ENGINES = {'glue', 'emr', 'emr_serverless'}
VALID_QUERY_ENGINES = {'athena', 'redshift', 'both'}
VALID_COMPLEXITIES = {'low', 'medium', 'high'}
VALID_ENCRYPTIONS = {'sse_s3', 'sse_kms', 'cse'}
VALID_SOURCE_TYPES = {'CSV', 'JSON', 'Parquet', 'Avro', 'ORC'}
VALID_PARTITIONING_STRATEGIES = {'date', 'region', 'customer', 'custom'}

# Regex for project name: alphanumeric, hyphens, underscores
PROJECT_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9_-]+$')

# AWS region pattern (e.g., us-east-1, eu-west-2, ap-southeast-1)
AWS_REGION_PATTERN = re.compile(r'^[a-z]{2}-[a-z]+-\d$')

# Required top-level sections
REQUIRED_SECTIONS = ('project', 'sources', 'ingestion', 'storage', 'analytics')


class ValidationError(Exception):
    """Raised when request body validation fails.

    Attributes:
        errors: List of field error dicts with path, message, and code.
    """

    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__(f"Validation failed: {len(errors)} error(s)")


def validate_request(body: dict) -> dict:
    """Validate the /generate-v2 request body.

    Args:
        body: Parsed JSON request body.

    Returns:
        The validated body dict (pass-through on success).

    Raises:
        ValidationError: If one or more validation rules fail.
    """
    errors: list[dict] = []

    # Check required top-level sections
    for section in REQUIRED_SECTIONS:
        if section not in body or not isinstance(body.get(section), dict):
            errors.append({
                'path': section,
                'message': f'Section "{section}" is required and must be an object',
                'code': 'missing_required_section',
            })

    # If required sections are missing, raise immediately
    if errors:
        raise ValidationError(errors)

    # Validate each required section
    errors.extend(_validate_project(body['project']))
    errors.extend(_validate_sources(body['sources']))
    errors.extend(_validate_ingestion(body['ingestion']))
    errors.extend(_validate_storage(body['storage']))
    errors.extend(_validate_analytics(body['analytics']))

    # Validate optional sections if present
    if body.get('processing') and isinstance(body['processing'], dict):
        errors.extend(_validate_processing(body['processing']))

    if body.get('governance') and isinstance(body['governance'], dict):
        errors.extend(_validate_governance(body['governance']))

    if body.get('costs') and isinstance(body['costs'], dict):
        errors.extend(_validate_costs(body['costs']))

    if errors:
        raise ValidationError(errors)

    return body


# ---------------------------------------------------------------------------
# Section validators
# ---------------------------------------------------------------------------


def _validate_project(data: dict) -> list[dict]:
    """Validate the project section fields."""
    errors: list[dict] = []

    # project_name: required string, alphanumeric/hyphens/underscores
    project_name = data.get('project_name')
    if not project_name or not isinstance(project_name, str):
        errors.append({
            'path': 'project.project_name',
            'message': 'Required string field',
            'code': 'required',
        })
    elif not PROJECT_NAME_PATTERN.match(project_name):
        errors.append({
            'path': 'project.project_name',
            'message': 'Must contain only alphanumeric characters, hyphens, and underscores',
            'code': 'invalid_format',
        })

    # environment: required enum
    environment = data.get('environment')
    if environment not in VALID_ENVIRONMENTS:
        errors.append({
            'path': 'project.environment',
            'message': f'Must be one of: {", ".join(sorted(VALID_ENVIRONMENTS))}',
            'code': 'invalid_enum',
        })

    # region: required string matching AWS region pattern
    region = data.get('region')
    if not region or not isinstance(region, str):
        errors.append({
            'path': 'project.region',
            'message': 'Required string field',
            'code': 'required',
        })
    elif not AWS_REGION_PATTERN.match(region):
        errors.append({
            'path': 'project.region',
            'message': 'Must be a valid AWS region (e.g., us-east-1)',
            'code': 'invalid_format',
        })

    # description: optional string (no validation needed beyond type)
    description = data.get('description')
    if description is not None and not isinstance(description, str):
        errors.append({
            'path': 'project.description',
            'message': 'Must be a string if provided',
            'code': 'invalid_type',
        })

    return errors


def _validate_sources(data: dict) -> list[dict]:
    """Validate the sources section fields."""
    errors: list[dict] = []

    # data_volume_tb: required, numeric, > 0
    data_volume_tb = data.get('data_volume_tb')
    if not _is_positive_number(data_volume_tb):
        errors.append({
            'path': 'sources.data_volume_tb',
            'message': 'Must be a number greater than 0',
            'code': 'value_error.number.not_gt',
        })

    # records_per_day_millions: required, numeric, > 0
    records_per_day_millions = data.get('records_per_day_millions')
    if not _is_positive_number(records_per_day_millions):
        errors.append({
            'path': 'sources.records_per_day_millions',
            'message': 'Must be a number greater than 0',
            'code': 'value_error.number.not_gt',
        })

    # data_source_count: required, integer, >= 0
    data_source_count = data.get('data_source_count')
    if not _is_non_negative_int(data_source_count):
        errors.append({
            'path': 'sources.data_source_count',
            'message': 'Must be a non-negative integer',
            'code': 'value_error.integer',
        })

    # source_types: optional list of valid source types
    source_types = data.get('source_types')
    if source_types is not None:
        if not isinstance(source_types, list):
            errors.append({
                'path': 'sources.source_types',
                'message': 'Must be a list',
                'code': 'invalid_type',
            })
        else:
            invalid_types = [t for t in source_types if t not in VALID_SOURCE_TYPES]
            if invalid_types:
                errors.append({
                    'path': 'sources.source_types',
                    'message': f'Invalid source types: {", ".join(invalid_types)}. '
                               f'Valid options: {", ".join(sorted(VALID_SOURCE_TYPES))}',
                    'code': 'invalid_enum',
                })

    # dms_cdc_enabled: boolean
    dms_cdc_enabled = data.get('dms_cdc_enabled')
    if dms_cdc_enabled is not None and not isinstance(dms_cdc_enabled, bool):
        errors.append({
            'path': 'sources.dms_cdc_enabled',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # dms_cdc_db_count: required if dms_cdc_enabled is True, must be > 0
    if dms_cdc_enabled is True:
        dms_cdc_db_count = data.get('dms_cdc_db_count')
        if not _is_positive_int(dms_cdc_db_count):
            errors.append({
                'path': 'sources.dms_cdc_db_count',
                'message': 'Must be a positive integer when DMS CDC is enabled',
                'code': 'value_error.number.not_gt',
            })

    return errors


def _validate_ingestion(data: dict) -> list[dict]:
    """Validate the ingestion section fields."""
    errors: list[dict] = []

    # ingestion_pattern: required enum
    ingestion_pattern = data.get('ingestion_pattern')
    if ingestion_pattern not in VALID_INGESTION_PATTERNS:
        errors.append({
            'path': 'ingestion.ingestion_pattern',
            'message': f'Must be one of: {", ".join(sorted(VALID_INGESTION_PATTERNS))}',
            'code': 'invalid_enum',
        })

    # batch_frequency: conditional - required if ingestion_pattern is 'batch' or 'hybrid'
    if ingestion_pattern in ('batch', 'hybrid'):
        batch_frequency = data.get('batch_frequency')
        if batch_frequency is not None and batch_frequency not in VALID_BATCH_FREQUENCIES:
            errors.append({
                'path': 'ingestion.batch_frequency',
                'message': f'Must be one of: {", ".join(sorted(VALID_BATCH_FREQUENCIES))}',
                'code': 'invalid_enum',
            })

    # streaming_throughput_mbps: conditional - relevant if streaming or hybrid
    if ingestion_pattern in ('streaming', 'hybrid'):
        streaming_throughput = data.get('streaming_throughput_mbps')
        if streaming_throughput is not None:
            if not _is_positive_number(streaming_throughput):
                errors.append({
                    'path': 'ingestion.streaming_throughput_mbps',
                    'message': 'Must be a positive number',
                    'code': 'value_error.number.not_gt',
                })

    # dms_cdc_enabled: optional boolean (also present in ingestion for backward compat)
    dms_cdc_enabled = data.get('dms_cdc_enabled')
    if dms_cdc_enabled is not None and not isinstance(dms_cdc_enabled, bool):
        errors.append({
            'path': 'ingestion.dms_cdc_enabled',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # dms_cdc_db_count: conditional on dms_cdc_enabled in ingestion section
    if dms_cdc_enabled is True:
        dms_cdc_db_count = data.get('dms_cdc_db_count')
        if dms_cdc_db_count is not None and not _is_positive_int(dms_cdc_db_count):
            errors.append({
                'path': 'ingestion.dms_cdc_db_count',
                'message': 'Must be a positive integer when DMS CDC is enabled',
                'code': 'value_error.number.not_gt',
            })

    return errors


def _validate_storage(data: dict) -> list[dict]:
    """Validate the storage section fields."""
    errors: list[dict] = []

    # storage_tiers: required list, at least one tier
    storage_tiers = data.get('storage_tiers')
    if not isinstance(storage_tiers, list) or len(storage_tiers) == 0:
        errors.append({
            'path': 'storage.storage_tiers',
            'message': 'Must be a non-empty list with at least one storage tier',
            'code': 'value_error.list.min_items',
        })
    elif storage_tiers:
        # Normalize to lowercase for comparison
        invalid_tiers = [t for t in storage_tiers
                         if (t.lower() if isinstance(t, str) else t) not in VALID_STORAGE_TIERS]
        if invalid_tiers:
            errors.append({
                'path': 'storage.storage_tiers',
                'message': f'Invalid tiers: {", ".join(str(t) for t in invalid_tiers)}. '
                           f'Valid options: {", ".join(sorted(VALID_STORAGE_TIERS))}',
                'code': 'invalid_enum',
            })

    # file_format: required enum
    file_format = data.get('file_format')
    if file_format not in VALID_FILE_FORMATS:
        errors.append({
            'path': 'storage.file_format',
            'message': f'Must be one of: {", ".join(sorted(VALID_FILE_FORMATS))}',
            'code': 'invalid_enum',
        })

    # compression: required enum
    compression = data.get('compression')
    if compression not in VALID_COMPRESSIONS:
        errors.append({
            'path': 'storage.compression',
            'message': f'Must be one of: {", ".join(sorted(VALID_COMPRESSIONS))}',
            'code': 'invalid_enum',
        })

    # partitioning_strategy: optional enum
    partitioning_strategy = data.get('partitioning_strategy')
    if partitioning_strategy is not None:
        if partitioning_strategy not in VALID_PARTITIONING_STRATEGIES:
            errors.append({
                'path': 'storage.partitioning_strategy',
                'message': f'Must be one of: {", ".join(sorted(VALID_PARTITIONING_STRATEGIES))}',
                'code': 'invalid_enum',
            })

    return errors


def _validate_analytics(data: dict) -> list[dict]:
    """Validate the analytics section fields."""
    errors: list[dict] = []

    # query_engine: required enum
    query_engine = data.get('query_engine')
    if query_engine not in VALID_QUERY_ENGINES:
        errors.append({
            'path': 'analytics.query_engine',
            'message': f'Must be one of: {", ".join(sorted(VALID_QUERY_ENGINES))}',
            'code': 'invalid_enum',
        })

    # avg_query_complexity: required enum
    avg_query_complexity = data.get('avg_query_complexity')
    if avg_query_complexity not in VALID_COMPLEXITIES:
        errors.append({
            'path': 'analytics.avg_query_complexity',
            'message': f'Must be one of: {", ".join(sorted(VALID_COMPLEXITIES))}',
            'code': 'invalid_enum',
        })

    # max_query_latency_sec: required, numeric, > 0
    max_query_latency_sec = data.get('max_query_latency_sec')
    if not _is_positive_number(max_query_latency_sec):
        errors.append({
            'path': 'analytics.max_query_latency_sec',
            'message': 'Must be a positive number',
            'code': 'value_error.number.not_gt',
        })

    # concurrent_users: required, integer, > 0
    concurrent_users = data.get('concurrent_users')
    if not _is_positive_int(concurrent_users):
        errors.append({
            'path': 'analytics.concurrent_users',
            'message': 'Must be a positive integer',
            'code': 'value_error.number.not_gt',
        })

    # redshift_node_count: conditional - required and >= 2 when query_engine includes redshift
    if query_engine in ('redshift', 'both'):
        redshift_node_count = data.get('redshift_node_count')
        if redshift_node_count is None:
            errors.append({
                'path': 'analytics.redshift_node_count',
                'message': 'Required when query engine includes Redshift (minimum 2)',
                'code': 'required',
            })
        elif not isinstance(redshift_node_count, int) or redshift_node_count < 2:
            errors.append({
                'path': 'analytics.redshift_node_count',
                'message': 'Must be an integer >= 2',
                'code': 'value_error.number.not_ge',
            })

    # quicksight_enabled: required boolean
    quicksight_enabled = data.get('quicksight_enabled')
    if not isinstance(quicksight_enabled, bool):
        errors.append({
            'path': 'analytics.quicksight_enabled',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # external_api_count: required, integer, >= 0
    external_api_count = data.get('external_api_count')
    if not _is_non_negative_int(external_api_count):
        errors.append({
            'path': 'analytics.external_api_count',
            'message': 'Must be a non-negative integer',
            'code': 'value_error.integer',
        })

    return errors


def _validate_processing(data: dict) -> list[dict]:
    """Validate the optional processing section fields."""
    errors: list[dict] = []

    # etl_engine: required enum
    etl_engine = data.get('etl_engine')
    if etl_engine not in VALID_ETL_ENGINES:
        errors.append({
            'path': 'processing.etl_engine',
            'message': f'Must be one of: {", ".join(sorted(VALID_ETL_ENGINES))}',
            'code': 'invalid_enum',
        })

    # job_concurrency: required, integer, > 0
    job_concurrency = data.get('job_concurrency')
    if not _is_positive_int(job_concurrency):
        errors.append({
            'path': 'processing.job_concurrency',
            'message': 'Must be a positive integer',
            'code': 'value_error.number.not_gt',
        })

    # data_quality_enabled: required boolean
    data_quality_enabled = data.get('data_quality_enabled')
    if not isinstance(data_quality_enabled, bool):
        errors.append({
            'path': 'processing.data_quality_enabled',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    return errors


def _validate_governance(data: dict) -> list[dict]:
    """Validate the optional governance section fields."""
    errors: list[dict] = []

    # lake_formation_enabled: required boolean
    lake_formation_enabled = data.get('lake_formation_enabled')
    if not isinstance(lake_formation_enabled, bool):
        errors.append({
            'path': 'governance.lake_formation_enabled',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # column_level_security: required boolean
    column_level_security = data.get('column_level_security')
    if not isinstance(column_level_security, bool):
        errors.append({
            'path': 'governance.column_level_security',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # data_catalog_tags: optional list of strings
    data_catalog_tags = data.get('data_catalog_tags')
    if data_catalog_tags is not None:
        if not isinstance(data_catalog_tags, list):
            errors.append({
                'path': 'governance.data_catalog_tags',
                'message': 'Must be a list of strings',
                'code': 'invalid_type',
            })
        elif not all(isinstance(t, str) for t in data_catalog_tags):
            errors.append({
                'path': 'governance.data_catalog_tags',
                'message': 'All items must be strings',
                'code': 'invalid_type',
            })

    # encryption: required enum
    encryption = data.get('encryption')
    if encryption not in VALID_ENCRYPTIONS:
        errors.append({
            'path': 'governance.encryption',
            'message': f'Must be one of: {", ".join(sorted(VALID_ENCRYPTIONS))}',
            'code': 'invalid_enum',
        })

    return errors


def _validate_costs(data: dict) -> list[dict]:
    """Validate the optional costs section fields."""
    errors: list[dict] = []

    # pricing_region: optional string
    pricing_region = data.get('pricing_region')
    if pricing_region is not None and not isinstance(pricing_region, str):
        errors.append({
            'path': 'costs.pricing_region',
            'message': 'Must be a string',
            'code': 'invalid_type',
        })

    # budget_limit_usd: optional, numeric, > 0 if provided
    budget_limit_usd = data.get('budget_limit_usd')
    if budget_limit_usd is not None:
        if not _is_positive_number(budget_limit_usd):
            errors.append({
                'path': 'costs.budget_limit_usd',
                'message': 'Must be a positive number',
                'code': 'value_error.number.not_gt',
            })

    # create_estimate: required boolean
    create_estimate = data.get('create_estimate')
    if not isinstance(create_estimate, bool):
        errors.append({
            'path': 'costs.create_estimate',
            'message': 'Must be a boolean',
            'code': 'invalid_type',
        })

    # cost_allocation_tags: optional list of strings
    cost_allocation_tags = data.get('cost_allocation_tags')
    if cost_allocation_tags is not None:
        if not isinstance(cost_allocation_tags, list):
            errors.append({
                'path': 'costs.cost_allocation_tags',
                'message': 'Must be a list of strings',
                'code': 'invalid_type',
            })
        elif not all(isinstance(t, str) for t in cost_allocation_tags):
            errors.append({
                'path': 'costs.cost_allocation_tags',
                'message': 'All items must be strings',
                'code': 'invalid_type',
            })

    return errors


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _is_positive_number(value: Any) -> bool:
    """Check if value is a number (int or float) greater than 0."""
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value > 0
    return False


def _is_non_negative_int(value: Any) -> bool:
    """Check if value is a non-negative integer (>= 0)."""
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return value >= 0
    return False


def _is_positive_int(value: Any) -> bool:
    """Check if value is a positive integer (> 0)."""
    if value is None:
        return False
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return value > 0
    return False
