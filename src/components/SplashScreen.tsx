import { useEffect, useState, useMemo } from 'react'
import Logo from './ui/Logo'

interface LoadStep {
  label: string
  detail: string
  duration: number
}

const LOAD_STEPS: LoadStep[] = [
  { label: 'Runtime', detail: 'Initializing WebView2 runtime', duration: 400 },
  { label: 'IPC Bridge', detail: 'Establishing Tauri IPC channel', duration: 350 },
  { label: 'Frontend', detail: 'Hydrating React component tree', duration: 500 },
  { label: 'Theme', detail: 'Loading theme configuration', duration: 250 },
  { label: 'Filesystem', detail: 'Verifying filesystem access permissions', duration: 400 },
  { label: 'Models', detail: 'Scanning AI model directory', duration: 700 },
  { label: 'Plugins', detail: 'Initializing Tauri plugin system', duration: 350 },
  { label: 'Config', detail: 'Reading application configuration', duration: 300 },
  { label: 'Providers', detail: 'Loading LLM provider registry', duration: 450 },
  { label: 'Services', detail: 'Starting background service workers', duration: 400 },
  { label: 'Cache', detail: 'Warming up analysis cache layers', duration: 300 },
  { label: 'Interface', detail: 'Rendering main interface shell', duration: 350 },
  { label: 'Ready', detail: 'All systems operational', duration: 0 },
]

export default function SplashScreen({ onComplete }: { onComplete?: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  const totalDuration = useMemo(
    () => LOAD_STEPS.reduce((s, step) => s + step.duration, 0),
    [],
  )

  const currentStep = LOAD_STEPS[stepIndex]
  const isComplete = progress >= 100

  useEffect(() => {
    if (isComplete || isExiting) return

    const tick = 30
    const interval = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + tick
        if (next >= totalDuration) {
          clearInterval(interval)
          setProgress(100)
          setStepIndex(LOAD_STEPS.length - 1)
          return totalDuration
        }

        setProgress(Math.min(Math.round((next / totalDuration) * 100), 100))

        let acc = 0
        for (let i = 0; i < LOAD_STEPS.length; i++) {
          acc += LOAD_STEPS[i].duration
          if (next <= acc) {
            setStepIndex(i)
            break
          }
        }

        return next
      })
    }, tick)

    return () => clearInterval(interval)
  }, [totalDuration, isComplete, isExiting])

  useEffect(() => {
    if (!isComplete || isExiting) return
    const t = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onComplete?.(), 600)
    }, 500)
    return () => clearTimeout(t)
  }, [isComplete, isExiting, onComplete])

  return (
    <div
      className="splash-root"
      data-theme="dark"
      style={{ opacity: isExiting ? 0 : 1, transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }}
    >
      {/* ═══ Aurora Background ═══ */}
      <div className="splash-aurora">
        <div className="splash-aurora-orb splash-aurora-orb-1" />
        <div className="splash-aurora-orb splash-aurora-orb-2" />
        <div className="splash-aurora-orb splash-aurora-orb-3" />
        <div className="splash-aurora-orb splash-aurora-orb-4" />
      </div>

      {/* ═══ Particle Field ═══ */}
      <div className="splash-particles">
        {useMemo(
          () =>
            Array.from({ length: 24 }).map((_, i) => ({
              id: i,
              size: 1.5 + (i % 4) * 0.8,
              left: ((i * 37 + 13) % 100),
              delay: (i * 0.7) % 8,
              dur: 7 + (i % 5) * 2,
              color: ['rgba(139,92,246,0.6)', 'rgba(91,168,245,0.5)', 'rgba(236,72,153,0.5)', 'rgba(6,182,212,0.4)'][i % 4],
            })),
          [],
        ).map((p) => (
          <div
            key={p.id}
            className="splash-particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              background: p.color,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ═══ Grid Noise Overlay ═══ */}
      <div className="splash-noise" />

      {/* ═══ Main Content ═══ */}
      <div className="splash-content">
        {/* ─── Logo Cluster ─── */}
        <div className="splash-logo-cluster flex justify-center mb-4">
          <Logo size={80} variant="icon" animated />
        </div>

        {/* ─── Branding ─── */}
        <div className="splash-branding">
          <h1 className="splash-title">TissueAI</h1>
          <div className="splash-subtitle-row">
            <span className="splash-subtitle">Histopathology Intelligence</span>
            <span className="splash-version">v0.1.0</span>
          </div>
        </div>

        {/* ─── Bento Status Grid ─── */}
        <div className="splash-bento">
          {/* Step label card */}
          <div className="splash-bento-card splash-bento-card-main">
            <div className="splash-bento-card-glow" />
            <div className="splash-bento-card-header">
              <div className={`splash-status-dot ${isComplete ? 'splash-status-dot-done' : 'splash-status-dot-active'}`} />
              <span className="splash-bento-label">{currentStep.label}</span>
            </div>
            <p className="splash-bento-detail">{currentStep.detail}</p>
          </div>

          {/* Metrics row */}
          <div className="splash-bento-metrics">
            <div className="splash-bento-card splash-bento-card-metric">
              <span className="splash-metric-value">{progress}%</span>
              <span className="splash-metric-label">Progress</span>
            </div>
            <div className="splash-bento-card splash-bento-card-metric">
              <span className="splash-metric-value">{stepIndex + 1}/{LOAD_STEPS.length}</span>
              <span className="splash-metric-label">Steps</span>
            </div>
            <div className="splash-bento-card splash-bento-card-metric">
              <span className="splash-metric-value">{(elapsed / 1000).toFixed(1)}s</span>
              <span className="splash-metric-label">Elapsed</span>
            </div>
          </div>
        </div>

        {/* ─── Progress Bar ─── */}
        <div className="splash-progress-wrapper">
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="splash-progress-glow" />
            </div>
          </div>
          <div className="splash-progress-info">
            <span className="splash-progress-step-text">
              {isComplete ? 'Launch complete' : currentStep.detail}
            </span>
            <span className="splash-progress-pct">{progress}%</span>
          </div>
        </div>

        {/* ─── Step Timeline ─── */}
        <div className="splash-timeline">
          {LOAD_STEPS.map((step, i) => {
            const state =
              i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'
            return (
              <div key={i} className={`splash-timeline-item splash-timeline-${state}`}>
                <div className="splash-timeline-dot" />
                <span className="splash-timeline-label">{step.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
