const DEFAULT_BASE_URL = 'https://escavador2-api-dowqa75f4a-rj.a.run.app';

class Escavador2Error extends Error {
    constructor(message, statusCode, responseBody) {
        super(message);
        this.name = 'Escavador2Error';
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function buildEscavador2Payload({ cpf, nome, options = {} }) {
    return {
        cpf: onlyDigits(cpf),
        nome: String(nome || '').trim(),
        detalhar: options.detalhar ?? true,
        movimentacoes: options.movimentacoes ?? 'risk_only',
        documentos: options.documentos ?? 'risk_only',
        limit_movimentacoes: options.limit_movimentacoes ?? 20,
        limit_documentos: options.limit_documentos ?? 20,
    };
}

async function consultarEscavador2({
    cpf,
    nome,
    apiKey,
    options = {},
    baseUrl = DEFAULT_BASE_URL,
}) {
    const payload = buildEscavador2Payload({ cpf, nome, options });

    if (payload.cpf.length !== 11) {
        throw new Error('CPF invalido para Escavador2.');
    }

    if (!apiKey) {
        throw new Error('ESCAVADOR2_API_KEY nao configurado.');
    }

    const response = await fetch(`${baseUrl}/escavador2/consultar`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Internal-Api-Key': apiKey,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const responseBody = await response.text();
        throw new Escavador2Error('Falha ao consultar Escavador2.', response.status, responseBody);
    }

    return response.json();
}

module.exports = {
    DEFAULT_BASE_URL,
    Escavador2Error,
    buildEscavador2Payload,
    consultarEscavador2,
};
