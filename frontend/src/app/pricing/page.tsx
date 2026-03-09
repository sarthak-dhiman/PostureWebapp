"use client"
import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { Check, ShieldCheck, Zap, Building, ArrowRight, Activity, Camera, Stethoscope, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubscribeButton } from "@/components/ui/subscribe-button"
import { GiftSubscriptionModal } from "@/components/ui/gift-subscription-modal"
import { useSearchParams } from "next/navigation"

export default function PricingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
            <PricingContent />
        </Suspense>
    )
}

function PricingContent() {
    const searchParams = useSearchParams()
    const type = searchParams.get("type")
    const [view, setView] = useState<"solo" | "enterprise">("solo")
    const [cycle, setCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly")

    useEffect(() => {
        if (type === "enterprise") setView("enterprise")
        else if (type === "solo") setView("solo")
    }, [type])

    // Pricing Data Mapping
    const prices = {
        webcam: { monthly: "1", quarterly: "2", yearly: "5" },
        health: { monthly: "1", quarterly: "2", yearly: "5" },
        combo: { monthly: "1.50", quarterly: "3", yearly: "8" }
    }

    const razorpayPlanIds = {
        webcam: {
            monthly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_WEBCAM_MO || "plan_mock_webcam_mo",
            quarterly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_WEBCAM_QTR || "plan_mock_webcam_qtr",
            yearly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_WEBCAM_YR || "plan_mock_webcam_yr"
        },
        health: {
            monthly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_HEALTH_MO || "plan_mock_health_mo",
            quarterly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_HEALTH_QTR || "plan_mock_health_qtr",
            yearly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_HEALTH_YR || "plan_mock_health_yr"
        },
        combo: {
            monthly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_COMBO_MO || "plan_mock_combo_mo",
            quarterly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_COMBO_QTR || "plan_mock_combo_qtr",
            yearly: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_COMBO_YR || "plan_mock_combo_yr"
        },
        business: process.env.NEXT_PUBLIC_RAZORPAY_PLAN_BUSINESS || "plan_mock_business_mo"
    }

    const periodLabels = { monthly: "/mo", quarterly: "/qtr", yearly: "/yr" }
    const savingsLabels = {
        monthly: null,
        quarterly: "Save 33%",
        yearly: "Save 58%"
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20 text-slate-900">
            {/* Header section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-16">
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">
                    Simple, transparent <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">pricing</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-10">
                    Choose the plan that fits your scale. From individual posture tracking to global facility monitoring.
                </p>

                <div className="flex flex-col items-center gap-6">
                    {/* View Switcher (Solo vs Enterprise) */}
                    <div className="flex items-center justify-center gap-1 p-1 bg-slate-200/50 backdrop-blur rounded-xl w-fit border border-slate-200">
                        <button
                            onClick={() => setView("solo")}
                            className={`px-8 py-2 text-sm font-bold rounded-lg transition-all ${view === "solo" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Solo User
                        </button>
                        <button
                            onClick={() => setView("enterprise")}
                            className={`px-8 py-2 text-sm font-bold rounded-lg transition-all ${view === "enterprise" ? "bg-white text-violet-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Enterprise
                        </button>
                    </div>

                    {/* Cycle Toggle (Only for Solo) */}
                    {view === "solo" && (
                        <div className="flex items-center justify-center gap-1 p-1 bg-violet-100/50 backdrop-blur rounded-full w-fit border border-violet-200">
                            {(["monthly", "quarterly", "yearly"] as const).map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setCycle(c)}
                                    className={`relative px-6 py-1.5 text-xs font-bold rounded-full transition-all uppercase tracking-wider ${cycle === c
                                        ? "bg-violet-600 text-white shadow-md shadow-violet-500/20"
                                        : "text-violet-600/60 hover:text-violet-600"
                                        }`}
                                >
                                    {c}
                                    {savingsLabels[c] && cycle !== c && (
                                        <span className="absolute -top-1 -right-2 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Solo Pricing */}
            {view === "solo" && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Tier 1: Webcam */}
                    <PricingCard
                        icon={<Activity className="w-6 h-6 text-violet-600" />}
                        title="Posture Pro"
                        price={`$${prices.webcam[cycle]}`}
                        period={periodLabels[cycle]}
                        badge={savingsLabels[cycle]}
                        description="Real-time posture monitoring for your personal laptop."
                        features={[
                            "Local Edge Inference",
                            "Historical Posture Stats",
                            "Slump Pattern Alerts",
                            "Privacy First: Local Data"
                        ]}
                        buttonText="Start Free Trial"
                        href={`/signup?plan=webcam&cycle=${cycle}`}
                        priceId={razorpayPlanIds.webcam[cycle]}
                    />

                    {/* Tier 2: Disease AI */}
                    <PricingCard
                        icon={<Stethoscope className="w-6 h-6 text-rose-600" />}
                        title="Vision Health"
                        price={`$${prices.health[cycle]}`}
                        period={periodLabels[cycle]}
                        badge={savingsLabels[cycle]}
                        description="Access AI-driven medical diagnostics for scanning images."
                        features={[
                            "Jaundice & Skin Detection",
                            "Oral Cancer Analysis",
                            "Nail Disease Patterns",
                            "Secure HIPAA Encrypted"
                        ]}
                        buttonText="Start Free Trial"
                        href={`/signup?plan=health&cycle=${cycle}`}
                        priceId={razorpayPlanIds.health[cycle]}
                    />

                    {/* Tier 3: Combo */}
                    <PricingCard
                        highlight
                        icon={<Zap className="w-6 h-6 text-indigo-600" />}
                        title="Posture OS Combo"
                        price={`$${prices.combo[cycle]}`}
                        period={periodLabels[cycle]}
                        badge={savingsLabels[cycle]}
                        description="Get everything we offer for solo users in one bundle."
                        features={[
                            "Full Posture Pro access",
                            "Unlimited Vision Health checks",
                            "Unified Analytics Dashboard",
                            "Priority Feature Access",
                            "Save 25% on bundle"
                        ]}
                        buttonText="Get The Combo"
                        href={`/signup?plan=combo&cycle=${cycle}`}
                        priceId={razorpayPlanIds.combo[cycle]}
                    />
                </div>
            )}

            {/* Enterprise Pricing */}
            {view === "enterprise" && (
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <PricingCard
                        highlight
                        icon={<Building className="w-6 h-6 text-indigo-600" />}
                        title="Business Starter"
                        price="$100"
                        period="/mo"
                        badge="Popular"
                        description="A turnkey package for growing teams and facilities."
                        features={[
                            "100 Posture Monitor Seats",
                            "5 CCTV Room Ingestions",
                            "100 Medical Scans (Included)",
                            "Organization Admin Dashboard",
                            "Priority Email Support"
                        ]}
                        buttonText="Get Started"
                        href="/signup?plan=business"
                        priceId={razorpayPlanIds.business}
                    />

                    <PricingCard
                        icon={<ShieldCheck className="w-6 h-6 text-emerald-600" />}
                        title="Custom Enterprise"
                        price="Custom"
                        period="pricing"
                        description="Everything in Business Starter, plus custom limits, isolated tenant environments, and SAML SSO."
                        features={[
                            "Custom Posture & CCTV Limits",
                            "Dedicated Tenant Database Node",
                            "SSO (SAML/OpenID) Logins",
                            "On-Premise Deployment Options",
                            "24/7 Priority SLA Support"
                        ]}
                        buttonText="Contact Sales"
                        href="mailto:sales@posturehub.com"
                    />
                </div>
            )}
        </div>
    )
}

function PricingCard({
    highlight = false,
    icon,
    title,
    price,
    period,
    badge,
    description,
    features,
    buttonText,
    href,
    priceId
}: {
    highlight?: boolean,
    icon: React.ReactNode,
    title: string,
    price: string,
    period: string,
    badge?: string | null,
    description: string,
    features: string[],
    buttonText: string,
    href: string,
    priceId?: string
}) {
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)

    return (
        <div className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 ${highlight
            ? "bg-slate-900 text-white shadow-2xl scale-105 z-10 border-indigo-500/50 border-2"
            : "bg-white text-slate-900 shadow-sm border border-slate-200 hover:border-violet-300 hover:shadow-lg"
            }`}>
            {highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[10px] uppercase font-black px-4 py-1.5 rounded-full shadow-lg">
                    Best Value
                </div>
            )}

            <div className="flex justify-between items-start mb-6">
                <div>{icon}</div>
                {badge && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${highlight
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}>
                        {badge}
                    </span>
                )}
            </div>
            <h3 className="text-xl font-bold mb-3 tracking-tight">{title}</h3>
            <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black">{price}</span>
                <span className={`text-sm ${highlight ? "text-white/60" : "text-slate-500"}`}>{period}</span>
            </div>
            <p className={`text-sm mb-8 leading-relaxed ${highlight ? "text-white/60" : "text-slate-600"}`}>
                {description}
            </p>

            <div className="space-y-4 mb-8 flex-grow">
                {features.map(f => (
                    <div key={f} className="flex items-center gap-3">
                        <Check className={`w-4 h-4 ${highlight ? "text-indigo-400" : "text-emerald-500"}`} />
                        <span className="text-sm font-medium">{f}</span>
                    </div>
                ))}
            </div>

            {priceId ? (
                <div className="space-y-3">
                    <SubscribeButton
                        planId={priceId}
                        planName={title}
                        buttonText={buttonText}
                        fallbackUrl={href}
                        className={highlight
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white shadow-lg shadow-violet-500/30"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-900 hover:text-slate-900"
                        }
                    />
                    <Button
                        variant="ghost"
                        className={`w-full font-semibold h-10 ${highlight ? "text-violet-200 hover:text-white hover:bg-violet-800/50" : "text-violet-600 hover:text-violet-800 hover:bg-violet-50"}`}
                        onClick={() => setIsGiftModalOpen(true)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 lucide lucide-gift"><polyline points="20 12 20 22 4 22 4 12" /><rect width="20" height="5" x="2" y="7" /><line x1="12" x2="12" y1="22" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>
                        Gift this plan to a friend
                    </Button>
                    <GiftSubscriptionModal
                        isOpen={isGiftModalOpen}
                        onClose={() => setIsGiftModalOpen(false)}
                        planId={priceId}
                        planName={title}
                    />
                </div>
            ) : (
                <Link href={href}>
                    <Button className={`w-full font-bold h-11 rounded-xl transition-all border-none ${highlight
                        ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 text-white shadow-lg shadow-violet-500/30"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-900 hover:text-slate-900"
                        }`}>
                        {buttonText}
                    </Button>
                </Link>
            )}
        </div>
    )
}
