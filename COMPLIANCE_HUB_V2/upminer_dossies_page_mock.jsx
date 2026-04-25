import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type IconProps = { className?: string };
type Mode = "analitico" | "detalhado";
type Page = "detail" | "list" | "create" | "customProfile";
type CreateStep = "perfil" | "tag" | "parametros";
type PersonType = "Pessoa Física" | "Pessoa Jurídica";
type ProfileKey = "compliance" | "internacional" | "financeiro" | "investigativo" | "juridico" | "pld" | "rh";
type SourceStatus = "Com resultado" | "Nenhum resultado" | "Indisponível" | "Aguardando revisão" | "Processando" | "Concluído" | "Criado";
type OpenMap = Record<string, boolean>;

type ProfileCard = {
  key: ProfileKey;
  title: string;
  icon: React.ComponentType<IconProps>;
  description: string;
  sources: string[];
};

type SourceRow = { fonte: string; status: SourceStatus; detalhes?: boolean };
type SectionBlock = { id: string; title: string; icon: React.ComponentType<IconProps>; count: number; rows: SourceRow[] };
type DetailEntry = { id: string; title: string; subtitle?: string; table?: Array<Record<string, string>>; paragraph?: string; processList?: boolean; status?: SourceStatus };
type JudicialProcess = {
  number: string;
  className: string;
  court: string;
  status: "Em tramitação" | "Arquivamento definitivo" | "Em grau de recurso";
  participation: "Autor" | "Réu" | "Envolvido";
  subject: string;
  area: string;
  segment: string;
  district: string;
  courtUnit: string;
  distributionDate: string;
  value: string;
  link: string;
  activeParty: string;
  passiveParty: string;
  relatedPeople: Array<{ name: string; documentType: string; document: string }>;
  movements: string[];
};

const purple = "#8427cf";
const orange = "#ff8500";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const pageFx = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.24 },
};

const slideFx = {
  initial: { x: 380, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 380, opacity: 0 },
  transition: { duration: 0.26, ease: "easeOut" },
};

function BaseIcon({ className, children }: React.PropsWithChildren<IconProps>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.05" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function ArrowLeftIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M19 12H5" /><path d="m10 7-5 5 5 5" /></BaseIcon>; }
function HomeIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5" /></BaseIcon>; }
function MessageIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-5 4v-4.5A2.5 2.5 0 0 1 5 12V6.5Z" /></BaseIcon>; }
function CalendarIcon({ className }: IconProps) { return <BaseIcon className={className}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 9h16" /></BaseIcon>; }
function ExportIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5" /></BaseIcon>; }
function GavelIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="m3.5 20 7-7" /><path d="m7 6 4 4" /><path d="m10 3 5 5" /><path d="m8.5 4.5 6-2" /><path d="m9.5 11.5 6-2" /></BaseIcon>; }
function GlobeIcon({ className }: IconProps) { return <BaseIcon className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></BaseIcon>; }
function DatabaseIcon({ className }: IconProps) { return <BaseIcon className={className}><ellipse cx="9" cy="7" rx="5" ry="2.5" /><path d="M4 7v6c0 1.4 2.2 2.5 5 2.5" /><path d="M14 7v3" /><path d="M15 13h6" /><path d="M18 10v6" /></BaseIcon>; }
function DollarIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M12 3v18" /><path d="M15.5 7.5c0-1.4-1.6-2.5-3.5-2.5s-3.5 1.1-3.5 2.5 1.4 2.3 3.5 2.8 3.5 1.3 3.5 3.2S13.9 18 12 18s-3.5-1.1-3.5-2.5" /></BaseIcon>; }
function ShieldIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M12 3c2.8 2 5.3 2.8 8 3v5c0 5-3.2 8.6-8 10-4.8-1.4-8-5-8-10V6c2.7-.2 5.2-1 8-3Z" /></BaseIcon>; }
function TreeIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M12 20v-6" /><path d="M7 10a5 5 0 1 1 10 0" /><path d="M5 13h14" /></BaseIcon>; }
function HomeOutlineIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="m3 11 9-7 9 7" /><path d="M6 9.5V20h12V9.5" /></BaseIcon>; }
function BriefcaseIcon({ className }: IconProps) { return <BaseIcon className={className}><rect x="3.5" y="6.5" width="17" height="12.5" rx="2" /><path d="M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5" /><path d="M3.5 11.5h17" /></BaseIcon>; }
function BookmarkIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z" /></BaseIcon>; }
function SmilePlusIcon({ className }: IconProps) { return <BaseIcon className={className}><circle cx="12" cy="12" r="9" /><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M8.5 14a5.5 5.5 0 0 0 7 0" /><path d="M19 4v4" /><path d="M17 6h4" /></BaseIcon>; }
function HelpIcon({ className }: IconProps) { return <BaseIcon className={className}><circle cx="12" cy="12" r="9" /><path d="M9.7 9.3a2.7 2.7 0 1 1 4.3 2.1c-1 .7-1.8 1.2-1.8 2.6" /><path d="M12 17h.01" /></BaseIcon>; }
function ChevronUpIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="m6 15 6-6 6 6" /></BaseIcon>; }
function ChevronDownIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="m6 9 6 6 6-6" /></BaseIcon>; }
function ExternalIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M14 5h5v5" /><path d="M10 14 19 5" /><path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></BaseIcon>; }
function SearchCircleIcon({ className }: IconProps) { return <BaseIcon className={className}><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></BaseIcon>; }
function UsersIcon({ className }: IconProps) { return <BaseIcon className={className}><circle cx="9" cy="9" r="2.5" /><circle cx="16.5" cy="10" r="2" /><path d="M4.5 18c1.2-2.7 3.1-4 5.5-4s4.3 1.3 5.5 4" /><path d="M15 15c1.7.2 3 1.1 4 3" /></BaseIcon>; }
function CheckIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="m5 12 4 4L19 6" /></BaseIcon>; }
function XIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M6 6l12 12" /><path d="M18 6 6 18" /></BaseIcon>; }
function FlagIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M4 4v16" /><path d="M4 4h10l-2 4 2 4H4" /></BaseIcon>; }
function PlusIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M12 5v14" /><path d="M5 12h14" /></BaseIcon>; }
function LockIcon({ className }: IconProps) { return <BaseIcon className={className}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></BaseIcon>; }
function PencilIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></BaseIcon>; }
function LogoutIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 19V5a2 2 0 0 0-2-2h-6" /></BaseIcon>; }
function BellIcon({ className }: IconProps) { return <BaseIcon className={className}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></BaseIcon>; }

const defaultOpen: OpenMap = {
  juridico: true, financeiro: true, cadastro: true, reguladores: true, listas: true, profissional: true,
  detalhado_juridico: true, detalhado_cadastro: true, detalhado_reguladores: true, detalhado_socio: true,
  pf: true, processos: true, cpf: true, tse: true, tst: true, ibama: true, analysis: true, comments: true,
};

function useCollapseState() {
  const [openMap, setOpenMap] = useState<OpenMap>(defaultOpen);
  const isOpen = (id: string) => openMap[id] ?? true;
  const toggle = (id: string) => setOpenMap((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  return { isOpen, toggle };
}

function Collapse({ open, children }: React.PropsWithChildren<{ open: boolean }>) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.24, ease: "easeOut" }} className="overflow-hidden">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ButtonMotion(props: React.ComponentProps<typeof motion.button>) {
  return <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={{ type: "spring", stiffness: 380, damping: 22 }} {...props} />;
}

function Toast({ message, show, onClose }: { message: string; show: boolean; onClose?: () => void }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0, y: -16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.97 }} className="fixed right-4 top-2 z-50 flex items-center gap-3 rounded bg-[#0dab68] px-5 py-3 text-[14px] font-bold text-white shadow-lg">
          <CheckIcon className="h-4 w-4" /> {message}
          <button type="button" onClick={onClose} className="ml-2">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const tabs = [
  { key: "juridico", label: "Jurídico", icon: GavelIcon, active: true },
  { key: "midia", label: "Mídia/Internet", icon: GlobeIcon },
  { key: "financeiro", label: "Financeiro", icon: DollarIcon, muted: true },
  { key: "cadastro", label: "Cadastro", icon: DatabaseIcon },
  { key: "reguladores", label: "Reguladores", icon: ShieldIcon },
  { key: "bens", label: "Bens e Imóveis", icon: HomeOutlineIcon, muted: true },
  { key: "listas", label: "Listas Restritivas", icon: BriefcaseIcon, muted: true },
  { key: "profissional", label: "Profissional", icon: DatabaseIcon, muted: true },
  { key: "socio", label: "Socioambiental", icon: TreeIcon },
] as const;

const analyticMetrics = [
  { label: "Total de processos", value: "7", icon: GavelIcon },
  { label: "Processos como autor", value: "2", icon: UsersIcon },
  { label: "Processos como réu", value: "5", icon: SearchCircleIcon },
  { label: "Processos como envolvido", value: "0", icon: UsersIcon },
  { label: "Processos com segredo", value: "0", icon: HelpIcon },
];

const analyticSections: SectionBlock[] = [
  { id: "financeiro", title: "Financeiro", icon: DollarIcon, count: 2, rows: [{ fonte: "SEFAZ SP: Certidão Negativa de Débitos da Dívida Ativa - CDA", status: "Indisponível" }, { fonte: "PGM SP: Protesto SP", status: "Nenhum resultado" }] },
  { id: "cadastro", title: "Cadastro", icon: DatabaseIcon, count: 3, rows: [{ fonte: "Infosimples: Situação Cadastral do CPF na Receita Federal", status: "Com resultado", detalhes: true }, { fonte: "upLexis: QSA - Quadro de Sócios e Administradores", status: "Nenhum resultado" }, { fonte: "TSE: Consulta Situação Eleitoral", status: "Com resultado", detalhes: true }] },
  { id: "reguladores", title: "Reguladores", icon: ShieldIcon, count: 2, rows: [{ fonte: "Infosimples: Situação da Restituição de IRPF da Receita Federal", status: "Criado" }, { fonte: "MPT: Ministério Público do Trabalho", status: "Nenhum resultado" }] },
  { id: "listas", title: "Listas Restritivas", icon: BriefcaseIcon, count: 5, rows: [{ fonte: "MTE: Trabalho Escravo", status: "Nenhum resultado" }, { fonte: "Banco Central: Quadro Geral de Inabilitados", status: "Nenhum resultado" }, { fonte: "ICIJ: Empresas Offshore", status: "Nenhum resultado" }, { fonte: "Transparência Brasil: PEP Pessoas Politicamente Expostas", status: "Nenhum resultado" }, { fonte: "World Bank: Pessoas e Empresas Impedidas", status: "Nenhum resultado" }] },
  { id: "profissional", title: "Profissional", icon: DatabaseIcon, count: 1, rows: [{ fonte: "Transparência Brasil: Servidores do Governo Federal", status: "Nenhum resultado" }] },
];

