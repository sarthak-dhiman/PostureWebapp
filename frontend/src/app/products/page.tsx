import Link from "next/link"
import { Activity, Camera, Stethoscope, ArrowRight, ShieldCheck, Zap } from "lucide-react"

export default function ProductsPage() {
    return (
        <div className="min-h-screen bg-slate-50 pt-20">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                    The Posture OS <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Ecosystem</span>
                </h1>
                <p className="max-w-2xl mx-auto text-lg text-slate-600">
                    Three powerful tools, one unified edge-to-cloud infrastructure. Monitor ergonomics, facility safety, and preventative diagnostics.
                </p>
            </div>

            {/* Products Grid */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Product 1: Webcam */}
                    <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:border-violet-300 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-100 to-fuchsia-50 opacity-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                        <div className="w-14 h-14 bg-violet-100 rounded-2xl flex items-center justify-center mb-6 text-violet-600 shadow-sm border border-violet-200">
                            <Activity className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Posture Webcam App</h2>
                        <p className="text-slate-600 mb-6 flex-grow leading-relaxed">
                            A PySide6 desktop application that runs completely offline using local AI models to monitor your sitting posture and alert you to slump patterns in real-time.
                        </p>
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <Zap className="w-4 h-4 text-amber-500" /> Offline Edge Processing
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Zero Video Uploads
                            </div>
                        </div>
                        <div className="mt-auto space-y-3">
                            <Link 
                                href="https://drive.google.com/uc?export=download&id=1CiPTwiGiWgRjdZnnZqVOoUz-isDTzaeF" 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between w-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl font-semibold transition-colors shadow-lg shadow-slate-900/10"
                            >
                                Download for Windows <ArrowRight className="w-4 h-4" />
                            </Link>
                            <Link href="/demo" className="flex items-center justify-center w-full bg-slate-50 hover:bg-violet-50 text-slate-900 hover:text-violet-700 px-4 py-3 rounded-xl font-semibold transition-colors border border-slate-200 hover:border-violet-200">
                                Try Online Demo
                            </Link>
                        </div>
                    </div>

                    {/* Product 2: CCTV */}
                    <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-cyan-50 opacity-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 shadow-sm border border-blue-200">
                            <Camera className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Facility CCTV Nodes</h2>
                        <p className="text-slate-600 mb-6 flex-grow leading-relaxed">
                            Deploy lightweight Python monitoring nodes to existing facility IP cameras. Track worker ergonomics and safety compliance across factory floors globally.
                        </p>
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <Zap className="w-4 h-4 text-amber-500" /> Multi-Camera Inference
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> API-Key Device Auth
                            </div>
                        </div>
                        <Link href="/cctv" className="mt-auto flex items-center justify-between w-full bg-slate-50 hover:bg-blue-50 text-slate-900 hover:text-blue-700 px-4 py-3 rounded-xl font-semibold transition-colors border border-slate-200 hover:border-blue-200">
                            Learn More <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Product 3: Medical Diagnostics */}
                    <div className="group bg-white rounded-3xl p-8 shadow-sm border border-slate-200 hover:shadow-xl hover:border-rose-300 transition-all duration-300 flex flex-col h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-100 to-orange-50 opacity-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                        <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mb-6 text-rose-600 shadow-sm border border-rose-200">
                            <Stethoscope className="w-7 h-7" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">AI Diagnostics</h2>
                        <p className="text-slate-600 mb-6 flex-grow leading-relaxed">
                            A high-accuracy microservice suite built on FastAPI. Upload medical scans for detection of cataracts, jaundice, oral cancers, and nail diseases.
                        </p>
                        <div className="space-y-3 mb-8">
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <Zap className="w-4 h-4 text-amber-500" /> 5+ Specialized Models
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Web & API Access
                            </div>
                        </div>
                        <Link href="https://medical-ai-posture.onrender.com/" target="_blank" className="mt-auto flex items-center justify-between w-full bg-slate-50 hover:bg-rose-50 text-slate-900 hover:text-rose-700 px-4 py-3 rounded-xl font-semibold transition-colors border border-slate-200 hover:border-rose-200">
                            Launch App <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                </div>
            </div>
        </div>
    )
}
