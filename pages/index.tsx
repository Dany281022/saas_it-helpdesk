"use client";

import Head from "next/head";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Head>
        <title>IT Help Desk | Ticket Resolver</title>
        <meta
          name="description"
          content="AI-powered IT support assistant that analyzes technical issues, provides diagnostics, and step-by-step resolution guides."
        />
      </Head>

      <div className="container mx-auto px-4 py-12">
        {/* Navigation */}
        <nav className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛠️</span>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
              TechFix AI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-md">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/product"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors shadow-md"
              >
                Go to Dashboard
              </Link>
              <UserButton showName={true} />
            </SignedIn>
          </div>
        </nav>

        {/* Hero */}
        <div className="text-center py-16">
          <h2 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent mb-6">
            Solve IT Issues
            <br className="hidden md:block" />
            In Seconds, Not Hours
          </h2>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Our AI-powered Help Desk analyzes your technical tickets and generates 
            comprehensive diagnostics and step-by-step resolution guides instantly.
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            {/* Card 1 - Diagnostic */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm h-full">
                <div className="text-3xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  Smart Diagnostics
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Instant root-cause analysis for hardware, software, and network failures.
                </p>
              </div>
            </div>

            {/* Card 2 - Step-by-Step */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm h-full">
                <div className="text-3xl mb-4">📜</div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  Step-by-Step Guides
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Get clear, numbered instructions to fix issues without waiting for a technician.
                </p>
              </div>
            </div>

            {/* Card 3 - Priority Gating */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm h-full">
                <div className="text-3xl mb-4">⚡</div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                  Priority Management
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Automatically categorize and prioritize tickets based on business impact.
                </p>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/product"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition-all transform hover:scale-105 shadow-xl"
            >
              Resolve a Ticket Now
            </Link>
            
            <SignedOut>
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                * Authentication required to access the resolver
              </p>
            </SignedOut>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="text-center text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-8">
          <p>Enterprise Grade • ITIL Compliant • 24/7 AI Support</p>
        </div>
      </div>
    </main>
  );
}
