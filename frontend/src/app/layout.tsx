import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Posture OS Hub",
  description: "Multi-Tenant Digital Health & Safety Dashboard",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Bypass Next.js static build-time replacement (DefinePlugin)
  // so that variables are truly read dynamically at runtime on the server.
  const getEnv = (name: string) => process.env[name];
  const isEnabled = (name: string) => getEnv(name) === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50 flex flex-col select-none`}
      >
        <Providers config={{
          cashfreeAppId: getEnv("NEXT_PUBLIC_CASHFREE_APP_ID") || "",
          cashfreeSdkUrl: getEnv("NEXT_PUBLIC_CASHFREE_SDK_URL") || "",
          cashfreeBusinessPlanId: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_BUSINESS") || "",
          cashfreePlanWebcamMo: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_WEBCAM_MO") || "",
          cashfreePlanWebcamQtr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_WEBCAM_QTR") || "",
          cashfreePlanWebcamYr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_WEBCAM_YR") || "",
          cashfreePlanHealthMo: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_HEALTH_MO") || "",
          cashfreePlanHealthQtr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_HEALTH_QTR") || "",
          cashfreePlanHealthYr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_HEALTH_YR") || "",
          cashfreePlanComboMo: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_COMBO_MO") || "",
          cashfreePlanComboQtr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_COMBO_QTR") || "",
          cashfreePlanComboYr: getEnv("NEXT_PUBLIC_CASHFREE_PLAN_COMBO_YR") || "",
          allowSandbox: isEnabled("NEXT_PUBLIC_ALLOW_SANDBOX"),
        }}>
          <Navbar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
