"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useSubscription } from "@/hooks/useSubscription";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  User,
  CreditCard,
  Clock,
  Activity,
  Loader2,
  LogOut,
  Settings,
  Users,
  Key,
  Building,
  Check,
  Copy,
  Zap,
  Sparkles,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiFetch, getApiUrl } from "@/lib/api";
import { useCallback } from "react";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const { hasSubscription, org: activeOrg, role } = useSubscription();
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  // Controlled form state for Personal Details
  const _fullName = session?.user?.name || "";
  const _nameParts = _fullName.split(" ").filter(Boolean);
  const [firstName, setFirstName] = useState<string>(_nameParts[0] || "");
  const [lastName, setLastName] = useState<string>(
    _nameParts.slice(1).join(" ") || "",
  );
  const [emailVal, setEmailVal] = useState<string>(session?.user?.email || "");
  const [phoneVal, setPhoneVal] = useState<string>(
    (session?.user as any)?.phone_number || "",
  );
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [requestPhoneLoading, setRequestPhoneLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [adStatus, setAdStatus] = useState<any>(null);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adMessage, setAdMessage] = useState<string | null>(null);

  const fetchAdStatus = useCallback(async () => {
    try {
      const res = await apiFetch(getApiUrl('/api/v1/ads/status/'), {
        method: "GET",
      });
      if (res.ok) {
        const data = await res.json();
        setAdStatus(data);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchAdStatus();
  }, [fetchAdStatus]);

  // ALWAYS call redirect useEffect before any early returns
  useEffect(() => {
    if (
      status === "unauthenticated" ||
      (status === "authenticated" && !session?.user)
    ) {
      router.push("/login?callbackUrl=/profile");
    }
  }, [status, session, router]);

  const handleJoinOrg = async () => {
    if (!inviteCode.trim()) return;
    setIsJoining(true);
    setJoinError("");

    try {
      const res = await apiFetch(getApiUrl('/api/v1/orgs/join/'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
        },
        body: JSON.stringify({ invite_code: inviteCode }),
      });

      const data = await res.json();
      if (res.ok) {
        // Force a session refresh to pull the new org & role
        await update();
        window.location.reload();
      } else {
        setJoinError(data.error || "Failed to join organization.");
      }
    } catch (err) {
      setJoinError("Network error occurred.");
    } finally {
      setIsJoining(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return null;
  }

  // Use our custom injected NextAuth session payload for base user data
  const user = session.user as any;
  const org = activeOrg || user.organization;

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-20 overflow-x-hidden">
      {/* BG Decorative elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100/50 rounded-full blur-3xl -z-10 -translate-y-1/2 overflow-hidden" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              User Profile
            </h1>
            <p className="text-slate-500 mt-1">
              Manage your account details and subscriptions.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="shadow-sm shadow-red-500/20"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* User Details Column */}
          <div className="md:col-span-1 space-y-8">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-violet-100 text-violet-600 w-24 h-24 rounded-full flex items-center justify-center mb-4 text-3xl font-black uppercase shadow-inner">
                  {user.name?.charAt(0) || "U"}
                </div>
                <CardTitle className="text-xl">{user.name}</CardTitle>
                <CardDescription className="text-xs">
                  {user.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 border-t border-slate-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">System Role</span>
                    <Badge variant="outline" className="bg-slate-50">
                      {role || "USER"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">User ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-800 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                        {String(user.id || "")}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-violet-100 hover:text-violet-600"
                        onClick={() => {
                          navigator.clipboard.writeText(String(user.id || ""));
                          setCopiedId(true);
                          setTimeout(() => setCopiedId(false), 2000);
                        }}
                      >
                        {copiedId ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Security</span>
                    <span className="text-green-600 flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3 h-3" /> Active
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Ad Rewards Card (Premium Glassmorphism Style) */}
            <Card className="shadow-sm border-slate-200 overflow-hidden relative">
              {/* Subtle background glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full" />

              <CardHeader className="pb-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-violet-600 flex-shrink-0 flex items-center justify-center shadow-lg shadow-violet-200 ring-4 ring-violet-50">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 flex-shrink-0">
                      Mock Ads
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 leading-tight">
                      Earn Free Access
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1 leading-relaxed">
                      Watch short ads to earn AI access and webcam time.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-5">
                  {/* Progress Section */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 relative overflow-hidden">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Next Reward</span>
                      <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        {adStatus
                          ? `${adStatus.watched_since_last_reward || 0}/5`
                          : "0/5"}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/50 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${adStatus ? Math.min(100, ((adStatus.watched_since_last_reward || 0) / 5) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats Section */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Credits</div>
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        {adStatus
                          ? `${Math.floor((adStatus.credits_seconds || 0) / 3600)}h ${Math.floor(((adStatus.credits_seconds || 0) % 3600) / 60)}m`
                          : "0h 0m"}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200 flex-shrink-0 mx-3" />
                    <div className="flex flex-col flex-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AI Uses</div>
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                        <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                        {adStatus ? adStatus.ai_uses || 0 : "0"}
                      </div>
                    </div>
                  </div>

                  {/* Action Section */}
                  <div className="relative w-full pt-1">
                    <Button
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-[0.98] h-11"
                      disabled={watchingAd}
                      onClick={async () => {
                        setAdMessage(null);
                        setWatchingAd(true);
                        setTimeout(async () => {
                          try {
                            const res = await apiFetch(getApiUrl('/api/v1/ads/watch/'), {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
                              },
                              body: JSON.stringify({ provider: "mock", ad_id: "mock_ad_1" }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              if (data.rewards && data.rewards.length) {
                                setAdMessage("✨ Reward granted: " + data.rewards.map((r: any) => r.type).join(", "));
                              } else {
                                setAdMessage("✅ Watch recorded!");
                              }
                              await fetchAdStatus();
                            } else {
                              setAdMessage(data.detail || "Failed to record watch");
                            }
                          } catch (e) {
                            setAdMessage("Network error");
                          } finally {
                            setWatchingAd(false);
                          }
                        }, 3000);
                      }}
                    >
                      {watchingAd ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                          <span className="truncate font-semibold tracking-wide">Watching...</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <Play className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate font-semibold tracking-wide">Watch & Earn Base Access</span>
                        </div>
                      )}
                    </Button>
                    {adMessage && (
                      <div className="absolute top-full left-0 right-0 mt-2 text-[10px] font-bold text-center text-violet-600 animate-in fade-in slide-in-from-top-1 px-2">
                        {adMessage}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription & Payment Column */}
          <div className="md:col-span-2 space-y-8">
            {/* Personal Details Card */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-5 h-5 text-slate-700" />
                  <CardTitle>Personal Details</CardTitle>
                </div>
                <CardDescription>
                  Update your name, email and phone number.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    id="first_name"
                  />
                  <Input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    id="last_name"
                  />
                  <Input
                    placeholder="Email address"
                    value={emailVal}
                    onChange={(e) => setEmailVal(e.target.value)}
                    id="email"
                    className="sm:col-span-2"
                  />
                  <Input
                    placeholder="Phone (not yet verified)"
                    value={phoneVal}
                    onChange={(e) => setPhoneVal(e.target.value)}
                    id="phone"
                    className="sm:col-span-2"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Note: Changing your email will trigger a verification email.
                </p>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    id="saveProfile"
                    disabled={saving}
                    onClick={async () => {
                      setSaveMessage(null);
                      setSaving(true);
                      try {
                        const res = await apiFetch(
                          getApiUrl(`/api/v1/users/me/`),
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
                            },
                            body: JSON.stringify({
                              first_name: firstName.trim(),
                              last_name: lastName.trim(),
                              email: emailVal.trim(),
                              phone: phoneVal.trim(),
                            }),
                          },
                        );

                        const data = await res.json();
                        if (res.ok) {
                          try {
                            await update();
                          } catch (e) { }
                          setSaveMessage(
                            "Profile updated. If email changed, verification sent.",
                          );
                          // update local session display by reloading
                          window.location.reload();
                        } else {
                          setSaveMessage(
                            data.detail || "Failed to update profile",
                          );
                        }
                      } catch (e) {
                        setSaveMessage("Network error updating profile");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </Button>

                  <Button
                    id="resendVerification"
                    variant="outline"
                    disabled={resendLoading}
                    onClick={async () => {
                      setResendLoading(true);
                      try {
                        const res = await apiFetch(
                          getApiUrl(`/api/v1/auth/resend-verification/`),
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
                            },
                          },
                        );
                        const data = await res.json();
                        if (res.ok) {
                          setSaveMessage(
                            data.detail || "Verification email sent",
                          );
                        } else {
                          setSaveMessage(
                            data.detail || "Unable to resend verification",
                          );
                        }
                      } catch (e) {
                        setSaveMessage("Network error");
                      } finally {
                        setResendLoading(false);
                      }
                    }}
                  >
                    {resendLoading ? "Sending..." : "Resend verification"}
                  </Button>
                  <Button
                    id="requestPhoneCode"
                    variant="outline"
                    disabled={requestPhoneLoading}
                    onClick={async () => {
                      if (!phoneVal.trim()) {
                        setSaveMessage("Enter a phone number first");
                        return;
                      }
                      setRequestPhoneLoading(true);
                      try {
                        const res = await apiFetch(
                          getApiUrl(`/api/v1/auth/phone/request/`),
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
                            },
                            body: JSON.stringify({ phone: phoneVal.trim() }),
                          },
                        );
                        const data = await res.json();
                        if (res.ok) {
                          setSaveMessage(
                            data.detail || "Code sent via SMS (mock)",
                          );
                        } else {
                          setSaveMessage(
                            data.detail || "Failed to request code",
                          );
                        }
                      } catch (e) {
                        setSaveMessage("Network error");
                      } finally {
                        setRequestPhoneLoading(false);
                      }
                    }}
                  >
                    {requestPhoneLoading ? "Sending..." : "Request phone code"}
                  </Button>

                  <Button
                    id="verifyPhoneCode"
                    variant="outline"
                    disabled={verifyLoading}
                    onClick={async () => {
                      const code = window.prompt(
                        "Enter the verification code you received via SMS",
                      );
                      if (!code) return;
                      setVerifyLoading(true);
                      try {
                        const res = await apiFetch(
                          getApiUrl(`/api/v1/auth/phone/verify/`),
                          {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${(session?.user as any)?.accessToken}`,
                            },
                            body: JSON.stringify({ code }),
                          },
                        );
                        const data = await res.json();
                        if (res.ok) {
                          setSaveMessage(data.detail || "Phone verified");
                          try {
                            await update();
                          } catch (e) { }
                          window.location.reload();
                        } else {
                          setSaveMessage(
                            data.detail || "Failed to verify code",
                          );
                        }
                      } catch (e) {
                        setSaveMessage("Network error");
                      } finally {
                        setVerifyLoading(false);
                      }
                    }}
                  >
                    {verifyLoading ? "Verifying..." : "Verify phone"}
                  </Button>
                </div>
                <div className="text-xs text-slate-500 sm:ml-4 sm:mt-0 mt-3 w-full sm:w-auto text-left sm:text-right">
                  Phone verification not yet enabled server-side.
                </div>
              </CardFooter>
            </Card>
            {user.role === "SOLO" && (
              <Card className="shadow-sm border-slate-200">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-slate-700" />
                    <CardTitle>Billing & Payment Methods</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your Posture OS subscription and payment methods.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {org?.hasSubscription ? (
                      <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-8 bg-slate-100 rounded flex items-center justify-center border border-slate-200">
                            <span className="text-[10px] font-black tracking-widest text-slate-500">
                              VISA
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Visa ending in •••• 4242
                            </p>
                            <p className="text-xs text-slate-500">
                              Expires 12/26
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-slate-500 bg-slate-50"
                        >
                          Default
                        </Badge>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                        No default payment methods found.
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50 border-t border-slate-100 flex justify-end p-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/settings")}
                  >
                    Update Billing Details via Razorpay
                  </Button>
                </CardFooter>
              </Card>
            )}

            {user.role === "SOLO" && (
              <Card className="shadow-sm border-slate-200 overflow-hidden relative">
                <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-violet-500/5 blur-2xl rounded-full" />
                <CardHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="w-5 h-5 text-violet-600" />
                    <CardTitle className="text-base font-bold text-slate-900">Organization Setup</CardTitle>
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    Upgrade to enterprise or join an existing organization.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Create org CTA */}
                  <div className="p-5 sm:p-8 text-center rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/50 to-white flex flex-col items-center justify-center group transition-all hover:border-violet-200 shadow-sm">
                    <div className="bg-violet-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-4 text-white shadow-xl shadow-violet-200 group-hover:scale-110 transition-transform duration-300">
                      <Building className="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Launch an Organization
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 mb-6 leading-relaxed max-w-[280px]">
                      Centralized CCTV management, admin controls, and team collaboration.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => router.push("/orgs/create")}
                      className="bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 px-8 transition-all active:scale-95"
                    >
                      Create Organization
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 px-2">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                      or join team
                    </span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Join org form */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Invite Code
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="ENTER-CODE-HERE"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        className="font-mono text-sm tracking-widest uppercase bg-slate-50 border-slate-200 focus:bg-white transition-all h-11"
                      />
                      <Button
                        variant="outline"
                        onClick={handleJoinOrg}
                        disabled={isJoining || !inviteCode.trim()}
                        className="h-11 px-6 border-slate-200 hover:bg-slate-50 font-bold text-slate-700 shrink-0"
                      >
                        {isJoining ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Joining</span>
                          </div>
                        ) : "Join Team"}
                      </Button>
                    </div>
                    {joinError && (
                      <p className="text-xs text-rose-600 font-bold px-2 animate-in fade-in slide-in-from-top-1">
                        {joinError}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {user.role !== "SOLO" && (
              <Card className="shadow-sm border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/5 to-transparent rounded-bl-full pointer-events-none" />

                <CardHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-5 h-5 text-violet-600" />
                    <CardTitle className="text-base font-bold text-slate-900">Organization & Billing</CardTitle>
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    Manage your subscription tier and organization workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {org ? (
                    user.role === "ADMIN" ? (
                      <>
                        <div className="p-5 rounded-2xl border border-slate-100 bg-slate-50/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em] mb-1.5">
                              Organization Workspace
                            </p>
                            <p className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                              {org.name}
                              {org.isActive && <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />}
                            </p>
                          </div>
                          <Badge
                            className={
                              org.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 font-bold text-[10px] uppercase tracking-wider"
                                : "bg-slate-100 text-slate-500 border-slate-200 px-3 py-1 font-bold text-[10px] uppercase tracking-wider"
                            }
                          >
                            {org.isActive ? "Active Workspace" : "Inactive"}
                          </Badge>
                        </div>

                        <div className="p-5 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/30 to-white shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-6 relative overflow-hidden group">
                          <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-violet-500/5 blur-xl rounded-full" />
                          <div className="relative">
                            <p className="text-[10px] text-violet-400 font-bold uppercase tracking-[0.15em] mb-1.5">
                              Current Plan
                            </p>
                            <div className="flex items-center gap-3">
                              <p className="font-black text-slate-900 text-xl tracking-tight">
                                {hasSubscription
                                  ? "Posture OS Pro"
                                  : "Free Tier"}
                              </p>
                              {hasSubscription && (
                                <div className="flex items-center gap-1.5 bg-emerald-100/50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                  <Check className="w-3 h-3" /> Professional
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-2.5 flex items-center gap-2 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Cycle: {hasSubscription ? "Monthly" : "No active subscription"}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/settings")}
                            className="bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50 h-10 px-4 shadow-sm relative z-10"
                          >
                            <Settings className="w-4 h-4 mr-2 text-violet-500" />
                            Manage Plan
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="p-8 text-center rounded-2xl border border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center">
                        <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                          <Users className="w-7 h-7 text-violet-600" />
                        </div>
                        <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                          Enterprise Managed
                        </h3>
                        <p className="text-sm text-slate-500 mt-2.5 max-w-sm leading-relaxed font-medium">
                          You are currently a member of <span className="text-slate-900 font-bold">{org.name}</span>.
                          Billing and workspace limits are managed centrally.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-6 md:p-10 text-center rounded-2xl border-2 border-dashed border-violet-100 bg-violet-50/30 flex flex-col items-center">
                      <div className="bg-violet-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-white shadow-xl shadow-violet-200">
                        <Key className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                        Join a Workspace
                      </h3>
                      <p className="text-sm text-slate-500 mt-2 mb-8 max-w-sm leading-relaxed font-medium">
                        Enter an invite code from your administrator to unlock team features and shared credits.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm">
                        <Input
                          placeholder="CODE-HERE"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value)}
                          className="bg-white border-slate-200 font-mono tracking-widest uppercase h-11"
                          disabled={isJoining}
                        />
                        <Button
                          className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 h-11 px-8 font-bold active:scale-95 transition-all"
                          onClick={handleJoinOrg}
                          disabled={isJoining || !inviteCode.trim()}
                        >
                          {isJoining ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          Join Team
                        </Button>
                      </div>
                      {joinError && (
                        <div className="mt-4 bg-rose-50 text-rose-600 text-xs font-bold py-2 px-4 rounded-full border border-rose-100">
                          {joinError}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Payment Methods (Only for Admins) */}
            {user.role === "ADMIN" && (
              <Card className="shadow-sm border-slate-200 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 blur-3xl rounded-full" />
                <CardHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-slate-700" />
                    <CardTitle className="text-base font-bold text-slate-900">Payment Methods</CardTitle>
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    Manage cards linked to your organization workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {org?.hasSubscription ? (
                      <div className="p-5 rounded-2xl border border-slate-100 bg-white flex items-center justify-between group hover:border-violet-100 transition-all shadow-sm">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg flex flex-col items-center justify-center border border-slate-700 shadow-md">
                            <span className="text-[10px] font-black tracking-widest text-white italic opacity-80 mb-0.5">
                              VISA
                            </span>
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">
                              Visa ending in •••• 4242
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                              Expires 12 / 2026
                            </p>
                          </div>
                        </div>
                        <Badge
                          className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-black uppercase tracking-widest px-2.5"
                        >
                          Default
                        </Badge>
                      </div>
                    ) : (
                      <div className="p-6 rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/50 text-center flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center mb-2">
                          <CreditCard className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">No Payment Methods</p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="bg-slate-50/50 border-t border-slate-100 flex justify-end p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/settings")}
                    className="text-violet-600 font-extrabold text-xs uppercase tracking-widest hover:bg-violet-50 hover:text-violet-700"
                  >
                    Update via Razorpay
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
