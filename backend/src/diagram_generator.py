"""Diagram generator module for Lakehouse Designer V2.

Generates Mermaid source strings and .drawio XML for architecture diagrams
based on the selected services and their layer organization.
"""

import logging
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

logger = logging.getLogger(__name__)

# Layer display order and styling for .drawio
LAYER_CONFIG = {
    'sources': {'label': 'Fontes de Dados', 'order': 0, 'color': '#f5f5f5', 'stroke': '#666666'},
    'ingestion': {'label': 'Ingestão', 'order': 1, 'color': '#dae8fc', 'stroke': '#6c8ebf'},
    'storage': {'label': 'Storage', 'order': 2, 'color': '#d5e8d4', 'stroke': '#82b366'},
    'processing': {'label': 'Processamento', 'order': 3, 'color': '#fff2cc', 'stroke': '#d6b656'},
    'analytics': {'label': 'Analytics / Consumo', 'order': 4, 'color': '#e1d5e7', 'stroke': '#9673a6'},
    'governance': {'label': 'Governança', 'order': 5, 'color': '#f8cecc', 'stroke': '#b85450'},
}

# Service display labels
SERVICE_LABELS = {
    'S3': 'Amazon S3',
    'S3_Raw': 'S3 Raw',
    'S3_Curated': 'S3 Curated',
    'S3_Aggregated': 'S3 Aggregated',
    'Glue': 'AWS Glue ETL',
    'Glue_Crawlers': 'Glue Crawlers',
    'Glue_Catalog': 'Glue Data Catalog',
    'Athena': 'Amazon Athena',
    'Redshift': 'Amazon Redshift',
    'Redshift_Serverless': 'Redshift Serverless',
    'QuickSight': 'Amazon QuickSight',
    'DMS': 'AWS DMS (CDC)',
    'Kinesis': 'Amazon Kinesis',
    'Kinesis_Firehose': 'Kinesis Data Firehose',
    'EMR': 'Amazon EMR',
    'EMR_Serverless': 'EMR Serverless',
    'Lake_Formation': 'AWS Lake Formation',
    'API_Gateway': 'API Gateway',
    'Lambda': 'AWS Lambda',
    'CloudWatch': 'Amazon CloudWatch',
}


def generate_mermaid_v2(architecture: dict) -> str:
    """Generate a Mermaid diagram source string from the architecture spec.

    Args:
        architecture: Dict with keys 'services' (list of ServiceNode dicts),
                      'connections' (list of Connection dicts),
                      'layers' (list of Layer dicts).

    Returns:
        Mermaid source string representing the layered architecture.
    """
    services = architecture.get('services', [])
    connections = architecture.get('connections', [])
    layers = architecture.get('layers', [])

    if not services:
        return 'graph TD\n    empty[Nenhum serviço selecionado]'

    lines = ['graph TD']

    # Group services by layer for subgraph rendering
    sorted_layers = sorted(layers, key=lambda l: l.get('order', 0))
    services_by_layer = {}
    for svc in services:
        layer_id = svc.get('layer', 'unknown')
        services_by_layer.setdefault(layer_id, []).append(svc)

    # Render subgraphs per layer
    for layer in sorted_layers:
        layer_id = layer.get('id', '')
        layer_label = layer.get('label', layer_id)
        layer_services = services_by_layer.get(layer_id, [])

        if not layer_services:
            continue

        lines.append(f'    subgraph {_mermaid_safe_id(layer_id)}["{layer_label}"]')
        for svc in layer_services:
            svc_id = _mermaid_safe_id(svc.get('id', ''))
            svc_label = svc.get('label', svc.get('service', svc_id))
            shape = _get_mermaid_shape(svc)
            lines.append(f'        {svc_id}{shape[0]}"{svc_label}"{shape[1]}')
        lines.append('    end')

    # Render connections
    for conn in connections:
        src = _mermaid_safe_id(conn.get('from', ''))
        tgt = _mermaid_safe_id(conn.get('to', ''))
        label = conn.get('label', '')
        conn_type = conn.get('type', 'data_flow')

        arrow = _get_mermaid_arrow(conn_type)
        if label:
            lines.append(f'    {src} {arrow}|"{label}"| {tgt}')
        else:
            lines.append(f'    {src} {arrow} {tgt}')

    return '\n'.join(lines)


