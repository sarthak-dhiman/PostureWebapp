"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface CaptchaWidgetProps {
  onVerify: (data: { captcha_id: string; captcha_solution: string } | null) => void;
}

export function CaptchaWidget({ onVerify }: CaptchaWidgetProps) {
  const [captchaId, setCaptchaId] = useState<string>("");
  const [captchaImage, setCaptchaImage] = useState<string>("");
  const [solution, setSolution] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCaptcha = async () => {
    setLoading(true);
    setCaptchaId("");
    setCaptchaImage("");
    setSolution("");
    onVerify(null);

    try {
      // In production, Next.js API requests are typically hit via the gateway or direct.
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/api/v1/auth/captcha/`);
      const data = await res.json();
      if (res.ok && data.captcha_id) {
        setCaptchaId(data.captcha_id);
        setCaptchaImage(data.captcha_image);
      }
    } catch (err) {
      console.error("Failed to fetch CAPTCHA", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSolution(val);
    if (val && captchaId) {
      onVerify({ captcha_id: captchaId, captcha_solution: val });
    } else {
      onVerify(null);
    }
  };

  if (loading && !captchaImage) {
    return (
      <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-slate-50 min-h-[110px]">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="text-[10px] uppercase font-bold text-slate-500 mt-2 tracking-wider">Secure Connection</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase text-slate-500 tracking-wider">
        Human Verification
      </label>
      <div className="flex items-center gap-2">
        <div className="h-[50px] w-full flex-1 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative bg-white">
            {captchaImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captchaImage} alt="Math CAPTCHA" className="object-cover w-full h-full" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-red-500 font-medium bg-red-50">
                    Connection Error
                </div>
            )}
        </div>
        <button
          type="button"
          onClick={fetchCaptcha}
          className="h-[50px] w-[50px] flex items-center justify-center shrink-0 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
          title="Refresh CAPTCHA"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Enter your answer (e.g. 15)"
        value={solution}
        onChange={handleChange}
        required
        className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors"
      />
    </div>
  );
}
