"""Unit tests for diagram_generator module."""

import sys
import os
import pytest

# Add src to path so we can import diagram_generator
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from diagram_generator import generate_mermaid_v2, generate_drawio


# ---------------------------------------------------------------------------
# Fixtures: architecture data
# ---------------------------------------------------------------------------


def _sample_layers():
    return [
        {'id': 'sources', 'label': 'Fontes de Dados', 'order': 0},
        {'id': 'ingestion', 'label': 'Ingestão', 'order': 1},
        {'id': 'storage', 'label': 'Storage', 'order': 2},
        {'id': 'processing', 'label': 'Processamento', 'order': 3},
        {'id': 'analytics', 'label': 'Analytics / Consumo', 'order': 4},
        {'id': 'governance', 'label': 'Governança', 'order': 5},
    ]


def _sample_services():
    return [
        {'id': 'rds_sources', 'service': 'RDS', 'label': 'Bancos Relacionais', 'layer': 'sources'},
        {'id': 'dms', 'service': 'DMS', 'label': 'AWS DMS (CDC)', 'layer': 'ingestion'},
        {'id': 'glue_etl', 'service': 'Glue', 'label': 'AWS Glue ETL', 'layer': 'ingestion'},
        {'id': 's3_raw', 'service': 'S3_Raw', 'label': 'S3 Raw', 'layer': 'storage'},
        {'id': 's3_curated', 'service': 'S3_Curated', 'label': 'S3 Curated', 'layer': 'storage'},
        {'id': 'glue_processing', 'service': 'Glue', 'label': 'Glue Jobs', 'layer': 'processing'},
        {'id': 'athena', 'service': 'Athena', 'label': 'Amazon Athena', 'layer': 'analytics'},
        {'id': 'redshift', 'service': 'Redshift', 'label': 'Amazon Redshift', 'layer': 'analytics'},
        {'id': 'quicksight', 'service': 'QuickSight', 'label': 'Amazon QuickSight', 'layer': 'analytics'},
        {'id': 'lake_formation', 'service': 'Lake_Formation', 'label': 'AWS Lake Formation', 'layer': 'governance'},
    ]


def _sample_connections():
    return [
        {'from': 'rds_sources', 'to': 'dms', 'label': 'CDC', 'type': 'data_flow'},
        {'from': 'dms', 'to': 's3_raw', 'label': '', 'type': 'data_flow'},
        {'from': 's3_raw', 'to': 'glue_processing', 'label': '', 'type': 'data_flow'},
        {'from': 'glue_processing', 'to': 's3_curated', 'label': '', 'type': 'data_flow'},
        {'from': 's3_curated', 'to': 'athena', 'label': '', 'type': 'data_flow'},
        {'from': 's3_curated', 'to': 'redshift', 'label': '', 'type': 'data_flow'},
        {'from': 'redshift', 'to': 'quicksight', 'label': '', 'type': 'data_flow'},
        {'from': 'lake_formation', 'to': 's3_curated', 'label': '', 'type': 'control'},
    ]


def _sample_architecture():
    return {
        'services': _sample_services(),
        'connections': _sample_connections(),
        'layers': _sample_layers(),
    }


def _sample_project():
    return {
        'project_name': 'my-lakehouse',
        'description': 'Test lakehouse project',
        'region': 'us-east-1',
        'environment': 'prod',
    }


def _minimal_architecture():
    return {
        'services': [
            {'id': 's3_raw', 'service': 'S3', 'label': 'S3 Raw', 'layer': 'storage'},
            {'id': 'athena', 'service': 'Athena', 'label': 'Amazon Athena', 'layer': 'analytics'},
        ],
        'connections': [
            {'from': 's3_raw', 'to': 'athena', 'type': 'data_flow'},
        ],
        'layers': [
            {'id': 'storage', 'label': 'Storage', 'order': 2},
            {'id': 'analytics', 'label': 'Analytics', 'order': 4},
        ],
    }


# ---------------------------------------------------------------------------
# Tests: generate_mermaid_v2
# ---------------------------------------------------------------------------


