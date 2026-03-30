import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../core/firebase/config';
import { useAuth } from '../core/auth/useAuth';
import './LoginPage.css';

function getAuthErrorMessage(error) {
    switch (error?.code) {
    case 'auth/invalid-credential':
        return 'Email ou senha invalidos.';
    case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
        return 'Nao foi possivel falar com o Firebase agora. Verifique sua conexao.';
    default:
        return error?.message || 'Erro ao autenticar';
    }
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const { loading: authLoading, login, user } = useAuth();
    const navigate = useNavigate();

    if (!authLoading && user) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/', { replace: true });
        } catch (err) {
            setError(getAuthErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (event) => {
        event.preventDefault();
        setError('');
        setResetSent(false);

        if (!email) {
            setError('Informe o email para receber o link de recuperacao.');
            return;
        }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setResetSent(true);
        } catch (err) {
            if (err?.code === 'auth/user-not-found') {
                setError('Nenhuma conta encontrada com este email.');
            } else {
                setError(getAuthErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-page__bg" />
            <div className="login-card animate-scaleIn">
                <div className="login-card__brand">
                    <div className="login-card__logo">CH</div>
                    <h1 className="login-card__title">ComplianceHub</h1>
                    <p className="login-card__desc">Sistema de Gestao de Due Diligence</p>
                </div>

                {resetMode ? (
                    <form className="login-form" onSubmit={handlePasswordReset}>
                        <div className="login-form__field">
                            <label className="login-form__label" htmlFor="login-email">Email da conta</label>
                            <input
                                id="login-email"
                                type="email"
                                className="login-form__input"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="email@empresa.com"
                                required
                            />
                        </div>

                        {error && <div className="login-form__error" role="alert">{error}</div>}

                        {resetSent && (
                            <div className="login-form__success" role="status">
                                Link de recuperacao enviado para {email}. Verifique sua caixa de entrada.
                            </div>
                        )}

                        <button className="login-form__submit" type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                        </button>

                        <button
                            type="button"
                            className="login-form__toggle"
                            onClick={() => { setResetMode(false); setError(''); setResetSent(false); }}
                        >
                            Voltar ao login
                        </button>
                    </form>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="login-form__field">
                            <label className="login-form__label" htmlFor="login-email">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                className="login-form__input"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="email@empresa.com"
                                required
                            />
                        </div>

                        <div className="login-form__field">
                            <label className="login-form__label" htmlFor="login-password">Senha</label>
                            <input
                                id="login-password"
                                type="password"
                                className="login-form__input"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="********"
                                required
                            />
                        </div>

                        {error && <div className="login-form__error" role="alert">{error}</div>}

                        <button className="login-form__submit" type="submit" disabled={loading}>
                            {loading ? 'Aguarde...' : 'Entrar'}
                        </button>

                        <button
                            type="button"
                            className="login-form__toggle"
                            onClick={() => { setResetMode(true); setError(''); }}
                        >
                            Esqueci minha senha
                        </button>
                    </form>
                )}

                <div className="login-card__demo">
                    <p className="login-card__demo-label">Acesso provisionado</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', lineHeight: 1.6 }}>
                        O portal, o papel e a franquia visivel so aparecem depois da confirmacao do Firebase Auth e do perfil real no Firestore. Contas operacionais e de cliente devem ser provisionadas pelo sistema ou pelo time responsavel.
                    </p>
                    <div className="login-card__demo-buttons" style={{ marginTop: '1rem' }}>
                        <button type="button" className="login-demo-btn login-demo-btn--client" onClick={() => navigate('/demo/client/solicitacoes')}>
                            Demo cliente
                        </button>
                        <button type="button" className="login-demo-btn login-demo-btn--ops" onClick={() => navigate('/demo/ops/fila')}>
                            Demo operacional
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
