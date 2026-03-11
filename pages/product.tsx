"use client";

import React from "react";
import { UserButton, Protect, PricingTable } from "@clerk/nextjs";
import TicketForm from "@/components/TicketForm"; // Assure-toi que le nom du fichier correspond

export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-10 pb-20">
      {/* Bouton profil utilisateur en haut à droite */}
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* PROTECTION PAGE PRODUIT :
        On enveloppe le formulaire dans le composant <Protect>.
        Si l'utilisateur n'a pas le plan "premium_subscription", 
        on affiche le contenu du 'fallback' (la table de prix).
      */}
      <Protect
        plan="premium_subscription"
        fallback={
          <div className="container mx-auto px-4 py-12 text-center">
            {/* RÉPONSE AU TODO DU PROF : Titre et description de la barrière de paiement */}
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              🚀 Débloquez la puissance de l'IA
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              L'accès à l'IT Ticket Resolver est réservé à nos membres Premium. 
              Choisissez un plan ci-dessous pour commencer à résoudre vos tickets en quelques secondes.
            </p>
            
            <PricingTable />
          </div>
        }
      >
        {/* Ce composant n'est visible QUE si l'utilisateur est Premium */}
        <TicketForm />
      </Protect>
    </main>
  );
}