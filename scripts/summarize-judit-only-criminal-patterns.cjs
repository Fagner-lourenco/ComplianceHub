const fs = require('fs');

const report = JSON.parse(fs.readFileSync('results/audit-judit-only-criminal-impact.json', 'utf8'));

function yearOf(date) {
    if (!date) return 'N/A';
    const value = String(date).slice(0, 4);
    return /^\d{4}$/.test(value) ? value : 'N/A';
}

function inc(map, key) {
    const normalized = key || 'N/A';
    map[normalized] = (map[normalized] || 0) + 1;
}

function addToArrayMap(map, key, item) {
    const normalized = key || 'N/A';
    if (!map[normalized]) map[normalized] = [];
    map[normalized].push(item);
}

function materialProcess(process) {
    return process.isCriminal && process.hasExactCpfMatch && !process.isVictim && !process.isWitness;
}

const byImpact = {};
const processStats = {
    totalProcesses: 0,
    materialProcesses: 0,
    byState: {},
    byTribunal: {},
    byCity: {},
    byCounty: {},
    byYear: {},
    byRole: {},
    byClass: {},
    bySubject: {},
    materialByState: {},
    materialByYear: {},
};

const casesByState = {};
const criticalCases = [];

for (const item of report.cases) {
    inc(byImpact, item.counterfactual.impact);
    const material = item.juditProcesses.filter(materialProcess);
    if (item.counterfactual.impact === 'PROVAVELMENTE_MUDARIA_VEREDITO_FINAL') {
        criticalCases.push(item);
    }

    const states = new Set(item.juditProcesses.map((p) => p.state).filter(Boolean));
    for (const state of states) addToArrayMap(casesByState, state, item.id);

    for (const process of item.juditProcesses) {
        processStats.totalProcesses += 1;
        const isMaterial = materialProcess(process);
        if (isMaterial) processStats.materialProcesses += 1;

        inc(processStats.byState, process.state);
        inc(processStats.byTribunal, process.tribunalAcronym);
        inc(processStats.byCity, process.city);
        inc(processStats.byCounty, process.county);
        inc(processStats.byYear, yearOf(process.distributionDate));
        inc(processStats.byRole, process.personType || process.role);
        for (const classification of process.classifications || []) inc(processStats.byClass, classification);
        for (const subject of process.subjects || []) inc(processStats.bySubject, subject);
        if (isMaterial) {
            inc(processStats.materialByState, process.state);
            inc(processStats.materialByYear, yearOf(process.distributionDate));
        }
    }
}

function sortedEntries(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const summary = {
    totalCases: report.cases.length,
    byImpact,
    processStats: {
        totalProcesses: processStats.totalProcesses,
        materialProcesses: processStats.materialProcesses,
        byState: sortedEntries(processStats.byState),
        byTribunal: sortedEntries(processStats.byTribunal),
        byYear: sortedEntries(processStats.byYear),
        byRole: sortedEntries(processStats.byRole),
        byClass: sortedEntries(processStats.byClass),
        bySubject: sortedEntries(processStats.bySubject),
        materialByState: sortedEntries(processStats.materialByState),
        materialByYear: sortedEntries(processStats.materialByYear),
    },
    casesByState: Object.fromEntries(Object.entries(casesByState).map(([key, value]) => [key, [...new Set(value)].length])),
    criticalCases: criticalCases.map((item) => ({
        id: item.id,
        candidateName: item.candidateName,
        finalVerdict: item.finalVerdict,
        finalCriminalFlag: item.finalFlags.criminalFlag,
        processes: item.juditProcesses.filter(materialProcess).map((process) => ({
            cnj: process.cnj,
            state: process.state,
            city: process.city,
            county: process.county,
            tribunal: process.tribunalAcronym,
            distributionDate: process.distributionDate,
            year: yearOf(process.distributionDate),
            role: process.personType,
            class: process.classifications,
            subjects: process.subjects,
            lastStep: process.lastStep,
        })),
    })),
};

fs.writeFileSync('results/audit-judit-only-criminal-patterns.json', JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
