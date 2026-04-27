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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Bypass Next.js static build-time replacement (DefinePlugin)
  // so that variables are truly read dynamically at runtime on the server.
  const getEnv = (name: string) => process.env[name];

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50 flex flex-col select-none`}
      >
        <Providers config={{
          razorpayKeyId: getEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID") || "",
          razorpayBusinessPlanId: getEnv("NEXT_PUBLIC_RAZORPAY_PLAN_BUSINESS") || "",
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
