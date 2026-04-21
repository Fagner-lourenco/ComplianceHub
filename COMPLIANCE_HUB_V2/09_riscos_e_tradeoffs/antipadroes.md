# Antipadroes a evitar

## Antipadrao: documento de caso infinito

Sintoma: todo novo provider adiciona dezenas de campos em `cases`.

Correcao: provider records + canonical facts + projections.

## Antipadrao: relatorio como renderizacao dinamica de estado atual

Sintoma: abrir relatorio mostra algo diferente do que foi aprovado.

Correcao: report snapshot imutavel.

## Antipadrao: IA substituindo revisao

Sintoma: IA gera parecer final sem trilha humana.

Correcao: IA preenche e sugere; analista aprova, ajusta e assina.

## Antipadrao: provider payload como dominio

Sintoma: campos da BigDataCorp vazam para regras, UI e relatorio.

Correcao: normalizers e entidades canonicas.

## Antipadrao: rule builder antes do modelo de dados

Sintoma: regras configuraveis sem fatos confiaveis.

Correcao: estabilizar evidencia e sinais antes.

## Antipadrao: portal cliente tecnico demais

Sintoma: cliente ve fontes, payloads, metodos e detalhes internos.

Correcao: portal cliente mostra decisao, status, relatorio e evidencias permitidas.

## Antipadrao: copiar arquitetura estrangeira sem localizacao

Sintoma: produto vira AML/KYC generico.

Correcao: foco brasileiro CPF/CNPJ/processos/mandados/societario/patrimonial.

## Antipadrao: auditoria apenas de botoes

Sintoma: sabe-se quem clicou, mas nao qual evidencia sustentou a decisao.

Correcao: evidence-grade audit.

