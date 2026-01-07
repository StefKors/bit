import { useState, useRef } from "react"
import { SignOutIcon, MailIcon, ArrowLeftIcon } from "@primer/octicons-react"
import { db } from "@/lib/instantDb"
import { Button } from "@/components/Button"
import { Avatar } from "@/components/Avatar"
import styles from "./LoginPage.module.css"

type AuthStep = "email" | "code" | "authenticated"

function LoginPage() {
  const { isLoading, user, error } = db.useAuth()
  const [step, setStep] = useState<AuthStep>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [sentTo, setSentTo] = useState("")
  const [authError, setAuthError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSending(true)
    setAuthError(null)

    try {
      await db.auth.sendMagicCode({ email: email.trim() })
      setSentTo(email.trim())
      setStep("code")
      setCode("")
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Failed to send code")
    } finally {
      setSending(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setSending(true)
    setAuthError(null)

    try {
      await db.auth.signInWithMagicCode({ email: sentTo, code: code.trim() })
      setStep("authenticated")
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Invalid code")
    } finally {
      setSending(false)
    }
  }

  const handleBack = () => {
    setStep("email")
    setCode("")
    setAuthError(null)
  }

  const handleSignOut = () => {
    void db.auth.signOut()
    setStep("email")
    setEmail("")
    setCode("")
    setSentTo("")
    setAuthError(null)
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/bit-cube.png" alt="Bit" className={styles.logo} />
            <h1 className={styles.title}>Authentication Error</h1>
            <p className={styles.subtitle}>{error.message}</p>
          </div>

          <Button variant="primary" size="large" block onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (user) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Avatar
              src={(user as { avatarUrl?: string }).avatarUrl}
              name={user.email}
              size={80}
              isOnline
            />
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>{user.email}</p>
          </div>

          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{user.email}</span>
            </div>
            {(user as { login?: string }).login && (
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>GitHub</span>
                <span className={styles.infoValue}>@{(user as { login?: string }).login}</span>
              </div>
            )}
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status</span>
              <span className={styles.statusBadge}>Authenticated</span>
            </div>
          </div>

          <Button
            variant="danger"
            size="large"
            block
            leadingIcon={<SignOutIcon size={16} />}
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  // Email entry step
  if (step === "email") {
    return (
      <div className={styles.container}>
        <div className={styles.backgroundPattern} />
        <div className={styles.card}>
          <div className={styles.header}>
            <img src="/bit-cube.png" alt="Bit" className={styles.logo} />
            <h1 className={styles.title}>Sign in to Bit</h1>
            <p className={styles.subtitle}>Enter your email to get started</p>
          </div>

          <form onSubmit={(e) => void handleSendCode(e)} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.inputLabel}>
                Email address
              </label>
              <input
                ref={emailInputRef}
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={styles.input}
                autoFocus
                autoComplete="email"
                required
              />
            </div>

            {authError && <div className={styles.error}>{authError}</div>}

            <Button
              type="submit"
              variant="primary"
              size="large"
              block
              leadingIcon={<MailIcon size={20} />}
              loading={sending}
            >
              {sending ? "Sending code..." : "Continue with Email"}
            </Button>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>We'll send you a magic code to sign in</p>
          </div>
        </div>
      </div>
    )
  }

  // Code verification step
  return (
    <div className={styles.container}>
      <div className={styles.backgroundPattern} />
      <div className={styles.card}>
        <div className={styles.header}>
          <img src="/bit-cube.png" alt="Bit" className={styles.logo} />
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.subtitle}>
            We sent a code to <strong>{sentTo}</strong>
          </p>
        </div>

        <form onSubmit={(e) => void handleVerifyCode(e)} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="code" className={styles.inputLabel}>
              Verification code
            </label>
            <input
              ref={codeInputRef}
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter 6-digit code"
              className={styles.input}
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
            />
          </div>

          {authError && <div className={styles.error}>{authError}</div>}

          <Button type="submit" variant="primary" size="large" block loading={sending}>
            {sending ? "Verifying..." : "Verify Code"}
          </Button>
        </form>

        <div className={styles.backLink}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <ArrowLeftIcon size={14} />
            Use a different email
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
