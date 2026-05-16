"""Unit tests for the generate_v2 Lambda handler."""

import json
import sys
import os
from unittest.mock import patch

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from generate_v2 import (
    lambda_handler,
    decide_architecture,
    compute_cost_estimate_v2,
    _build_diagram_filename,
    _build_diagram_spec,
    _get_provisioning_steps_v2,
)
from pricing_service import FALLBACK_PRICES


# Mock get_prices to avoid AWS API calls during tests
@patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
class _MockedPrices:
    """Mixin to auto-mock get_prices in all test methods."""
    pass


# ==================== Test Fixtures ====================

def _minimal_valid_body():
    """Return a minimal valid request body for /generate-v2."""
    return {
        'project': {
            'project_name': 'test-project',
            'environment': 'dev',
            'region': 'us-east-1',
        },
        'sources': {
            'data_volume_tb': 10,
            'records_per_day_millions': 5,
            'data_source_count': 3,
            'dms_cdc_enabled': False,
        },
        'ingestion': {
            'ingestion_pattern': 'batch',
            'batch_frequency': 'daily',
        },
        'storage': {
            'storage_tiers': ['raw', 'curated'],
            'file_format': 'parquet',
            'compression': 'snappy',
        },
        'analytics': {
            'query_engine': 'athena',
            'avg_query_complexity': 'medium',
            'max_query_latency_sec': 30,
            'concurrent_users': 10,
            'external_api_count': 0,
            'quicksight_enabled': False,
        },
    }


def _full_valid_body():
    """Return a full valid request body with all optional sections."""
    body = _minimal_valid_body()
    body['sources']['dms_cdc_enabled'] = True
    body['sources']['dms_cdc_db_count'] = 2
    body['analytics']['query_engine'] = 'both'
    body['analytics']['redshift_node_count'] = 3
    body['analytics']['quicksight_enabled'] = True
    body['analytics']['external_api_count'] = 2
    body['processing'] = {
        'etl_engine': 'glue',
        'job_concurrency': 5,
        'data_quality_enabled': True,
    }
    body['governance'] = {
        'lake_formation_enabled': True,
        'column_level_security': True,
        'encryption': 'sse_kms',
    }
    body['costs'] = {
        'pricing_region': 'us-east-1',
        'budget_limit_usd': 5000,
        'create_estimate': False,
    }
    return body


def _make_event(body=None, method='POST'):
    """Build a Lambda event dict."""
    event = {
        'httpMethod': method,
        'body': json.dumps(body) if body is not None else '{}',
    }
    return event


# ==================== Handler Tests ====================

