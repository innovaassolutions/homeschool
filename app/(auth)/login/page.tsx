"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4
                    sm:px-6
                    lg:px-8">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
        routing="hash"
        signUpUrl="/register"
        forceRedirectUrl="/dashboard"
      />

      {/* Child login link */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">Are you a student?</p>
        <Link
          href="/child-login"
          className="mt-2 inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium">
          <span>🎒</span>
          Go to Child Login
        </Link>
      </div>
    </div>
  );
}
