import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../core/firebase/config';
import { useAuth } from '../core/auth/useAuth';
import { extractErrorMessage } from '../core/errorUtils';
import './LoginPage.css';

function getAuthErrorMessage(error) {
    switch (error?.code) {
    case 'auth/invalid-credential':
        return 'Email ou senha inválidos.';
    case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/network-request-failed':
        return 'Não foi possível conectar ao servidor. Verifique sua conexão.';
    case 'auth/user-disabled':
        return 'Esta conta foi desativada. Entre em contato com o administrador.';
    case 'auth/invalid-email':
        return 'Formato de email inválido.';
    default:
        return extractErrorMessage(error, 'Erro ao autenticar. Verifique suas credenciais e tente novamente.');
    }
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetMode, setResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [clientInfo, setClientInfo] = useState(null);
    const { loading: authLoading, login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const controller = new AbortController();
        fetch('https://ipapi.co/json/?lang=pt', { signal: controller.signal })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data?.ip) {
                    setClientInfo({
                        ip: data.ip,
                        city: data.city || null,
                        region: data.region_code || data.region || null,
                        country: data.country_name || null,
                    });
                }
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);

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
            setError('Informe o email para receber o link de recuperação.');
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
                    <p className="login-card__desc">Sistema de Gestão de Due Diligence</p>
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
                                Link de recuperação enviado para {email}. Verifique sua caixa de entrada.
                            </div>
                        )}

                        <button className="login-form__submit" type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
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

                <div className="login-card__security">
                    <div className="login-card__security-header">
                        <svg className="login-card__security-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>Acesso restrito e monitorado</span>
                    </div>
                    <p className="login-card__security-text">
                        Plataforma confidencial. Todas as ações são auditadas em tempo real.
                        A divulgação não autorizada é expressamente proibida.
                    </p>
                </div>

                {clientInfo && (
                    <div className="login-card__tracker">
                        <div className="login-card__tracker-dot" />
                        <div className="login-card__tracker-body">
                            <div className="login-card__tracker-ip">{clientInfo.ip}</div>
                            <div className="login-card__tracker-location">
                                {[clientInfo.city, clientInfo.region, clientInfo.country].filter(Boolean).join(', ')}
                            </div>
                        </div>
                        <div className="login-card__tracker-label">Sessão monitorada</div>
                    </div>
                )}

                <div className="login-card__demo">
                    <button type="button" className="login-demo-btn" onClick={() => navigate('/demo/client/solicitacoes')}>
                        Acessar demonstração
                    </button>
                </div>
            </div>
        </div>
    );
}
