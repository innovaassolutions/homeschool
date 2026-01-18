"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <SignedIn>
        <PageContent isAuthenticated={true} />
      </SignedIn>

      <SignedOut>
        <PageContent isAuthenticated={false} />
      </SignedOut>
    </main>
  );
}

function PageContent({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900
                       sm:text-5xl
                       md:text-6xl">
          Homeschool Learning Platform
        </h1>
        <p className="mt-4 text-xl text-gray-600
                      sm:text-2xl">
          AI-powered tutoring that adapts to your child
        </p>
        <div className="mt-8 flex flex-col gap-4 justify-center
                        sm:flex-row">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="btn-primary text-lg px-8 py-3">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="btn-primary text-lg px-8 py-3">
                Parent Sign In
              </Link>
              <Link
                href="/register"
                className="btn-secondary text-lg px-8 py-3">
                Create Account
              </Link>
            </>
          )}
        </div>

        {/* Child Login - always visible */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-gray-500 mb-3">Are you a student?</p>
          <Link
            href="/child-login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500
                       text-white font-semibold rounded-xl hover:from-purple-600 hover:to-blue-600
                       transition-all shadow-md hover:shadow-lg">
            <span className="text-xl">🎒</span>
            Child Login
          </Link>
        </div>
      </div>

      <div className="mt-16 grid gap-8
                      md:grid-cols-3">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900">Age-Adaptive Learning</h3>
          <p className="mt-2 text-gray-600">
            Content and interface adapt to your child&apos;s age group for optimal engagement.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-gray-900">AI Tutoring</h3>
          <p className="mt-2 text-gray-600">
            Personalized conversations with an AI tutor that understands your child&apos;s learning style.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900">Progress Tracking</h3>
          <p className="mt-2 text-gray-600">
            Real-time progress updates and skill mastery tracking across all subjects.
          </p>
        </div>
      </div>
    </div>
  );
}
