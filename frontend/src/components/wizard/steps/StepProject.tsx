import { useState, useEffect, useCallback, useMemo } from 'react';
import type { StepProps, ProjectData } from '../types';
import { useStepValidation } from '../../../hooks/useStepValidation';
import { Input, Select } from '../../ui';
import type { SelectOption } from '../../ui';

const AWS_REGIONS: SelectOption[] = [
  { value: 'us-east-1', label: 'US East (N. Virginia) - us-east-1' },
  { value: 'us-east-2', label: 'US East (Ohio) - us-east-2' },
  { value: 'us-west-1', label: 'US West (N. California) - us-west-1' },
  { value: 'us-west-2', label: 'US West (Oregon) - us-west-2' },
  { value: 'eu-west-1', label: 'EU (Ireland) - eu-west-1' },
  { value: 'eu-west-2', label: 'EU (London) - eu-west-2' },
  { value: 'eu-central-1', label: 'EU (Frankfurt) - eu-central-1' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore) - ap-southeast-1' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney) - ap-southeast-2' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo) - ap-northeast-1' },
  { value: 'sa-east-1', label: 'South America (São Paulo) - sa-east-1' },
];

const ENVIRONMENTS: SelectOption[] = [
  { value: 'dev', label: 'Desenvolvimento (dev)' },
  { value: 'staging', label: 'Homologação (staging)' },
  { value: 'prod', label: 'Produção (prod)' },
];

const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

export default function StepProject({ data, onValidSubmit, registerSubmit }: StepProps) {
  const initialData = data as ProjectData | undefined;

  const [projectName, setProjectName] = useState(initialData?.project_name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [region, setRegion] = useState(initialData?.region ?? '');
  const [environment, setEnvironment] = useState<string>(initialData?.environment ?? '');

  const validationRules = useMemo(
    () => [
      {
        field: 'project_name',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Nome do projeto é obrigatório';
          if (!PROJECT_NAME_REGEX.test(v))
            return 'Nome do projeto deve conter apenas letras, números, hífens e underscores';
          return null;
        },
      },
      {
        field: 'region',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Região é obrigatória';
          return null;
        },
      },
      {
        field: 'environment',
        validate: (value: unknown) => {
          const v = value as string;
          if (!v || v.trim() === '') return 'Ambiente é obrigatório';
          return null;
        },
      },
    ],
    []
  );

  const { errors, touched, validateField, validateAll, touchField } = useStepValidation(validationRules);

  const handleSubmit = useCallback(() => {
    const formData: Record<string, unknown> = {
      project_name: projectName,
      region,
      environment,
    };

    const isValid = validateAll(formData);
    if (isValid) {
      const submitData: ProjectData = {
        project_name: projectName.trim(),
        description: description.trim() || undefined,
        region,
        environment: environment as ProjectData['environment'],
      };
      onValidSubmit(submitData);
    }
  }, [projectName, description, region, environment, validateAll, onValidSubmit]);

  useEffect(() => {
    if (registerSubmit) {
      registerSubmit(handleSubmit);
    }
  }, [registerSubmit, handleSubmit]);

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setProjectName(value);
    if (touched.has('project_name')) {
      validateField('project_name', value);
    }
  };

  const handleProjectNameBlur = () => {
    touchField('project_name');
    validateField('project_name', projectName);
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setRegion(value);
    touchField('region');
    validateField('region', value);
  };

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setEnvironment(value);
    touchField('environment');
    validateField('environment', value);
  };

  return (
    <div data-testid="step-project" className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Projeto</h2>
        <p className="text-sm text-slate-500 mt-1">
          Defina as informações básicas do seu projeto de data lakehouse.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <Input
            label="Nome do Projeto"
            placeholder="meu-projeto-lakehouse"
            value={projectName}
            onChange={handleProjectNameChange}
            onBlur={handleProjectNameBlur}
            error={touched.has('project_name') ? errors.project_name : undefined}
            required
            hint="Apenas letras, números, hífens e underscores"
          />
        </div>

        <div className="md:col-span-2">
          <Input
            label="Descrição"
            placeholder="Descrição opcional do projeto"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <Select
          label="Região AWS"
          options={AWS_REGIONS}
          placeholder="Selecione uma região"
          value={region}
          onChange={handleRegionChange}
          error={touched.has('region') ? errors.region : undefined}
          required
        />

        <Select
          label="Ambiente"
          options={ENVIRONMENTS}
          placeholder="Selecione o ambiente"
          value={environment}
          onChange={handleEnvironmentChange}
          error={touched.has('environment') ? errors.environment : undefined}
          required
        />
      </div>
    </div>
  );
}
