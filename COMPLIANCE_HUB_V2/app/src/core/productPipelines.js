/**
 * Product Pipeline Registry — defines the onboarding + input flow for each product.
 *
 * Each product has:
 *  - steps: which wizard steps to show
 *  - subjectFields: dynamic form fields for the subject
 *  - modules: default modules that will run
 *  - intro: educational copy for first-time use
 *  - statusMessages: custom messages during analysis (AnaliseRapidaPage)
 */

const PRODUCT_PIPELINES = {
    dossier_pf_basic: {
        productKey: 'dossier_pf_basic',
        family: 'dossie',
        color: '#2563eb',
        steps: ['intro', 'subject', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: true,
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text', placeholder: 'Nome completo do sujeito' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf', placeholder: '000.000.000-00' },
            { name: 'dateOfBirth', label: 'Data de nascimento', required: false, type: 'date' },
            { name: 'motherName', label: 'Nome da mãe', required: false, type: 'text', placeholder: 'Nome completo da mãe' },
        ],
        modules: ['identity_pf', 'criminal', 'labor', 'warrants', 'kyc'],
        intro: {
            title: 'Dossiê PF — Essencial',
            description: 'Análise cadastral, criminal, trabalhista e listas restritivas. Ideal para due diligence de colaboradores e parceiros comerciais.',
            features: [
                { icon: 'ID', label: 'Cadastral completo (Receita Federal)' },
                { icon: 'CR', label: 'Antecedentes criminais' },
                { icon: 'TR', label: 'Histórico trabalhista' },
                { icon: 'KY', label: 'PEP, sanções e listas restritivas' },
            ],
            estimatedTime: '2–3 minutos',
        },
        statusMessages: {
            initializing: 'Iniciando Dossiê PF Essencial...',
            running: 'Consultando bases cadastrais e restritivas...',
            compiling: 'Compilando achados do dossiê...',
            finalizing: 'Finalizando relatório estruturado...',
        },
    },
    dossier_pf_full: {
        productKey: 'dossier_pf_full',
        family: 'dossie',
        color: '#1d4ed8',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: true,
        hasRealtimeDashboard: true,
        socialProfileFields: [
            { name: 'instagram', label: 'Instagram', placeholder: '@usuario' },
            { name: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/usuario' },
            { name: 'facebook', label: 'Facebook', placeholder: 'facebook.com/usuario' },
            { name: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
            { name: 'twitter', label: 'Twitter/X', placeholder: '@usuario' },
            { name: 'youtube', label: 'YouTube', placeholder: 'youtube.com/c/usuario' },
        ],
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
            { name: 'dateOfBirth', label: 'Data de nascimento', required: false, type: 'date' },
            { name: 'motherName', label: 'Nome da mãe', required: false, type: 'text' },
            { name: 'position', label: 'Cargo/função', required: false, type: 'text' },
        ],
        modules: ['identity_pf', 'criminal', 'labor', 'warrants', 'kyc', 'osint', 'social', 'digital'],
        intro: {
            title: 'Dossiê PF — Completo',
            description: 'Investigação aprofundada com análise de mídia, perfil digital e conflitos de interesse. Recomendado para cargos de alto risco e executivos.',
            features: [
                { icon: 'ID', label: 'Cadastral completo' },
                { icon: 'CR', label: 'Criminal + mandados' },
                { icon: 'TR', label: 'Trabalhista' },
                { icon: 'KY', label: 'PEP e sanções' },
                { icon: 'OS', label: 'OSINT e mídia adversa' },
                { icon: 'DG', label: 'Perfil digital e reputação' },
            ],
            estimatedTime: '4–6 minutos',
        },
    },
    dossier_pj: {
        productKey: 'dossier_pj',
        family: 'dossie',
        color: '#2563eb',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: true,
        subjectFields: [
            { name: 'legalName', label: 'Razão social', required: true, type: 'text', placeholder: 'Razão social da empresa' },
            { name: 'cnpj', label: 'CNPJ', required: true, type: 'cnpj', placeholder: '00.000.000/0000-00' },
            { name: 'tradeName', label: 'Nome fantasia', required: false, type: 'text' },
            { name: 'foundingDate', label: 'Data de fundação', required: false, type: 'date' },
        ],
        modules: ['identity_pj', 'criminal', 'judicial', 'kyc', 'relationship'],
        intro: {
            title: 'Dossiê PJ',
            description: 'Análise completa de pessoa jurídica: cadastro empresarial, sócios, processos judiciais e vínculos societários.',
            features: [
                { icon: 'EM', label: 'Cadastro empresarial (RFB)' },
                { icon: 'RL', label: 'Sócios e relações societárias' },
                { icon: 'JU', label: 'Processos judiciais' },
                { icon: 'KY', label: 'Sanções e listas restritivas' },
            ],
            estimatedTime: '3–5 minutos',
        },
    },
    kyc_individual: {
        productKey: 'kyc_individual',
        family: 'compliance',
        color: '#059669',
        steps: ['intro', 'subject', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: true,
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
            { name: 'dateOfBirth', label: 'Data de nascimento', required: false, type: 'date' },
            { name: 'nationality', label: 'Nacionalidade', required: false, type: 'text' },
        ],
        modules: ['identity_pf', 'kyc', 'warrants', 'criminal'],
        intro: {
            title: 'KYC Individual',
            description: 'Know Your Customer para pessoa física. Validação de identidade, screening em listas restritivas e sanções internacionais.',
            features: [
                { icon: 'ID', label: 'Validação de identidade' },
                { icon: 'KY', label: 'Screening PEP e sanções' },
                { icon: 'CR', label: 'Checagem criminal' },
                { icon: 'MD', label: 'Mandados de prisão' },
            ],
            estimatedTime: '2–3 minutos',
        },
    },
    kyb_business: {
        productKey: 'kyb_business',
        family: 'compliance',
        color: '#059669',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: true,
        subjectFields: [
            { name: 'legalName', label: 'Razão social', required: true, type: 'text' },
            { name: 'cnpj', label: 'CNPJ', required: true, type: 'cnpj' },
            { name: 'tradeName', label: 'Nome fantasia', required: false, type: 'text' },
            { name: 'mainActivity', label: 'Atividade principal (CNAE)', required: false, type: 'text' },
        ],
        modules: ['identity_pj', 'kyc', 'relationship', 'osint', 'judicial'],
        intro: {
            title: 'KYB — Know Your Business',
            description: 'Due diligence corporativa completa: estrutura societária, screening de sócios, processos e reputação empresarial.',
            features: [
                { icon: 'EM', label: 'Cadastro empresarial' },
                { icon: 'RL', label: 'Sócios e estrutura societária' },
                { icon: 'KY', label: 'Screening de sanções' },
                { icon: 'OS', label: 'Reputação e mídia' },
                { icon: 'JU', label: 'Processos judiciais' },
            ],
            estimatedTime: '3–5 minutos',
        },
    },
    kye_employee: {
        productKey: 'kye_employee',
        family: 'compliance',
        color: '#059669',
        steps: ['intro', 'subject', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: true,
        hasRealtimeDashboard: true,
        socialProfileFields: [
            { name: 'instagram', label: 'Instagram', placeholder: '@usuario' },
            { name: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/usuario' },
            { name: 'facebook', label: 'Facebook', placeholder: 'facebook.com/usuario' },
            { name: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
            { name: 'twitter', label: 'Twitter/X', placeholder: '@usuario' },
            { name: 'youtube', label: 'YouTube', placeholder: 'youtube.com/c/usuario' },
        ],
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
            { name: 'position', label: 'Cargo', required: false, type: 'text' },
            { name: 'department', label: 'Departamento', required: false, type: 'text' },
        ],
        modules: ['identity_pf', 'criminal', 'labor', 'kyc', 'warrants'],
        intro: {
            title: 'KYE — Background Check Colaborador',
            description: 'Verificação de antecedentes para processo de admissional. Rápido, completo e em conformidade com a LGPD.',
            features: [
                { icon: 'ID', label: 'Identidade e cadastro' },
                { icon: 'CR', label: 'Antecedentes criminais' },
                { icon: 'TR', label: 'Histórico trabalhista' },
                { icon: 'KY', label: 'PEP e sanções' },
            ],
            estimatedTime: '2–3 minutos',
        },
    },
    kys_supplier: {
        productKey: 'kys_supplier',
        family: 'compliance',
        color: '#059669',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: true,
        subjectFields: [
            { name: 'legalName', label: 'Razão social', required: true, type: 'text' },
            { name: 'cnpj', label: 'CNPJ', required: true, type: 'cnpj' },
            { name: 'tradeName', label: 'Nome fantasia', required: false, type: 'text' },
        ],
        modules: ['identity_pj', 'identity_pf', 'criminal', 'kyc', 'relationship'],
        intro: {
            title: 'KYS — Due Diligence de Fornecedor',
            description: 'Avaliação de risco de cadeia de suprimentos. Identifica vínculos ocultos, sanções e riscos reputacionais de fornecedores.',
            features: [
                { icon: 'EM', label: 'Cadastro empresarial' },
                { icon: 'RL', label: 'Sócios e vínculos' },
                { icon: 'KY', label: 'Sanções e listas' },
                { icon: 'CR', label: 'Antecedentes criminais' },
            ],
            estimatedTime: '3–5 minutos',
        },
    },
    tpr_third_party: {
        productKey: 'tpr_third_party',
        family: 'third_party',
        color: '#7c3aed',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: true,
        hasRealtimeDashboard: true,
        socialProfileFields: [
            { name: 'instagram', label: 'Instagram', placeholder: '@usuario' },
            { name: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/usuario' },
            { name: 'facebook', label: 'Facebook', placeholder: 'facebook.com/usuario' },
            { name: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
            { name: 'twitter', label: 'Twitter/X', placeholder: '@usuario' },
            { name: 'youtube', label: 'YouTube', placeholder: 'youtube.com/c/usuario' },
        ],
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
            { name: 'legalName', label: 'Razão social (se aplicável)', required: false, type: 'text' },
            { name: 'cnpj', label: 'CNPJ (se aplicável)', required: false, type: 'cnpj' },
        ],
        modules: ['identity_pf', 'identity_pj', 'criminal', 'kyc', 'labor', 'relationship'],
        intro: {
            title: 'TPR — Terceiros em Compliance',
            description: 'Due diligence avançada para terceiros com alto risco de compliance: intermediários, consultores e parceiros estratégicos.',
            features: [
                { icon: 'ID', label: 'PF e PJ (dual)' },
                { icon: 'RL', label: 'Rede de relacionamentos' },
                { icon: 'KY', label: 'Screening completo' },
                { icon: 'CR', label: 'Criminal + trabalhista' },
            ],
            estimatedTime: '4–6 minutos',
        },
    },
    reputational_risk: {
        productKey: 'reputational_risk',
        family: 'risk',
        color: '#dc2626',
        steps: ['intro', 'subject', 'modules', 'review'],
        supportsExpressMode: true,
        supportsPriority: true,
        supportsSocialProfiles: true,
        hasRealtimeDashboard: true,
        socialProfileFields: [
            { name: 'instagram', label: 'Instagram', placeholder: '@usuario' },
            { name: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/usuario' },
            { name: 'facebook', label: 'Facebook', placeholder: 'facebook.com/usuario' },
            { name: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
            { name: 'twitter', label: 'Twitter/X', placeholder: '@usuario' },
            { name: 'youtube', label: 'YouTube', placeholder: 'youtube.com/c/usuario' },
        ],
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
        ],
        modules: ['identity_pf', 'osint', 'social', 'digital'],
        intro: {
            title: 'Risco Reputacional',
            description: 'Monitoramento de reputação digital e mídia adversa. Identifica notícias negativas, polêmicas e riscos de imagem.',
            features: [
                { icon: 'OS', label: 'Mídia e notícias' },
                { icon: 'DG', label: 'Perfil digital' },
                { icon: 'SC', label: 'Redes sociais' },
            ],
            estimatedTime: '2–4 minutos',
        },
    },
    ongoing_monitoring: {
        productKey: 'ongoing_monitoring',
        family: 'monitoring',
        color: '#d97706',
        steps: ['intro', 'subject', 'review'],
        supportsExpressMode: false,
        supportsPriority: false,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: false,
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
        ],
        modules: ['ongoing_monitoring'],
        intro: {
            title: 'Monitoramento Contínuo',
            description: 'Reconsulta periódica automatizada. Seja alertado quando novos achados surgirem em bases oficiais.',
            features: [
                { icon: 'MN', label: 'Reconsulta automática' },
                { icon: 'AL', label: 'Alertas em tempo real' },
                { icon: 'HS', label: 'Histórico comparativo' },
            ],
            estimatedTime: '1–2 minutos',
        },
    },
    report_secure: {
        productKey: 'report_secure',
        family: 'output',
        color: '#4b5563',
        steps: ['intro', 'subject', 'review'],
        supportsExpressMode: false,
        supportsPriority: false,
        supportsSocialProfiles: false,
        hasRealtimeDashboard: false,
        subjectFields: [
            { name: 'fullName', label: 'Nome completo', required: true, type: 'text' },
            { name: 'cpf', label: 'CPF', required: true, type: 'cpf' },
        ],
        modules: ['decision', 'report_secure'],
        intro: {
            title: 'Relatório Seguro',
            description: 'Geração de relatório auditável com hash de integridade. Ideal para processos jurídicos e auditorias.',
            features: [
                { icon: 'RP', label: 'Relatório com hash' },
                { icon: 'AU', label: 'Trilha de auditoria' },
                { icon: 'LK', label: 'Link público seguro' },
            ],
            estimatedTime: '1–2 minutos',
        },
    },
};

export function getPipelineConfig(productKey) {
    return PRODUCT_PIPELINES[productKey] || PRODUCT_PIPELINES.dossier_pf_basic;
}

export function getPipelineConfigStrict(productKey) {
    const config = PRODUCT_PIPELINES[productKey];
    if (!config) {
        throw new Error(`Produto desconhecido: ${productKey}`);
    }
    return config;
}

export function isValidProductKey(productKey) {
    return Object.prototype.hasOwnProperty.call(PRODUCT_PIPELINES, productKey);
}

export function listPipelines() {
    return Object.values(PRODUCT_PIPELINES);
}

export function getFamilyColor(family) {
    const colors = {
        dossie: '#2563eb',
        compliance: '#059669',
        third_party: '#7c3aed',
        risk: '#dc2626',
        monitoring: '#d97706',
        output: '#4b5563',
    };
    return colors[family] || '#6b7280';
}

export function getFamilyLabel(family) {
    const labels = {
        dossie: 'Dossiê',
        compliance: 'Compliance',
        third_party: 'Terceiros',
        risk: 'Risco',
        monitoring: 'Monitoramento',
        output: 'Relatório',
    };
    return labels[family] || family;
}

export { PRODUCT_PIPELINES };
export default PRODUCT_PIPELINES;