const judicialProcesses: JudicialProcess[] = [
  {
    number: "0205659-11.2024.8.06.0167",
    className: "CUMPRIMENTO DE SENTENÇA DE OBRIGAÇÃO DE PRESTAR ALIMENTOS",
    court: "TJ-CE",
    status: "Em tramitação",
    participation: "Réu",
    subject: "Porte de arma (branca)",
    area: "Cível",
    segment: "Justiça Estadual",
    district: "Comarca de Sobral",
    courtUnit: "2ª Unidade do Juizado Especial Cível e Criminal",
    distributionDate: "31/01/2024",
    value: "R$ 0,00",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "FRANCISCO TACIANO DE SOUSA",
    passiveParty: "MINISTÉRIO PÚBLICO ESTADUAL",
    relatedPeople: [
      { name: "JOSIANE DE LIMA MONTEIRO", documentType: "CPF", document: "068.634.333-11" },
      { name: "JOÃO PAULO ARAGÃO NASCIMENTO", documentType: "CPF", document: "004.669.003-41" },
      { name: "GERMANO HERBERT PEREIRA ARAGÃO", documentType: "CPF", document: "051.130.703-94" },
    ],
    movements: ["Distribuído por sorteio", "Concluso para decisão", "Intimação expedida"],
  },
  {
    number: "0202743-72.2022.8.06.0167",
    className: "APELAÇÃO CRIMINAL",
    court: "TJ-CE",
    status: "Arquivamento definitivo",
    participation: "Réu",
    subject: "Contravenções penais",
    area: "Criminal",
    segment: "Justiça Estadual",
    district: "Sobral",
    courtUnit: "1ª Vara Criminal",
    distributionDate: "07/06/2022",
    value: "R$ 0,01",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "MINISTÉRIO PÚBLICO DO ESTADO DO CEARÁ",
    passiveParty: "FRANCISCO TACIANO DE SOUSA",
    relatedPeople: [{ name: "FRANCISCO TACIANO DE SOUSA", documentType: "CPF", document: "050.232.903-36" }],
    movements: ["Processo relacionado", "Arquivamento definitivo", "Baixa definitiva"],
  },
  {
    number: "3001575-02.2021.8.06.0167",
    className: "TERMO CIRCUNSTANCIADO",
    court: "TJ-CE",
    status: "Arquivamento definitivo",
    participation: "Réu",
    subject: "Ameaça",
    area: "Criminal",
    segment: "Justiça Estadual",
    district: "Sobral",
    courtUnit: "Juizado Especial Criminal",
    distributionDate: "31/01/2024",
    value: "R$ 0,00",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "MINISTÉRIO PÚBLICO ESTADUAL",
    passiveParty: "FRANCISCO TACIANO DE SOUSA",
    relatedPeople: [{ name: "FRANCISCO TACIANO DE SOUSA", documentType: "CPF", document: "050.232.903-36" }],
    movements: ["Audiência designada", "Sentença", "Arquivamento definitivo"],
  },
  {
    number: "0002198-45.2022.8.06.0167",
    className: "AÇÃO PENAL - PROCEDIMENTO ORDINÁRIO",
    court: "TJ-CE",
    status: "Em grau de recurso",
    participation: "Réu",
    subject: "Contravenções penais",
    area: "Criminal",
    segment: "Justiça Estadual",
    district: "Sobral",
    courtUnit: "Vara Criminal",
    distributionDate: "10/03/2022",
    value: "R$ 0,01",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "MINISTÉRIO PÚBLICO DO ESTADO DO CEARÁ",
    passiveParty: "FRANCISCO TACIANO DE SOUSA",
    relatedPeople: [{ name: "FRANCISCO TACIANO DE SOUSA", documentType: "CPF", document: "050.232.903-36" }],
    movements: ["Recurso interposto", "Vista ao relator", "Processo relacionado"],
  },
  {
    number: "0031471-40.2021.8.06.0293",
    className: "MEDIDAS PROTETIVAS DE URGÊNCIA",
    court: "TJ-CE",
    status: "Arquivamento definitivo",
    participation: "Envolvido",
    subject: "Violência doméstica",
    area: "Criminal",
    segment: "Justiça Estadual",
    district: "Sobral",
    courtUnit: "Vara de Violência Doméstica",
    distributionDate: "19/08/2021",
    value: "R$ 0,00",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "Parte sigilosa",
    passiveParty: "FRANCISCO TACIANO DE SOUSA",
    relatedPeople: [{ name: "FRANCISCO TACIANO DE SOUSA", documentType: "CPF", document: "050.232.903-36" }],
    movements: ["Medida analisada", "Baixa", "Arquivamento definitivo"],
  },
  {
    number: "0053023-02.2020.8.06.0167",
    className: "PROCEDIMENTO COMUM CÍVEL",
    court: "TJ-CE",
    status: "Arquivamento definitivo",
    participation: "Autor",
    subject: "Alimentos",
    area: "Cível",
    segment: "Justiça Estadual",
    district: "Sobral",
    courtUnit: "2ª Vara Cível",
    distributionDate: "14/05/2020",
    value: "R$ 3.204,73",
    link: "https://pje-consulta.tjce.jus.br/pje1grau/Consulta",
    activeParty: "FRANCISCO TACIANO DE SOUSA",
    passiveParty: "Parte adversa",
    relatedPeople: [{ name: "FRANCISCO TACIANO DE SOUSA", documentType: "CPF", document: "050.232.903-36" }],
    movements: ["Petição juntada", "Sentença", "Arquivamento definitivo"],
  },
];

const detailEntries: DetailEntry[] = [
  { id: "pf", title: "Infosimples: Antecedente Criminal da Polícia Federal", subtitle: "Consulta realizada em 23/04/2026 com o critério 050.232.903-36", status: "Com resultado", table: [{ CPF: "050.232.903-36", Nome: "FRANCISCO TACIANO DE SOUSA", "Nome da mãe": "FRANCISCA CAETANA DE SOUSA", Nascimento: "16/08/1991", Número: "095079532026", PDF: "PDF" }], paragraph: "A Polícia Federal CERTIFICA, após pesquisa no Sistema Nacional de Informações Criminais - SINIC, que, até a presente data, NADA CONSTA condenação com trânsito em julgado em nome de FRANCISCO TACIANO DE SOUSA, filho(a) de FRANCISCA CAETANA DE SOUSA, nascido(a) aos 16/08/1991, CPF 050.232.903-36." },
  { id: "processos", title: "Processos Judiciais", subtitle: "Consulta realizada em 23/04/2026 com o critério 050.232.903-36", status: "Com resultado", processList: true },
  { id: "cpf", title: "Infosimples: Situação Cadastral do CPF na Receita Federal", status: "Com resultado", table: [{ CPF: "050.232.903-36", Nome: "FRANCISCO TACIANO DE SOUSA", "Data de nascimento": "16/08/1991", Idade: "34", "Situação na Receita Federal": "REGULAR", "Data de Consulta": "23/04/2026" }, { "Código de Controle Comprovante": "EB55.7AEE.3328.45D3", "Dígito Verificador": "00", Óbito: "-" }] },
  { id: "tse", title: "TSE: Consulta Situação Eleitoral", status: "Com resultado", table: [{ Nome: "FRANCISCO TACIANO DE SOUSA", "Situação de inscrição": "REGULAR", "Data de nascimento": "16/08/1991", "Zona eleitoral": "--", Seção: "--" }] },
  { id: "tst", title: "TST: Certidão Negativa de Débitos Trabalhistas", status: "Com resultado", table: [{ CPF: "050.232.903-36", Nome: "FRANCISCO TACIANO DE SOUSA", Expedição: "23/04/2026 às 18:29:27", Validade: "20/10/2026 - 180 dias", PDF: "PDF" }], paragraph: "Certifica-se que FRANCISCO TACIANO DE SOUSA, inscrito(a) no CPF sob o nº 050.232.903-36, NÃO CONSTA como inadimplente no Banco Nacional de Devedores Trabalhistas. Esta certidão eletrônica pode ser validada no portal do Tribunal Superior do Trabalho." },
  { id: "ibama", title: "IBAMA: Certidão Negativa de Débitos", status: "Com resultado", table: [{ CPF: "050.232.903-36", Nome: "FRANCISCO TACIANO DE SOUSA", Certidão: "Nada consta", PDF: "PDF" }], paragraph: "Nada consta para o CPF informado na base consultada." },
];

const profileCards: ProfileCard[] = [
  { key: "compliance", title: "Compliance", icon: ShieldIcon, description: "Reunimos neste perfil as fontes essenciais para manter sua empresa segura contra riscos regulatórios e dentro das normas exigidas pelo setor.", sources: ["Reclame Aqui: Reclamações e Reputação", "PROCON SP: Cadastro de Reclamações", "Infosimples: Certidão Negativa da MPF", "TST: Certidão Negativa de Débitos Trabalhistas", "CEF: Certificado de Regularidade do FGTS", "Processos Judiciais"] },
  { key: "internacional", title: "Compliance Internacional", icon: GlobeIcon, description: "Perfil voltado a checagens internacionais, listas restritivas, empresas offshore e fontes globais de reputação e integridade.", sources: ["Lista Europeia", "Lista da ONU", "ICIJ: Empresas Offshore", "World Bank: Pessoas e Empresas Impedidas", "Instant OFAC"] },
  { key: "financeiro", title: "Financeiro", icon: DollarIcon, description: "Este perfil oferece um amplo conjunto de utilidades para checagem financeira, inadimplência, regularidade fiscal e histórico cadastral.", sources: ["Imposto Predial e Territorial Urbano (IPTU): São Paulo", "SERPRO: SNCR Cadastro de Imóveis Rurais", "PGM SP: Protesto SP", "Transparência Brasil: CNEP Cadastro de Empresas Punidas", "TST: Certidão Negativa de Débitos Trabalhistas"] },
  { key: "investigativo", title: "Investigativo", icon: SearchCircleIcon, description: "Perfil orientado à busca ampliada de vínculos, registros, cadastros e indícios relevantes para investigação e análise de contexto.", sources: ["Processos Judiciais", "Infosimples: Antecedente Criminal da Polícia Federal", "Consulta ao CPF", "Consulta ao CNPJ", "Mídia/Internet"] },
  { key: "juridico", title: "Jurídico", icon: GavelIcon, description: "Conjunto de fontes para análise jurídica, processos, certidões e consultas em bases judiciais e administrativas.", sources: ["Processos Judiciais", "TSE: Consulta Situação Eleitoral", "TST: Certidão Negativa de Débitos Trabalhistas", "Antecedente Criminal da Polícia Federal"] },
  { key: "pld", title: "PLD", icon: DatabaseIcon, description: "Perfil voltado à prevenção à lavagem de dinheiro, identificação de riscos, listas restritivas e exposição política.", sources: ["Transparência Brasil: PEP Pessoas Politicamente Expostas", "Lista da ONU", "Instant OFAC", "Banco Central: Quadro Geral de Inabilitados"] },
  { key: "rh", title: "Recursos Humanos", icon: BriefcaseIcon, description: "Desenvolvemos este perfil para fortalecer o poder de recrutamento das empresas e assegurar uma seleção de talentos precisa e eficiente.", sources: ["TSE: Consulta Situação Eleitoral", "upLexis: QSA - Quadro de Sócios e Administradores", "Infosimples: Situação Cadastral do CPF na Receita Federal", "Processos Judiciais", "Infosimples: Antecedente Criminal da Polícia Federal", "Listas de Sanções da ONU", "MTE: Trabalho Escravo", "Banco Central: Quadro Geral de Inabilitados", "TST: Certidão Negativa de Débitos Trabalhistas", "IBAMA: Certidão Negativa de Débitos"] },
];

