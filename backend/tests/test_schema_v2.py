"""Unit tests for schema_v2 validation module."""

import sys
import os
import pytest

# Add src to path so we can import schema_v2
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from schema_v2 import validate_request, ValidationError


# ---------------------------------------------------------------------------
# Fixtures: valid payloads
# ---------------------------------------------------------------------------


def _valid_project():
    return {
        'project_name': 'my-lakehouse-project',
        'environment': 'prod',
        'region': 'us-east-1',
        'description': 'Test project',
    }


def _valid_sources():
    return {
        'data_volume_tb': 10,
        'records_per_day_millions': 5,
        'data_source_count': 3,
        'dms_cdc_enabled': False,
        'source_types': ['CSV', 'JSON'],
    }


def _valid_ingestion():
    return {
        'ingestion_pattern': 'batch',
        'batch_frequency': 'daily',
    }


def _valid_storage():
    return {
        'storage_tiers': ['raw', 'curated'],
        'file_format': 'parquet',
        'compression': 'snappy',
    }


def _valid_analytics():
    return {
        'query_engine': 'athena',
        'avg_query_complexity': 'medium',
        'max_query_latency_sec': 30,
        'concurrent_users': 10,
        'quicksight_enabled': False,
        'external_api_count': 0,
    }


def _valid_body():
    return {
        'project': _valid_project(),
        'sources': _valid_sources(),
        'ingestion': _valid_ingestion(),
        'storage': _valid_storage(),
        'analytics': _valid_analytics(),
    }


# ---------------------------------------------------------------------------
# Tests: successful validation
# ---------------------------------------------------------------------------


class TestValidateRequestSuccess:
    def test_minimal_valid_body(self):
        body = _valid_body()
        result = validate_request(body)
        assert result == body

    def test_full_body_with_optional_sections(self):
        body = _valid_body()
        body['processing'] = {
            'etl_engine': 'glue',
            'job_concurrency': 5,
            'data_quality_enabled': True,
        }
        body['governance'] = {
            'lake_formation_enabled': True,
            'column_level_security': False,
            'encryption': 'sse_s3',
            'data_catalog_tags': ['pii', 'financial'],
        }
        body['costs'] = {
            'create_estimate': True,
            'budget_limit_usd': 5000,
            'pricing_region': 'us-east-1',
            'cost_allocation_tags': ['team:data'],
        }
        result = validate_request(body)
        assert result == body

    def test_redshift_with_node_count(self):
        body = _valid_body()
        body['analytics']['query_engine'] = 'redshift'
        body['analytics']['redshift_node_count'] = 4
        result = validate_request(body)
        assert result['analytics']['redshift_node_count'] == 4

    def test_both_query_engine_with_node_count(self):
        body = _valid_body()
        body['analytics']['query_engine'] = 'both'
        body['analytics']['redshift_node_count'] = 2
        result = validate_request(body)
        assert result['analytics']['query_engine'] == 'both'

    def test_cdc_enabled_with_db_count(self):
        body = _valid_body()
        body['sources']['dms_cdc_enabled'] = True
        body['sources']['dms_cdc_db_count'] = 3
        result = validate_request(body)
        assert result['sources']['dms_cdc_db_count'] == 3

    def test_streaming_ingestion_with_throughput(self):
        body = _valid_body()
        body['ingestion'] = {
            'ingestion_pattern': 'streaming',
            'streaming_throughput_mbps': 100,
        }
        result = validate_request(body)
        assert result['ingestion']['streaming_throughput_mbps'] == 100

    def test_hybrid_ingestion(self):
        body = _valid_body()
        body['ingestion'] = {
            'ingestion_pattern': 'hybrid',
            'batch_frequency': 'hourly',
            'streaming_throughput_mbps': 50,
        }
        result = validate_request(body)
        assert result['ingestion']['ingestion_pattern'] == 'hybrid'


# ---------------------------------------------------------------------------
# Tests: missing required sections
# ---------------------------------------------------------------------------


class TestMissingRequiredSections:
    def test_missing_project_section(self):
        body = _valid_body()
        del body['project']
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project' for e in errors)
        assert any(e['code'] == 'missing_required_section' for e in errors)

    def test_missing_sources_section(self):
        body = _valid_body()
        del body['sources']
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources' for e in errors)

    def test_missing_multiple_sections(self):
        body = {'project': _valid_project()}
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert len(errors) == 4  # sources, ingestion, storage, analytics

    def test_section_not_a_dict(self):
        body = _valid_body()
        body['project'] = 'not a dict'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project' and e['code'] == 'missing_required_section' for e in errors)


# ---------------------------------------------------------------------------
# Tests: project validation
# ---------------------------------------------------------------------------


class TestProjectValidation:
    def test_empty_project_name(self):
        body = _valid_body()
        body['project']['project_name'] = ''
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project.project_name' for e in errors)

    def test_invalid_project_name_characters(self):
        body = _valid_body()
        body['project']['project_name'] = 'my project!@#'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project.project_name' and e['code'] == 'invalid_format' for e in errors)

    def test_valid_project_name_with_hyphens_underscores(self):
        body = _valid_body()
        body['project']['project_name'] = 'my_project-123'
        result = validate_request(body)
        assert result['project']['project_name'] == 'my_project-123'

    def test_invalid_environment(self):
        body = _valid_body()
        body['project']['environment'] = 'production'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project.environment' and e['code'] == 'invalid_enum' for e in errors)

    def test_missing_region(self):
        body = _valid_body()
        body['project']['region'] = ''
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project.region' for e in errors)

    def test_invalid_region_format(self):
        body = _valid_body()
        body['project']['region'] = 'invalid-region'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'project.region' and e['code'] == 'invalid_format' for e in errors)