class TestLambdaHandler:
    """Tests for the lambda_handler function."""

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_valid_minimal_request_returns_200(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert 'diagram' in body
        assert 'spec' in body
        assert 'cost_estimate' in body
        assert 'warnings' in body
        assert 'mermaid_diagram' in body
        assert 'provisioning_steps' in body

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_valid_full_request_returns_200(self, mock_prices):
        event = _make_event(_full_valid_body())
        result = lambda_handler(event, None)

        assert result['statusCode'] == 200
        body = json.loads(result['body'])
        assert body['diagram']['content_base64']
        assert body['diagram']['filename'].endswith('.drawio')
        assert body['spec_source'] == 'deterministic'

    def test_invalid_json_returns_400(self):
        event = {'httpMethod': 'POST', 'body': 'not valid json{{{'}
        result = lambda_handler(event, None)

        assert result['statusCode'] == 400
        body = json.loads(result['body'])
        assert body['error'] == 'Invalid JSON body'

    def test_validation_error_returns_422(self):
        event = _make_event({'project': 'not_a_dict'})
        result = lambda_handler(event, None)

        assert result['statusCode'] == 422
        body = json.loads(result['body'])
        assert body['error'] == 'validation_error'
        assert 'fields' in body
        assert len(body['fields']) > 0

    def test_missing_required_sections_returns_422(self):
        event = _make_event({'project': {'project_name': 'test', 'environment': 'dev', 'region': 'us-east-1'}})
        result = lambda_handler(event, None)

        assert result['statusCode'] == 422

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_cors_headers_present_on_success(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        assert result['headers']['Access-Control-Allow-Origin'] == '*'
        assert result['headers']['Access-Control-Allow-Headers'] == 'Content-Type'
        assert result['headers']['Access-Control-Allow-Methods'] == 'POST,OPTIONS'

    def test_cors_headers_present_on_error(self):
        event = {'httpMethod': 'POST', 'body': 'invalid'}
        result = lambda_handler(event, None)

        assert result['headers']['Access-Control-Allow-Origin'] == '*'
        assert result['headers']['Access-Control-Allow-Methods'] == 'POST,OPTIONS'

    def test_options_preflight_returns_200(self):
        event = {'httpMethod': 'OPTIONS', 'body': None}
        result = lambda_handler(event, None)

        assert result['statusCode'] == 200
        assert result['headers']['Access-Control-Allow-Origin'] == '*'

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_response_diagram_is_base64_decodable(self, mock_prices):
        import base64
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        body = json.loads(result['body'])
        content_b64 = body['diagram']['content_base64']
        # Should not raise
        decoded = base64.b64decode(content_b64)
        assert b'mxfile' in decoded  # .drawio XML contains mxfile

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_response_cost_estimate_structure(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        body = json.loads(result['body'])
        cost = body['cost_estimate']
        assert 'monthly_total_usd' in cost
        assert 'breakdown' in cost
        assert 'assumptions' in cost
        assert 'notes' in cost
        assert 'unit_prices' in cost
        assert 'pricing_location' in cost
        assert 'pricing_api_region' in cost
        assert isinstance(cost['breakdown'], list)
        assert isinstance(cost['assumptions'], list)
        assert isinstance(cost['notes'], list)
        assert cost['monthly_total_usd'] >= 0

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_response_spec_structure(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        body = json.loads(result['body'])
        spec = body['spec']
        assert 'architecture_type' in spec
        assert 'services' in spec
        assert 'connections' in spec
        assert 'layers' in spec

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_response_mermaid_diagram_is_string(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        body = json.loads(result['body'])
        assert isinstance(body['mermaid_diagram'], str)
        assert body['mermaid_diagram'].startswith('graph TD')

    @patch('generate_v2.get_prices', return_value=dict(FALLBACK_PRICES))
    def test_response_provisioning_steps_is_list(self, mock_prices):
        event = _make_event(_minimal_valid_body())
        result = lambda_handler(event, None)

        body = json.loads(result['body'])
        assert isinstance(body['provisioning_steps'], list)
        assert len(body['provisioning_steps']) > 0


# ==================== Architecture Decision Tests ====================

class TestDecideArchitecture:
    """Tests for the decide_architecture function."""

    def test_minimal_request_includes_basic_services(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 's3_raw' in service_ids
        assert 's3_curated' in service_ids
        assert 'glue_etl' in service_ids
        assert 'athena' in service_ids
        assert 'glue_catalog' in service_ids

    def test_dms_cdc_adds_dms_service(self):
        request = _minimal_valid_body()
        request['sources']['dms_cdc_enabled'] = True
        request['sources']['dms_cdc_db_count'] = 2
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'dms' in service_ids
        assert 'rds_sources' in service_ids

    def test_redshift_engine_adds_redshift(self):
        request = _minimal_valid_body()
        request['analytics']['query_engine'] = 'redshift'
        request['analytics']['redshift_node_count'] = 2
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'redshift' in service_ids

    def test_both_engine_adds_athena_and_redshift(self):
        request = _minimal_valid_body()
        request['analytics']['query_engine'] = 'both'
        request['analytics']['redshift_node_count'] = 2
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'athena' in service_ids
        assert 'redshift' in service_ids

    def test_quicksight_enabled_adds_quicksight(self):
        request = _minimal_valid_body()
        request['analytics']['quicksight_enabled'] = True
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'quicksight' in service_ids

    def test_external_apis_adds_api_gateway_and_lambda(self):
        request = _minimal_valid_body()
        request['analytics']['external_api_count'] = 2
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'api_gateway' in service_ids
        assert 'lambda_fn' in service_ids

    def test_streaming_ingestion_adds_kinesis(self):
        request = _minimal_valid_body()
        request['ingestion']['ingestion_pattern'] = 'streaming'
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'kinesis' in service_ids

    def test_emr_engine_adds_emr(self):
        request = _minimal_valid_body()
        request['processing'] = {
            'etl_engine': 'emr',
            'job_concurrency': 3,
            'data_quality_enabled': False,
        }
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'emr' in service_ids
        assert 'glue_etl' not in service_ids

    def test_lake_formation_disabled_excludes_it(self):
        request = _minimal_valid_body()
        request['governance'] = {
            'lake_formation_enabled': False,
            'column_level_security': False,
            'encryption': 'sse_s3',
        }
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        assert 'lake_formation' not in service_ids

    def test_layers_always_present(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)

        assert 'layers' in arch
        layer_ids = [l['id'] for l in arch['layers']]
        assert 'sources' in layer_ids
        assert 'ingestion' in layer_ids
        assert 'storage' in layer_ids
        assert 'processing' in layer_ids
        assert 'analytics' in layer_ids
        assert 'governance' in layer_ids

    def test_connections_are_valid(self):
        request = _full_valid_body()
        arch = decide_architecture(request)

        service_ids = [s['id'] for s in arch['services']]
        for conn in arch['connections']:
            assert conn['from'] in service_ids, f"Connection from '{conn['from']}' not in services"
            assert conn['to'] in service_ids, f"Connection to '{conn['to']}' not in services"


# ==================== Cost Estimate Tests ====================

class TestComputeCostEstimateV2:
    """Tests for the compute_cost_estimate_v2 function."""

    def test_returns_required_fields(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        assert 'monthly_total_usd' in cost
        assert 'breakdown' in cost
        assert 'assumptions' in cost
        assert 'notes' in cost
        assert 'unit_prices' in cost
        assert 'pricing_location' in cost
        assert 'pricing_api_region' in cost

    def test_monthly_total_matches_breakdown_sum(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        breakdown_sum = sum(item['monthly_cost_usd'] for item in cost['breakdown'])
        assert abs(cost['monthly_total_usd'] - round(breakdown_sum, 2)) < 0.01

    def test_breakdown_items_have_required_fields(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        for item in cost['breakdown']:
            assert 'service' in item
            assert 'monthly_cost_usd' in item
            assert 'unit_price' in item
            assert 'unit' in item
            assert 'quantity' in item

    def test_redshift_cost_included_when_enabled(self):
        request = _minimal_valid_body()
        request['analytics']['query_engine'] = 'redshift'
        request['analytics']['redshift_node_count'] = 3
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        service_names = [item['service'] for item in cost['breakdown']]
        assert 'Amazon Redshift' in service_names
        assert 'Redshift' in cost['unit_prices']

    def test_dms_cost_included_when_cdc_enabled(self):
        request = _minimal_valid_body()
        request['sources']['dms_cdc_enabled'] = True
        request['sources']['dms_cdc_db_count'] = 2
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        service_names = [item['service'] for item in cost['breakdown']]
        assert 'AWS DMS' in service_names

    def test_assumptions_are_non_empty(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        assert len(cost['assumptions']) > 0

    def test_notes_indicate_fallback_prices(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        assert any('fallback' in note.lower() or 'dinâmicos' in note.lower() for note in cost['notes'])

    def test_pricing_location_for_us_east_1(self):
        request = _minimal_valid_body()
        request['costs'] = {'pricing_region': 'us-east-1', 'create_estimate': False}
        arch = decide_architecture(request)
        cost = compute_cost_estimate_v2(request, arch, FALLBACK_PRICES)

        assert cost['pricing_location'] == 'US East (N. Virginia)'
        assert cost['pricing_api_region'] == 'us-east-1'


# ==================== Helper Function Tests ====================

class TestHelperFunctions:
    """Tests for helper functions."""

    def test_build_diagram_filename(self):
        project = {'project_name': 'my-project', 'environment': 'prod', 'region': 'us-east-1'}
        filename = _build_diagram_filename(project)

        assert filename.startswith('lakehouse-my-project-')
        assert filename.endswith('.drawio')

    def test_build_diagram_spec_athena_only(self):
        arch = {
            'services': [
                {'id': 'athena', 'service': 'Athena', 'label': 'Athena', 'layer': 'analytics'},
            ],
            'connections': [],
            'layers': [{'id': 'analytics', 'label': 'Analytics', 'order': 4}],
        }
        spec = _build_diagram_spec(arch)

        assert spec['architecture_type'] == 'light_lakehouse_athena'

    def test_build_diagram_spec_redshift(self):
        arch = {
            'services': [
                {'id': 'redshift', 'service': 'Redshift', 'label': 'Redshift', 'layer': 'analytics'},
            ],
            'connections': [],
            'layers': [{'id': 'analytics', 'label': 'Analytics', 'order': 4}],
        }
        spec = _build_diagram_spec(arch)

        assert spec['architecture_type'] == 'full_lakehouse_with_redshift'

    def test_build_diagram_spec_both_engines(self):
        arch = {
            'services': [
                {'id': 'athena', 'service': 'Athena', 'label': 'Athena', 'layer': 'analytics'},
                {'id': 'redshift', 'service': 'Redshift', 'label': 'Redshift', 'layer': 'analytics'},
            ],
            'connections': [],
            'layers': [{'id': 'analytics', 'label': 'Analytics', 'order': 4}],
        }
        spec = _build_diagram_spec(arch)

        assert spec['architecture_type'] == 'full_lakehouse_redshift_athena'

    def test_provisioning_steps_basic(self):
        request = _minimal_valid_body()
        arch = decide_architecture(request)
        steps = _get_provisioning_steps_v2(request, arch)

        assert isinstance(steps, list)
        assert len(steps) > 0
        assert any('S3' in step for step in steps)

    def test_provisioning_steps_with_dms(self):
        request = _minimal_valid_body()
        request['sources']['dms_cdc_enabled'] = True
        request['sources']['dms_cdc_db_count'] = 2
        arch = decide_architecture(request)
        steps = _get_provisioning_steps_v2(request, arch)

        assert any('DMS' in step for step in steps)

    def test_provisioning_steps_with_redshift(self):
        request = _minimal_valid_body()
        request['analytics']['query_engine'] = 'redshift'
        request['analytics']['redshift_node_count'] = 4
        arch = decide_architecture(request)
        steps = _get_provisioning_steps_v2(request, arch)

        assert any('Redshift' in step for step in steps)
