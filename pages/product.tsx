"use client";

import React, { useState } from "react";
// Étape 1 : Ajoute "useUser" dans l'import de Clerk
import { useAuth, Protect, UserButton, useUser } from "@clerk/nextjs"; 
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ... (Garde tes composants PricingTable et TicketResolverForm identiques) ...

export default function Product() {
  // Étape 2 : Récupère l'objet user pour accéder aux Metadata
  const { user } = useUser(); 

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-10 pb-20">
      <div className="absolute top-4 right-4">
        <UserButton showName={true} afterSignOutUrl="/" />
      </div>
      
      {/* Étape 3 : Utilise une condition plus flexible */}
      <Protect 
        condition={(has) => 
          has({ role: "Premium" }) || 
          user?.publicMetadata?.role === "Premium" || 
          user?.publicMetadata?.plan === "premium_subscription"
        }
        fallback={<PricingTable />}
      >
        <TicketForm />
      </Protect>
    </main>
  );
}

function TicketForm() {
    return <TicketResolverForm />;
}