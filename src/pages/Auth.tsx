import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Heart, Mail, Lock, User, ArrowLeft, Shield, UserCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiLogin, saveAuthToStorage } from "@/lib/connectCareApi";
import { supabase, SUPABASE_ENABLED, supabaseSignIn, supabaseSignUp } from "@/lib/supabase";


type Role = "PATIENT" | "CARETAKER";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [role, setRole] = useState<Role>("PATIENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ── Tier 1: Supabase Auth (cloud — real persistent accounts) ──────────
      if (SUPABASE_ENABLED) {
        if (isSignUp) {
          const { user } = await supabaseSignUp(email, password, name || email.split("@")[0], role);
          if (user) {
            saveAuthToStorage({ user_id: user.id, role, name: name || email.split("@")[0], token: '', permissions: [] });
            toast({ title: `Account created!`, description: `Welcome, ${name || email}! Signed up as ${role}.` });
            navigate(role === "CARETAKER" ? "/caretaker" : "/dashboard");
            return;
          }
        } else {
          const { user, session } = await supabaseSignIn(email, password);
          if (user && session) {
            const userRole = (user.user_metadata?.role as "PATIENT" | "CARETAKER") ?? role;
            const userName = (user.user_metadata?.name as string) ?? email.split("@")[0];
            saveAuthToStorage({ user_id: user.id, role: userRole, name: userName, token: session.access_token, permissions: [] });
            toast({ title: `Welcome back, ${userName}!`, description: `Signed in as ${userRole}` });
            navigate(userRole === "CARETAKER" ? "/caretaker" : "/dashboard");
            return;
          }
        }
      }

      // ── Tier 2: Backend JWT ───────────────────────────────────────────────
      const userId = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const displayName = name || email.split("@")[0];
      const authUser = await apiLogin(userId, role, displayName);
      saveAuthToStorage(authUser);
      toast({ title: `Welcome, ${authUser.name}!`, description: `Signed in as ${authUser.role}` });
      navigate(authUser.role === "CARETAKER" ? "/caretaker" : "/dashboard");
    } catch {
      // ── Tier 3: Demo mode (offline fallback) ─────────────────────────────
      const userId = email.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const fallbackUser = { user_id: userId, role, name: name || email.split("@")[0], token: "demo-token", permissions: [] };
      saveAuthToStorage(fallbackUser);
      toast({ title: "Demo Mode", description: "Signed in locally — backend/Supabase offline." });
      navigate(role === "CARETAKER" ? "/caretaker" : "/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold">MedConnect</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? "Join Connect Care to monitor and protect your health"
                : "Sign in to your health companion"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="Your full name"
                      className="pl-10"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Role selector — always visible */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Shield className="h-3 w-3 text-indigo-500" /> I am a…
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("PATIENT")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-semibold transition-all duration-200 ${role === "PATIENT"
                      ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 text-slate-500 hover:border-blue-300"
                      }`}
                  >
                    <UserCheck className="h-5 w-5" />
                    Patient
                    {role === "PATIENT" && (
                      <span className="text-[10px] text-blue-500">Selected ✓</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("CARETAKER")}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-sm font-semibold transition-all duration-200 ${role === "CARETAKER"
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm"
                      : "border-slate-200 text-slate-500 hover:border-indigo-300"
                      }`}
                  >
                    <Shield className="h-5 w-5" />
                    Caretaker
                    {role === "CARETAKER" && (
                      <span className="text-[10px] text-indigo-500">Selected ✓</span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {role === "PATIENT"
                    ? "Patients can upload reports, view vitals, and trigger SOS."
                    : "Caretakers can monitor linked patients, receive alerts, and override emergencies."}
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
                ) : (
                  isSignUp ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                onClick={() => setIsSignUp(s => !s)}
                className="font-medium text-primary hover:underline"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
