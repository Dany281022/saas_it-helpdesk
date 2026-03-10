"use client";

import Head from "next/head";
import Link from "next/link";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

/**
 * Landing Page de l'application TechFix AI.
 * Présente les fonctionnalités et gère l'accès au dashboard (Step 7 & 8).
 */
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Head>
        <title>IT Help Desk | AI Ticket Resolver</title>
        <meta
          name="description"
          content="AI-powered IT support assistant that analyzes technical issues, provides diagnostics, and step-by-step resolution guides."
        />
      </Head>

      <div className="container mx-auto px-4 py-12">
        {/* Navigation */}
        <nav className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🛠️</span>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 tracking-tight">
              TechFix AI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link
                href="/product"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-all shadow-md active:scale-95"
              >
                Go to Dashboard
              </Link>
              <UserButton 
                showName={true} 
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonBox: "hover:opacity-80 transition-opacity"
                  }
                }}
              />
            </SignedIn>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="text-center py-16">
          <h2 className="text-5xl md:text-7xl font-extrabold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent mb-8 leading-tight">
            Solve IT Issues
            <br className="hidden md:block" />
            In Seconds, Not Hours
          </h2>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Notre assistant IA analyse vos tickets techniques pour générer 
            des diagnostics précis et des guides de résolution étape par étape instantanément.
          </p>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {/* Card 1 - Diagnostic */}
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-600 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Smart Diagnostics
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Analyse immédiate de la cause racine pour les pannes matérielles, logicielles et réseau.
                </p>
              </div>
            </div>

            {/* Card 2 - Guides */}
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-600 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div className="text-4xl mb-4">📜</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Resolution Guides
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Instructions claires et numérotées pour réparer sans attendre l'intervention d'un technicien.
                </p>
              </div>
            </div>

            {/* Card 3 - Priority */}
            <div className="relative group">
              <div className="absolute inset-0 bg-teal-600 rounded-2xl blur opacity-10 group-hover:opacity-20 transition duration-300"></div>
              <div className="relative bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 h-full">
                <div className="text-4xl mb-4">⚡</div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Priority Gating
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Gestion automatique des priorités basée sur l'impact business et la sévérité de l'incident.
                </p>
              </div>
            </div>
          </div>

          {/* Main CTA */}
          <div className="flex flex-col items-center gap-6">
            <Link
              href="/product"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-5 px-12 rounded-2xl text-xl transition-all transform hover:scale-105 shadow-2xl hover:shadow-indigo-200 dark:hover:shadow-none"
            >
              Resolve a Ticket Now
            </Link>
            
            <SignedOut>
              <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 px-4 py-1.5 rounded-full font-medium">
                🔒 Authentification requise pour accéder au résolveur
              </p>
            </SignedOut>
          </div>
        </div>

        {/* Footer info */}
        <footer className="mt-20 border-t border-gray-200 dark:border-gray-700 pt-8 text-center">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-gray-400 dark:text-gray-500">
            Enterprise Grade • ITIL Compliant • Powered by GPT-4o
          </div>
        </footer>
      </div>
    </main>
  );
}