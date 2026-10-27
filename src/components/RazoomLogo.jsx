import { Component, useRef, useState } from 'react'
import { LottieSvg } from 'lottie-react'
import animationData from '../assets/razoom-logo.json'
import logoFallback from '../logo.svg'
import './RazoomLogo.css'

const LAST_FRAME = { percent: 100 }

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function toCssSize(value) {
  if (value == null) return undefined
  if (value === 'auto') return 'auto'
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value))) {
    return `${value}px`
  }
  return value
}

function logoClassName(className) {
  return ['razoom-logo', className].filter(Boolean).join(' ')
}

function logoStyle(width, height, style) {
  const next = { ...style }
  const cssWidth = toCssSize(width)
  const cssHeight = toCssSize(height)
  if (cssWidth != null) next['--razoom-logo-width'] = cssWidth
  if (cssHeight != null) next['--razoom-logo-height'] = cssHeight
  return next
}

function LogoFallback({ className, width, height, alt = 'Ra Zoom', style }) {
  return (
    <img
      src={logoFallback}
      alt={alt}
      width={typeof width === 'number' ? width : undefined}
      height={typeof height === 'number' ? height : undefined}
      className={logoClassName(className)}
      style={logoStyle(width, height, style)}
    />
  )
}

class LogoErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

function RazoomLogoAnimation({ className = '', width, height, alt = 'Ra Zoom', style }) {
  const lottieRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [reduceMotion] = useState(prefersReducedMotion)

  const holdLastFrame = () => {
    lottieRef.current?.scrubTo(LAST_FRAME)
  }

  if (failed) {
    return <LogoFallback className={className} width={width} height={height} alt={alt} style={style} />
  }

  return (
    <LottieSvg
      lottieRef={lottieRef}
      className={logoClassName(className)}
      src={animationData}
      loop={false}
      autoplay={!reduceMotion}
      rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      role="img"
      aria-label={alt}
      subscriptions={{
        ready() {
          if (reduceMotion) holdLastFrame()
        },
        complete: holdLastFrame,
        error() {
          setFailed(true)
        }
      }}
      style={logoStyle(width, height, style)}
    />
  )
}

export default function RazoomLogo(props) {
  return (
    <LogoErrorBoundary fallback={<LogoFallback {...props} />}>
      <RazoomLogoAnimation {...props} />
    </LogoErrorBoundary>
  )
}
