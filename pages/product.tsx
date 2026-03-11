"use client";

import React from "react";
import { UserButton, Protect, PricingTable } from "@clerk/nextjs";
// Correction de l'import : on pointe vers le fichier réel TicketResolverForm
import TicketForm from "@/components/TicketResolverForm";

/**
 * Composant PricingFallback
 * Répond au "TODO" du prof en ajoutant un titre et une description 
 * avant d'afficher la table des prix.
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
      {/* Profil utilisateur Clerk */}
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* CONSIGNE 7b : Protection de la page Produit
          On utilise <Protect> avec le plan "premium_subscription".
          Si l'utilisateur n'a pas ce plan, Clerk affiche le 'fallback'.
      */}
      <Protect
        plan="premium_subscription"
        fallback={<PricingFallback />}
      >
        {/* Visible uniquement pour les utilisateurs Premium */}
        <TicketForm />
      </Protect>
    </main>
  );
}