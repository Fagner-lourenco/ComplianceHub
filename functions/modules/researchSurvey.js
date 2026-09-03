/**
 * researchSurvey.js — Recebe as respostas da pesquisa de produto.
 *
 * A pesquisa (ComplianceHub_Pesquisa_RH_FINAL_PUBLICACAO.html) roda em dois
 * lugares e o mesmo endpoint atende os dois:
 *   1. link publico, enviado a pessoas especificas — sem login;
 *   2. convite dentro do app — com usuario autenticado.
 *
 * Por isso o token do Firebase e OPCIONAL: quando vem, grava uid/tenant; quando
 * nao vem, a resposta e anonima e o parametro `origem` da URL diz de qual
 * convite ela veio.
 *
 * Nao ha PII obrigatoria aqui, mas ha texto livre onde a pessoa pode escrever
 * qualquer coisa — inclusive opiniao identificavel sobre colegas ou clientes.
 * Leitura fica restrita a ops/admin nas rules; escrita, so por esta funcao.
 */

const SURVEY_VERSION_MAX = 64;
const ORIGEM_MAX = 120;
const ANSWER_KEY_MAX = 80;
const ANSWER_TEXT_MAX = 4000;
const MAX_ANSWERS = 120;
const MAX_BODY_BYTES = 256 * 1024;

function textoLimitado(value, max) {
    if (typeof value !== 'string') return null;
    const limpo = value.trim();
    if (!limpo) return null;
    return limpo.slice(0, max);
}

/**
 * Normaliza as respostas vindas do formulario.
 *
 * O formulario tem 3 tipos: single (string), multi (array de string) e text
 * (string livre). Qualquer outra forma e descartada em vez de gravada como
 * veio — o documento e lido depois por analise, nao pode ter formato surpresa.
 */
function sanitizeAnswers(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    let count = 0;
    for (const [key, value] of Object.entries(raw)) {
        if (count >= MAX_ANSWERS) break;
        const chave = textoLimitado(key, ANSWER_KEY_MAX);
        if (!chave) continue;

        if (typeof value === 'string') {
            const texto = textoLimitado(value, ANSWER_TEXT_MAX);
            if (texto !== null) { out[chave] = texto; count += 1; }
            continue;
        }
        if (Array.isArray(value)) {
            const itens = value
                .map((item) => textoLimitado(item, ANSWER_TEXT_MAX))
                .filter((item) => item !== null)
                .slice(0, 50);
            if (itens.length > 0) { out[chave] = itens; count += 1; }
            continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) { out[chave] = value; count += 1; continue; }
        if (typeof value === 'boolean') { out[chave] = value; count += 1; }
    }
    return out;
}

function createSubmitResearchResponseHandler({ db, FieldValue, auth, logger = console }) {
    return async (req, res) => {
        // CORS: a pagina publica pode ser aberta de qualquer lugar, entao o
        // preflight precisa passar. O endpoint so escreve em colecao propria.
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');

        if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
        if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

        const bruto = req.body || {};
        if (Buffer.byteLength(JSON.stringify(bruto), 'utf8') > MAX_BODY_BYTES) {
            res.status(413).json({ error: 'payload_too_large' });
            return;
        }

        const answers = sanitizeAnswers(bruto.answers);
        if (Object.keys(answers).length === 0) {
            res.status(400).json({ error: 'no_answers' });
            return;
        }

        // Identidade e OPCIONAL: token invalido nao derruba a resposta, so a
        // deixa anonima. Perder feedback por causa de sessao expirada seria
        // pior do que gravar sem uid.
        let uid = null;
        let tenantId = null;
        const authHeader = req.get('Authorization') || '';
        if (authHeader.startsWith('Bearer ') && auth) {
            try {
                const decoded = await auth.verifyIdToken(authHeader.slice(7));
                uid = decoded.uid || null;
                tenantId = decoded.tenantId || null;
            } catch (err) {
                logger.warn?.(`[pesquisa] token ignorado: ${err.message}`);
            }
        }

        const doc = {
            surveyVersion: textoLimitado(bruto.surveyVersion, SURVEY_VERSION_MAX) || 'desconhecida',
            origem: textoLimitado(bruto.origem, ORIGEM_MAX),
            uid,
            tenantId: tenantId || textoLimitado(bruto.tenantId, ORIGEM_MAX),
            anonima: uid === null,
            parcial: bruto.parcial === true,
            answers,
            totalRespostas: Object.keys(answers).length,
            // Campos do payload do formulario (ComplianceHub_Pesquisa_RH...html):
            // nomes vem de la, nao renomeados aqui — o backend se adapta a pagina.
            respondentId: textoLimitado(bruto.respondentId, ORIGEM_MAX),
            iniciadoEm: textoLimitado(bruto.startedAt, 40),
            enviadoEm: textoLimitado(bruto.submittedAt, 40),
            viewport: textoLimitado(bruto.viewportCategory, 40),
            locale: textoLimitado(bruto.locale, 20),
            duracaoSegundos: Number.isFinite(bruto.durationSeconds)
                ? Math.max(0, Math.round(bruto.durationSeconds))
                : (Number.isFinite(bruto.duracaoSegundos) ? Math.max(0, Math.round(bruto.duracaoSegundos)) : null),
            userAgent: textoLimitado(req.get('User-Agent'), 400),
            criadoEm: FieldValue.serverTimestamp(),
        };

        try {
            const ref = await db.collection('researchResponses').add(doc);
            logger.log?.(`[pesquisa] resposta ${ref.id} (${doc.surveyVersion}, ${doc.totalRespostas} respostas, anonima=${doc.anonima})`);
            res.status(200).json({ ok: true, id: ref.id });
        } catch (err) {
            logger.error?.('[pesquisa] falha ao gravar:', err);
            res.status(500).json({ error: 'internal_error' });
        }
    };
}

module.exports = {
    createSubmitResearchResponseHandler,
    sanitizeAnswers,
};