const allSources = ["Processos Judiciais", "Infosimples: Antecedente Criminal da Polícia Federal", "Infosimples: Situação Cadastral do CPF na Receita Federal", "TSE: Consulta Situação Eleitoral", "TST: Certidão Negativa de Débitos Trabalhistas", "IBAMA: Certidão Negativa de Débitos", "MTE: Trabalho Escravo", "Lista da ONU", "Instant OFAC", "Banco Central: Quadro Geral de Inabilitados", "PGM SP: Protesto SP", "Transparência Brasil: PEP Pessoas Politicamente Expostas", "ICIJ: Empresas Offshore", "CEF Certificado de Regularidade do FGTS"];

const productCategories = ["Background Check", "Cibersegurança", "Due Diligence", "Estrutura Societária", "Jurídico", "Recuperação de Ativos"] as const;

type ProductItem = {
  name: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<IconProps>;
  enabled?: boolean;
};

const productCatalog: Record<string, ProductItem[]> = {
  "Background Check": [
    { name: "Dossiês", subtitle: "Gere relatórios personalizados", description: "Resolva em poucos minutos pesquisas que levariam dias, graças à geração automatizada de dossiês sobre pessoas ou empresas.", icon: DatabaseIcon, enabled: true },
    { name: "UpLink", subtitle: "Pesquisa de Conflito de Interesse", description: "Descubra visualmente as conexões entre pessoas e empresas por meio de uma solução dinâmica e intuitiva.", icon: GlobeIcon },
    { name: "UpSearch", subtitle: "Inteligência Jurídica e Patrimonial", description: "Simplifique suas pesquisas, maximize seus resultados e reduza risco genérico em crédito e compliance.", icon: SearchCircleIcon },
    { name: "Certidões", subtitle: "Obtenha certidões de todo Brasil", description: "Centralize certidões de diferentes órgãos em uma única plataforma e ganhe tempo para realizar diversas atividades.", icon: BriefcaseIcon },
    { name: "UpFlag", subtitle: "Gere relatórios personalizados", description: "Monitore alertas, reputação e riscos com apoio de automações e filtros de priorização.", icon: FlagIcon },
  ],
  "Due Diligence": [
    { name: "Dossiês", subtitle: "Relatórios para análise reputacional", description: "Use perfis padronizados e personalizados para apoiar análises de terceiros, fornecedores e candidatos.", icon: DatabaseIcon, enabled: true },
    { name: "Monitoria", subtitle: "Acompanhamento contínuo", description: "Acompanhe mudanças relevantes nas fontes consultadas e receba sinais de alteração de risco.", icon: ShieldIcon },
    { name: "Workflow", subtitle: "Esteira de aprovação", description: "Organize revisão, aprovação, reprovação e comentários internos do dossiê.", icon: CheckIcon },
  ],
  "Jurídico": [
    { name: "Dossiês", subtitle: "Processos e certidões", description: "Consolide processos, certidões e fontes judiciais em uma visão analítica e detalhada.", icon: GavelIcon, enabled: true },
    { name: "Processos", subtitle: "Consulta processual", description: "Explore processos por tribunal, classe, área, polo e status.", icon: SearchCircleIcon },
  ],
  "Cibersegurança": [
    { name: "Leak Search", subtitle: "Exposição digital", description: "Verifique sinais de exposição em fontes abertas e bases de risco digital.", icon: ShieldIcon },
    { name: "Domínios", subtitle: "Risco de infraestrutura", description: "Monitore domínios, registros e ativos relacionados à organização analisada.", icon: GlobeIcon },
  ],
  "Estrutura Societária": [
    { name: "QSA", subtitle: "Quadro societário", description: "Analise vínculos societários, administradores, empresas relacionadas e alterações cadastrais.", icon: UsersIcon },
    { name: "Grupo econômico", subtitle: "Relações empresariais", description: "Organize estruturas e conexões relevantes para análise corporativa.", icon: DatabaseIcon },
  ],
  "Recuperação de Ativos": [
    { name: "Localizador", subtitle: "Apoio patrimonial", description: "Centralize sinais patrimoniais e fontes úteis para recuperação de ativos.", icon: SearchCircleIcon },
    { name: "Bens e Imóveis", subtitle: "Consultas patrimoniais", description: "Consulte fontes voltadas a imóveis, cadastros e indícios patrimoniais.", icon: HomeOutlineIcon },
  ],
};



function ProductCard({ item }: { item: ProductItem }) {
  const Icon = item.icon;
  return (
    <motion.div whileHover={{ y: -3, scale: 1.01 }} className={cx("grid grid-cols-[92px_1fr] gap-5 rounded-lg p-3 transition", item.enabled ? "text-neutral-900" : "text-neutral-400")}>
      <div className={cx("flex h-[64px] w-[92px] flex-col items-center justify-center rounded border", item.enabled ? "border-[#ddd] bg-white text-[#ff8500]" : "border-[#ddd] bg-[#fafafa]")}> 
        <Icon className="mb-1 h-6 w-6" />
        <span className="text-[11px] font-bold">{item.name}</span>
      </div>
      <div>
        <div className="text-[13px] font-bold">{item.subtitle}</div>
        <p className="mt-1 text-[12px] leading-5 text-neutral-500">{item.description}</p>
        <button className={cx("mt-2 text-[12px] font-bold", item.enabled ? "text-neutral-700" : "text-neutral-400")}>{item.enabled ? "Acessar" : "Contrate Agora"} <span className="text-[#ff8500]">›</span></button>
      </div>
    </motion.div>
  );
}

function ProductsMegaMenu({ category, onClose }: { category: string; onClose: () => void }) {
  const products = productCatalog[category] ?? [];
  return (
    <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.2 }} className="absolute left-16 top-[118px] z-40 w-[760px] rounded-xl border border-[#ddd] bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,.18)]">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-[15px] font-bold">{category}</div>
          <div className="mt-1 text-[13px] text-neutral-600">Recomendamos os produtos abaixo</div>
        </div>
        <button onClick={onClose} className="text-[13px] font-bold text-[#8427cf]">Fechar</button>
      </div>
      <div className="grid grid-cols-2 gap-x-7 gap-y-5">
        {products.map((item) => <ProductCard key={`${category}-${item.name}`} item={item} />)}
      </div>
    </motion.div>
  );
}



