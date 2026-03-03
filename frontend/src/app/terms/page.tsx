import Link from "next/link"

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-slate-50 py-20 px-4">
            <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
                <Link href="/" className="text-violet-600 text-sm font-semibold mb-8 inline-block hover:underline">
                    &larr; Back to Home
                </Link>
                <h1 className="text-4xl font-bold mb-6 tracking-tight text-slate-900">Terms of Service</h1>
                <p className="text-slate-500 mb-8">Effective Date: {new Date().toLocaleDateString()}</p>

                <div className="space-y-8 text-slate-700 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Scope of the OS</h2>
                        <p>
                            Posture OS Hub provides multi-tenant orchestration for edge inferencing nodes. By deploying the Python PySide6 client, CCTV Daemon, or FastAPI Medical microservice, you agree to these terms outlining API usage limits and diagnostic disclaimers.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Medical Disclaimer</h2>
                        <p>
                            The Medical AI models (Skin, Nail, Eye, Skin Burns) provided via the FastAPI backend are strictly for informational and triage capabilities. They are <strong>not FDA approved medical diagnostic devices</strong>. Always consult a licensed physician. Posture OS Hub accepts zero liability for actions taken or omitted based on model outputs.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Acceptable Use</h2>
                        <p>
                            Tenant organisations must not attempt to reverse engineer the PySide6 frozen binaries, nor extract the Segformer or YOLO state dictionaries bundled within the edge nodes. CCTV analysis must comply with local surveillance and employee monitoring labor laws.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">4. SLA & Revisions</h2>
                        <p>
                            We guarantee 99.9% uptime on the central management API (`/api/v1`). Edge nodes operate offline-first and are immune to upstream network disruption.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