def generate_drawio(architecture: dict, project: dict) -> str:
    """Generate a .drawio XML string from the architecture spec.

    Args:
        architecture: Dict with keys 'services', 'connections', 'layers'.
        project: Dict with keys 'project_name', 'description', 'region', 'environment'.

    Returns:
        .drawio XML string suitable for import into draw.io.
    """
    services = architecture.get('services', [])
    connections = architecture.get('connections', [])
    layers = architecture.get('layers', [])

    project_name = project.get('project_name', 'Lakehouse Architecture')
    environment = project.get('environment', 'prod')
    region = project.get('region', 'us-east-1')

    # Build XML structure
    mxfile = Element('mxfile', {
        'host': 'app.diagrams.net',
        'modified': '',
        'agent': 'Lakehouse Designer V2',
        'version': '21.0.0',
        'type': 'device',
    })

    diagram = SubElement(mxfile, 'diagram', {
        'id': 'lakehouse-arch',
        'name': f'{project_name} ({environment} - {region})',
    })

    mx_graph_model = SubElement(diagram, 'mxGraphModel', {
        'dx': '1422',
        'dy': '794',
        'grid': '1',
        'gridSize': '10',
        'guides': '1',
        'tooltips': '1',
        'connect': '1',
        'arrows': '1',
        'fold': '1',
        'page': '1',
        'pageScale': '1',
        'pageWidth': '1169',
        'pageHeight': '827',
        'math': '0',
        'shadow': '0',
    })

    root = SubElement(mx_graph_model, 'root')

    # Default parent cells required by draw.io
    SubElement(root, 'mxCell', {'id': '0'})
    SubElement(root, 'mxCell', {'id': '1', 'parent': '0'})

    # Layout constants
    layer_x = 50
    layer_width = 1060
    layer_height = 100
    layer_gap = 20
    service_width = 140
    service_height = 60
    service_padding = 20

    # Sort layers by order
    sorted_layers = sorted(layers, key=lambda l: l.get('order', 0))

    # Group services by layer
    services_by_layer = {}
    for svc in services:
        layer_id = svc.get('layer', 'unknown')
        services_by_layer.setdefault(layer_id, []).append(svc)

    # Track cell IDs for connections
    cell_id_counter = 2
    service_cell_ids = {}

    # Render layer containers and services
    for layer_idx, layer in enumerate(sorted_layers):
        layer_id = layer.get('id', '')
        layer_label = layer.get('label', layer_id)
        layer_services = services_by_layer.get(layer_id, [])

        if not layer_services:
            continue

        # Layer container position
        y_pos = 50 + layer_idx * (layer_height + layer_gap)
        layer_config = LAYER_CONFIG.get(layer_id, {
            'color': '#f5f5f5', 'stroke': '#666666'
        })

        # Create layer container (swimlane)
        cell_id_counter += 1
        layer_cell_id = str(cell_id_counter)

        layer_style = (
            f"rounded=1;whiteSpace=wrap;html=1;fillColor={layer_config['color']};"
            f"strokeColor={layer_config['stroke']};dashed=1;dashPattern=5 5;"
            f"verticalAlign=top;fontStyle=1;fontSize=12;container=1;collapsible=0;"
        )

        layer_cell = SubElement(root, 'mxCell', {
            'id': layer_cell_id,
            'value': layer_label,
            'style': layer_style,
            'vertex': '1',
            'parent': '1',
        })
        SubElement(layer_cell, 'mxGeometry', {
            'x': str(layer_x),
            'y': str(y_pos),
            'width': str(layer_width),
            'height': str(layer_height),
            'as': 'geometry',
        })

        # Render services within the layer
        num_services = len(layer_services)
        total_services_width = num_services * service_width + (num_services - 1) * service_padding
        start_x = (layer_width - total_services_width) // 2

        for svc_idx, svc in enumerate(layer_services):
            cell_id_counter += 1
            svc_cell_id = str(cell_id_counter)
            svc_id = svc.get('id', f'svc_{cell_id_counter}')
            svc_label = svc.get('label', svc.get('service', svc_id))

            service_cell_ids[svc_id] = svc_cell_id

            svc_x = start_x + svc_idx * (service_width + service_padding)
            svc_y = 30  # Offset from layer top (below label)

            svc_style = (
                "rounded=1;whiteSpace=wrap;html=1;fillColor=#FFFFFF;"
                f"strokeColor={layer_config['stroke']};fontSize=11;"
                "fontFamily=Helvetica;shadow=1;"
            )

            svc_cell = SubElement(root, 'mxCell', {
                'id': svc_cell_id,
                'value': svc_label,
                'style': svc_style,
                'vertex': '1',
                'parent': layer_cell_id,
            })
            SubElement(svc_cell, 'mxGeometry', {
                'x': str(svc_x),
                'y': str(svc_y),
                'width': str(service_width),
                'height': str(service_height),
                'as': 'geometry',
            })

    # Render connections (edges)
    for conn in connections:
        src_id = conn.get('from', '')
        tgt_id = conn.get('to', '')
        label = conn.get('label', '')
        conn_type = conn.get('type', 'data_flow')

        src_cell = service_cell_ids.get(src_id)
        tgt_cell = service_cell_ids.get(tgt_id)

        if not src_cell or not tgt_cell:
            logger.warning(
                "Connection skipped: source '%s' or target '%s' not found in services",
                src_id, tgt_id
            )
            continue

        cell_id_counter += 1
        edge_cell_id = str(cell_id_counter)

        edge_style = _get_drawio_edge_style(conn_type)

        edge_cell = SubElement(root, 'mxCell', {
            'id': edge_cell_id,
            'value': label,
            'style': edge_style,
            'edge': '1',
            'parent': '1',
            'source': src_cell,
            'target': tgt_cell,
        })
        SubElement(edge_cell, 'mxGeometry', {
            'relative': '1',
            'as': 'geometry',
        })

    # Convert to XML string with pretty formatting
    xml_bytes = tostring(mxfile, encoding='unicode')
    try:
        dom = parseString(xml_bytes)
        return dom.toprettyxml(indent='  ', encoding=None)
    except Exception:
        # Fallback to raw XML if pretty-print fails
        return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_bytes}'


