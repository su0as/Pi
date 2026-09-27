"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type Step = "email" | "otp";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setPending(false);
    if (sendError) {
      setError(sendError.message ?? "Couldn't send a code. Try again.");
      return;
    }
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: verifyError } = await authClient.signIn.emailOtp({ email, otp });
    setPending(false);
    if (verifyError) {
      setError(verifyError.message ?? "That code didn't work.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-4">
      <h1 className="font-serif text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No passwords — we email you a one-time code.
      </p>

      {step === "email" ? (
        <form onSubmit={sendOtp} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border-input bg-background rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {email}.</p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            className="border-input bg-background rounded-lg border px-3 py-2 text-center text-lg tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Sign in"}
          </Button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Use a different email
          </button>
        </form>
      )}
    </main>
  );
}
