import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-app)',
                    padding: '24px',
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '480px',
                        background: 'var(--bg-card)',
                        borderRadius: '20px',
                        padding: '32px',
                        boxShadow: '0 24px 48px rgba(15, 23, 42, 0.12)',
                        border: '1px solid var(--border-default)',
                        textAlign: 'center',
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            background: 'var(--red-50)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            margin: '0 auto 20px',
                        }}>!</div>
                        <h2 style={{ marginBottom: '12px', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                            Algo deu errado
                        </h2>
                        <p style={{ marginBottom: '24px', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '.875rem' }}>
                            Ocorreu um erro inesperado na aplicacao. Tente recarregar a pagina.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '12px 24px',
                                borderRadius: '12px',
                                background: 'var(--gray-900)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                border: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            Recarregar pagina
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
