export interface ArchitectureInput {
  data_volume_tb: number;
  records_per_day_millions: number;
  avg_query_complexity: "low" | "medium" | "high";
  max_query_latency_sec: number;
  concurrent_users: number;
}

export interface ArchitectureOutput {
  architecture_type: "full_lakehouse_with_redshift" | "light_lakehouse_athena";
  services: string[];
  estimated_monthly_cost_usd: number;
  cost_breakdown_per_service: Record<string, number>;
  diagram_mermaid: string;
  provisioning_steps: string[];
  message: string;
  cloudformation_template_url?: string;
}