# ---------------------------------------------------------------------------
# Tests: sources validation
# ---------------------------------------------------------------------------


class TestSourcesValidation:
    def test_zero_data_volume(self):
        body = _valid_body()
        body['sources']['data_volume_tb'] = 0
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.data_volume_tb' for e in errors)

    def test_negative_data_volume(self):
        body = _valid_body()
        body['sources']['data_volume_tb'] = -5
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.data_volume_tb' for e in errors)

    def test_zero_records_per_day(self):
        body = _valid_body()
        body['sources']['records_per_day_millions'] = 0
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.records_per_day_millions' for e in errors)

    def test_invalid_source_types(self):
        body = _valid_body()
        body['sources']['source_types'] = ['CSV', 'INVALID']
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.source_types' for e in errors)

    def test_cdc_enabled_without_db_count(self):
        body = _valid_body()
        body['sources']['dms_cdc_enabled'] = True
        # No dms_cdc_db_count provided
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.dms_cdc_db_count' for e in errors)

    def test_cdc_enabled_with_zero_db_count(self):
        body = _valid_body()
        body['sources']['dms_cdc_enabled'] = True
        body['sources']['dms_cdc_db_count'] = 0
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'sources.dms_cdc_db_count' for e in errors)


# ---------------------------------------------------------------------------
# Tests: ingestion validation
# ---------------------------------------------------------------------------


class TestIngestionValidation:
    def test_invalid_ingestion_pattern(self):
        body = _valid_body()
        body['ingestion']['ingestion_pattern'] = 'realtime'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'ingestion.ingestion_pattern' for e in errors)

    def test_invalid_batch_frequency(self):
        body = _valid_body()
        body['ingestion']['batch_frequency'] = 'monthly'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'ingestion.batch_frequency' for e in errors)

    def test_negative_streaming_throughput(self):
        body = _valid_body()
        body['ingestion'] = {
            'ingestion_pattern': 'streaming',
            'streaming_throughput_mbps': -10,
        }
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'ingestion.streaming_throughput_mbps' for e in errors)


# ---------------------------------------------------------------------------
# Tests: storage validation
# ---------------------------------------------------------------------------


class TestStorageValidation:
    def test_empty_storage_tiers(self):
        body = _valid_body()
        body['storage']['storage_tiers'] = []
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'storage.storage_tiers' for e in errors)

    def test_invalid_file_format(self):
        body = _valid_body()
        body['storage']['file_format'] = 'csv'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'storage.file_format' for e in errors)

    def test_invalid_compression(self):
        body = _valid_body()
        body['storage']['compression'] = 'lz4'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'storage.compression' for e in errors)


# ---------------------------------------------------------------------------
# Tests: analytics validation
# ---------------------------------------------------------------------------


class TestAnalyticsValidation:
    def test_invalid_query_engine(self):
        body = _valid_body()
        body['analytics']['query_engine'] = 'spark'
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.query_engine' for e in errors)

    def test_redshift_without_node_count(self):
        body = _valid_body()
        body['analytics']['query_engine'] = 'redshift'
        # No redshift_node_count
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.redshift_node_count' for e in errors)

    def test_redshift_node_count_below_minimum(self):
        body = _valid_body()
        body['analytics']['query_engine'] = 'redshift'
        body['analytics']['redshift_node_count'] = 1
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.redshift_node_count' for e in errors)

    def test_zero_concurrent_users(self):
        body = _valid_body()
        body['analytics']['concurrent_users'] = 0
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.concurrent_users' for e in errors)

    def test_missing_quicksight_enabled(self):
        body = _valid_body()
        del body['analytics']['quicksight_enabled']
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.quicksight_enabled' for e in errors)

    def test_negative_external_api_count(self):
        body = _valid_body()
        body['analytics']['external_api_count'] = -1
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'analytics.external_api_count' for e in errors)


# ---------------------------------------------------------------------------
# Tests: optional sections validation
# ---------------------------------------------------------------------------


class TestOptionalSectionsValidation:
    def test_invalid_etl_engine(self):
        body = _valid_body()
        body['processing'] = {
            'etl_engine': 'spark',
            'job_concurrency': 5,
            'data_quality_enabled': True,
        }
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'processing.etl_engine' for e in errors)

    def test_invalid_encryption(self):
        body = _valid_body()
        body['governance'] = {
            'lake_formation_enabled': True,
            'column_level_security': False,
            'encryption': 'aes256',
        }
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'governance.encryption' for e in errors)

    def test_invalid_budget_limit(self):
        body = _valid_body()
        body['costs'] = {
            'create_estimate': True,
            'budget_limit_usd': -100,
        }
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'costs.budget_limit_usd' for e in errors)

    def test_costs_missing_create_estimate(self):
        body = _valid_body()
        body['costs'] = {
            'budget_limit_usd': 5000,
        }
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert any(e['path'] == 'costs.create_estimate' for e in errors)


# ---------------------------------------------------------------------------
# Tests: error structure
# ---------------------------------------------------------------------------


class TestErrorStructure:
    def test_error_has_path_message_code(self):
        body = _valid_body()
        body['project']['project_name'] = ''
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        for error in exc_info.value.errors:
            assert 'path' in error
            assert 'message' in error
            assert 'code' in error

    def test_validation_error_has_errors_list(self):
        body = {}
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        assert isinstance(exc_info.value.errors, list)
        assert len(exc_info.value.errors) > 0

    def test_multiple_errors_collected(self):
        body = _valid_body()
        body['project']['project_name'] = ''
        body['project']['environment'] = 'invalid'
        body['project']['region'] = ''
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        errors = exc_info.value.errors
        assert len(errors) >= 3
