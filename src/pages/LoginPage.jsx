import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../core/firebase/config';
import { useAuth } from '../core/auth/useAuth';
import { callGetClientGeoIp } from '../core/firebase/firestoreService';
import { extractErrorMessage } from '../core/errorUtils';
import './LoginPage.css';
// GeoIP fallback fix v2 — forces Vite HMR refresh

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
        const DEBUG_LOGIN_SECURITY = import.meta.env.DEV;
        let cancelled = false;

        const fetchGeo = async (fallbackIp = null) => {
            try {
                const data = await callGetClientGeoIp(fallbackIp);
                if (cancelled) return;
                if (DEBUG_LOGIN_SECURITY) {
                    console.debug('[LoginSecurity] response:', data);
                }
                if (data?.ip) {
                    setClientInfo({
                        ip: data.ip,
                        city: data.city || null,
                        region: data.region || null,
                        regionCode: data.regionCode || null,
                        country: data.countryName || data.country || null,
                        countryCode: data.countryCode || null,
                        lookupOk: data.lookupOk === true,
                    });
                } else if (!fallbackIp) {
                    // Fallback: ask a public service for our IP, then geolocate directly
                    if (DEBUG_LOGIN_SECURITY) {
                        console.debug('[LoginSecurity] backend returned no IP, trying ipify + ipapi fallback...');
                    }
                    try {
                        const controller = new AbortController();
                        const t = window.setTimeout(() => controller.abort(), 3000);
                        const ipifyRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
                        window.clearTimeout(t);
                        const ipifyData = await ipifyRes.json();
                        if (cancelled) return;
                        if (ipifyData?.ip) {
                            if (DEBUG_LOGIN_SECURITY) {
                                console.debug('[LoginSecurity] ipify fallback IP:', ipifyData.ip);
                            }
                            // Try backend once more with the discovered IP
                            await fetchGeo(ipifyData.ip);
                        } else if (DEBUG_LOGIN_SECURITY) {
                            console.warn('[LoginSecurity] ipify returned no IP');
                        }
                    } catch (ipifyErr) {
                        if (DEBUG_LOGIN_SECURITY) console.warn('[LoginSecurity] ipify failed:', ipifyErr);
                    }
                } else {
                    // Even backend with explicit IP returned nothing — do direct geo lookup
                    try {
                        const controller = new AbortController();
                        const t = window.setTimeout(() => controller.abort(), 3000);
                        const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(fallbackIp)}/json/`, { signal: controller.signal });
                        window.clearTimeout(t);
                        const geoData = await geoRes.json();
                        if (cancelled) return;
                        if (geoData?.ip) {
                            if (DEBUG_LOGIN_SECURITY) {
                                console.debug('[LoginSecurity] direct geo lookup:', geoData);
                            }
                            setClientInfo({
                                ip: geoData.ip,
                                city: geoData.city || null,
                                region: geoData.region || null,
                                regionCode: geoData.region_code || null,
                                country: geoData.country_name || null,
                                countryCode: geoData.country_code || null,
                                lookupOk: true,
                            });
                        } else if (DEBUG_LOGIN_SECURITY) {
                            console.warn('[LoginSecurity] direct geo lookup returned no data:', geoData);
                        }
                    } catch (geoErr) {
                        if (DEBUG_LOGIN_SECURITY) console.warn('[LoginSecurity] direct geo lookup failed:', geoErr);
                    }
                }
            } catch (err) {
                if (DEBUG_LOGIN_SECURITY) {
                    console.warn('[LoginSecurity] failed:', err);
                }
            }
        };

        fetchGeo();

        return () => {
            cancelled = true;
        };
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
                    <p className="login-card__desc">Análise cadastral e gestão de risco para sua empresa.</p>
                </div>

                {resetMode ? (
                    <form className="login-form" onSubmit={handlePasswordReset}>
                        <div className="login-form__field">
                            <label className="login-form__label" htmlFor="login-email">Email da conta</label>
                            <input
                                id="login-email"
                                name="email"
                                type="email"
                                autoComplete="email"
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
                                name="email"
                                type="email"
                                autoComplete="username"
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
                                name="password"
                                type="password"
                                autoComplete="current-password"
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
                        <span>Acesso seguro e monitorado</span>
                    </div>
                    <p className="login-card__security-text">
                        Plataforma segura. Suas ações são registradas para garantir a proteção dos seus dados.
                    </p>
                </div>

                {clientInfo?.ip && (
                    <div className="login-card__tracker">
                        <div className="login-card__tracker-left">
                            <span className="login-card__tracker-dot" aria-hidden="true" />
                            <div>
                                <strong className="login-card__tracker-ip">{clientInfo.ip}</strong>
                                <span className="login-card__tracker-location">
                                    {[clientInfo.city, clientInfo.region, clientInfo.country].filter(Boolean).join(', ') || 'Localização aproximada indisponível'}
                                </span>
                            </div>
                        </div>
                        <span className="login-card__tracker-badge">
                            SESSÃO MONITORADA
                        </span>
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
