/**
 * Test: Query Judit warrant for FRANCISCO TACIANO DE SOUSA (050.232.903-36)
 * Then normalize and print result.
 */
const JUDIT_API_KEY = '99884e54-16dd-4aea-85a9-70a7b0721767';
const ASYNC_BASE_URL = 'https://requests.prod.judit.io';
const CPF = '050.232.903-36';

async function callPost(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': JUDIT_API_KEY },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`POST ${url} → ${res.status}: ${JSON.stringify(data)}`);
    return data;
}

async function callGet(url) {
    const res = await fetch(url, {
        headers: { 'api-key': JUDIT_API_KEY },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}: ${JSON.stringify(data)}`);
    return data;
}

async function pollRequest(requestId) {
    const maxWait = 300_000;
    const interval = 5000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
        const status = await callGet(`${ASYNC_BASE_URL}/requests/${requestId}`);
        console.log(`  poll: ${status.status} (${((Date.now() - start) / 1000).toFixed(0)}s)`);
        if (status.status === 'completed') return status;
        if (status.status === 'failed') throw new Error('Request failed: ' + JSON.stringify(status));
        await new Promise(r => setTimeout(r, interval));
    }
    throw new Error('Poll timeout');
}

async function main() {
    console.log(`\n=== Judit Warrant Test: ${CPF} ===\n`);

    // Step 1: Create async request
    const body = {
        search: {
            search_type: 'cpf',
            search_key: CPF,
            response_type: 'warrant',
        },
    };
    console.log('1. Creating warrant request...');
    console.log('   Body:', JSON.stringify(body, null, 2));
    const createResult = await callPost(`${ASYNC_BASE_URL}/requests`, body);
    const requestId = createResult.request_id;
    console.log(`   request_id: ${requestId}`);
    console.log(`   status: ${createResult.status}`);

    // Step 2: Poll
    console.log('\n2. Polling...');
    await pollRequest(requestId);

    // Step 3: Fetch responses
    console.log('\n3. Fetching responses...');
    const responses = await callGet(`${ASYNC_BASE_URL}/responses?request_id=${requestId}&page=1&page_size=100`);
    console.log(`   all_count: ${responses.all_count}`);
    console.log(`   page_data length: ${responses.page_data?.length || 0}`);

    if (responses.page_data && responses.page_data.length > 0) {
        for (const item of responses.page_data) {
            const d = item.response_data || item;
            console.log('\n   --- WARRANT FOUND ---');
            console.log(`   code:            ${d.code}`);
            console.log(`   status:          ${d.status}`);
            console.log(`   warrant_type:    ${d.warrant_type}`);
            console.log(`   arrest_type:     ${d.arrest_type}`);
            console.log(`   issue_date:      ${d.issue_date}`);
            console.log(`   tribunal:        ${d.tribunal_acronym}`);
            console.log(`   court:           ${d.court}`);
            console.log(`   entity.name:     ${d.entity?.name}`);
            console.log(`   entity.cpf:      ${d.entity?.main_document}`);
            console.log(`   judgement:       ${(d.judgementSummary || '').slice(0, 200)}...`);
        }
    } else {
        console.log('\n   ⚠️ ZERO warrants returned!');
    }

    // Step 4: Normalize (inline) 
    const items = responses.page_data || [];
    const warrants = items.map(item => {
        const data = item.response_data || item;
        return {
            code: data.code || null,
            status: data.status || null,
            warrantType: data.warrant_type || null,
            arrestType: data.arrest_type || null,
            issueDate: data.issue_date || null,
        };
    });
    const active = warrants.filter(w => w.status && /pendente/i.test(w.status));
    const flag = active.length > 0 ? 'POSITIVE' : warrants.length > 0 ? 'INCONCLUSIVE' : 'NEGATIVE';

    console.log('\n=== NORMALIZED RESULT ===');
    console.log(`warrantFlag:        ${flag}`);
    console.log(`warrantCount:       ${warrants.length}`);
    console.log(`activeWarrantCount: ${active.length}`);
    if (warrants.length === 0) {
        console.log('notes: Judit: Nenhum mandado de prisao encontrado.');
    } else {
        console.log(`notes: ALERTA JUDIT: ${warrants.length} mandado(s) encontrado(s), ${active.length} PENDENTE(S) DE CUMPRIMENTO.`);
    }

    // Save raw JSON
    const fs = require('fs');
    fs.writeFileSync('results/warrant_francisco_test_' + new Date().toISOString().slice(0, 10) + '.json',
        JSON.stringify({ createResult, responses, warrants, flag }, null, 2));
    console.log('\n✅ Saved to results/');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
