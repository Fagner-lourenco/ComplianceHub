import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../core/auth/AuthContext';
import { getPortal } from '../core/rbac/permissions';
import './LoginPage.css';

export default function LoginPage() {
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('client_viewer');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isRegister) {
                await register(email, password, name, role);
            } else {
                await login(email, password);
            }
            // Navigate based on role
            const portal = getPortal(role);
            navigate(portal === 'ops' ? '/ops/fila' : '/client/solicitacoes');
        } catch (err) {
            setError(err.message || 'Erro ao autenticar');
        } finally {
            setLoading(false);
        }
    };

    // Demo login
    const handleDemo = (demoRole) => {
        setRole(demoRole);
        const portal = getPortal(demoRole);
        // For demo, navigate directly
        navigate(portal === 'ops' ? '/ops/fila' : '/client/solicitacoes');
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

                <form className="login-form" onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="login-form__field">
                            <label className="login-form__label">Nome completo</label>
                            <input
                                type="text"
                                className="login-form__input"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Seu nome"
                                required
                            />
                        </div>
                    )}

                    <div className="login-form__field">
                        <label className="login-form__label">Email</label>
                        <input
                            type="email"
                            className="login-form__input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="email@empresa.com"
                            required
                        />
                    </div>

                    <div className="login-form__field">
                        <label className="login-form__label">Senha</label>
                        <input
                            type="password"
                            className="login-form__input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {isRegister && (
                        <div className="login-form__field">
                            <label className="login-form__label">Perfil</label>
                            <select className="login-form__input" value={role} onChange={e => setRole(e.target.value)}>
                                <option value="client_viewer">Cliente (Viewer)</option>
                                <option value="client_manager">Cliente (Manager)</option>
                                <option value="analyst">Analista</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    )}

                    {error && <div className="login-form__error">{error}</div>}

                    <button className="login-form__submit" type="submit" disabled={loading}>
                        {loading ? 'Aguarde...' : isRegister ? 'Criar conta' : 'Entrar'}
                    </button>

                    <button
                        type="button"
                        className="login-form__toggle"
                        onClick={() => setIsRegister(!isRegister)}
                    >
                        {isRegister ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
                    </button>
                </form>

                <div className="login-card__demo">
                    <p className="login-card__demo-label">Acesso rápido (demo)</p>
                    <div className="login-card__demo-buttons">
                        <button className="login-demo-btn login-demo-btn--client" onClick={() => handleDemo('client_manager')}>
                            👤 Portal Cliente
                        </button>
                        <button className="login-demo-btn login-demo-btn--ops" onClick={() => handleDemo('analyst')}>
                            🔧 Portal Operacional
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
