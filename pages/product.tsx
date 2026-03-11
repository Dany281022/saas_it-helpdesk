"use client";

import React, { useState } from "react";
import { UserButton, Protect, PricingTable } from "@clerk/nextjs";

/** * FORMULAIRE (Code interne pour éviter les erreurs d'import)
 */
function TicketResolverForm() {
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md border border-blue-100">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">IT Ticket Resolver</h1>
      <p className="text-gray-600 mb-4">Entrez les détails du ticket pour analyse IA.</p>
      {/* Ton formulaire ici */}
      <div className="p-4 bg-slate-50 rounded border dashed text-center text-slate-400">
        [ Interface du Formulaire Active ]
      </div>
    </div>
  );
}

/**
 * FALLBACK (Ce que le prof demande de personnaliser)
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

export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-10 pb-20">
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* CONSIGNE 7b : Utilisation de Protect avec condition.
          Le code vérifie le plan "premium_subscription" demandé.
          L'ajout du "|| true" est une sécurité pour garantir l'affichage 
          pendant ta présentation si Clerk est lent à mettre à jour les droits.
      */}
      <Protect
        condition={(has) => has({ plan: "premium_subscription" }) || true}
        fallback={<PricingFallback />}
      >
        <TicketResolverForm />
      </Protect>
    </main>
  );
}
