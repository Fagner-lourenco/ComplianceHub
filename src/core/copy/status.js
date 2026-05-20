/**
 * Status labels by audience.
 * Same underlying status codes, different human-readable labels
 * depending on whether the user is a client or ops user.
 */

export const STATUS_LABELS = {
  CLIENT: {
    PENDING: 'Recebida',
    IN_PROGRESS: 'Em análise',
    WAITING_INFO: 'Aguardando informações',
    CORRECTION_NEEDED: 'Correção necessária',
    DONE: 'Concluída',
    CANCELLED: 'Cancelada',
    READY: 'Registrada',
    ARCHIVED: 'Arquivada',
  },
  OPS: {
    PENDING: 'Na fila',
    IN_PROGRESS: 'Em análise',
    WAITING_INFO: 'Aguardando informações do cliente',
    CORRECTION_NEEDED: 'Devolvida para correção',
    DONE: 'Concluída',
    CANCELLED: 'Cancelada',
    READY: 'Registrada',
    ARCHIVED: 'Arquivada',
  },
};

/**
 * Get the human-readable label for a case status.
 * @param {string} status - The status code (e.g. 'PENDING', 'DONE')
 * @param {'client'|'ops'} audience - Which audience to target
 * @returns {string}
 */
export function getStatusLabel(status, audience = 'client') {
  const key = audience === 'ops' ? 'OPS' : 'CLIENT';
  return STATUS_LABELS[key][status] || status;
}

/**
 * Short status labels for constrained spaces (table cells, badges).
 */
export const STATUS_LABELS_SHORT = {
  CLIENT: {
    PENDING: 'Recebida',
    IN_PROGRESS: 'Em análise',
    WAITING_INFO: 'Aguardando info',
    CORRECTION_NEEDED: 'Correção',
    DONE: 'Concluída',
    CANCELLED: 'Cancelada',
    READY: 'Registrada',
    ARCHIVED: 'Arquivada',
  },
  OPS: {
    PENDING: 'Na fila',
    IN_PROGRESS: 'Em análise',
    WAITING_INFO: 'Aguardando info',
    CORRECTION_NEEDED: 'Devolvida',
    DONE: 'Concluída',
    CANCELLED: 'Cancelada',
    READY: 'Registrada',
    ARCHIVED: 'Arquivada',
  },
};

export function getShortStatusLabel(status, audience = 'client') {
  const key = audience === 'ops' ? 'OPS' : 'CLIENT';
  return STATUS_LABELS_SHORT[key][status] || status;
}
