"use client"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { Monitor, Cctv, Brain } from "lucide-react"
import { useSession } from "next-auth/react"

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    let animId: number
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number }> = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2,
    }))

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas!.width
        if (p.x > canvas!.width) p.x = 0
        if (p.y < 0) p.y = canvas!.height
        if (p.y > canvas!.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,92,246,${p.alpha})`
        ctx.fill()
      }
      // draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(139,92,246,${0.15 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [])

  const { data: session } = useSession()

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white overflow-hidden flex flex-col">
      {/* animated network background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-50" />

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-2 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Multi-Tenant Digital Health &amp; Safety OS
        </div>

        <h1 className="text-5xl md:text-7xl font-black leading-none mb-6">
          <span className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
            One Hub.
          </span>
          <br />
          <span className="text-white/30">Every Signal.</span>
        </h1>

        <p className="max-w-xl text-lg text-white/50 mb-12 leading-relaxed">
          Centralise posture telemetry, CCTV facility data and AI diagnostics across your entire organisation in real time — gated by role, isolated by tenant.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/30"
          >
            Get Started Free
          </Link>
          <Link
            href="/demo"
            className="px-8 py-3.5 rounded-full border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition-all"
          >
            Try Interactive Demo
          </Link>
        </div>

        {/* Stat bar */}
        <div className="mt-20 grid grid-cols-3 gap-8 md:gap-16 text-center">
          {[
            { label: "Data Sources", value: "3" },
            { label: "Tenant Isolation", value: "100%" },
            { label: "Uptime SLA", value: "99.9%" },
          ].map(s => (
            <div key={s.label}>
              <div className="text-3xl font-black text-white">{s.value}</div>
              <div className="text-xs text-white/40 mt-1 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Features */}
      <section id="features" className="relative z-10 px-8 py-24 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-16 text-white/80">Platform Pillars</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Monitor className="w-8 h-8 text-violet-400" />,
              title: "Posture Webcam",
              desc: "Personal telemetry straight from employee laptops. Real-time posture scoring, anonymised and filed to your tenant's data lake.",
              color: "from-violet-500/20 to-violet-500/5",
              border: "border-violet-500/20",
            },
            {
              icon: <Cctv className="w-8 h-8 text-indigo-400" />,
              title: "CCTV Daemon",
              desc: "Facility-level telemetry from edge servers or cloud cameras. Tracks crowd density, zone compliance and ergonomic risk across locations.",
              color: "from-indigo-500/20 to-indigo-500/5",
              border: "border-indigo-500/20",
            },
            {
              icon: <Brain className="w-8 h-8 text-purple-400" />,
              title: "Medical AI",
              desc: "FastAPI microservice delivering jaundice, skin disease, nail and oral cancer diagnostics. Billed per inference, isolated per tenant.",
              color: "from-purple-500/20 to-purple-500/5",
              border: "border-purple-500/20",
            },
          ].map(f => (
            <div
              key={f.title}
              className={`rounded-2xl bg-gradient-to-br ${f.color} border ${f.border} p-6 hover:scale-105 transition-transform cursor-default`}
            >
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-white/20 py-8 border-t border-white/5">
        © {new Date().getFullYear()} PostureHub — Built with Next.js &amp; Django &nbsp;·&nbsp;
        {!session ? (
          <Link href="/login" className="hover:text-white/60 transition-colors">Sign In</Link>
        ) : (
          <Link href="/dashboard" className="hover:text-white/60 transition-colors">Dashboard</Link>
        )}
      </footer>
    </div>
  )
}
