import json
from collections import Counter

with open("d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/bdc_catalog.json", "r", encoding="utf-8") as f:
    raw = json.load(f)

HYDRATED = {
    12: {"dataset":"kyc","family":"/pessoas","macroarea":"compliance_sancoes","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo","5M+":"contato"},
        "keys":["minmatch","considerexpandedpep","name"],
        "filters":["pep_level","pep_job","pep_motive","sanctions_source","sanctions_type","type","standardized_sanction_type","standardized_type"],
        "v2":"consumed"},
    15: {"dataset":"online_presence","family":"/pessoas","macroarea":"presenca_digital","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    19: {"dataset":"emails_extended","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["email","returnonlydifferentemails","returnonlyvalidemails"],
        "filters":["type","isactive","isrecent","ismain","validationstatus","domain"],"v2":"gap"},
    21: {"dataset":"phones_extended","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["phone","returnonlydifferentphones","withmatchrate"],
        "filters":["type","isactive","isrecent","ismain","isindonotcalllist","areacode"],"v2":"gap"},
    23: {"dataset":"addresses_extended","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["zipcode","addressnumber","address","returnonlydifferentaddresses","withmatchrate"],
        "filters":["Type","isratified","isactive","isrecent","ismain","isindirect","state","zipcode"],"v2":"gap"},
    26: {"dataset":"basic_data","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.030,"10k-50k":0.028,"50k-100k":0.027,"100k-500k":0.026,"500k-1M":0.025,"1M-5M":"R$21000 fixo"},
        "keys":["name","mothername","fathername"],"filters":[],"v2":"consumed"},
    27: {"dataset":"basic_data_with_configurable_recency","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.090,"10k-50k":0.085,"50k-100k":0.081,"100k-500k":0.077,"500k-1M":0.073},
        "keys":["max_days_since_update","name","mothername","fathername"],"filters":[],"v2":"gap"},
    28: {"dataset":"historical_basic_data","family":"/pessoas","macroarea":"identidade_cadastro","subject":"pf",
        "prices":{"1-10k":0.030,"10k-50k":0.028,"50k-100k":0.027,"100k-500k":0.026,"500k-1M":0.025,"1M-5M":"R$21000 fixo"},
        "keys":["name","mothername","birthdate","dateformat"],"filters":[],"v2":"gap"},
    29: {"dataset":"financial_data","family":"/pessoas","macroarea":"financeiro_credito","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    34: {"dataset":"government_debtors","family":"/pessoas","macroarea":"financeiro_credito","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    35: {"dataset":"political_involvement","family":"/pessoas","macroarea":"politico_eleitoral","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    36: {"dataset":"election_candidate_data","family":"/pessoas","macroarea":"politico_eleitoral","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    42: {"dataset":"online_ads","family":"/pessoas","macroarea":"presenca_digital","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":["activeads","totalads","admaxvalue","adminvalue","portal","category"],"v2":"gap"},
    44: {"dataset":"processes","family":"/pessoas","macroarea":"juridico_processual","subject":"pf",
        "prices":{"1-10k":0.070,"10k-50k":0.066,"50k-100k":0.063,"100k-500k":0.060,"500k-1M":0.057,"1M-5M":"R$46000 fixo"},
        "keys":["returnupdates","applyFiltersToStats","returncvmprocesses","updateslimit","extendednamematch"],
        "filters":["capturedate","closedate","cnjsubject","cnjproceduretype","courtlevel","courtname","courttype","partypolarity","partytype","noticedate","state","status","resjudicatadate","value"],
        "v2":"consumed"},
    46: {"dataset":"lawsuits_distribution_data","family":"/pessoas","macroarea":"juridico_processual","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["alternativedistributionparameter"],
        "filters":["capturedate","closedate","cnjsubject","cnjproceduretype","courtlevel","courtname","courttype","partypolarity","partytype","noticedate","state","status","resjudicatadate","value"],"v2":"gap"},
    48: {"dataset":"class_organization","family":"/pessoas","macroarea":"profissional_laboral","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":["organizationname","organizationtype","organizationchapter","status","category"],"v2":"gap"},
    50: {"dataset":"university_student_data","family":"/pessoas","macroarea":"profissional_laboral","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":["level","institution","specializationarea"],"v2":"gap"},
    52: {"dataset":"awards_and_certifications","family":"/pessoas","macroarea":"profissional_laboral","subject":"pf",
        "prices":{"1-10k":0.090,"10k-50k":0.085,"50k-100k":0.081,"100k-500k":0.077,"500k-1M":0.073,"1M-5M":"R$61000 fixo"},
        "keys":[],"filters":["awardname","awardingorganizationname","certificationname","certifyingentity","certificationstatus"],"v2":"gap"},
    53: {"dataset":"profession_data","family":"/pessoas","macroarea":"profissional_laboral","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":["sector","companyname","area","level","status"],"v2":"gap"},
    55: {"dataset":"sports_exposure","family":"/pessoas","macroarea":"profissional_laboral","subject":"pf",
        "prices":{"1-10k":0.070,"10k-50k":0.066,"50k-100k":0.063,"100k-500k":0.060,"500k-1M":0.057,"1M-5M":"R$46000 fixo"},
        "keys":[],"filters":["relationshiplevel","role","isactive"],"v2":"gap"},
    56: {"dataset":"financial_risk","family":"/pessoas","macroarea":"risco","subject":"pf",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    58: {"dataset":"collections","family":"/pessoas","macroarea":"risco","subject":"pf",
        "prices":{"1-10k":0.070,"10k-50k":0.066,"50k-100k":0.063,"100k-500k":0.060,"500k-1M":0.057,"1M-5M":"R$46000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    59: {"dataset":"indebtedness_question","family":"/pessoas","macroarea":"risco","subject":"pf",
        "prices":{"1-10k":0.090,"10k-50k":0.085,"50k-100k":0.081,"100k-500k":0.077,"500k-1M":0.073,"1M-5M":0.069,"5M-10M":0.066,"10M-50M":0.063,"50M+":0.060},
        "keys":[],"filters":[],"v2":"gap"},
    65: {"dataset":"kyc","family":"/empresas","macroarea":"compliance_sancoes","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["minmatch","name"],"filters":["pep_level","pep_job","pep_motive","sanctions_source","sanctions_type"],"v2":"gap"},
    66: {"dataset":"owners_kyc","family":"/empresas","macroarea":"compliance_sancoes","subject":"pj",
        "prices":{"1-10k":0.090,"10k-50k":0.085,"50k-100k":0.081,"100k-500k":0.077,"500k-1M":0.073,"1M-5M":"R$61000 fixo"},
        "keys":["minmatch"],"filters":["pep_level","pep_job","pep_motive","sanctions_source","sanctions_type"],"v2":"gap"},
    67: {"dataset":"employees_kyc","family":"/empresas","macroarea":"compliance_sancoes","subject":"pj",
        "prices":{"1-10k":0.410,"10k-50k":0.389,"50k-100k":0.370,"100k-500k":0.352,"500k-1M":0.334,"1M-5M":"R$277000 fixo"},
        "keys":["minmatch"],"filters":["pep_level","pep_job","pep_motive","sanctions_source","sanctions_type"],"v2":"gap"},
    68: {"dataset":"economic_group_kyc","family":"/empresas","macroarea":"compliance_sancoes","subject":"pj",
        "prices":{"1-10k":0.410,"10k-50k":0.389,"50k-100k":0.370,"100k-500k":0.352,"500k-1M":0.334,"1M-5M":"R$277000 fixo"},
        "keys":["minmatch"],"filters":["pep_level","pep_job","pep_motive","sanctions_source","sanctions_type"],"v2":"gap"},
    76: {"dataset":"basic_data","family":"/empresas","macroarea":"identidade_cadastro","subject":"pj",
        "prices":{"1-10k":0.020,"10k-50k":0.019,"50k-100k":0.018,"100k-500k":0.017,"500k-1M":0.016,"1M-5M":"R$14000 fixo"},
        "keys":[],"filters":[],"v2":"consumed"},
    77: {"dataset":"history_basic_data","family":"/empresas","macroarea":"identidade_cadastro","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    78: {"dataset":"merchant_category_data","family":"/empresas","macroarea":"identidade_cadastro","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    79: {"dataset":"company_evolution","family":"/empresas","macroarea":"financeiro_credito","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k+":"R$19000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    80: {"dataset":"activity_indicators","family":"/empresas","macroarea":"financeiro_credito","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    81: {"dataset":"political_involvement","family":"/empresas","macroarea":"politico_eleitoral","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    85: {"dataset":"syndicate_agreements","family":"/empresas","macroarea":"socioambiental_esg","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    86: {"dataset":"social_conscience","family":"/empresas","macroarea":"socioambiental_esg","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
    92: {"dataset":"processes","family":"/empresas","macroarea":"juridico_processual","subject":"pj",
        "prices":{"1-10k":0.070,"10k-50k":0.066,"50k-100k":0.063,"100k-500k":0.060,"500k-1M":0.057,"1M-5M":"R$46000 fixo"},
        "keys":["returnupdates","applyFiltersToStats","returncvmprocesses","updateslimit"],
        "filters":["capturedate","closedate","cnjsubject","cnjproceduretype","courtlevel","courtname","courttype","partypolarity","partytype","noticedate","state","status","resjudicatadate","value"],"v2":"gap"},
    93: {"dataset":"owners_lawsuits","family":"/empresas","macroarea":"juridico_processual","subject":"pj",
        "prices":{"1-10k":0.130,"10k-50k":0.124,"50k-100k":0.118,"100k-500k":0.112,"500k-1M":0.106,"1M-5M":"R$86000 fixo"},
        "keys":["returnupdates","applyFiltersToStats","returncvmprocesses","updateslimit"],
        "filters":["capturedate","closedate","cnjsubject","cnjproceduretype","courtlevel","courtname","courttype","partypolarity","partytype","noticedate","state","status","resjudicatadate","value"],"v2":"gap"},
    94: {"dataset":"lawsuits_distribution_data","family":"/empresas","macroarea":"juridico_processual","subject":"pj",
        "prices":{"1-10k":0.050,"10k-50k":0.048,"50k-100k":0.046,"100k-500k":0.044,"500k-1M":0.042,"1M-5M":"R$34000 fixo"},
        "keys":["alternativedistributionparameter"],
        "filters":["capturedate","closedate","cnjsubject","cnjproceduretype","courtlevel","courtname","courttype","partypolarity","partytype","noticedate","state","status","resjudicatadate","value"],"v2":"gap"},
    96: {"dataset":"relationships","family":"/empresas","macroarea":"ativos_propriedade","subject":"pj",
        "prices":{"1-10k":0.030,"10k-50k":0.028,"50k-100k":0.027,"100k-500k":0.026,"500k-1M":0.025,"1M-5M":"R$21000 fixo"},
        "keys":["useHeadQuartersData"],"filters":["relatedentitytaxidtype","relationshiplevel","relationshiptype"],"v2":"gap"},
    98: {"dataset":"dynamic_qsa_data","family":"/empresas","macroarea":"ativos_propriedade","subject":"pj",
        "prices":{"1-10k":0.090,"10k-50k":0.085,"50k-100k":0.081,"100k-500k":0.077,"500k-1M":0.073,"1M-5M":0.069,"5M-10M":0.066,"10M-50M":0.063,"50M+":0.060},
        "keys":["recency"],"filters":[],"v2":"gap"},
    101: {"dataset":"collections","family":"/empresas","macroarea":"risco","subject":"pj",
        "prices":{"1-10k":0.070,"10k-50k":0.066,"50k-100k":0.063,"100k-500k":0.060,"500k-1M":0.057,"1M-5M":"R$46000 fixo"},
        "keys":[],"filters":[],"v2":"gap"},
}


def classify(entry):
    title = entry["title"].lower()
    cat = entry["cat"].lower()
    slug = entry["slug"].lower()
    if "pessoa" in slug or slug.startswith("pessoas-"):
        subj = "pf"
    elif "empresas-" in slug or "empresa" in title:
        subj = "pj"
    elif "enderecos-" in slug or "endereco" in cat:
        subj = "address"
    elif "veiculos-" in slug or "veiculo" in cat:
        subj = "vehicle"
    elif "produtos-" in slug or "produto" in cat:
        subj = "product"
    elif "processos-" in slug:
        subj = "process"
    elif "ondemand" in slug and "empresas" in slug:
        subj = "pj"
    elif "ondemand" in slug and "pessoas" in slug:
        subj = "pf"
    elif "ondemand" in slug and "veiculos" in slug:
        subj = "vehicle"
    elif "ondemand" in slug and "notas-fiscais" in slug:
        subj = "nfe"
    elif "ondemand" in slug and "enderecos" in slug:
        subj = "address"
    elif "marketplace" in slug:
        subj = "pj"
    else:
        subj = "meta"
    if subj == "pf":
        family = "/pessoas"
    elif subj == "pj":
        family = "/empresas"
    elif subj == "address":
        family = "/enderecos"
    elif subj == "vehicle":
        family = "/veiculos"
    elif subj == "product":
        family = "/produtos"
    elif subj == "process":
        family = "/processos"
    elif subj == "nfe":
        family = "/ondemand"
    else:
        family = "meta"
    if cat in ("visão geral", "primeiros passos"):
        m = "meta"
    elif "compliance" in cat:
        m = "compliance_sancoes"
    elif "comportamento" in cat:
        m = "presenca_digital"
    elif "contatos" in cat:
        m = "identidade_cadastro"
    elif "dados básicos" in cat:
        m = "identidade_cadastro"
    elif cat.startswith("econômicos"):
        m = "financeiro_credito"
    elif "envolvimento político" in cat:
        m = "politico_eleitoral"
    elif "exposição" in cat:
        m = "midia_reputacao"
    elif "presença digital" in cat:
        m = "presenca_digital"
    elif "processos" in cat:
        m = "juridico_processual"
    elif "profissio" in cat:
        m = "profissional_laboral"
    elif "risco" in cat:
        m = "risco"
    elif "sócio" in cat:
        m = "identidade_cadastro"
    elif "veículos" in cat or "veiculo" in cat:
        m = "ativos_propriedade"
    elif "ativos" in cat:
        m = "ativos_propriedade"
    elif "esg" in cat:
        m = "socioambiental_esg"
    elif "relacionamentos" in cat:
        m = "ativos_propriedade"
    elif "reputação" in cat:
        m = "midia_reputacao"
    elif "setoriais" in cat:
        m = "financeiro_credito"
    elif "consultas de pessoas" in cat:
        m = "identidade_cadastro"
    elif "consultas de empresas" in cat:
        m = "identidade_cadastro"
    elif "consultas de notas" in cat:
        m = "financeiro_credito"
    elif "consultas de veículos" in cat:
        m = "ativos_propriedade"
    elif "crédito" in cat:
        m = "financeiro_credito"
    elif "endereços" in cat:
        m = "identidade_cadastro" if "dados" in title else "socioambiental_esg"
    elif "api de processos" in cat:
        m = "juridico_processual"
    elif "api de veículos" in cat:
        m = "ativos_propriedade"
    elif "certidões" in cat:
        m = "compliance_sancoes" if "débito" in title else "identidade_cadastro"
    elif "serviços auxiliares" in cat:
        m = "meta"
    else:
        m = "unclassified"
    mode = "standard"
    if "ondemand" in slug:
        mode = "ondemand"
    elif "certid" in cat or "certid" in title:
        mode = "certificate"
    elif "marketplace" in slug:
        mode = "marketplace"
    elif cat in ("visão geral", "primeiros passos") or cat.startswith("serviços"):
        mode = "meta"
    return {"subjectKind": subj, "family": family, "macroarea": m, "deliveryMode": mode}


catalog = []
for e in raw:
    cls = classify(e)
    entry = {
        "num": e["num"],
        "sourceKey": f"bdc_{e['slug'].replace('-', '_')}",
        "title": e["title"],
        "slug": e["slug"],
        "url": e["url"],
        "categoryBdc": e["cat"],
        "provider": "bigdatacorp",
        "subjectKind": cls["subjectKind"],
        "family": cls["family"],
        "endpoint": f"POST https://plataforma.bigdatacorp.com.br{cls['family']}" if cls["family"].startswith("/") else None,
        "macroarea": cls["macroarea"],
        "deliveryMode": cls["deliveryMode"],
        "status": "hydrated" if e["num"] in HYDRATED else "stub",
        "summaryFromDocx": e["desc"]
    }
    if e["num"] in HYDRATED:
        h = HYDRATED[e["num"]]
        entry.update({
            "datasetTechName": h["dataset"],
            "priceByTier": h["prices"],
            "complementaryKeys": h["keys"],
            "filters": h["filters"],
            "v2Status": h["v2"]
        })
    else:
        entry.update({
            "datasetTechName": None,
            "priceByTier": None,
            "complementaryKeys": [],
            "filters": [],
            "v2Status": "pending_hydration"
        })
    catalog.append(entry)

macro_count = Counter(c["macroarea"] for c in catalog)
subj_count = Counter(c["subjectKind"] for c in catalog)
mode_count = Counter(c["deliveryMode"] for c in catalog)
hydrated = sum(1 for c in catalog if c["status"] == "hydrated")

with open("d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/10-source-catalog.json", "w", encoding="utf-8") as f:
    json.dump({
        "metadata": {"total": len(catalog), "hydrated": hydrated, "provider": "bigdatacorp", "taxonomyVersion": "v1"},
        "macroareaStats": dict(macro_count),
        "subjectStats": dict(subj_count),
        "deliveryModeStats": dict(mode_count),
        "entries": catalog
    }, f, ensure_ascii=False, indent=2)

print(f"Catalog: {len(catalog)} entries, {hydrated} hydrated")
print(f"By macroárea: {dict(macro_count)}")
print(f"By subject: {dict(subj_count)}")
print(f"By delivery: {dict(mode_count)}")
