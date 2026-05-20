/**
 * ComplianceHub Copy System
 * Centralized user-facing text with audience-aware variations.
 *
 * Usage:
 *   import { getStatusLabel, getRiskConfig, getConcept, ICONS } from '@/core/copy';
 *
 *   <StatusBadge status={s} audience="client" />
 *   <RiskChip value={v} category="criminal" audience="ops" />
 */

export {
  STATUS_LABELS,
  STATUS_LABELS_SHORT,
  getStatusLabel,
  getShortStatusLabel,
} from './status';

export {
  CRISK_LABELS,
  COVERAGE_LABELS,
  SEVERITY_LABELS,
  SOCIAL_LABELS,
  DIGITAL_LABELS,
  CONFLICT_LABELS,
  VERDICT_LABELS,
  RISK_LEVEL_LABELS,
  getRiskConfig,
  getRiskLabel,
} from './risk';

export {
  CLIENT_NAV,
  OPS_NAV,
  PAGE_TITLES,
  CONTEXT_LABELS,
  ICONS,
} from './navigation.jsx';

export {
  ACCESS_MESSAGES,
  LOADING_MESSAGES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  EMPTY_STATES,
  CONFIRM_MESSAGES,
  FORM_LABELS,
  ACTION_LABELS,
} from './messages';

export {
  CONCEPTS,
  TECH_TO_HUMAN,
  PHASE_LABELS,
  PROVIDER_NAMES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getConcept,
  getTechLabel,
  getPhaseLabel,
  getRoleLabel,
  getRoleDescription,
} from './labels';
