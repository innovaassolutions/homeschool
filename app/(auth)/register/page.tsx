"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [mounted, setMounted] = useState(false);
  const authActions = useAuthActions();
  const createFamily = useMutation(api.families.create);
  const router = useRouter();

  const [signUpComplete, setSignUpComplete] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [coppaConsent, setCoppaConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const signIn = authActions?.signIn;

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await signIn("password", { email, password, flow: "signUp" });
      setSignUpComplete(true);
    } catch (err) {
      console.error("Registration error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Could not create account: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!coppaConsent) {
      setError("You must consent to COPPA requirements to continue");
      return;
    }

    setLoading(true);

    try {
      console.log("Creating family...");
      await createFamily({ name: familyName, coppaConsent: true });
      console.log("Family created, redirecting...");
      router.push("/dashboard");
    } catch (err) {
      console.error("Family creation error:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Could not create family: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4
                    sm:px-6
                    lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your family account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Sign in
            </Link>
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center space-x-4">
          <div className={`flex items-center ${!signUpComplete ? "text-primary-600" : "text-gray-400"}`}>
            <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${!signUpComplete ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300"}`}>
              1
            </span>
            <span className="ml-2 text-sm font-medium">Account</span>
          </div>
          <div className="w-8 h-0.5 bg-gray-300"></div>
          <div className={`flex items-center ${signUpComplete ? "text-primary-600" : "text-gray-400"}`}>
            <span className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${signUpComplete ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300"}`}>
              2
            </span>
            <span className="ml-2 text-sm font-medium">Family</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!signUpComplete ? (
          <form className="mt-8 space-y-6" onSubmit={handleAccountSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500
                             sm:text-sm"
                  placeholder="parent@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500
                             sm:text-sm"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500
                             sm:text-sm"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                         hover:bg-primary-700">
              {loading ? "Creating account..." : "Continue"}
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleFamilySubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="familyName" className="block text-sm font-medium text-gray-700">
                  Family Name
                </label>
                <input
                  id="familyName"
                  name="familyName"
                  type="text"
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500
                             sm:text-sm"
                  placeholder="The Smith Family"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-900">COPPA Compliance</h3>
                <p className="mt-1 text-sm text-blue-700">
                  The Children&apos;s Online Privacy Protection Act (COPPA) requires parental consent
                  for children under 13. By checking this box, you confirm you are a parent or
                  guardian with authority to consent on behalf of any children who will use this
                  platform.
                </p>
                <div className="mt-3 flex items-start">
                  <input
                    id="coppaConsent"
                    name="coppaConsent"
                    type="checkbox"
                    checked={coppaConsent}
                    onChange={(e) => setCoppaConsent(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-1"
                  />
                  <label htmlFor="coppaConsent" className="ml-2 block text-sm text-blue-900">
                    I am the parent or guardian and I consent to my children using this platform
                    under my supervision.
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !coppaConsent}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
                         hover:bg-primary-700">
              {loading ? "Creating family..." : "Complete Registration"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
