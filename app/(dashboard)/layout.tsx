"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </AuthLoading>

      <Unauthenticated>
        <RedirectToLogin />
      </Unauthenticated>

      <Authenticated>
        <DashboardContent>{children}</DashboardContent>
      </Authenticated>
    </>
  );
}

function RedirectToLogin() {
  const router = useRouter();

  useEffect(() => {
    router.push("/login");
  }, [router]);

  return null;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { signOut } = useAuthActions();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4
                        sm:px-6
                        lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/dashboard" className="flex items-center">
                <span className="text-xl font-bold text-primary-600">Homeschool</span>
              </Link>
              <div className="hidden ml-10 space-x-8
                              sm:flex">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent
                             hover:border-gray-300">
                  Dashboard
                </Link>
                <Link
                  href="/status"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent
                             hover:border-gray-300 hover:text-gray-700">
                  Today&apos;s Status
                </Link>
                <Link
                  href="/ixl"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent
                             hover:border-gray-300 hover:text-gray-700">
                  IXL Progress
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 border-b-2 border-transparent
                             hover:border-gray-300 hover:text-gray-700">
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="text-sm font-medium text-gray-500
                           hover:text-gray-700">
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4
                       sm:px-6
                       lg:px-8">
        {children}
      </main>
    </div>
  );
}
