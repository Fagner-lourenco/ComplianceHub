const fs = require('fs');
const path = require('path');

const scrapDir = 'd:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/bdg_scraped';
const catalog = JSON.parse(fs.readFileSync('d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/bdc_catalog.json', 'utf8'));
const outFile = 'd:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/05b-bigdatacorp-hydrated-full.md';

const files = fs.readdirSync(scrapDir).filter(f => f.endsWith('.md')).sort();
console.log(`Processing ${files.length} scraped files...`);

const out = ['# 05b — BigDataCorp API (entradas hidratadas via scraping)\n'];

for (const file of files) {
    const slug = file.replace('.md', '');
    const entry = catalog.find(e => e.slug === slug);
    if (!entry) {
        console.log('Missing catalog entry for', slug);
        continue;
    }
    const text = fs.readFileSync(path.join(scrapDir, file), 'utf8');
    out.push(`---\n`);
    out.push(`## ${entry.num}. ${entry.title}\n`);
    out.push(`**URL:** ${entry.url}\n`);
    out.push(`**Categoria:** ${entry.cat}\n`);
    out.push(`**Slug:** \`${slug}\`\n\n`);
    out.push('```\n' + text.replace(/```/g, '``') + '\n```\n\n');
}

fs.writeFileSync(outFile, out.join(''), 'utf8');
console.log(`Wrote ${outFile} (${out.length} sections)`);