function AppsDropdown({ onClose }: { onClose: () => void }) {
  const apps = [
    { name: "Dossiês", category: "Background Check", active: true },
    { name: "UpLink", category: "Background Check" },
    { name: "UpSearch", category: "Background Check" },
    { name: "Certidões", category: "Background Check" },
    { name: "Monitoria", category: "Due Diligence" },
    { name: "Workflow", category: "Due Diligence" },
    { name: "Processos", category: "Jurídico" },
    { name: "QSA", category: "Estrutura Societária" },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-12 top-[104px] z-40 w-[320px] rounded-lg border border-[#ddd] bg-white p-4 shadow-[0_8px_24px_rgba(0,0,0,.16)]">
      <div className="mb-3 flex items-center justify-between"><b>Aplicativos</b><button onClick={onClose} className="text-[#8427cf]">×</button></div>
      <div className="space-y-1">
        {apps.map((app) => <button key={app.name} className={cx("flex w-full items-center justify-between rounded px-3 py-2 text-left text-[13px] hover:bg-purple-50", app.active && "bg-[#f5efff] text-[#8427cf] font-bold")}><span>{app.name}</span><span className="text-[11px] text-neutral-400">{app.category}</span></button>)}
      </div>
    </motion.div>
  );
}

function ProfileMenu({ onClose, onCostCenter }: { onClose: () => void; onCostCenter: () => void }) {
  const menuRows = [
    { label: "Idioma", icon: GlobeIcon, arrow: true },
    { label: "Centro de Custo", icon: DollarIcon, action: onCostCenter },
    { label: "Indicação", icon: BriefcaseIcon },
    { label: "Suporte", icon: HelpIcon },
    { label: "Termos de Uso", icon: DatabaseIcon, arrow: true },
    { label: "Contrato", icon: BriefcaseIcon },
    { label: "Logout", icon: LogoutIcon },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={{ duration: 0.2 }} className="absolute right-[88px] top-[46px] z-50 w-[430px] rounded bg-white px-8 py-7 text-neutral-700 shadow-[0_4px_18px_rgba(0,0,0,.22)]">
      <div className="absolute -top-3 right-4 h-6 w-6 rotate-45 bg-white" />
      <button onClick={onClose} className="absolute right-7 top-6 text-2xl text-[#8427cf]">×</button>
      <div className="flex items-center gap-4 text-[18px] font-bold"><UsersIcon className="h-6 w-6 text-[#ff8500]" />Enterprise</div>
      <div className="mt-7 text-[13px] font-semibold text-neutral-500">FAGNER LOURENÇO</div>
      <div className="mt-8 flex items-center gap-4 text-[18px] font-bold"><UsersIcon className="h-6 w-6 text-[#ff8500]" />Operador</div>
      <div className="mt-7 flex items-center gap-4 text-[18px] font-bold"><UsersIcon className="h-6 w-6 text-[#ff8500]" />NOVAX</div>
      <div className="mt-7 flex flex-wrap gap-3">
        <ButtonMotion className="flex items-center gap-2 rounded border-2 border-[#9e38e8] px-4 py-2 text-[16px] font-bold text-[#8427cf]"><LockIcon className="h-4 w-4" />Alterar senha</ButtonMotion>
        <ButtonMotion className="flex items-center gap-2 rounded border-2 border-[#9e38e8] px-4 py-2 text-[16px] font-bold text-[#8427cf]"><PencilIcon className="h-4 w-4" />Editar perfil</ButtonMotion>
        <ButtonMotion className="flex items-center gap-2 rounded border-2 border-[#9e38e8] px-4 py-2 text-[16px] font-bold text-[#8427cf]"><ShieldIcon className="h-4 w-4" />Habilitar MFA</ButtonMotion>
      </div>
      <div className="mt-7 text-[13px] text-neutral-500">E-mail</div>
      <div className="mt-1 text-[16px] font-bold text-neutral-800">fagner.lourenco@pm.pr.gov.br</div>
      <div className="mt-8 flex gap-10 text-[14px]"><span>Telefone</span><span>Celular</span></div>
      <div className="mt-8 divide-y divide-[#d8d8d8] border-b border-[#d8d8d8]">
        {menuRows.map((row) => { const Icon = row.icon; return <button key={row.label} type="button" onClick={row.action} className="flex w-full items-center justify-between py-3 text-left text-[17px] text-neutral-500 transition hover:bg-purple-50 hover:text-[#8427cf]"><span className="flex items-center gap-4"><Icon className="h-5 w-5 text-[#ff8500]" />{row.label}</span>{row.arrow && <span>›</span>}</button>; })}
      </div>
    </motion.div>
  );
}

function CostCenterPanel({ onClose }: { onClose: () => void }) {
  const costs = [
    { code: "NOVAX-ADM", name: "Administrativo", status: "Ativo", budget: "R$ 12.500,00" },
    { code: "NOVAX-DD", name: "Due Diligence", status: "Ativo", budget: "R$ 38.200,00" },
    { code: "NOVAX-JUR", name: "Jurídico", status: "Restrito", budget: "R$ 9.800,00" },
  ];
  return (
    <motion.aside {...slideFx} className="fixed right-0 top-0 z-50 h-screen w-[420px] border-l-4 border-[#ff8500] bg-white px-8 py-8 shadow-[-8px_0_18px_rgba(0,0,0,.16)]">
      <button onClick={onClose} className="absolute right-8 top-8 text-[14px] font-bold text-[#8427cf]">Fechar ›</button>
      <div className="mt-8 flex items-center gap-3 text-[20px] font-bold"><DollarIcon className="h-6 w-6 text-[#ff8500]" />Centro de Custo</div>
      <p className="mt-4 text-[13px] leading-6 text-neutral-600">Gerencie centros de custo vinculados à conta, visualize orçamento e defina a área responsável pelos dossiês.</p>
      <div className="mt-7 rounded bg-[#f5f5f5] p-4 text-[13px]"><b>Conta:</b> NOVAX<br/><b>Operador:</b> FAGNER LOURENÇO<br/><b>Permissão:</b> Consulta e solicitação</div>
      <div className="mt-7 space-y-3">
        {costs.map((cost) => <motion.div whileHover={{ y: -2 }} key={cost.code} className="rounded border border-[#ddd] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><b>{cost.name}</b><span className={cx("rounded px-2 py-1 text-[11px] font-bold text-white", cost.status === "Ativo" ? "bg-[#0d9f52]" : "bg-[#d98208]")}>{cost.status}</span></div><div className="mt-2 text-[12px] text-neutral-500">{cost.code}</div><div className="mt-3 text-[13px]"><b>Orçamento:</b> {cost.budget}</div></motion.div>)}
      </div>
      <ButtonMotion className="mt-7 w-full rounded bg-[#8427cf] px-5 py-3 text-[14px] font-bold text-white">Solicitar novo centro de custo</ButtonMotion>
    </motion.aside>
  );
}

function TopProductHeader() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [appsOpen, setAppsOpen] = useState(false);
  const [permission, setPermission] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [costCenterOpen, setCostCenterOpen] = useState(false);
  return (
    <div className="relative">
      <div className="h-[62px] bg-gradient-to-r from-[#ff8417] via-[#a44167] to-[#5f147f] text-white">
        <div className="mx-auto flex h-full max-w-[1900px] items-center justify-between px-8 text-[13px]">
          <div className="flex items-center gap-3 text-[24px] font-bold tracking-wide"><span className="text-2xl">⌘</span> UPMINER®</div>
          <div className="hidden items-center gap-6 md:flex">
            {permission && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded bg-[#f29900] px-4 py-3 text-[13px] font-bold text-white">ⓘ Você não tem permissão a essa funcionalidade, entre em contato com o master da conta <button onClick={() => setPermission(false)} className="ml-3">×</button></motion.div>}
            <button className="rounded border border-white/75 px-4 py-2 text-[14px] font-semibold">▣ Dicionário de fontes</button>
            <button className="rounded p-1 hover:bg-white/10"><MessageIcon className="h-5 w-5" /></button>
            <button className="rounded p-1 hover:bg-white/10"><DatabaseIcon className="h-5 w-5" /></button>
            <button className="rounded p-1 hover:bg-white/10"><BriefcaseIcon className="h-5 w-5" /></button>
            <button className="rounded p-1 hover:bg-white/10"><BellIcon className="h-5 w-5" /></button>
            <button type="button" onClick={() => { setProfileOpen(!profileOpen); setActiveCategory(null); setAppsOpen(false); }} className={cx("rounded p-1 hover:bg-white/10", profileOpen && "bg-white/15")}><UsersIcon className="h-6 w-6" /></button>
          </div>
        </div>
      </div>
      <div className="h-[42px] border-b bg-[#f1f1f1] shadow-sm">
        <div className="mx-auto flex h-full max-w-[1900px] items-center justify-between px-8 text-[13px] font-bold">
          <div className="flex gap-8">
            {productCategories.map((category) => <button key={category} type="button" onClick={() => { setActiveCategory(activeCategory === category ? null : category); setAppsOpen(false); setProfileOpen(false); }} className={cx("h-[42px] border-b-2 transition", activeCategory === category ? "border-[#8427cf] text-[#8427cf]" : "border-transparent hover:text-[#8427cf]")}>{category}</button>)}
          </div>
          <button type="button" onClick={() => { setAppsOpen(!appsOpen); setActiveCategory(null); setProfileOpen(false); }} className={cx("rounded border px-3 py-2 text-[#9b32e6] transition", appsOpen ? "border-[#8427cf] bg-white shadow" : "border-transparent")}>Aplicativos ▦</button>
        </div>
      </div>
      <AnimatePresence>{activeCategory && <ProductsMegaMenu category={activeCategory} onClose={() => setActiveCategory(null)} />}</AnimatePresence>
      <AnimatePresence>{appsOpen && <AppsDropdown onClose={() => setAppsOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{profileOpen && <ProfileMenu onClose={() => setProfileOpen(false)} onCostCenter={() => { setProfileOpen(false); setCostCenterOpen(true); }} />}</AnimatePresence>
      <AnimatePresence>{costCenterOpen && <CostCenterPanel onClose={() => setCostCenterOpen(false)} />}</AnimatePresence>
    </div>
  );
}

function Header({ mode, setMode, onBack }: { mode: Mode; setMode: (mode: Mode) => void; onBack: () => void }) {
  return (
    <>
      <TopProductHeader />
      <div className="mx-auto max-w-[1820px] px-4 pt-5 sm:px-10">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <ButtonMotion type="button" onClick={onBack} className="text-neutral-500" aria-label="Voltar para lista de dossiês"><ArrowLeftIcon className="h-5 w-5" /></ButtonMotion>
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">Dossiê {mode === "analitico" ? "111.332" : "916.160"}</h1>
            <div className="inline-flex rounded-full border border-[#8f31e6] bg-white p-[2px] text-[12px] font-bold">
              <button type="button" onClick={() => setMode("analitico")} className={cx("rounded-full px-5 py-1.5 sm:px-7 transition-all", mode === "analitico" ? "bg-[#8f31e6] text-white" : "text-neutral-700 hover:bg-purple-50")}>Analítico</button>
              <button type="button" onClick={() => setMode("detalhado")} className={cx("rounded-full px-5 py-1.5 sm:px-7 transition-all", mode === "detalhado" ? "bg-[#8f31e6] text-white" : "text-neutral-700 hover:bg-purple-50")}>Detalhado</button>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-9 gap-y-3 text-[13px] font-bold text-[#8427cf]"><span>↑ Início</span><span className="flex items-center gap-2"><MessageIcon className="h-5 w-5" />Análise e comentários</span><span className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" />Histórico de Dossiês</span><span className="flex items-center gap-2"><ExportIcon className="h-5 w-5" />Exportar</span></nav>
        </header>
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-4 border-b-2 border-[#bdbdbd] px-2 pb-3 text-[13px] sm:gap-x-16 sm:px-4">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.key} className={cx("flex items-center gap-2 transition-all hover:text-[#8427cf]", tab.muted ? "text-neutral-400" : tab.active ? "text-[#8427cf]" : "text-neutral-600")}><Icon className="h-4 w-4" />{tab.label}</button>; })}</div>
      </div>
    </>
  );
}

function OverviewCard({ mode }: { mode: Mode }) {
  const isAnalytic = mode === "analitico";
  return <motion.section {...pageFx} className="rounded-sm bg-[#f1f1f1] px-4 py-4 sm:px-6"><div className="rounded-sm border border-[#d2d2d2] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,.16)]"><div className="grid gap-6 xl:grid-cols-[1.1fr_3.6fr_1.5fr] xl:gap-8"><div><div className="text-[14px] font-semibold text-[#555]">{isAnalytic ? "050.232.903-36" : "00.001.002/0001-05"}</div><div className="mt-1 text-[11px] text-neutral-600">{isAnalytic ? "FRANCISCO TACIANO DE SOUSA" : "NOME DA EMPRESA"}</div><div className="text-[11px] text-neutral-600">{isAnalytic ? "34 anos" : ""}</div></div><div className="grid grid-cols-2 gap-4 text-[11px] md:grid-cols-4"><Info label="Número do Dossiê" value={isAnalytic ? "111.332" : "916.160"}/><Info label="Data de Criação" value="23/04/2026 19:05:17"/><Info label="Usuário" value={isAnalytic ? "FAGNER LOURENÇO" : "Nome usuário(a)"}/><Info label="Fontes com Resultados" value={isAnalytic ? "04 ↗" : "09 ↗"}/><Info label="Perfil de Consulta" value="Compliance"/><Info label="Último processamento" value="23/04/2026 19:15:17"/><Info label="Homonimos" value="Único"/><Info label="Fontes sem Resultados" value={isAnalytic ? "09 ↗" : "11 ↗"}/></div><div className="grid grid-cols-3 gap-3 text-center text-[11px]"><Tile text="upFlag não habilitado"/><Tile text="Workflow não habilitado"/><Tile text="Score não habilitado"/></div></div></div></motion.section>;
}
function Info({ label, value }: { label: string; value: string }) { return <div><div className="text-neutral-500">{label}</div><div className="mt-1 font-bold text-neutral-700">{value}</div></div>; }
function Tile({ text }: { text: string }) { return <motion.div whileHover={{ y: -2 }} className="flex min-h-[78px] items-center justify-center rounded-sm bg-[#f1f1f1] px-2 text-neutral-600">{text}</motion.div>; }
function StatusBadge({ kind }: { kind: SourceStatus }) { const color = kind === "Com resultado" || kind === "Concluído" ? "bg-[#0d9f52]" : kind === "Indisponível" || kind === "Aguardando revisão" ? "bg-[#d94141]" : kind === "Processando" ? "bg-[#5868f2]" : "bg-[#d98208]"; return <span className={cx("inline-flex rounded px-3 py-0.5 text-[11px] font-bold text-white", color)}>{kind}</span>; }

function SectionHeader({ icon: Icon, title, open, onToggle }: { icon: React.ComponentType<IconProps>; title: string; open: boolean; onToggle: () => void }) {
  return <div className="flex items-center justify-between border-b border-[#b878f0] bg-[#f3f3f3] px-4 py-2 text-[#8427cf]"><button type="button" onClick={onToggle} className="flex items-center gap-2 text-[14px] font-semibold"><Icon className="h-4 w-4" />{title}</button><div className="flex items-center gap-3 text-neutral-500"><BookmarkIcon className="h-4 w-4"/><SmilePlusIcon className="h-4 w-4"/><ButtonMotion type="button" onClick={onToggle} className="text-[#8427cf]" aria-label={open ? `Fechar ${title}` : `Abrir ${title}`}>{open ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}</ButtonMotion></div></div>;
}

function AnalyticPage() {
  const { isOpen, toggle } = useCollapseState();
  return <motion.div {...pageFx} className="space-y-7"><OverviewCard mode="analitico"/><motion.section layout className="rounded border border-[#d0d0d0] bg-white"><SectionHeader icon={GavelIcon} title="Jurídico" open={isOpen("juridico")} onToggle={() => toggle("juridico")}/><Collapse open={isOpen("juridico")}><div className="border border-[#f1c88a] bg-[#fffaf1] p-4 text-[12px] leading-5 text-neutral-700"><b className="text-[#d27d00]">Aviso</b><br/>As informações apresentadas nas visões analítica e detalhada podem diferir. A visão analítica consolida dados e foca em análises estratégicas.</div><div className="grid gap-6 p-5 xl:grid-cols-[250px_1fr]"><Filters/><div className="space-y-4"><div className="flex justify-end text-[12px] text-[#8427cf]">↧ Download</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">{analyticMetrics.map((m, idx) => { const Icon=m.icon; return <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:idx*.04}} whileHover={{y:-3, boxShadow:"0 8px 22px rgba(0,0,0,.09)"}} key={m.label} className="rounded border border-[#d2d2d2] bg-white p-3"><Icon className="ml-auto h-4 w-4 text-[#8427cf]"/><div className="text-[22px] font-bold text-[#8427cf]">{m.value}</div><div className="text-[11px] text-neutral-500">{m.label}</div></motion.div>; })}</div><BarChart/><div className="grid grid-cols-1 gap-3 xl:grid-cols-2"><DonutPanel title="Quantidade de processos por tribunais"/><DonutPanel title="Principais assuntos" button/><DonutPanel title="Vara dos Processos" pink button/><DonutPanel title="Classe de processos" mixed button/></div></div></div></Collapse></motion.section>{analyticSections.map((s) => <SourceSection key={s.id} section={s} open={isOpen(s.id)} onToggle={() => toggle(s.id)}/>) }<AnalysisBoxes isOpen={isOpen} toggle={toggle}/></motion.div>;
}
function Filters() { const group = (title: string, items: string[]) => <div><h4 className="mb-2 text-[12px] font-bold text-neutral-700">{title}</h4><div className="space-y-2 text-[12px] text-[#8427cf]">{items.map((i) => <label key={i} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-purple-50"><input type="checkbox" className="h-4 w-4 rounded border-[#8427cf]"/>{i}</label>)}</div></div>; return <aside className="space-y-5"><div className="flex items-center gap-2 text-[14px] font-bold"><span className="text-[#8427cf]">☷</span> Filtros</div><div className="flex gap-2"><ButtonMotion className="rounded border border-[#8427cf] px-4 py-1.5 text-[12px] text-[#8427cf]">Limpar filtros</ButtonMotion><ButtonMotion className="rounded bg-[#8427cf] px-4 py-1.5 text-[12px] font-bold text-white">Filtrar</ButtonMotion></div>{group("Tribunais", ["Tribunais Superiores e Conselhos", "Tribunais Regionais Federais", "Tribunais de Justiça", "Tribunais Regionais Eleitorais", "Tribunais Regionais do Trabalho", "Tribunais de Justiça Militar", "Tribunais de Justiça Federal"])}{group("Status de processos", ["Em tramitação", "Em grau de recurso", "Suspenso", "Arquivamento definitivo", "Arquivamento provisório", "Arquivado administrativamente", "Arquivamento", "Julgado", "Extinto"])}{group("Participação no processos", ["Autor", "Réu", "Envolvido", "Sem Polo"])}<div><h4 className="mb-2 text-[12px] font-bold text-neutral-700">UF dos processos</h4><div className="rounded border border-[#d6d6d6] px-3 py-2 text-[11px] text-neutral-500">Selecione a UF</div></div></aside>; }
function BarChart() { return <div className="rounded border border-[#d2d2d2] bg-white"><div className="bg-[#eee] px-3 py-2 text-[15px] font-medium">Status de processos</div><div className="relative h-[235px] p-5"><div className="absolute left-8 right-6 top-8 space-y-12">{[1,2,3,4].map(i=><div key={i} className="border-t border-[#e5e5e5]"/>)} </div><motion.div initial={{height:0}} animate={{height:145}} transition={{duration:.55}} className="absolute bottom-14 left-[24%] w-[92px] rounded-t-xl bg-[#ff8a17]"/><motion.div initial={{height:0}} animate={{height:28}} transition={{duration:.55, delay:.1}} className="absolute bottom-14 right-[19%] w-[92px] rounded-lg bg-[#ffa64d]"/><div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-5 text-[12px]"><span><b className="text-[#ff8a17]">■</b> Arquivamento</span><span><b className="text-[#ffa64d]">■</b> Em Tramitação</span></div></div></div>; }
function DonutPanel({ title, pink, mixed, button }: { title: string; pink?: boolean; mixed?: boolean; button?: boolean }) { const colors = pink ? ["#f08286", "#ffb3a6", "#ffd0bd", "#ff8a17"] : mixed ? ["#ff8a17", "#ffa64d", "#ffc78f", "#ffe3c8", "#f7a7a8", "#ed8588"] : ["#ff8a17", "#ffa64d", "#ffd0a1"]; return <motion.div whileHover={{y:-2}} className="rounded border border-[#d2d2d2] bg-white"><div className="bg-[#eee] px-3 py-2 text-[15px] font-medium">{title}</div><div className="grid min-h-[240px] grid-cols-1 items-center p-4 md:grid-cols-[210px_1fr]"><motion.div initial={{rotate:-90, opacity:.4}} animate={{rotate:0, opacity:1}} className="relative mx-auto h-36 w-36 rounded-full" style={{background:`conic-gradient(${colors.map((c,i)=>`${c} ${i*16}% ${(i+1)*18}%`).join(',')}, #f2f2f2 85% 100%)`}}><div className="absolute inset-9 rounded-full bg-white"/><span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded bg-white px-2 py-1 text-[10px] shadow">100.0%</span></motion.div><div className="space-y-2 text-[12px] text-neutral-700">{["Tribunais De Justi...", "Apelacao Criminal", "Termo Circunstanci...", "Procedimento Comum...", "Outros"].map((l,i)=><div key={l} className="flex gap-2"><span style={{color:colors[i%colors.length]}}>●</span>{l}</div>)}{button && <div className="pt-4 text-right"><ButtonMotion className="rounded border border-[#8427cf] px-5 py-1.5 text-[#8427cf]">Ver mais</ButtonMotion></div>}</div></div></motion.div>; }

function SourceSection({ section, open, onToggle }: { section: SectionBlock; open: boolean; onToggle: () => void }) { return <motion.section layout className="rounded border border-[#d0d0d0] bg-white"><SectionHeader icon={section.icon} title={section.title} open={open} onToggle={onToggle}/><Collapse open={open}><div className="grid grid-cols-[90px_1fr] gap-4 p-5 sm:grid-cols-[110px_1fr] sm:gap-6 sm:p-7"><div className="text-center text-[46px] font-bold text-neutral-500 sm:text-[54px]">{section.count}</div><div className="overflow-x-auto"><div className="min-w-[760px]"><div className="grid grid-cols-[1.8fr_.45fr_.35fr] bg-[#eee] px-4 py-3 text-[12px] font-bold"><span>Fontes</span><span>Status</span><span>Detalhes</span></div>{section.rows.map((r,i)=><motion.div initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} transition={{delay:i*.03}} key={r.fonte} className="grid grid-cols-[1.8fr_.45fr_.35fr] border-b px-4 py-3 text-[13px]"><span>{r.fonte}</span><span><StatusBadge kind={r.status}/></span><span>{r.detalhes ? <button className="text-[#8427cf]">Ver detalhes ↗</button> : ""}</span></motion.div>)}</div></div></div></Collapse></motion.section>; }

function DetailedPage() { const { isOpen, toggle } = useCollapseState(); return <motion.div {...pageFx} className="space-y-7"><OverviewCard mode="detalhado"/><DetailCategory id="detalhado_juridico" title="Jurídico" icon={GavelIcon} entries={detailEntries.slice(0,2)} isOpen={isOpen} toggle={toggle}/><DetailCategory id="detalhado_cadastro" title="Cadastro" icon={DatabaseIcon} entries={detailEntries.slice(2,4)} isOpen={isOpen} toggle={toggle}/><DetailCategory id="detalhado_reguladores" title="Reguladores" icon={ShieldIcon} entries={detailEntries.slice(4,5)} isOpen={isOpen} toggle={toggle}/><DetailCategory id="detalhado_socio" title="Socioambiental" icon={TreeIcon} entries={detailEntries.slice(5)} isOpen={isOpen} toggle={toggle}/><AnalysisBoxes isOpen={isOpen} toggle={toggle}/></motion.div>; }
function DetailCategory({ id, title, icon, entries, isOpen, toggle }: { id: string; title: string; icon: React.ComponentType<IconProps>; entries: DetailEntry[]; isOpen: (id: string) => boolean; toggle: (id: string) => void }) { return <motion.section layout className="rounded border border-[#d0d0d0] bg-white"><SectionHeader title={title} icon={icon} open={isOpen(id)} onToggle={() => toggle(id)}/><Collapse open={isOpen(id)}><div className="space-y-5 p-3">{entries.map((e)=><DetailEntryCard key={e.id} entry={e} open={isOpen(e.id)} onToggle={() => toggle(e.id)}/>)}</div></Collapse></motion.section>; }
function DetailEntryCard({ entry, open, onToggle }: { entry: DetailEntry; open: boolean; onToggle: () => void }) { return <motion.article layout className="rounded-sm border border-[#d7d7d7] bg-white"><div className="flex items-center justify-between border-b border-[#b878f0] px-3 py-2 text-[12px]"><button type="button" onClick={onToggle} className="text-left"><span className="mr-2 text-[#8427cf]">ⓘ</span>{entry.title}<div className="mt-1 text-[10px] text-neutral-500">{entry.subtitle}</div></button><div className="flex items-center gap-3"><StatusBadge kind={entry.status ?? "Com resultado"}/><BookmarkIcon className="h-4 w-4 text-neutral-500"/><SmilePlusIcon className="h-4 w-4 text-neutral-500"/><ButtonMotion type="button" onClick={onToggle} className="text-[#8427cf]">{open ? <ChevronUpIcon className="h-4 w-4"/> : <ChevronDownIcon className="h-4 w-4"/>}</ButtonMotion></div></div><Collapse open={open}>{entry.table && <DataTable rows={entry.table}/>} {entry.processList && <ProcessList/>}{entry.paragraph && <div className="px-4 py-3"><h4 className="mb-2 text-[12px] font-bold">Consulta</h4><p className="max-w-[1180px] text-[12px] leading-5 text-neutral-700">{entry.paragraph}</p></div>}<div className="px-4 py-5"><div className="flex justify-between text-[12px]"><b>Comentários finais</b><button className="text-[#8427cf]">×</button></div><p className="mt-3 text-[11px] text-neutral-500">Sem comentários até o momento.</p><div className="mt-5 text-right"><ButtonMotion className="rounded border border-[#8427cf] px-4 py-1.5 text-[12px] text-[#8427cf]">Adicionar +</ButtonMotion></div></div></Collapse></motion.article>; }
function DataTable({ rows }: { rows: Array<Record<string,string>> }) { const headers=Object.keys(rows[0] ?? {}); return <div className="overflow-x-auto p-4"><div className="min-w-[760px]"><div className="grid bg-[#eee] px-3 py-2 text-[11px] font-bold" style={{gridTemplateColumns:`repeat(${headers.length}, minmax(120px,1fr))`}}>{headers.map(h=><span key={h}>{h}</span>)}</div>{rows.map((r,i)=><motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*.03}} key={i} className="grid border-b px-3 py-2 text-[11px] text-neutral-700" style={{gridTemplateColumns:`repeat(${headers.length}, minmax(120px,1fr))`}}>{headers.map(h=><span key={h} className={h==='PDF'||h==='Situação'? 'font-bold text-[#8427cf]':''}>{r[h]}</span>)}</motion.div>)}</div></div>; }
function JudicialStatusBadge({ status }: { status: JudicialProcess["status"] }) {
  const color = status === "Em tramitação" ? "bg-[#0d9f52]" : status === "Em grau de recurso" ? "bg-[#5868f2]" : "bg-[#d94141]";
  return <span className={cx("rounded px-2 py-0.5 text-[10px] font-bold text-white", color)}>{status}</span>;
}

function ProcessDetailPanel({ processes, onClose }: { processes: JudicialProcess[]; onClose: () => void }) {
  return (
    <motion.aside {...slideFx} className="fixed right-0 top-0 z-50 h-screen w-[540px] border-l-4 border-[#ff8500] bg-white px-7 py-7 shadow-[-8px_0_18px_rgba(0,0,0,.16)]">
      <button onClick={onClose} className="absolute right-7 top-6 text-[13px] font-bold text-[#8427cf]">Fechar ›</button>
      <h2 className="text-[18px] font-bold">Detalhe dos processos</h2>
      <p className="mt-2 text-[12px] text-neutral-500">Confira os processos que você filtrou</p>
      <div className="mt-6 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[.28fr_1.2fr_1.05fr_.7fr_.55fr_.35fr] bg-[#eee] px-3 py-2 text-[11px] font-bold"><span>UF</span><span>Assunto do processo</span><span>Número do processo</span><span>Valor do processo</span><span>Participação</span><span></span></div>
          {processes.map((p) => <div key={p.number} className="grid grid-cols-[.28fr_1.2fr_1.05fr_.7fr_.55fr_.35fr] border-b px-3 py-2 text-[11px]"><span>CE</span><span>{p.subject}</span><span>{p.number}</span><span>{p.value}</span><span>{p.participation}</span><button className="text-[#8427cf]">Detalhes ↓</button></div>)}
        </div>
      </div>
      <ButtonMotion className="mt-5 rounded border border-[#8427cf] px-4 py-2 text-[12px] font-bold text-[#8427cf]">Baixar todos</ButtonMotion>
    </motion.aside>
  );
}

function ProcessExpandedDetails({ process }: { process: JudicialProcess }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="col-span-4 border-t border-[#d9b6f3] bg-[#fbfbfb] px-4 py-4 text-[11px]">
      <div className="grid grid-cols-2 gap-x-10 gap-y-3 md:grid-cols-5">
        <Info label="Número do Processo" value={process.number} />
        <Info label="Tribunal" value={process.court} />
        <Info label="Data Distribuição" value={process.distributionDate} />
        <Info label="Status" value={process.status} />
        <Info label="Movimentações" value="Ver mais ›" />
        <Info label="Assunto" value={process.subject} />
        <Info label="Área" value={process.area} />
        <Info label="Grau do Processo" value="1º Grau" />
        <Info label="Segmento" value={process.segment} />
        <Info label="Órgão Julgador" value={process.courtUnit} />
        <Info label="Classe Processual" value={process.className} />
        <Info label="Unidade de Origem" value={process.district} />
        <Info label="Código CNJ" value="1234" />
        <Info label="UF" value="CE" />
        <Info label="Principal" value="Sim" />
      </div>
      <div className="mt-4"><b>URL do Processo</b><br/><a className="font-bold text-[#1a73e8]" href="#">{process.link}</a></div>
      <div className="mt-4 grid grid-cols-[1fr_.6fr_.6fr] bg-[#eee] px-3 py-2 font-bold"><span>Requerente / Ativo</span><span>Tipo de documento</span><span>Número do documento</span></div>
      <div className="grid grid-cols-[1fr_.6fr_.6fr] border-b px-3 py-2"><span>{process.activeParty}</span><span>CPF</span><span className="text-[#8427cf]">050.232.903-36</span></div>
      <div className="mt-3 grid grid-cols-[1fr_.6fr_.6fr] bg-[#eee] px-3 py-2 font-bold"><span>Requerido / Passivo</span><span>Tipo de documento</span><span>Número do documento</span></div>
      <div className="grid grid-cols-[1fr_.6fr_.6fr] border-b px-3 py-2"><span>{process.passiveParty}</span><span>CNPJ</span><span className="text-[#8427cf]">06.928.790/0001-56</span></div>
      <div className="mt-3 grid grid-cols-[1fr_.6fr_.6fr] bg-[#eee] px-3 py-2 font-bold"><span>Pessoas relacionadas</span><span>Tipo de documento</span><span>Número do documento</span></div>
      {process.relatedPeople.map((person) => <div key={person.name} className="grid grid-cols-[1fr_.6fr_.6fr] border-b px-3 py-2"><span>{person.name}</span><span>{person.documentType}</span><span className="text-[#8427cf]">{person.document}</span></div>)}
      <div className="mt-3"><b>Últimas movimentações</b><div className="mt-2 flex flex-wrap gap-2">{process.movements.map((m) => <span key={m} className="rounded bg-white px-3 py-1 shadow-sm">{m}</span>)}</div></div>
    </motion.div>
  );
}

function ProcessList() {
  const [activeTab, setActiveTab] = useState<"Segmento" | "Área" | "Classe">("Classe");
  const [expanded, setExpanded] = useState(judicialProcesses[1]?.number ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const classes = useMemo(() => Array.from(new Set(judicialProcesses.map((p) => p.className))), []);
  return (
    <div className="overflow-x-auto p-4">
      <div className="mb-3 flex items-center justify-between text-[11px]"><label className="flex items-center gap-2"><input type="checkbox"/>Marcar todos como relevantes</label><ButtonMotion onClick={() => setPanelOpen(true)} className="rounded border border-[#8427cf] px-3 py-1 text-[#8427cf]">Ver detalhes dos processos</ButtonMotion></div>
      <div className="min-w-[1120px]">
        <div className="mb-4 flex items-center justify-center gap-8 text-[11px]">{(["Segmento", "Área", "Classe"] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={cx("border-b-2 px-5 py-2", activeTab === tab ? "border-[#8427cf] text-[#8427cf] font-bold" : "border-transparent text-neutral-500")}>{tab}</button>)}</div>
        <div className="mb-3 flex items-center gap-5 overflow-hidden text-[10px] text-neutral-600"><button className="text-neutral-300">‹</button><button className="rounded bg-[#f5efff] px-4 py-2 text-[#8427cf]">Todos os segmentos</button>{classes.map((item) => <button key={item} className="whitespace-nowrap border-b border-transparent px-2 py-2 hover:border-[#8427cf] hover:text-[#8427cf]">{item}</button>)}<button className="text-[#8427cf]">›</button></div>
        <div className="grid grid-cols-[.45fr_1.65fr_.55fr_.75fr] bg-[#eee] px-3 py-2 text-[11px] font-bold"><span>Nº do Processo</span><span>Classe</span><span>Tribunal</span><span></span></div>
        {judicialProcesses.map((process, i) => {
          const open = expanded === process.number;
          return (
            <motion.div layout initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .025 }} key={process.number} className="grid grid-cols-[.45fr_1.65fr_.55fr_.75fr] border-b border-[#d9b6f3] text-[11px]">
              <button onClick={() => setExpanded(open ? "" : process.number)} className="px-3 py-2 text-left">☆ &nbsp; {process.number}</button>
              <button onClick={() => setExpanded(open ? "" : process.number)} className="px-3 py-2 text-left font-semibold">{process.className}</button>
              <span className="px-3 py-2">{process.court}</span>
              <span className="flex items-center justify-end gap-2 px-3 py-2"><span className="text-[10px] text-neutral-500">Processo relacionado</span><JudicialStatusBadge status={process.status}/>{open ? <ChevronUpIcon className="h-3 w-3 text-[#8427cf]"/> : <ChevronDownIcon className="h-3 w-3 text-[#8427cf]"/>}</span>
              {open && <ProcessExpandedDetails process={process}/>} 
            </motion.div>
          );
        })}
      </div>
      <div className="px-0 py-5"><div className="flex justify-between text-[12px]"><b>Comentários finais</b><button className="text-[#8427cf]">×</button></div><p className="mt-3 text-[11px] text-neutral-500">Sem comentários até o momento.</p><div className="mt-5 text-right"><ButtonMotion className="rounded border border-[#8427cf] px-4 py-1.5 text-[12px] text-[#8427cf]">Adicionar +</ButtonMotion></div></div>
      <AnimatePresence>{panelOpen && <ProcessDetailPanel processes={judicialProcesses} onClose={() => setPanelOpen(false)}/>}</AnimatePresence>
    </div>
  );
}

function AnalysisBoxes({ isOpen, toggle }: { isOpen: (id: string) => boolean; toggle: (id: string) => void }) { return <div className="space-y-5 bg-[#eee] p-7"><TextBox id="analysis" title="Análise conclusiva do dossiê" action open={isOpen("analysis")} onToggle={() => toggle("analysis")}/><TextBox id="comments" title="Comentários finais" comment open={isOpen("comments")} onToggle={() => toggle("comments")}/></div>; }
function TextBox({ title, action, comment, open, onToggle }: { id?: string; title:string; action?:boolean; comment?:boolean; open:boolean; onToggle:()=>void }){ return <motion.section layout className="border border-[#cfcfcf] bg-white"><button type="button" onClick={onToggle} className="flex w-full items-center justify-between bg-[#f4f4f4] px-4 py-2 text-left text-[12px] font-semibold"><span>▱ {title}</span>{open ? <ChevronUpIcon className="h-4 w-4 text-[#8427cf]"/> : <ChevronDownIcon className="h-4 w-4 text-[#8427cf]"/>}</button><Collapse open={open}><div className="p-4"><div className="mb-1 text-[11px] text-neutral-500">{comment?'Escreva um comentário':'Análise'}</div><textarea className="h-20 w-full rounded border border-[#cfcfcf] p-3 text-[12px] outline-none transition focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100" placeholder={comment?'Digite aqui...':'Escreva sua análise aqui...'}/><div className="mt-3 flex justify-end gap-3">{comment && <ButtonMotion className="bg-[#ddd] px-4 py-1.5 text-[11px]">Enviar esse comentário como relevante ☆</ButtonMotion>}{action && <><ButtonMotion className="bg-[#ccc] px-5 py-1.5 text-[12px] font-bold">👍 Aprovar</ButtonMotion><ButtonMotion className="bg-[#ccc] px-5 py-1.5 text-[12px] font-bold">👎 Reprovar</ButtonMotion></>} {comment && <ButtonMotion className="bg-[#ccc] px-5 py-1.5 text-[12px] font-bold">Enviar</ButtonMotion>}</div></div></Collapse></motion.section> }
function Footer(){ return <footer className="mt-8 flex h-16 items-center justify-center bg-gradient-to-r from-[#ff8417] via-[#a44167] to-[#5f147f] font-bold text-white">⌘ UPMINER®</footer> }

function FieldBox({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <label className={cx("block", wide ? "w-[255px]" : "w-[205px]")}><div className="mb-1 text-[11px] text-neutral-500">{label}</div><div className="flex h-[34px] items-center justify-between rounded border border-[#cfcfcf] bg-white px-3 text-[14px] text-neutral-500"><span>{value}</span><span>⌄</span></div></label>; }

function ProfileSidePanel({ profile, onClose }: { profile: ProfileCard; onClose?: () => void }) {
  const Icon = profile.icon;
  return <AnimatePresence><motion.aside {...slideFx} className="fixed right-0 top-0 z-40 h-screen w-[350px] border-l-4 border-[#ff8500] bg-white px-8 py-8 shadow-[-8px_0_18px_rgba(0,0,0,.12)]"><button type="button" onClick={onClose} className="absolute right-8 top-8 text-[14px] font-bold text-[#8427cf]">Fechar ›</button><div className="mt-10 flex items-center gap-3 text-[18px] font-bold"><Icon className="h-6 w-6 text-[#ff8500]" />{profile.title}</div><div className="mt-6 text-[12px] font-bold">Objetivo</div><p className="mt-2 text-[13px] leading-7 text-neutral-700">{profile.description}</p><div className="mt-8 space-y-0">{profile.sources.map((source, idx) => <motion.div initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} transition={{delay:idx*.025}} key={source} className="truncate border-b border-[#ddd] py-3 text-[12px] text-neutral-500">{source}</motion.div>)}</div><button className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8a00] text-3xl text-white shadow-lg">▱</button></motion.aside></AnimatePresence>;
}

function CreateDossierPage({ onBack, onCreated, onCustomProfile }: { onBack: () => void; onCreated: () => void; onCustomProfile: () => void }) {
  const [step, setStep] = useState<CreateStep>("perfil");
  const [personType, setPersonType] = useState<PersonType>("Pessoa Física");
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>("rh");
  const [showPanel, setShowPanel] = useState(true);
  const [paramOpen, setParamOpen] = useState(true);
  const currentProfile = profileCards.find((item) => item.key === selectedProfile) ?? profileCards[0];
  const next = () => step === "perfil" ? setStep("tag") : step === "tag" ? setStep("parametros") : onCreated();
  const back = () => step === "parametros" ? setStep("tag") : step === "tag" ? setStep("perfil") : onBack();

  return <div className="min-h-screen bg-white text-neutral-900 [font-family:'Inter','Segoe_UI',Arial,sans-serif] antialiased"><TopProductHeader/><main className="relative min-h-[calc(100vh-104px)] px-10 py-8"><motion.div {...pageFx} className="mb-7 flex justify-between"><div><h1 className="text-[28px] font-bold tracking-[-0.02em]">Criação de dossiês</h1><div className="mt-6 flex gap-3 text-[13px]"><b className={step==="perfil"?"":"text-neutral-500"}>Perfil de consulta</b><span>/</span><span className={step === "perfil" ? "text-neutral-400" : step === "tag" ? "font-bold" : "text-neutral-500"}>Critérios</span><span>/</span><span className={step === "tag" ? "font-bold" : "text-neutral-400"}>Tag</span><span>/</span><span className={step === "parametros" ? "font-bold" : "text-neutral-400"}>Parâmetros</span></div></div><ButtonMotion type="button" onClick={onBack} className="mt-2 text-[14px] font-bold text-[#8427cf]">Voltar para histórico de Dossiês</ButtonMotion></motion.div>
    <AnimatePresence mode="wait">
      {step === "perfil" && <motion.div key="perfil" {...pageFx}><div className="mb-6 inline-flex rounded-full border border-neutral-400 bg-white p-[1px] text-[11px] font-bold">{(["Pessoa Física", "Pessoa Jurídica"] as PersonType[]).map((item) => <button key={item} type="button" onClick={() => setPersonType(item)} className={cx("rounded-full px-4 py-2 transition-all", personType === item ? "bg-[#8427cf] text-white" : "text-neutral-500 hover:bg-purple-50")}>{item}</button>)}</div><section className="mt-4"><div className="text-[16px] text-neutral-500">Perfis de Consulta Personalizados <span className="ml-2">ⓘ</span></div><div className="mt-6 text-[19px]">Nenhum perfil encontrado</div></section><section className="absolute bottom-[120px] left-10 right-[370px]"><div className="mb-5 text-[16px] text-neutral-500">Perfis de Consulta Padronizados <span className="ml-2">ⓘ</span></div><div className="flex gap-4 overflow-x-auto pb-4">{profileCards.map((profile, idx) => { const Icon = profile.icon; const active = profile.key === selectedProfile; return <motion.button initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{delay:idx*.035}} whileHover={{scale:1.035, y:-4}} whileTap={{scale:.97}} key={profile.key} type="button" onClick={() => { setSelectedProfile(profile.key); setShowPanel(true); }} className={cx("flex h-[145px] min-w-[210px] flex-col items-center justify-center rounded-lg border bg-white text-center shadow-sm transition-all", active ? "border-[#9e38e8] shadow-[0_0_0_1px_#9e38e8]" : "border-[#d3d3d3]")}><Icon className="mb-3 h-6 w-6 text-[#ff8500]"/><div className="text-[18px] font-bold leading-5">{profile.title}</div><div className="mt-5 text-[12px] text-neutral-500">ⓘ Ver Detalhes</div></motion.button>; })}</div></section></motion.div>}
      {step === "tag" && <motion.section key="tag" {...pageFx} className="mt-8 max-w-[340px]"><h2 className="mb-8 text-[16px] font-bold">Descrição da Tag</h2><div className="mb-8 text-[16px] text-neutral-600">Selecione uma Tag existente</div><label className="text-[12px] text-neutral-500">Tags Criadas<div className="mt-2 flex h-10 items-center justify-between rounded border border-[#cfcfcf] px-4 text-[15px] text-neutral-500">Selecione <span>⌄</span></div></label><label className="mt-5 flex items-center gap-2 text-[13px] text-[#8427cf]"><input type="checkbox" className="h-4 w-4"/>Não atribuir tag a esse dossiê</label></motion.section>}
      {step === "parametros" && <motion.section key="parametros" {...pageFx} className="mt-8"><p className="mb-8 text-[16px] text-neutral-600">Adicione parâmetros para enriquecer sua busca e encontrar resultados mais precisos</p><div className="rounded border border-[#ddd]"><button type="button" onClick={() => setParamOpen(!paramOpen)} className="flex w-full items-center justify-between border-b border-[#b878f0] bg-[#f3f3f3] px-4 py-3 text-left text-[15px] font-semibold">Processos Judiciais (Nova){paramOpen ? <ChevronUpIcon className="h-4 w-4 text-[#8427cf]"/> : <ChevronDownIcon className="h-4 w-4 text-[#8427cf]"/>}</button><Collapse open={paramOpen}><label className="mt-4 flex items-center gap-2 px-4 pb-4 text-[13px] text-[#8427cf]"><input type="checkbox" className="h-4 w-4"/>Marcar automaticamente como relevantes</label></Collapse></div></motion.section>}
    </AnimatePresence>
    <div className="absolute bottom-8 left-10 flex items-center gap-4"><ButtonMotion type="button" onClick={back} className="rounded border border-[#8427cf] px-7 py-3 text-[15px] font-bold text-[#8427cf]">Voltar</ButtonMotion><ButtonMotion type="button" onClick={next} className="rounded bg-[#8427cf] px-7 py-3 text-[15px] font-bold text-white">{step === "parametros" ? "Criar dossiê" : "Próximo passo"}</ButtonMotion>{step === "perfil" && <><span className="text-[14px] text-neutral-600">Nenhum dos perfis atende sua necessidade?</span><ButtonMotion type="button" onClick={onCustomProfile} className="text-[14px] font-bold text-[#8427cf]">Clique aqui para criar um novo!</ButtonMotion></>}{step === "parametros" && <label className="flex items-center gap-2 text-[13px] text-[#8427cf]"><input type="checkbox"/>Criar e processar Dossiês automaticamente</label>}</div></main>{step === "perfil" && showPanel && <ProfileSidePanel profile={currentProfile} onClose={() => setShowPanel(false)}/>}</div>;
}

function CustomProfilePage({ onBack, onSave }: { onBack: () => void; onSave: () => void }) {
  const [personType, setPersonType] = useState<PersonType>("Pessoa Física");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(["Processos Judiciais", "Infosimples: Situação Cadastral do CPF na Receita Federal"]);
  const [openCategory, setOpenCategory] = useState(true);
  const filtered = allSources.filter((source) => source.toLowerCase().includes(query.toLowerCase()));
  const toggleSource = (source: string) => setSelected((prev) => prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]);

  return <div className="min-h-screen bg-white text-neutral-900 [font-family:'Inter','Segoe_UI',Arial,sans-serif] antialiased"><TopProductHeader/><main className="px-10 py-8"><motion.div {...pageFx} className="mb-8 flex items-start justify-between"><div><h1 className="text-[28px] font-bold tracking-[-0.02em]">Criar perfil personalizado</h1><div className="mt-6 flex gap-3 text-[13px]"><b>Perfil de consulta</b><span>/</span><b>Fonte de dados</b><span>/</span><span className="text-neutral-400">Parâmetros</span></div></div><ButtonMotion onClick={onBack} className="text-[14px] font-bold text-[#8427cf]">Voltar para criação de dossiês</ButtonMotion></motion.div>
    <motion.section {...pageFx} className="grid gap-8 xl:grid-cols-[390px_1fr_320px]"><div className="space-y-5"><div><label className="text-[12px] font-semibold text-neutral-500">Nome do perfil</label><input className="mt-2 h-11 w-full rounded border border-[#cfcfcf] px-4 text-[14px] outline-none focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100" placeholder="Ex: Compliance RH Premium"/></div><div><label className="text-[12px] font-semibold text-neutral-500">Descrição</label><textarea className="mt-2 h-28 w-full rounded border border-[#cfcfcf] px-4 py-3 text-[14px] outline-none focus:border-[#8427cf] focus:ring-2 focus:ring-purple-100" placeholder="Descreva o objetivo deste perfil..."/></div><div><div className="mb-2 text-[12px] font-semibold text-neutral-500">Tipo de pessoa</div><div className="inline-flex rounded-full border border-neutral-400 p-[1px] text-[11px] font-bold">{(["Pessoa Física", "Pessoa Jurídica"] as PersonType[]).map((item) => <button key={item} onClick={() => setPersonType(item)} className={cx("rounded-full px-4 py-2", personType === item ? "bg-[#8427cf] text-white" : "text-neutral-500")}>{item}</button>)}</div></div></div>
    <div className="rounded border border-[#d6d6d6] bg-white"><div className="flex items-center justify-between border-b bg-[#f3f3f3] px-4 py-3"><button onClick={() => setOpenCategory(!openCategory)} className="flex items-center gap-2 font-semibold text-[#8427cf]"><DatabaseIcon className="h-4 w-4"/>Fontes disponíveis</button>{openCategory ? <ChevronUpIcon className="h-4 w-4 text-[#8427cf]"/> : <ChevronDownIcon className="h-4 w-4 text-[#8427cf]"/>}</div><Collapse open={openCategory}><div className="p-4"><input value={query} onChange={(e) => setQuery(e.target.value)} className="mb-4 h-10 w-full rounded border border-[#cfcfcf] px-4 text-[14px] outline-none focus:border-[#8427cf]" placeholder="Pesquisar fonte..."/><div className="max-h-[420px] space-y-2 overflow-auto pr-2">{filtered.map((source, idx) => <motion.label key={source} initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} transition={{delay:idx*.015}} className="flex cursor-pointer items-center justify-between rounded border border-[#eee] px-3 py-3 text-[13px] hover:bg-purple-50"><span>{source}</span><input type="checkbox" checked={selected.includes(source)} onChange={() => toggleSource(source)} className="h-4 w-4"/></motion.label>)}</div></div></Collapse></div>
    <aside className="rounded border border-[#d6d6d6] bg-[#fafafa] p-5"><div className="text-[16px] font-bold">Resumo do perfil</div><div className="mt-4 text-[12px] text-neutral-500">Tipo</div><div className="font-semibold">{personType}</div><div className="mt-4 text-[12px] text-neutral-500">Fontes selecionadas</div><div className="mt-1 text-[28px] font-bold text-[#8427cf]">{selected.length}</div><div className="mt-4 space-y-2">{selected.slice(0,6).map((item) => <div key={item} className="rounded bg-white px-3 py-2 text-[11px] shadow-sm">{item}</div>)}</div><ButtonMotion onClick={onSave} className="mt-6 w-full rounded bg-[#8427cf] px-5 py-3 text-[14px] font-bold text-white">Salvar perfil personalizado</ButtonMotion></aside></motion.section>
  </main></div>;
}

function DossiersListPage({ onOpenDetail, onCreate, showToast }: { onOpenDetail: () => void; onCreate: () => void; showToast: boolean }) {
  const [status, setStatus] = useState<"Iniciar" | "Na fila" | "Processando">("Processando");
  const [toast, setToast] = useState(showToast);
  const progress = status === "Iniciar" ? 0 : status === "Na fila" ? 0 : 86;
  return <div className="min-h-screen bg-white text-neutral-900 [font-family:'Inter','Segoe_UI',Arial,sans-serif] antialiased"><TopProductHeader/><Toast show={toast} message="Dossiê criado com sucesso!" onClose={() => setToast(false)}/><main className="px-8 py-9"><motion.div {...pageFx} className="mb-7 flex items-start justify-between"><div><h1 className="text-[29px] font-bold tracking-[-0.02em]">Dossiês</h1><div className="mt-6 flex flex-wrap items-end gap-4"><FieldBox label="Período" value="00/00/0000 até 00/00/0000  ◷" wide/><FieldBox label="Responsável" value="FAGNER LOUREN...   ×"/><FieldBox label="Status" value="Selecione o status"/><button className="mb-2 text-[14px] font-bold text-[#8427cf]">+ Filtros</button></div></div><div className="flex flex-col items-end gap-7"><div className="flex items-center gap-4 text-[13px] text-neutral-600"><span>Perguntas frequentes</span><span>?</span><span>csv</span><span>⚙</span><span>⇩</span><ButtonMotion type="button" onClick={onCreate} className="rounded border-2 border-[#9e38e8] px-6 py-3 text-[16px] font-bold text-[#8427cf]">Criar novo dossiê</ButtonMotion></div><div className="flex gap-3"><ButtonMotion className="rounded border-2 border-[#9e38e8] px-7 py-3 text-[16px] font-bold text-[#8427cf]">Limpar</ButtonMotion><ButtonMotion className="rounded bg-[#8427cf] px-7 py-3 text-[16px] font-bold text-white">Buscar</ButtonMotion></div></div></motion.div><motion.section {...pageFx} className="overflow-hidden rounded-sm border border-[#dfdfdf] bg-white"><div className="grid grid-cols-[40px_.5fr_.55fr_1.9fr_2.9fr_.5fr_.75fr_.7fr_.7fr_.55fr_.75fr] bg-[#efefef] px-3 py-3 text-[12px] font-bold"><span><input type="checkbox" /></span><span>Nº dossiê</span><span>Criação</span><span>Tag</span><span>Critério</span><span>⌄</span><span>Progresso</span><span>Status</span><span>Monitoria</span><span>Workflow</span><span>Ações</span></div><motion.button whileHover={{backgroundColor:"#faf5ff"}} type="button" onClick={onOpenDetail} className="grid w-full grid-cols-[40px_.5fr_.55fr_1.9fr_2.9fr_.5fr_.75fr_.7fr_.7fr_.55fr_.75fr] items-center border-b px-3 py-4 text-left text-[13px] text-neutral-700"><span><input type="checkbox" /></span><span>111.332</span><span>23/04/2026</span><span className="text-[#8427cf]">⌄</span><span className="flex items-center gap-3"><span>☻</span> FRANCISCO TACIANO DE SOUSA</span><span className="text-[#8427cf]">⌄</span><span className="pr-6"><div className="mb-1 flex items-center gap-2"><span>{progress}%</span><span className="text-neutral-400">?</span></div><div className="h-1.5 rounded bg-neutral-200"><motion.div initial={{width:0}} animate={{width:`${progress}%`}} transition={{duration:.7}} className="h-1.5 rounded bg-[#8427cf]"/></div></span><span>{status === "Processando" ? <StatusBadge kind="Processando"/> : status === "Na fila" ? <b className="rounded bg-[#eee] px-3 py-1 text-neutral-700">Na fila</b> : <b>Iniciar ▷</b>}</span><span className="text-neutral-400">□ &nbsp; off</span><span></span><span className="text-[#8427cf]">01</span></motion.button></motion.section><div className="mt-5 flex gap-3"><button onClick={() => setStatus("Iniciar")} className="rounded border border-[#8427cf] px-3 py-1 text-xs text-[#8427cf]">Estado: iniciar</button><button onClick={() => setStatus("Na fila")} className="rounded border border-[#8427cf] px-3 py-1 text-xs text-[#8427cf]">Estado: fila</button><button onClick={() => setStatus("Processando")} className="rounded border border-[#8427cf] px-3 py-1 text-xs text-[#8427cf]">Estado: processando</button></div></main><button className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#ff8a00] text-3xl text-white shadow-lg">▱</button></div>;
}

export function runDossieDetailSmokeTests() {
  if (tabs.length < 8) throw new Error("Expected dossier detail tabs.");
  if (analyticMetrics.length !== 5) throw new Error("Expected analytic metrics.");
  if (analyticSections.length < 5) throw new Error("Expected analytic source sections.");
  if (detailEntries.length < 6) throw new Error("Expected detailed entries.");
  if (!detailEntries.some((entry) => entry.processList)) throw new Error("Expected judicial process detail list.");
  if (judicialProcesses.length < 6) throw new Error("Expected detailed judicial process records.");
  if (!defaultOpen.juridico || !defaultOpen.processos) throw new Error("Expected collapsible sections to start open.");
  if (typeof DossiersListPage !== "function") throw new Error("Expected return list page component.");
  if (typeof CreateDossierPage !== "function") throw new Error("Expected create dossier flow.");
  if (typeof CustomProfilePage !== "function") throw new Error("Expected custom profile page.");
  if (profileCards.length < 7) throw new Error("Expected standardized profile cards.");
  if (productCategories.length < 6) throw new Error("Expected product category navigation.");
  if (!productCatalog["Background Check"].some((item) => item.name === "Dossiês" && item.enabled)) throw new Error("Expected Dossiês as Background Check product.");
  return true;
}

export default function UpminerDossieDetailPage() {
  const [mode, setMode] = useState<Mode>("analitico");
  const [page, setPage] = useState<Page>("detail");
  const [createdToast, setCreatedToast] = useState(false);
  const showList = () => setPage("list");
  const createAndReturn = () => { setCreatedToast(true); setPage("list"); };

  return (
    <AnimatePresence mode="wait">
      {page === "list" && <motion.div key="list" {...pageFx}><DossiersListPage onOpenDetail={() => setPage("detail")} onCreate={() => setPage("create")} showToast={createdToast}/></motion.div>}
      {page === "create" && <motion.div key="create" {...pageFx}><CreateDossierPage onBack={showList} onCreated={createAndReturn} onCustomProfile={() => setPage("customProfile")}/></motion.div>}
      {page === "customProfile" && <motion.div key="customProfile" {...pageFx}><CustomProfilePage onBack={() => setPage("create")} onSave={createAndReturn}/></motion.div>}
      {page === "detail" && <motion.div key="detail" {...pageFx} className="min-h-screen bg-white text-neutral-900 [font-family:'Inter','Segoe_UI',Arial,sans-serif] antialiased"><Header mode={mode} setMode={setMode} onBack={showList}/><main className="mx-auto max-w-[1820px] px-4 py-4 sm:px-10">{mode === "analitico" ? <AnalyticPage/> : <DetailedPage/>}</main><Footer/></motion.div>}
    </AnimatePresence>
  );
}
