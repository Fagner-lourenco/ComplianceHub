export const NOTIFICATION_TYPES = {
    CASE_COMPLETED: 'CASE_COMPLETED',
    NEW_CLIENT_SOLICITATION: 'NEW_CLIENT_SOLICITATION',
    CASE_MESSAGE_FROM_CLIENT: 'CASE_MESSAGE_FROM_CLIENT',
    CASE_MESSAGE_FROM_OPS: 'CASE_MESSAGE_FROM_OPS',
};

export const NOTIFICATION_COPY = {
    CASE_COMPLETED: {
        fallbackTitle: 'Analise concluida',
        fallbackMessage: 'Uma analise ja esta disponivel.',
        actionLabel: 'Ver relatorio',
    },
    NEW_CLIENT_SOLICITATION: {
        fallbackTitle: 'Nova solicitacao recebida',
        fallbackMessage: 'Uma nova analise foi enviada.',
        actionLabel: 'Abrir solicitacao',
    },
    CASE_MESSAGE_FROM_CLIENT: {
        fallbackTitle: 'Nova resposta do cliente',
        fallbackMessage: 'O cliente enviou uma mensagem sobre uma analise.',
        actionLabel: 'Abrir caso',
    },
    CASE_MESSAGE_FROM_OPS: {
        fallbackTitle: 'Nova mensagem da equipe',
        fallbackMessage: 'A equipe enviou uma mensagem sobre uma analise.',
        actionLabel: 'Abrir solicitacao',
    },
};
