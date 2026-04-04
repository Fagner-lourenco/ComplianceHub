/**
 * Normalizers: map Escavador API responses → form-ready field values + pt-BR notes.
 *
 * Each normalizer returns an object with field names prefixed with `escavador*`,
 * plus a `_source` key for audit trail.
 */

const CRIMINAL_AREAS = /penal|criminal/i;

/**
 * Find the role of a person in a process's envolvidos array by CPF.
 * @param {object[]} envolvidos
 * @param {string} cpf  11 digits, no formatting
 * @returns {{ tipo: string, tipoNormalizado: string, polo: string }|null}
 */
function findPersonRole(envolvidos, cpf) {
    if (!Array.isArray(envolvidos) || !cpf) return null;
    const cleanCpf = cpf.replace(/\D/g, '');
    for (const env of envolvidos) {
        const envCpf = (env.cpf || '').replace(/\D/g, '');
        if (envCpf && envCpf === cleanCpf) {
            return {
                tipo: env.tipo || null,
                tipoNormalizado: env.tipo_normalizado || null,
                polo: env.polo || null,
            };
        }
    }
    // Fallback: name match not implemented — CPF matching is sufficient
    return null;
}

/**
 * Normalize Escavador processos response.
 * @param {{ envolvido: object|null, items: object[], totalPages: number }} result
 * @param {string} cpf  For role detection
 * @returns {object}
 */
function normalizeEscavadorProcessos(result, cpf) {
    const { envolvido, items, totalPages } = result;
    const totalFromApi = envolvido?.quantidade_processos || items.length;

    let criminalCount = 0;
    const processos = [];

    for (const item of items) {
        // Each item is a processo with fontes[] containing capa, envolvidos, etc.
        const fonte = Array.isArray(item.fontes) ? item.fontes[0] : null;
        const capa = fonte?.capa || {};
        const area = capa.area || '';
        const isCriminal = CRIMINAL_AREAS.test(area);
        if (isCriminal) criminalCount++;

        // Find person's role in this process
        const envolvidos = fonte?.envolvidos || [];
        const role = findPersonRole(envolvidos, cpf);

        processos.push({
            numeroCnj: item.numero_cnj || null,
            area: area || null,
            classe: capa.classe || null,
            assuntoPrincipal: capa.assunto_principal_normalizado?.nome || capa.assunto || null,
            valorCausa: capa.valor_causa?.valor_formatado || null,
            status: capa.situacao || fonte?.status_predito || null,
            tribunalSigla: fonte?.sigla || item.unidade_origem?.tribunal_sigla || null,
            dataInicio: item.data_inicio || capa.data_distribuicao || null,
            dataUltimaMovimentacao: item.data_ultima_movimentacao || null,
            polo: role?.polo || null,
            tipo: role?.tipo || null,
            tipoNormalizado: role?.tipoNormalizado || null,
            segredoJustica: fonte?.segredo_justica || false,
            grau: fonte?.grau || null,
            grauFormatado: fonte?.grau_formatado || null,
        });
    }

    const hasCriminal = criminalCount > 0;
    const activeCount = processos.filter((p) =>
        p.status && /ativo/i.test(p.status),
    ).length;

    // Build notes
    let notes = `Escavador: ${totalFromApi} processo(s) encontrado(s)`;
    if (processos.length < totalFromApi) notes += ` (${processos.length} carregados)`;
    notes += '.';
    if (hasCriminal) notes += ` ${criminalCount} na esfera criminal/penal.`;
    if (activeCount > 0) notes += ` ${activeCount} processo(s) ativo(s).`;

    // Process summary (top 10)
    processos.slice(0, 10).forEach((p, i) => {
        const parts = [];
        if (p.numeroCnj) parts.push(p.numeroCnj);
        if (p.area) parts.push(p.area);
        if (p.tipoNormalizado) parts.push(p.tipoNormalizado);
        if (p.polo) parts.push(`polo ${p.polo}`);
        if (p.status) parts.push(p.status);
        if (p.valorCausa) parts.push(p.valorCausa);
        notes += `\n${i + 1}. ${parts.join(' | ')}`;
    });
    if (processos.length > 10) notes += `\n... e mais ${processos.length - 10} processo(s).`;

    return {
        escavadorProcessTotal: totalFromApi,
        escavadorCriminalFlag: hasCriminal ? 'POSITIVE' : 'NEGATIVE',
        escavadorCriminalCount: criminalCount,
        escavadorActiveCount: activeCount,
        escavadorProcessos: processos,
        escavadorNotes: notes,
        _source: {
            provider: 'escavador',
            endpoint: 'envolvido/processos',
            totalProcessos: totalFromApi,
            loadedProcessos: processos.length,
            totalPages,
            hasCriminal,
            consultedAt: new Date().toISOString(),
        },
    };
}

module.exports = {
    normalizeEscavadorProcessos,
    findPersonRole,
};
