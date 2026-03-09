"use client"
import { useSubscription } from "@/hooks/useSubscription"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { HeartPulse, Stethoscope, Microscope, ShieldCheck, Activity, BrainCircuit, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function MedicalAIPage() {
    const { sessionStatus, isLoading, hasSubscription, user, isAdmin, hasQuotaLeft, quota } = useSubscription()
    const router = useRouter()

    useEffect(() => {
        if (isLoading) return;

        // Redirect logic based on session status and subscription
        if (sessionStatus === "unauthenticated" || !user) {
            router.push("/login?callbackUrl=/medical-ai");
            return;
        }

        if (sessionStatus === "authenticated" && !hasSubscription && !isAdmin && !hasQuotaLeft) {
            router.push("/settings?error=quota_exceeded&feature=medical-ai");
            return;
        }
    }, [sessionStatus, isLoading, hasSubscription, isAdmin, hasQuotaLeft, user, router]);

    if (isLoading || sessionStatus === "unauthenticated" || !user || (!hasSubscription && !isAdmin && !hasQuotaLeft)) {
        return null; // Prevents render flash while redirecting
    }

    const handleLaunch = () => {
        // This button should only be clickable if the user is authenticated and has a subscription
        // The useEffect above handles the initial redirects.
        // If we reach here, it means the user is authenticated and has a subscription.

        // Redirect to the external Medical AI app
        window.location.href = "http://localhost:5173"
    }

    return (
        <div className="min-h-screen bg-slate-50 pt-28 pb-20 overflow-hidden relative">
            {/* Decorative BG elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-3xl -z-10 translate-y-1/2 -translate-x-1/2" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                    {/* Content Section */}
                    <div className="animate-in fade-in slide-in-from-left-8 duration-700">
                        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-100 rounded-full px-4 py-2 mb-8">
                            <HeartPulse className="w-3.5 h-3.5" /> Healthcare Grade AI
                        </div>

                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
                            Advanced Diagnostics,<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Powered by Vision.</span>
                        </h1>

                        <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-xl">
                            Our Medical AI suite leverages state-of-the-art diagnostic models to instantly analyze ocular and dermatological anomalies. Secure, scalable, and built for professionals.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mb-12">
                            <Button
                                onClick={handleLaunch}
                                size="lg"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 px-8 rounded-2xl shadow-xl shadow-slate-900/10 flex items-center gap-3 transition-transform hover:scale-105 active:scale-95 group"
                            >
                                <BrainCircuit className="w-5 h-5 group-hover:animate-pulse" />
                                Launch Application
                            </Button>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 px-4 py-2 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur">
                                    <div className="p-1.5 bg-green-100 rounded-lg">
                                        <ShieldCheck className="w-4 h-4 text-green-600" />
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">
                                        {isAdmin || hasSubscription ? 'Enterprise Unlocked' : 'Free Tier Supported'}
                                    </span>
                                </div>
                                {!isAdmin && !hasSubscription && quota?.quota_remaining_hours !== undefined && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50/50 ml-2 mt-1 w-max">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <span className="text-[10px] font-bold text-blue-700 tracking-wider uppercase">
                                            {quota.quota_remaining_hours} HRS QUOTA REMAINING
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Feature Pillars */}
                        <div className="grid grid-cols-2 gap-6">
                            <FeatureItem
                                icon={<Microscope className="w-4 h-4 text-violet-600" />}
                                title="Clinically Trained"
                                desc="Models trained on thousands of verified medical datasets."
                            />
                            <FeatureItem
                                icon={<Stethoscope className="w-4 h-4 text-violet-600" />}
                                title="Multi-modal Analysis"
                                desc="Support for Cataract, Skin, and Nail abnormalities."
                            />
                        </div>
                    </div>

                    {/* Visual Section (Mock Screenshot/Card) */}
                    <div className="relative animate-in fade-in slide-in-from-right-8 duration-700">
                        <div className="bg-white rounded-[2rem] p-4 shadow-2xl border border-slate-200 transform lg:-rotate-2 hover:rotate-0 transition-transform duration-500">
                            <div className="bg-slate-900 rounded-[1.5rem] aspect-video overflow-hidden relative group">
                                {/* Mock UI Elements */}
                                <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-indigo-900/20" />

                                {/* Fake Grid Background effect */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]" />

                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="relative">
                                        <div className="w-24 h-24 border border-violet-400/30 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                                            <div className="w-20 h-20 border-2 border-dashed border-violet-400/50 rounded-full"></div>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <BrainCircuit className="w-8 h-8 text-violet-300 drop-shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center">
                                            <ActivityIcon className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">Inference Engine</p>
                                            <p className="text-sm font-bold text-white">READY</p>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-violet-500/80 text-white text-[10px] font-black uppercase rounded-lg border border-violet-400/50">ONNX ACCELERATED</div>
                                </div>
                            </div>
                        </div>

                        {/* Floating Badges */}
                        <div className="absolute -top-6 -left-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 animate-bounce duration-[3000ms]">
                            <Stethoscope className="w-8 h-8 text-rose-500" />
                        </div>
                        <div className="absolute -bottom-6 -right-6 p-6 bg-white rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-widest">Secure Compute</span>
                        </div>
                    </div>

                </div>
            </div>

            {/* Extra Info Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-32">
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200">
                    <h2 className="text-3xl font-black text-slate-900 mb-8">System Capabilities</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <FAQItem
                            q="What conditions can the AI detect?"
                            a="Currently, the system features robust models for detecting stage-specific Cataracts, visual symptoms of Jaundice, Skin diseases, and Nail anomalies using macro photography."
                        />
                        <FAQItem
                            q="Is this a replacement for a doctor?"
                            a="No. Our Medical AI is strictly a preliminary diagnostic tool designed to assist healthcare professionals and provide early warnings. Always consult a certified medical practitioner."
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

function FAQItem({ q, a }: { q: string, a: string }) {
    return (
        <div>
            <h4 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-violet-500" /> {q}
            </h4>
            <p className="text-slate-600 leading-relaxed">{a}</p>
        </div>
    )
}

function ActivityIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
