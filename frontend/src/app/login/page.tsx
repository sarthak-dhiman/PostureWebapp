"use client"

import { useState, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Loader2, Activity, Users, Zap, CheckCircle2 } from "lucide-react"
import { CaptchaWidget } from "@/components/ui/captcha-widget"

export default function LoginPage() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [captchaData, setCaptchaData] = useState<{ captcha_id: string; captcha_solution: string } | null>(null)

    useEffect(() => {
        if (status === "authenticated") {
            router.push("/profile")
        }
    }, [status, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        const res = await signIn("credentials", {
            username,
            password,
            captcha_id: captchaData?.captcha_id,
            captcha_solution: captchaData?.captcha_solution,
            redirect: false,
        })

        if (res?.error) {
            console.error("signIn returned error:", res.error, res)
            if (res.error === "email_not_verified") {
                setError("Please check your email to verify your account before logging in.")
            } else {
                setError("Invalid username or password")
            }
            setLoading(false)
        }
        // No else block here, as redirect is handled by useEffect based on session status
    }

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-slate-50">
            {/* Left Side - Product Showcase */}
            <div className="hidden lg:flex flex-col justify-center relative bg-slate-900 text-white overflow-hidden p-16 xl:p-24">
                {/* Decorative BG elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/30 rounded-full blur-[100px] -z-0 -translate-y-1/2 translate-x-[20%]" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-600/30 rounded-full blur-[100px] -z-0 translate-y-1/2 -translate-x-[20%]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay z-0"></div>

                <div className="relative z-10 max-w-xl">
                    <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-300 bg-violet-900/50 border border-violet-500/30 rounded-full px-4 py-2 mb-8 backdrop-blur-md">
                        <Activity className="w-3.5 h-3.5" /> Posture OS Hub
                    </div>
                    <h1 className="text-5xl font-black tracking-tight mb-6 leading-tight">
                        Command Center for <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Human Ergonomics.</span>
                    </h1>
                    <p className="text-lg text-slate-300 mb-12 leading-relaxed">
                        Access your organization's telemetry, manage edge nodes, and deploy Medical AI models from a single, secure dashboard.
                    </p>

                    <div className="space-y-6">
                        <FeatureItem title="Real-time Telemetry" desc="Monitor posture degradation trends across all your active edge nodes instantly." />
                        <FeatureItem title="Enterprise Security" desc="Bank-grade encryption, strict RBAC, and HIPAA-compliant data routing." />
                        <FeatureItem title="Medical AI Integration" desc="One-click access to advanced diagnostic models for Jaundice, Cataracts, and more." />
                    </div>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="flex flex-col justify-center items-center p-6 sm:p-12 relative">
                {/* Mobile Header (Only visible on small screens) */}
                <div className="lg:hidden w-full max-w-sm mb-10 text-center">
                    <div className="mx-auto bg-violet-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <ShieldCheck className="w-8 h-8 text-violet-600" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Posture OS</h1>
                    <p className="text-slate-500 mt-2">Sign in to your organization hub</p>
                </div>

                <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="hidden lg:flex items-center gap-3 mb-8">
                        <div className="bg-violet-100 w-10 h-10 rounded-xl flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
                            <p className="text-sm text-slate-500">Enter your credentials to continue</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="username" className="text-xs font-bold uppercase text-slate-500 tracking-wider">Username</Label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="admin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="h-12 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-bold uppercase text-slate-500 tracking-wider">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-12 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                disabled={loading}
                            />
                        </div>
                        {error && <p className="text-sm text-destructive font-bold">{error}</p>}

                        <CaptchaWidget onVerify={setCaptchaData} />

                        <Button type="submit" className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading || !captchaData}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-100" />
                        </div>
                        <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
                            <span className="bg-white px-4 text-slate-400">Or continue with</span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        className="w-full h-12 bg-white border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => signIn('google', { callbackUrl: '/profile' })}
                        disabled={loading}
                    >
                        <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.07-3.71 1.07-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        Google
                    </Button>

                    <p className="text-center text-xs text-slate-500 mt-8">
                        Don't have an account? <a href="/signup" className="text-violet-600 font-bold hover:underline">Register for a Trial</a>
                    </p>
                </div>
            </div>
        </div>
    )
}

function FeatureItem({ title, desc }: { title: string, desc: string }) {
    return (
        <div className="flex gap-4 items-start">
            <div className="mt-1 bg-white/10 p-1 rounded-full shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <div>
                <h4 className="font-bold text-white text-base">{title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed mt-1">{desc}</p>
            </div>
        </div>
    )
}