class TestGenerateMermaidV2:
    def test_returns_string(self):
        result = generate_mermaid_v2(_sample_architecture())
        assert isinstance(result, str)

    def test_starts_with_graph_td(self):
        result = generate_mermaid_v2(_sample_architecture())
        assert result.startswith('graph TD')

    def test_contains_subgraphs_for_layers(self):
        result = generate_mermaid_v2(_sample_architecture())
        assert 'subgraph' in result
        assert 'Fontes de Dados' in result
        assert 'Storage' in result
        assert 'Analytics' in result

    def test_contains_service_labels(self):
        result = generate_mermaid_v2(_sample_architecture())
        assert 'AWS DMS (CDC)' in result
        assert 'S3 Raw' in result
        assert 'Amazon Athena' in result
        assert 'Amazon Redshift' in result

    def test_contains_connections(self):
        result = generate_mermaid_v2(_sample_architecture())
        assert 'rds_sources' in result
        assert 'dms' in result
        assert '-->' in result

    def test_labeled_connection(self):
        result = generate_mermaid_v2(_sample_architecture())
        # The CDC connection has a label
        assert 'CDC' in result

    def test_control_connection_uses_dashed_arrow(self):
        result = generate_mermaid_v2(_sample_architecture())
        # Control type uses dashed arrow
        assert '-.->' in result

    def test_empty_services_returns_placeholder(self):
        arch = {'services': [], 'connections': [], 'layers': []}
        result = generate_mermaid_v2(arch)
        assert 'Nenhum serviço selecionado' in result

    def test_minimal_architecture(self):
        result = generate_mermaid_v2(_minimal_architecture())
        assert 'graph TD' in result
        assert 'S3 Raw' in result
        assert 'Amazon Athena' in result
        assert '-->' in result

    def test_layers_rendered_in_order(self):
        result = generate_mermaid_v2(_sample_architecture())
        # Sources should appear before Analytics in the output
        sources_pos = result.find('Fontes de Dados')
        analytics_pos = result.find('Analytics')
        assert sources_pos < analytics_pos


# ---------------------------------------------------------------------------
# Tests: generate_drawio
# ---------------------------------------------------------------------------


class TestGenerateDrawio:
    def test_returns_string(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert isinstance(result, str)

    def test_valid_xml_structure(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert '<?xml' in result
        assert '<mxfile' in result
        assert '</mxfile>' in result

    def test_contains_diagram_element(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert '<diagram' in result
        assert 'mxGraphModel' in result

    def test_contains_project_name_in_diagram(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert 'my-lakehouse' in result

    def test_contains_root_cells(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        # draw.io requires cells with id 0 and 1
        assert 'id="0"' in result
        assert 'id="1"' in result

    def test_contains_service_labels(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert 'AWS DMS (CDC)' in result
        assert 'S3 Raw' in result
        assert 'Amazon Athena' in result

    def test_contains_layer_labels(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert 'Fontes de Dados' in result
        assert 'Storage' in result

    def test_contains_edges(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert 'edge="1"' in result

    def test_minimal_architecture(self):
        result = generate_drawio(_minimal_architecture(), _sample_project())
        assert '<mxfile' in result
        assert 'S3 Raw' in result
        assert 'Amazon Athena' in result
        assert 'edge="1"' in result

    def test_empty_services_produces_valid_xml(self):
        arch = {'services': [], 'connections': [], 'layers': []}
        result = generate_drawio(arch, _sample_project())
        assert '<?xml' in result
        assert '<mxfile' in result
        assert '</mxfile>' in result

    def test_connection_with_missing_service_is_skipped(self):
        arch = {
            'services': [
                {'id': 's3_raw', 'service': 'S3', 'label': 'S3 Raw', 'layer': 'storage'},
            ],
            'connections': [
                {'from': 's3_raw', 'to': 'nonexistent', 'type': 'data_flow'},
            ],
            'layers': [
                {'id': 'storage', 'label': 'Storage', 'order': 2},
            ],
        }
        # Should not raise, just skip the invalid connection
        result = generate_drawio(arch, _sample_project())
        assert '<mxfile' in result
        # No edge should be rendered since target doesn't exist
        assert 'edge="1"' not in result

    def test_environment_and_region_in_diagram_name(self):
        result = generate_drawio(_sample_architecture(), _sample_project())
        assert 'prod' in result
        assert 'us-east-1' in result
