import Link from "next/link"

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-20 px-4">
            <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-200">
                <Link href="/" className="text-violet-600 text-sm font-semibold mb-8 inline-block hover:underline">
                    &larr; Back to Home
                </Link>
                <h1 className="text-4xl font-bold mb-6 tracking-tight text-slate-900">Privacy Policy</h1>
                <p className="text-slate-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>

                <div className="space-y-8 text-slate-700 leading-relaxed">
                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Edge Processing & Telemetry</h2>
                        <p>
                            Posture OS Hub is designed point-first for enterprise data sovereignty. All AI inference (including posture tracking and medical diagnostic models) is performed <strong>at the edge</strong>. Visual data from webcams or CCTV feeds is never transmitted to our central cloud unless explicitly configured for remote debugging by a tenant super-administrator.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Anonymised Skeleton Data</h2>
                        <p>
                            The telemetry collected by the Posture Webcam desktop application consists strictly of coordinate vectors (e.g., nose: [x,y,z], shoulder: [x,y,z]). The raw camera matrix is destroyed immediately after coordinate extraction within volatile memory.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Data Retention</h2>
                        <p>
                            We retain anonymised scoring parameters, hardware IDs, and compliance boolean flags for the duration of your organisation's active subscription. Upon termination of your Postgres isolated schema, all data is permanently wiped within 72 hours.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Contact Us</h2>
                        <p>
                            For GDPR compliance requests or to speak with our Data Protection Officer, please ping your dedicated account manager or reach out to security@posturehub.local.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
