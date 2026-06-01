import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../core/auth/useAuth';
import { subscribeToCaseMessages, callSendCaseMessage, callMarkCaseCommunicationRead } from '../../../core/firebase/firestoreService';
import './CaseCommunicationPanel.css';

function formatMessageDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function CaseCommunicationPanel({ caseId, caseData, portal = 'ops' }) {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const tenantId = caseData?.tenantId;
    const isClientPortal = portal === 'client';
    const title = isClientPortal ? 'Comunicacao com a equipe' : 'Comunicacao com o cliente';
    const description = isClientPortal
        ? 'Use este espaco para responder duvidas ou enviar informacoes sobre esta analise.'
        : 'Use este espaco para pedir informacoes ou esclarecer pontos desta analise.';
    const placeholder = isClientPortal
        ? 'Escreva sua mensagem para a equipe...'
        : 'Escreva sua mensagem para o cliente...';
    const emptyText = 'Nenhuma mensagem ainda.';

    useEffect(() => {
        if (!caseId || !tenantId) return;
        setLoading(true);
        const unsubscribe = subscribeToCaseMessages(caseId, tenantId, (msgs, err) => {
            if (err) {
                setError('Erro ao carregar mensagens.');
            } else {
                setMessages(msgs);
                setError(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [caseId, tenantId]);

    useEffect(() => {
        // Marcar como lida ao montar
        if (caseId && user) {
            callMarkCaseCommunicationRead({ caseId }).catch(() => {});
        }
    }, [caseId, user]);

    useEffect(() => {
        // Scroll para última mensagem
        if (messagesEndRef.current?.scrollIntoView) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;
        setSending(true);
        try {
            await callSendCaseMessage({ caseId, body: newMessage.trim() });
            setNewMessage('');
        } catch {
            setError('Erro ao enviar mensagem. Tente novamente.');
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const currentUid = user?.uid;
    const getMessageBody = (message) => message?.body || message?.content || '';

    return (
        <div className="case-communication-panel">
            <div className="case-communication-header">
                <h3 className="case-communication-title">{title}</h3>
                <p className="case-communication-description">{description}</p>
            </div>

            <div className="case-communication-messages">
                {loading && (
                    <div className="case-communication-loading">
                        Carregando mensagens...
                    </div>
                )}

                {!loading && messages.length === 0 && (
                    <div className="case-communication-empty">
                        {emptyText}
                    </div>
                )}

                {!loading && messages.map((msg) => {
                    const isMine = msg.senderUid === currentUid;
                    const isSystem = msg.systemMessage;

                    if (isSystem) {
                        return (
                            <div key={msg.id} className="case-message-system">
                                <span className="case-message-system-text">{getMessageBody(msg)}</span>
                                <span className="case-message-system-time">{formatMessageDate(msg.createdAt)}</span>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={msg.id}
                            className={`case-message ${isMine ? 'case-message-mine' : 'case-message-other'}`}
                        >
                            <div className="case-message-avatar">
                                {getInitials(msg.senderName)}
                            </div>
                            <div className="case-message-content">
                                <div className="case-message-header">
                                    <span className="case-message-name">{msg.senderName}</span>
                                    <span className="case-message-time">{formatMessageDate(msg.createdAt)}</span>
                                </div>
                                <div className="case-message-body">{getMessageBody(msg)}</div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div className="case-communication-error">{error}</div>
            )}

            <div className="case-communication-input-area">
                <textarea
                    className="case-communication-input"
                    placeholder={placeholder}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    maxLength={1500}
                    rows={3}
                />
                <div className="case-communication-actions">
                    <span className="case-communication-char-count">
                        {newMessage.length}/1500
                    </span>
                    <button
                        className="case-communication-send-btn"
                        onClick={handleSend}
                        disabled={sending || !newMessage.trim()}
                    >
                        {sending ? 'Enviando...' : 'Enviar mensagem'}
                    </button>
                </div>
            </div>
        </div>
    );
}
