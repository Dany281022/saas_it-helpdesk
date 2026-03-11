"use client";

import React, { useState } from "react";
import { UserButton, Protect, PricingTable } from "@clerk/nextjs";

/**
 * 1. TON COMPOSANT FORMULAIRE (Inclus dans le même fichier)
 */
function TicketResolverForm() {
  // Ici, tu as probablement tes useState et tes fonctions handle
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6">IT Ticket Resolver</h1>
      {/* Ton formulaire (Champs, bouton, résultat IA) se trouve ici */}
      <p className="text-gray-500 italic">Le formulaire est prêt à être utilisé.</p>
    </div>
  );
}

/**
 * 2. COMPOSANT FALLBACK (Pour le TODO du prof)
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-3xl font-bold text-gray-800 mb-4">
      🚀 Accès Premium Requis
    </h2>
    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
      L'outil d'analyse IA IT Ticket Resolver est réservé aux membres Premium. 
      Veuillez choisir un plan pour continuer.
    </p>
    <PricingTable />
  </div>
);

/**
 * 3. LA PAGE PRINCIPALE (Export par défaut)
 */
export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-10 pb-20">
      {/* Bouton profil utilisateur */}
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* CONSIGNE 7b : Protection de la page */}
      <Protect
        plan="premium_subscription"
        fallback={<PricingFallback />}
      >
        {/* On appelle directement la fonction définie plus haut */}
        <TicketResolverForm />
      </Protect>
    </main>
  );
}
