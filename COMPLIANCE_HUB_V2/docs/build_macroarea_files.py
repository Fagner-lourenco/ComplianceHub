import json
import os

with open("d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/10-source-catalog.json", "r", encoding="utf-8") as f:
    data = json.load(f)

entries = data["entries"]
os.makedirs("d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/bdc", exist_ok=True)

MACROAREA_LABELS = {
    "identidade_cadastro": "01 — Identidade & Cadastro",
    "juridico_processual": "02 — Jurídico & Processual",
    "compliance_sancoes": "03 — Compliance & Sanções",
    "financeiro_credito": "04 — Financeiro & Crédito",
    "risco": "05 — Risco",
    "profissional_laboral": "06 — Profissional & Laboral",
    "politico_eleitoral": "07 — Político & Eleitoral",
    "midia_reputacao": "08 — Mídia & Reputação",
    "presenca_digital": "09 — Presença Digital",
    "ativos_propriedade": "10 — Ativos & Propriedade",
    "socioambiental_esg": "11 — Socioambiental & ESG",
    "meta": "00 — Meta (docs técnica, não é endpoint de dados)",
    "unclassified": "99 — Não classificado",
}

MACROAREA_FILE_SLUG = {
    "identidade_cadastro": "01-identidade-cadastro",
    "juridico_processual": "02-juridico-processual",
    "compliance_sancoes": "03-compliance-sancoes",
    "financeiro_credito": "04-financeiro-credito",
    "risco": "05-risco",
    "profissional_laboral": "06-profissional-laboral",
    "politico_eleitoral": "07-politico-eleitoral",
    "midia_reputacao": "08-midia-reputacao",
    "presenca_digital": "09-presenca-digital",
    "ativos_propriedade": "10-ativos-propriedade",
    "socioambiental_esg": "11-socioambiental-esg",
    "meta": "00-meta",
    "unclassified": "99-unclassified",
}

by_macro = {}
for e in entries:
    by_macro.setdefault(e["macroarea"], []).append(e)


def format_price(p):
    if not p:
        return "_[a coletar]_"
    items = []
    for k, v in p.items():
        if isinstance(v, float):
            items.append(f"`{k}`: R$ {v:.3f}")
        else:
            items.append(f"`{k}`: {v}")
    return " · ".join(items)


for macro, items in by_macro.items():
    fname = MACROAREA_FILE_SLUG.get(macro, macro)
    path = f"d:/ComplianceHub/COMPLIANCE_HUB_V2/docs/manual/bdc/{fname}.md"
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {MACROAREA_LABELS.get(macro, macro)}\n\n")
        f.write(f"Endpoints BDC nesta macroárea: **{len(items)}**.\n\n")
        hydrated = sum(1 for e in items if e["status"] == "hydrated")
        f.write(f"Hidratados: {hydrated} · Stubs: {len(items) - hydrated}\n\n")

        # split by subject
        by_subj = {}
        for e in items:
            by_subj.setdefault(e["subjectKind"], []).append(e)

        for subj, lst in sorted(by_subj.items()):
            f.write(f"## Subject: {subj}\n\n")
            f.write("| # | Título | Dataset técnico | Endpoint | Status | Preço 1-10k | V2 |\n")
            f.write("|---|---|---|---|---|---|---|\n")
            for e in sorted(lst, key=lambda x: x["num"]):
                ds = f"`{e['datasetTechName']}`" if e["datasetTechName"] else "_[a coletar]_"
                ep = e["endpoint"] or "_meta_"
                status = "✓" if e["status"] == "hydrated" else "…"
                price = ""
                if e["priceByTier"]:
                    v = e["priceByTier"].get("1-10k")
                    price = f"R$ {v:.3f}" if isinstance(v, float) else (str(v) if v else "—")
                else:
                    price = "—"
                v2 = e.get("v2Status", "—")
                f.write(f"| {e['num']} | {e['title']} | {ds} | {ep} | {status} | {price} | {v2} |\n")
            f.write("\n")

        # details for hydrated
        hydrated_items = [e for e in items if e["status"] == "hydrated"]
        if hydrated_items:
            f.write("## Detalhe hidratado\n\n")
            for e in sorted(hydrated_items, key=lambda x: x["num"]):
                f.write(f"### {e['num']}. {e['title']}\n")
                f.write(f"- **Slug:** `{e['slug']}` · **URL:** {e['url']}\n")
                f.write(f"- **Dataset:** `{e['datasetTechName']}` · **Endpoint:** `{e['endpoint']}`\n")
                f.write(f"- **Subject:** `{e['subjectKind']}` · **Delivery mode:** `{e['deliveryMode']}` · **V2:** `{e['v2Status']}`\n")
                f.write(f"- **Preços:** {format_price(e['priceByTier'])}\n")
                if e["complementaryKeys"]:
                    f.write(f"- **Chaves complementares:** {', '.join('`' + k + '`' for k in e['complementaryKeys'])}\n")
                if e["filters"]:
                    f.write(f"- **Filtros:** {', '.join('`' + k + '`' for k in e['filters'])}\n")
                if e["summaryFromDocx"]:
                    f.write(f"- **Resumo:** {e['summaryFromDocx'][:250]}\n")
                f.write("\n")

        # stubs reference
        stub_items = [e for e in items if e["status"] == "stub"]
        if stub_items:
            f.write("## Stubs (aguardando hidratação WebFetch)\n\n")
            for e in sorted(stub_items, key=lambda x: x["num"]):
                f.write(f"- **#{e['num']} {e['title']}** — slug `{e['slug']}` · {e['url']}\n")
                if e["summaryFromDocx"]:
                    f.write(f"  - {e['summaryFromDocx'][:200]}\n")
    print(f"Written: {path}")

print(f"\n{len(by_macro)} macroárea files created.")
