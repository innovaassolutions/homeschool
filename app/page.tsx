"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      </AuthLoading>

      <Authenticated>
        <PageContent isAuthenticated={true} />
      </Authenticated>

      <Unauthenticated>
        <PageContent isAuthenticated={false} />
      </Unauthenticated>
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
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn-secondary text-lg px-8 py-3">
                Create Account
              </Link>
            </>
          )}
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
