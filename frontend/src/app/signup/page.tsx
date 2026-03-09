"use client"
import { useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { ShieldCheck, Mail, Building, ArrowRight, User, Lock, Briefcase, UserPlus } from "lucide-react"

export default function SignupPage() {
    const [step, setStep] = useState(1)
    const [accountType, setAccountType] = useState<"solo" | "org" | "join" | null>(null)

    // Form data
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [orgName, setOrgName] = useState("")
    const [inviteCode, setInviteCode] = useState("")
    const [plan, setPlan] = useState("monthly")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

            // 1. Register the user
            const regRes = await fetch(`${apiBase}/api/v1/auth/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    account_type: accountType,
                    org_name: accountType === 'org' ? orgName : undefined,
                    invite_code: accountType === 'join' ? inviteCode : undefined
                })
            })

            const regData = await regRes.json()

            if (!regRes.ok) {
                throw new Error(regData.detail || "Registration failed")
            }

            // 2. Log them in automatically
            const signRes = await signIn("credentials", {
                username: email,
                password,
                callbackUrl: '/dashboard',
                redirect: true,
            })

            // 3. If solo, redirect to checkout. If org, they are done (pending approval)
            if (accountType === 'solo') {
                const checkoutRes = await fetch(`${apiBase}/api/v1/billing/checkout/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${regData.access}`
                    },
                    body: JSON.stringify({ price_id: plan === 'annual' ? "price_mock_combo_yr" : "price_mock_combo_mo" }) // Backend handles price_id mapping or we use real ones
                })
                const checkoutData = await checkoutRes.json()
                if (checkoutData.url) {
                    window.location.href = checkoutData.url
                    return
                }
            } else {
                setStep(4) // Success/Pending state
            }

        } catch (err: any) {
            setError(err.message)
            setLoading(false)
        }
    }

    return (
        <div className="h-screen flex items-center justify-center bg-slate-50 p-4 overflow-hidden">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

                {/* Decorative header gradient */}
                <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-indigo-600" />

                <div className="px-7 py-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-violet-100 w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Posture OS Hub</p>
                            <p className="text-xs text-slate-400">Step {step} of {step === 1 ? "3" : step === 2 ? "3" : "3"}</p>
                        </div>
                    </div>

                    {/* STEP 1: User Profile */}
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">Create Account</h1>
                            <p className="text-slate-500 mb-4 text-xs">Let&apos;s set up your personal profile first.</p>

                            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input required value={name} onChange={e => setName(e.target.value)} type="text" placeholder="John Doe" className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input required value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="john@example.com" className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input required minLength={8} value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-9 px-4 py-2 rounded-md font-medium text-sm mt-2">
                                    Continue <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>
                            <p className="text-center text-xs text-slate-500 mt-4">
                                Already have an account? <Link href="/login" className="text-violet-600 hover:underline font-semibold">Sign in</Link>
                            </p>
                        </div>
                    )}

                    {/* STEP 2: Account Type Selection */}
                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">Account Type</h1>
                            <p className="text-slate-500 mb-4 text-xs">How do you plan to use Posture OS?</p>

                            <div className="space-y-2">
                                <button
                                    onClick={() => { setAccountType("solo"); setStep(3); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50 transition-all text-left"
                                >
                                    <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-center">
                                            <h3 className="font-semibold text-slate-900 text-sm">Solo User</h3>
                                            <span className="bg-green-100 text-green-700 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ml-2">10 Hr Free</span>
                                        </div>
                                        <p className="text-xs text-slate-500">10 hrs free monitoring, then $1/mo.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { setAccountType("org"); setStep(3); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 hover:border-slate-800 hover:bg-slate-50 transition-all text-left"
                                >
                                    <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                        <Building className="w-4 h-4 text-slate-700" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 text-sm">Organization / Enterprise</h3>
                                        <p className="text-xs text-slate-500">Set up a tenant for your company.</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { setAccountType("join"); setStep(3); }}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 hover:border-violet-500 hover:bg-violet-50 transition-all text-left"
                                >
                                    <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm shrink-0">
                                        <UserPlus className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 text-sm">Join an existing Organization</h3>
                                        <p className="text-xs text-slate-500">Enter an invite code to join your company tenant.</p>
                                    </div>
                                </button>
                            </div>

                            <button onClick={() => setStep(1)} className="w-full text-center text-xs text-slate-500 font-medium hover:text-slate-800 mt-4">
                                &larr; Back
                            </button>
                        </div>
                    )}

                    {/* STEP 3: Join Org */}
                    {step === 3 && accountType === "join" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">Join Organization</h1>
                            <p className="text-slate-500 mb-4 text-xs">Enter the code provided by your administrator.</p>

                            <form className="space-y-3" onSubmit={handleSignup}>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">Invitation Code</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input required value={inviteCode} onChange={e => setInviteCode(e.target.value)} type="text" placeholder="xxxx-xxxx-xxxx" className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                    </div>
                                </div>

                                {error && <p className="text-xs text-destructive text-center font-medium">{error}</p>}

                                <button disabled={loading} type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-9 px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50">
                                    {loading ? "Joining..." : "Join Organization"} <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>

                            <button onClick={() => setStep(2)} className="w-full text-center text-xs text-slate-500 font-medium hover:text-slate-800 mt-4">
                                &larr; Back
                            </button>
                        </div>
                    )}

                    {step === 3 && accountType === "org" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">Create Tenant</h1>
                            <p className="text-slate-500 mb-4 text-xs">Set up your enterprise organization.</p>

                            <form className="space-y-3" onSubmit={handleSignup}>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-700">Organization Name</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                        <input required value={orgName} onChange={e => setOrgName(e.target.value)} type="text" placeholder="Acme Corp" className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 pl-9 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                    </div>
                                </div>

                                <div className="bg-violet-50 border border-violet-100 p-3 rounded-lg">
                                    <p className="text-xs text-violet-800 font-medium text-center">
                                        Automated self-service registration is currently restricted. Submit a request to provision your enterprise node.
                                    </p>
                                </div>

                                {error && <p className="text-xs text-destructive text-center font-medium">{error}</p>}

                                <button disabled={loading} type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-9 px-4 py-2 rounded-md font-medium text-sm disabled:opacity-50">
                                    {loading ? "Submitting..." : "Submit Trial Request"} <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>

                            <button onClick={() => setStep(2)} className="w-full text-center text-xs text-slate-500 font-medium hover:text-slate-800 mt-4">
                                &larr; Back
                            </button>
                        </div>
                    )}

                    {step === 3 && accountType === "solo" && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-0.5">Choose Your Plan</h1>
                            <p className="text-slate-500 mb-4 text-xs">7-day free trial included with every plan.</p>

                            <form className="space-y-3" onSubmit={handleSignup}>
                                <div className="space-y-2">
                                    <label className="relative flex cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-violet-500 hover:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 has-[:checked]:ring-1 has-[:checked]:ring-violet-500 transition-all">
                                        <input type="radio" name="plan" value="monthly" className="sr-only" checked={plan === "monthly"} onChange={() => setPlan("monthly")} />
                                        <div className="flex w-full items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm">Monthly</p>
                                                <p className="text-xs text-slate-500">7 days free, then $1/mo</p>
                                            </div>
                                            <p className="text-base font-bold text-slate-900">$1<span className="text-xs font-normal text-slate-500">/mo</span></p>
                                        </div>
                                    </label>

                                    <label className="relative flex cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-violet-500 hover:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 has-[:checked]:ring-1 has-[:checked]:ring-violet-500 transition-all">
                                        <input type="radio" name="plan" value="annual" className="sr-only" checked={plan === "annual"} onChange={() => setPlan("annual")} />
                                        <div className="flex w-full items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                                                    Annual <span className="bg-violet-100 text-violet-700 text-[9px] uppercase font-bold px-2 py-0.5 rounded-full">Save 58%</span>
                                                </p>
                                                <p className="text-xs text-slate-500">7 days free, then $5/yr</p>
                                            </div>
                                            <p className="text-base font-bold text-slate-900">$5<span className="text-xs font-normal text-slate-500">/yr</span></p>
                                        </div>
                                    </label>
                                </div>

                                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-[11px] text-slate-500 text-center">
                                    Won&apos;t be charged until {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}. Cancel anytime.
                                </div>

                                {error && <p className="text-xs text-destructive text-center font-medium">{error}</p>}

                                <button disabled={loading} type="submit" className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-9 px-4 py-2 rounded-md font-medium text-sm">
                                    {loading ? "Creating Account..." : "Start 7-Day Free Trial"} <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>

                            <button onClick={() => setStep(2)} className="w-full text-center text-xs text-slate-500 font-medium hover:text-slate-800 mt-3">
                                &larr; Back
                            </button>
                        </div>
                    )}

                    {/* Step 4: Success / Pending for Org */}
                    {step === 4 && (
                        <div className="animate-in fade-in zoom-in duration-300 text-center py-2">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ShieldCheck className="w-6 h-6 text-green-600" />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Request Received</h1>
                            <p className="text-slate-500 mb-6 text-sm">
                                We&apos;ve received your request to set up <strong>{orgName}</strong>. Our team will provision your enterprise node within 24 hours.
                            </p>
                            <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-colors h-9 px-6 py-2 rounded-md font-medium text-sm">
                                Return to Login
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
