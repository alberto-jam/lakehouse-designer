"""Warning engine for architecture analysis.

Analyzes the generated architecture against the user request and cost estimate
to produce actionable warnings about potential issues, anti-patterns, and risks.
"""

import logging

logger = logging.getLogger(__name__)


def analyze_architecture(request: dict, architecture: dict, cost_estimate: dict) -> list[dict]:
    """Analyze architecture for potential issues and return warnings.

    Args:
        request: The validated request dict (same structure as GenerateV2Request).
        architecture: The architecture dict returned by decide_architecture().
        cost_estimate: The cost estimate dict with at least monthly_total_usd field.

    Returns:
        List of warning dicts, each with keys: severity, code, message, recommendation.
    """
    warnings = []

    warnings.extend(_check_over_budget(request, cost_estimate))
    warnings.extend(_check_large_volume_athena_only(request))
    warnings.extend(_check_high_concurrency_athena(request))
    warnings.extend(_check_cdc_no_governance(request))

    return warnings


def _check_over_budget(request: dict, cost_estimate: dict) -> list[dict]:
    """OVER_BUDGET: cost > budget_limit when budget_limit_usd is set in costs section."""
    warnings = []

    costs_section = request.get('costs', {}) or {}
    budget_limit = costs_section.get('budget_limit_usd')

    if budget_limit is not None and budget_limit > 0:
        monthly_cost = cost_estimate.get('monthly_total_usd', 0)
        if monthly_cost > budget_limit:
            warnings.append({
                'severity': 'critical',
                'code': 'OVER_BUDGET',
                'message': (
                    f'Custo estimado (${monthly_cost:.2f}/mês) excede o limite de orçamento '
                    f'(${budget_limit:.2f}/mês)'
                ),
                'recommendation': (
                    'Considere reduzir a quantidade de nós, utilizar opções serverless '
                    'ou remover serviços opcionais para adequar ao orçamento'
                ),
            })

    return warnings


def _check_large_volume_athena_only(request: dict) -> list[dict]:
    """LARGE_VOLUME_ATHENA_ONLY: data_volume_tb > 50 AND query_engine == 'athena'."""
    warnings = []

    sources = request.get('sources', {}) or {}
    analytics = request.get('analytics', {}) or {}

    data_volume_tb = sources.get('data_volume_tb', 0)
    query_engine = analytics.get('query_engine', '')

    if data_volume_tb > 50 and query_engine == 'athena':
        warnings.append({
            'severity': 'warning',
            'code': 'LARGE_VOLUME_ATHENA_ONLY',
            'message': (
                f'Volume de dados ({data_volume_tb} TB) excede 50 TB com engine de query '
                f'somente Athena'
            ),
            'recommendation': (
                'Considere adicionar Redshift ou Redshift Serverless para queries complexas '
                'nesta escala de dados'
            ),
        })

    return warnings


def _check_high_concurrency_athena(request: dict) -> list[dict]:
    """HIGH_CONCURRENCY_ATHENA: concurrent_users > 50 AND query_engine == 'athena'."""
    warnings = []

    analytics = request.get('analytics', {}) or {}

    concurrent_users = analytics.get('concurrent_users', 0)
    query_engine = analytics.get('query_engine', '')

    if concurrent_users > 50 and query_engine == 'athena':
        warnings.append({
            'severity': 'warning',
            'code': 'HIGH_CONCURRENCY_ATHENA',
            'message': (
                f'Alta concorrência de usuários ({concurrent_users}) com Athena pode causar '
                f'throttling'
            ),
            'recommendation': (
                'Considere Redshift ou Redshift Serverless para suportar alta concorrência '
                'sem limitações de throttling'
            ),
        })

    return warnings


def _check_cdc_no_governance(request: dict) -> list[dict]:
    """CDC_NO_GOVERNANCE: dms_cdc_enabled == true AND (governance not present OR lake_formation_enabled == false)."""
    warnings = []

    sources = request.get('sources', {}) or {}
    governance = request.get('governance', {}) or {}

    dms_cdc_enabled = sources.get('dms_cdc_enabled', False)

    if dms_cdc_enabled:
        lake_formation_enabled = governance.get('lake_formation_enabled', False)
        # Warning if governance section is absent or Lake Formation is disabled
        if not governance or not lake_formation_enabled:
            warnings.append({
                'severity': 'info',
                'code': 'CDC_NO_GOVERNANCE',
                'message': (
                    'Replicação CDC habilitada sem governança Lake Formation ativa'
                ),
                'recommendation': (
                    'Habilite Lake Formation para controle de acesso granular sobre dados '
                    'replicados via CDC'
                ),
            })

    return warnings
