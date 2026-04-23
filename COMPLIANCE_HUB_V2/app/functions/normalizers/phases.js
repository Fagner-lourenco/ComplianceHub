/**
 * Normalizers: map FonteData raw API responses → form-ready field values + pt-BR notes.
 *
 * Each normalizer returns an object with the exact field names used by CasoPage form,
 * plus a `_source` key containing raw metadata for audit trail.
 *
 * Real API field names confirmed via live testing (2026-04-02).
 */

/**
 * Normalize Receita Federal response (receita-federal-pf).
 * Used for identity gate — only endpoint with situacaoCadastral.
 * Real fields: numeroCPF, nomePessoaFisica, nomeSocial, dataNascimento,
 *   situacaoCadastral ("REGULAR"), dataInscricao, possuiObito, anoObito, dataEmissao
 * @param {{ data: object, meta: object }} result
 */
function normalizeReceitaFederal(result) {
    const { data, meta } = result;

    return {
        enrichmentIdentity: {
            name: data.nomePessoaFisica || data.nomeSocial || null,
            cpfStatus: data.situacaoCadastral || null,
            birthDate: data.dataNascimento || null,
            hasDeathRecord: data.possuiObito || false,
            deathYear: data.anoObito || null,
            registrationDate: data.dataInscricao || null,
            consultedAt: new Date().toISOString(),
        },
        _source: {
            provider: 'fontedata',
            endpoint: 'receita-federal-pf',
            requestId: meta.requestId,
            cost: meta.cost,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize identity/contact response (cadastro-pf-basica).
 * Real fields: cpf, nome, sexo, dataNascimento, nomeMae, idade, signo,
 *   telefones[], enderecos[], emails[], rendaEstimada, rendaFaixaSalarial
 * @param {{ data: object, meta: object }} result
 */
function normalizeIdentity(result) {
    const { data, meta } = result;

    const phones = Array.isArray(data.telefones)
        ? data.telefones.map((t) => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object') {
                // Real API field: telefoneComDDD e.g. "(13) 992036849"
                return t.telefoneComDDD || t.numero || t.telefone || (t.ddd ? `(${t.ddd}) ${t.numero || t.telefone || ''}`.trim() : null);
            }
            return t != null ? String(t) : null;
        }).filter(Boolean)
        : [];

    const emails = Array.isArray(data.emails)
        ? data.emails.map((e) => {
            if (typeof e === 'string') return e;
            // Real API field: enderecoEmail e.g. "user@example.com"
            if (e && typeof e === 'object') return e.enderecoEmail || e.email || e.endereco || null;
            return e != null ? String(e) : null;
        }).filter(Boolean)
        : [];

    const rawAddresses = Array.isArray(data.enderecos) ? data.enderecos : [];

    const addresses = rawAddresses.map((a) => {
        if (typeof a === 'string') return a;
        // Clean up complemento: API returns literal "NULL" or "{num} NULL" when empty
        const complemento = a.complemento && !/^\s*(?:\d+\s+)?NULL\s*$/i.test(a.complemento)
            ? a.complemento : null;
        const parts = [a.logradouro, a.numero, complemento, a.bairro, a.cidade, a.uf, a.cep].filter(Boolean);
        return parts.join(', ') || JSON.stringify(a);
    });

    // Extract unique UFs from addresses for downstream tribunal filtering
    const allUfs = [...new Set(
        rawAddresses
            .map((a) => (typeof a === 'object' && a.uf) ? a.uf.toUpperCase() : null)
            .filter(Boolean),
    )];
    const primaryUf = allUfs[0] || null;

    return {
        enrichmentContact: {
            name: data.nome || null,
            motherName: data.nomeMae || null,
            birthDate: data.dataNascimento || null,
            gender: data.sexo || null,
            age: data.idade || null,
            phones,
            emails,
            addresses,
            primaryUf,
            allUfs,
            estimatedIncome: data.rendaEstimada || null,
            incomeBracket: data.rendaFaixaSalarial || null,
            consultedAt: new Date().toISOString(),
        },
        _source: {
            provider: 'fontedata',
            endpoint: 'cadastro-pf-basica',
            requestId: meta.requestId,
            cost: meta.cost,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize grouped lawsuit response (processos-agrupada).
 * Real fields: documentoConsultado, segmentos[], tribunais[],
 *   distribuicaoPorAno[], areasDireito[], totalProcessos, observacoes
 *
 * Criminal detection: check segmentos/areasDireito for criminal-related terms.
 * @param {{ data: object, meta: object }} result
 */
function normalizeProcessos(result) {
    const { data, meta } = result;

    const totalProcessos = data.totalProcessos || 0;
    const segmentos = Array.isArray(data.segmentos) ? data.segmentos : [];
    const tribunais = Array.isArray(data.tribunais) ? data.tribunais : [];
    const areas = Array.isArray(data.areasDireito) ? data.areasDireito : [];
    const distribuicao = Array.isArray(data.distribuicaoPorAno) ? data.distribuicaoPorAno : [];

    // Criminal detection from segmentos and areasDireito
    const criminalTerms = /criminal|penal|exec.*penal/i;
    const criminalSegmentos = segmentos.filter((s) => {
        const nome = typeof s === 'string' ? s : s.nome || s.segmento || '';
        return criminalTerms.test(nome);
    });
    const criminalAreas = areas.filter((a) => {
        const nome = typeof a === 'string' ? a : a.areaDireito || a.nome || a.area || '';
        return criminalTerms.test(nome);
    });
    const hasCriminal = criminalSegmentos.length > 0 || criminalAreas.length > 0;

    // Build notes
    let criminalNotes = '';
    if (hasCriminal) {
        const details = [];
        if (criminalSegmentos.length > 0) details.push(`Segmentos: ${criminalSegmentos.map((s) => typeof s === 'string' ? s : s.nome || s.segmento).join(', ')}`);
        if (criminalAreas.length > 0) details.push(`Areas: ${criminalAreas.map((a) => typeof a === 'string' ? a : a.areaDireito || a.nome || a.area).join(', ')}`);
        criminalNotes = `Detectado(s) processo(s) na esfera criminal/penal via processos-agrupada.\n${details.join('\n')}`;
    } else {
        criminalNotes = 'Nenhum processo na esfera criminal/penal detectado (processos-agrupada).';
    }

    // Process summary notes
    let processNotes = `Total de processos: ${totalProcessos}.`;
    if (tribunais.length > 0) {
        const tribunalList = tribunais.slice(0, 10).map((t) => {
            const nome = typeof t === 'string' ? t : t.tribunal || t.nome || JSON.stringify(t);
            const qtd = typeof t === 'object' ? (t.totalPorTribunal || t.quantidade || t.total || '') : '';
            return qtd ? `${nome} (${qtd})` : nome;
        });
        processNotes += `\nTribunais: ${tribunalList.join(', ')}`;
    }
    if (areas.length > 0) {
        const areaList = areas.slice(0, 10).map((a) => {
            const nome = typeof a === 'string' ? a : a.areaDireito || a.nome || a.area || JSON.stringify(a);
            const qtd = typeof a === 'object' ? (a.totalProcessosArea || a.quantidade || a.total || '') : '';
            return qtd ? `${nome} (${qtd})` : nome;
        });
        processNotes += `\nAreas do Direito: ${areaList.join(', ')}`;
    }
    if (distribuicao.length > 0) {
        const yearList = distribuicao.slice(-5).map((d) => {
            const ano = typeof d === 'object' ? (d.ano || d.year) : d;
            const qtd = typeof d === 'object' ? (d.totalPorAno || d.quantidade || d.total || '') : '';
            return qtd ? `${ano}: ${qtd}` : String(ano);
        });
        processNotes += `\nDistribuicao recente: ${yearList.join(', ')}`;
    }
    if (data.observacoes) processNotes += `\nObs: ${data.observacoes}`;

    const fontedataCriminalFlag = hasCriminal ? 'POSITIVE' : 'NEGATIVE';
    return {
        criminalFlag: fontedataCriminalFlag,
        fontedataCriminalFlag,
        criminalNotes,
        processTotal: totalProcessos,
        processNotes,
        processSegmentos: segmentos,
        processTribunais: tribunais,
        processAreas: areas,
        processDistribuicao: distribuicao,
        _source: {
            provider: 'fontedata',
            endpoint: 'processos-agrupada',
            requestId: meta.requestId,
            cost: meta.cost,
            totalProcessos,
            hasCriminal,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize full lawsuit details (processos-completa).
 * Returns per-process breakdown for detailed analysis.
 * @param {{ data: object, meta: object }} result
 */
function normalizeProcessosCompleta(result) {
    const { data, meta } = result;

    const processos = Array.isArray(data.processos) ? data.processos : (Array.isArray(data) ? data : []);

    const items = processos.slice(0, 50).map((p) => ({
        numero: p.numeroProcesso || p.numero || null,
        instancia: p.instancia || null,
        orgao: p.orgaoJulgador?.orgaoResponsavel || p.orgaoJulgador?.tribunal || p.orgaoJulgador?.nome || null,
        area: p.areaDireito || null,
        assuntos: Array.isArray(p.assuntos) ? p.assuntos.map((a) => a.assunto || a.nome || a.descricao || a).slice(0, 5) : [],
        dataDistribuicao: p.dataDistribuicao || null,
        valor: p.valorProcesso || p.valor || null,
        status: p.detalhesStatusProcesso?.statusDetalhes || p.detalhesStatusProcesso?.nome || p.status || null,
        partes: Array.isArray(p.partes) ? p.partes.map((pt) => `${pt.polo || pt.posicaoProcessual || pt.tipoParte || ''}: ${pt.nomeCompleto || pt.nome || ''}`).slice(0, 10) : [],
    }));

    let notes = `Detalhes de ${processos.length} processo(s) obtidos via processos-completa.\n`;
    items.slice(0, 10).forEach((p, i) => {
        const parts = [];
        if (p.numero) parts.push(`Nº ${p.numero}`);
        if (p.area) parts.push(p.area);
        if (p.status) parts.push(p.status);
        if (p.valor) parts.push(`R$ ${p.valor}`);
        if (p.dataDistribuicao) parts.push(p.dataDistribuicao);
        notes += `${i + 1}. ${parts.join(' | ')}\n`;
    });
    if (processos.length > 10) notes += `... e mais ${processos.length - 10} processo(s).`;

    return {
        processosCompleta: items,
        processosCompletaNotes: notes,
        _source: {
            provider: 'fontedata',
            endpoint: 'processos-completa',
            requestId: meta.requestId,
            cost: meta.cost,
            totalProcessos: processos.length,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize warrant response (cnj-mandados-prisao).
 * Real fields: cpf, possuiMandado (boolean), mandadosPrisao[], status
 * @param {{ data: object, meta: object }} result
 */
function normalizeWarrant(result) {
    const { data, meta } = result;
    const hasWarrants = data.possuiMandado === true;
    const mandados = Array.isArray(data.mandadosPrisao) ? data.mandadosPrisao : [];

    let notes = '';
    if (hasWarrants && mandados.length > 0) {
        const items = mandados.slice(0, 10).map((m, i) => {
            const parts = [];
            if (m.tipo || m.tipoPena) parts.push(`Tipo: ${m.tipo || m.tipoPena}`);
            if (m.orgao || m.orgaoExpedidor) parts.push(`Orgao: ${m.orgao || m.orgaoExpedidor}`);
            if (m.dataExpedicao || m.data) parts.push(`Data: ${m.dataExpedicao || m.data}`);
            if (m.status || m.situacao) parts.push(`Status: ${m.status || m.situacao}`);
            if (m.numeroPeca || m.numero) parts.push(`Nº: ${m.numeroPeca || m.numero}`);
            return `${i + 1}. ${parts.join(' | ') || 'Mandado encontrado'}`;
        });
        notes = `ALERTA: ${mandados.length} mandado(s) de prisao encontrado(s).\n${items.join('\n')}`;
    } else if (hasWarrants) {
        notes = 'ALERTA: possuiMandado=true mas sem detalhes disponiveis.';
    } else {
        notes = 'Nenhum mandado de prisao encontrado (CNJ).';
    }

    const fontedataWarrantFlag = hasWarrants ? 'POSITIVE' : 'NEGATIVE';
    return {
        warrantFlag: fontedataWarrantFlag,
        fontedataWarrantFlag,
        warrantNotes: notes,
        warrantCount: mandados.length,
        _source: {
            provider: 'fontedata',
            endpoint: 'cnj-mandados-prisao',
            requestId: meta.requestId,
            cost: meta.cost,
            possuiMandado: hasWarrants,
            recordCount: mandados.length,
            consultedAt: new Date().toISOString(),
        },
    };
}

/**
 * Normalize labor court response (trt-consulta).
 * Real fields: documento, regiao, nome, numeroCertidao, dataEmissao,
 *   dataValidade, status, possuiProcesso (boolean), processos[]
 * @param {{ data: object, meta: object }} result
 */
function normalizeLabor(result) {
    const { data, meta } = result;
    const hasLabor = data.possuiProcesso === true;
    const processos = Array.isArray(data.processos) ? data.processos : [];

    let severity = null;
    if (hasLabor || processos.length > 0) {
        if (processos.length >= 5) severity = 'HIGH';
        else if (processos.length >= 2) severity = 'MEDIUM';
        else severity = 'LOW';
    }

    let notes = '';
    if (hasLabor || processos.length > 0) {
        const items = processos.slice(0, 10).map((p, i) => {
            const parts = [];
            if (p.numero || p.numeroProcesso) parts.push(`Nº: ${p.numero || p.numeroProcesso}`);
            if (p.tribunal || p.vara) parts.push(p.tribunal || p.vara);
            if (p.situacao || p.status) parts.push(`Situacao: ${p.situacao || p.status}`);
            if (p.assunto) parts.push(p.assunto);
            if (p.dataDistribuicao || p.data) parts.push(`Data: ${p.dataDistribuicao || p.data}`);
            if (p.valor) parts.push(`Valor: R$ ${p.valor}`);
            return `${i + 1}. ${parts.join(' | ') || 'Processo trabalhista encontrado'}`;
        });
        const count = processos.length > 0 ? processos.length : '1+';
        notes = `Encontrado(s) ${count} processo(s) trabalhista(s) no TRT`;
        if (meta.regions) notes += ` (regioes: ${meta.regions.join(', ')})`;
        notes += `.\n${items.join('\n')}`;
        if (processos.length > 10) notes += `\n... e mais ${processos.length - 10} processo(s).`;
    } else {
        notes = 'Nenhum processo trabalhista encontrado no TRT';
        if (data.regiao) notes += ` (regiao ${data.regiao})`;
        notes += '.';
        if (data.numeroCertidao) notes += ` Certidao: ${data.numeroCertidao}`;
        if (data.dataValidade) notes += ` (validade: ${data.dataValidade})`;
    }

    const fontedataLaborFlag = (hasLabor || processos.length > 0) ? 'POSITIVE' : 'NEGATIVE';
    return {
        laborFlag: fontedataLaborFlag,
        fontedataLaborFlag,
        laborSeverity: severity,
        laborNotes: notes,
        laborProcessCount: processos.length,
        _source: {
            provider: 'fontedata',
            endpoint: 'trt-consulta',
            requestId: meta.requestId,
            cost: meta.cost,
            possuiProcesso: hasLabor,
            totalProcessos: processos.length,
            regions: meta.regions || (data.regiao ? [data.regiao] : []),
            consultedAt: new Date().toISOString(),
        },
    };
}

module.exports = {
    normalizeReceitaFederal,
    normalizeIdentity,
    normalizeProcessos,
    normalizeProcessosCompleta,
    normalizeWarrant,
    normalizeLabor,
    // Legacy aliases
    normalizeCriminal: normalizeProcessos,
};
