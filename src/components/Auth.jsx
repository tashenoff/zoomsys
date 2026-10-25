import { useState } from 'react'
import { ArrowRightIcon, EyeIcon, EyeSlashIcon, ExclamationCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../hooks/useAuth'
import logo from '../logo.svg'
import './Auth.css'

export default function Auth() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message || 'Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual" aria-label="Ra Zoom — система расчёта услуг">
        <header className="auth-brand">
          <img src={logo} alt="Ra Zoom" width="156" height="66" />
          <span>Система расчёта<br />и управления заказами</span>
        </header>
        <div className="auth-story">
          <p className="auth-eyebrow"><span /> СОЗДАЁМ. ПЕЧАТАЕМ. ВОПЛОЩАЕМ.</p>
          <h2>От идеи<br />до <em>тиража.</em></h2>
          <p className="auth-story-copy">Всё, что нужно для точного расчёта<br />и слаженной работы вашей команды.</p>
        </div>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-art-disc" />
          <div className="auth-paper auth-paper-back" />
          <div className="auth-paper auth-paper-front">
            <div className="auth-paper-top"><span>RA ZOOM / PRINT STUDIO</span><span>01</span></div>
            <div className="auth-print-word">Z<span>O</span>OM<span className="auth-print-dot">.</span></div>
            <div className="auth-paper-rule" />
            <div className="auth-paper-bottom">
              <div className="auth-color-bars"><i /><i /><i /><i /></div>
              <span>ИДЕИ ОБРЕТАЮТ ФОРМУ</span>
            </div>
            <span className="auth-registration auth-registration-tl" />
            <span className="auth-registration auth-registration-br" />
          </div>
          <span className="auth-art-caption">Хороший результат начинается с точности.</span>
        </div>
        <footer className="auth-visual-footer"><span>ZOOMSYS</span><span>Расчёты · Прайсы · Заказы</span></footer>
      </section>
      <section className="auth-form-panel" aria-labelledby="auth-title">
        <div className="auth-form-shell">
          <img className="auth-mobile-brand" src={logo} alt="Ra Zoom" width="140" height="60" />
          <div className="auth-form-heading">
            <p className="auth-eyebrow">ВАШЕ РАБОЧЕЕ ПРОСТРАНСТВО</p>
            <h1 id="auth-title">С возвращением.</h1>
            <p>Войдите, чтобы продолжить работу<br className="auth-desktop-break" /> с расчётами и заказами.</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
            <div className="auth-field">
              <label htmlFor="auth-username">Логин</label>
              <input id="auth-username" name="username" type="text" value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                required disabled={loading} placeholder="Введите ваш логин" autoComplete="username"
                autoCapitalize="none" spellCheck={false}
                aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Пароль</label>
              <div className="auth-password-wrap">
                <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  required disabled={loading} placeholder="Введите пароль" autoComplete="current-password"
                  aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} />
                <button type="button" className="auth-password-toggle" disabled={loading}
                  onClick={() => setShowPassword(!showPassword)} aria-controls="auth-password"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-pressed={showPassword}>
                  {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            {error && <div id="auth-error" className="auth-error" role="alert"><ExclamationCircleIcon aria-hidden="true" /><span>{error}</span></div>}
            <button type="submit" className="auth-submit" disabled={loading}>
              <span>{loading ? 'Входим в систему…' : 'Войти в Zoomsys'}</span>
              {loading ? <span className="auth-spinner" aria-hidden="true" /> : <ArrowRightIcon aria-hidden="true" />}
            </button>
          </form>
          <p className="auth-access-note"><LockClosedIcon aria-hidden="true" /><span>Нет доступа? Обратитесь к администратору.</span></p>
          <div className="auth-form-footer"><span className="auth-footer-mark" /> Ra Zoom<span>Работаем на результат.</span></div>
        </div>
      </section>
    </main>
  )
}
