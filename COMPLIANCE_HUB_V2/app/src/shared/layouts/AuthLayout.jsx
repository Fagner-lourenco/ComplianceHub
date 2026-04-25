import { useState } from 'react';
import { Navigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../core/auth/useAuth';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  UserPlus,
  Sparkles,
} from 'lucide-react';


const IS_DEV = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function AuthLayout() {
  const { user, login, register, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'register'

  if (user) return <Navigate to="/dossie" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      const msg = err?.message || 'Falha ao autenticar.';
      // Traduzir erros comuns do Firebase
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
        setError('E-mail ou senha incorretos.');
      } else if (msg.includes('auth/invalid-email')) {
        setError('E-mail inválido.');
      } else if (msg.includes('auth/weak-password')) {
        setError('A senha deve ter pelo menos 6 caracteres.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setError('Este e-mail já está em uso.');
      } else {
        setError(msg);
      }
    }
  }

  async function handleSeedUser() {
    setError('');
    try {
      await register('teste@compliancehub.com', 'Teste123!');
    } catch (err) {
      if (err?.message?.includes('email-already-in-use')) {
        // Usuário já existe, faz login
        try {
          await login('teste@compliancehub.com', 'Teste123!');
        } catch (loginErr) {
          setError(loginErr?.message?.includes('invalid-credential')
            ? 'Usuário de teste existe mas a senha foi alterada.'
            : (loginErr?.message || 'Erro ao logar usuário de teste.'));
        }
      } else {
        setError(err?.message || 'Erro ao criar usuário de teste.');
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(135deg, #f5efe8 0%, #ede4f4 50%, #f0e8f7 100%)' }}>

      {/* Decorative background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #8427cf 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -left-32 h-[28rem] w-[28rem] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #8427cf 0%, transparent 70%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-[0_24px_64px_rgba(95,20,127,0.14)] backdrop-blur-sm"
          style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.88) 100%)' }}>

          {/* Logo & Brand */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #8427cf 0%, #6e1fb0 100%)' }}
            >
              <ShieldCheck className="h-8 w-8 text-white" strokeWidth={2.2} />
            </motion.div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              ComplianceHub
            </h1>
            <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Due Diligence & Background Check
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="mb-6 flex rounded-xl p-1" style={{ background: 'var(--bg-app)' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${mode === 'login'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${mode === 'register'
                ? 'bg-white text-brand-600 shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
                }`}
            >
              Criar conta
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                E-mail
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-white/60 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-white/60 py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:bg-black/5"
                  style={{ color: 'var(--text-secondary)' }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="flex items-start gap-2.5 overflow-hidden rounded-xl px-4 py-3"
                  style={{ background: 'var(--danger-bg)', border: '1px solid rgba(217,65,65,0.18)' }}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm font-medium text-red-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              aria-label={mode === 'login' ? 'Entrar na conta' : 'Criar nova conta'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-[14px] font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {mode === 'login' ? (
                <>
                  <LogIn className="h-4 w-4" />
                  {loading ? 'Entrando...' : 'Entrar'}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  {loading ? 'Criando conta...' : 'Criar conta'}
                </>
              )}
            </button>
          </form>

          {/* Dev-only seed user */}
          {IS_DEV && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-5 border-t border-dashed pt-4"
              style={{ borderColor: 'var(--border-default)' }}
            >
              <button
                type="button"
                onClick={handleSeedUser}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors hover:bg-brand-500/5"
                style={{ color: 'var(--brand-500)' }}
              >
                <Sparkles className="h-4 w-4" />
                Criar / Logar com usuário de teste
              </button>
              <p className="mt-1.5 text-center text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                teste@compliancehub.com / Teste123!
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
          © {new Date().getFullYear()} ComplianceHub. Todos os direitos reservados.
        </p>
      </motion.div>
    </div>
  );
}