# ==================== Helper Functions ====================


def _mermaid_safe_id(raw_id: str) -> str:
    """Convert a raw ID to a Mermaid-safe identifier (alphanumeric + underscore)."""
    return ''.join(c if c.isalnum() or c == '_' else '_' for c in raw_id)


def _get_mermaid_shape(service: dict) -> tuple:
    """Return Mermaid shape delimiters based on service type.

    Returns:
        Tuple of (open_delimiter, close_delimiter).
    """
    service_name = service.get('service', '')
    layer = service.get('layer', '')

    # Storage services use cylinder shape
    if layer == 'storage' or service_name in ('S3', 'S3_Raw', 'S3_Curated', 'S3_Aggregated'):
        return ('[(', ')]')
    # Database/data sources use database shape
    if layer == 'sources':
        return ('[(', ')]')
    # Default: rounded rectangle
    return ('[', ']')


def _get_mermaid_arrow(conn_type: str) -> str:
    """Return Mermaid arrow style based on connection type."""
    if conn_type == 'data_flow':
        return '-->'
    elif conn_type == 'control':
        return '-.->'
    elif conn_type == 'monitoring':
        return '-.->|monitor|'
    return '-->'


def _get_drawio_edge_style(conn_type: str) -> str:
    """Return draw.io edge style string based on connection type."""
    base = "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;"

    if conn_type == 'data_flow':
        return f"{base}strokeColor=#6c8ebf;strokeWidth=2;"
    elif conn_type == 'control':
        return f"{base}strokeColor=#d6b656;strokeWidth=1;dashed=1;"
    elif conn_type == 'monitoring':
        return f"{base}strokeColor=#b85450;strokeWidth=1;dashed=1;dashPattern=5 5;"
    return f"{base}strokeColor=#666666;strokeWidth=1;"
