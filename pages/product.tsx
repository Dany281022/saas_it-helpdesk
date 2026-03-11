"use client";

import React, { useState } from "react";
import { UserButton, useUser, SignInButton } from "@clerk/nextjs";

/** * 1. LE FORMULAIRE (Visible uniquement pour les Premium)
 */
function TicketForm() {
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().split('T')[0]);
  const [issueDescription, setIssueDescription] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulation du stream
    const msg = "### Analyse IA en cours...\n\nLe système vérifie la catégorie " + issueCategory;
    setOutput(msg);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-blue-100 mt-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800 border-b pb-4">New IT Ticket Submission</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input type="text" value={ticketId} onChange={(e)=>setTicketId(e.target.value)} placeholder="Ticket ID" className="p-2 border rounded" />
          <input type="text" value={reportedBy} onChange={(e)=>setReportedBy(e.target.value)} placeholder="Reported By" className="p-2 border rounded" />
          <select value={issueCategory} onChange={(e)=>setIssueCategory(e.target.value)} className="p-2 border rounded">
            <option>Network</option><option>Hardware</option><option>Software</option>
          </select>
          <input type="date" value={submittedDate} onChange={(e)=>setSubmittedDate(e.target.value)} className="p-2 border rounded" />
        </div>
        <textarea rows={8} value={issueDescription} onChange={(e)=>setIssueDescription(e.target.value)} placeholder="Issue Description" className="w-full p-2 border rounded" />
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
          {loading ? "Chargement..." : "Analyser le Ticket"}
        </button>
      </form>
      {output && <div className="mt-6 p-4 bg-slate-50 rounded border font-mono">{output}</div>}
    </div>
  );
}

/** * 2. TON PROPRE COMPOSANT DE SOUSCRIPTION (Le Paywall)
 */
const CustomSubscriptionPage = () => (
  <div className="max-w-4xl mx-auto mt-16 p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center">
    <div className="mb-6 inline-block p-4 bg-blue-50 rounded-full">
      <span className="text-4xl">🚀</span>
    </div>
    <h2 className="text-4xl font-black text-slate-900 mb-4">Passez au niveau supérieur</h2>
    <p className="text-xl text-gray-600 mb-10">
      L'analyse IA en temps réel est une fonctionnalité exclusive. 
      Choisissez le plan qui vous convient pour débloquer cet outil.
    </p>
    
    <div className="grid md:grid-cols-2 gap-8">
      {/* Carte Plan Gratuit */}
      <div className="p-8 border rounded-2xl bg-gray-50 opacity-60">
        <h3 className="text-lg font-bold">Plan Basique</h3>
        <p className="text-3xl font-black my-4">0€ <span className="text-sm text-gray-500">/mois</span></p>
        <ul className="text-sm text-gray-600 mb-6 space-y-2 text-left">
          <li>✓ Consultation des tickets</li>
          <li>✗ Analyse IA illimitée</li>
        </ul>
        <button disabled className="w-full py-2 bg-gray-300 rounded-lg cursor-not-allowed">Plan actuel</button>
      </div>

      {/* Carte Plan Premium */}
      <div className="p-8 border-2 border-blue-500 rounded-2xl bg-blue-50 relative">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs py-1 px-3 rounded-full font-bold uppercase">Recommandé</span>
        <h3 className="text-lg font-bold text-blue-900">Plan Premium</h3>
        <p className="text-3xl font-black my-4 text-blue-900">19€ <span className="text-sm text-blue-500">/mois</span></p>
        <ul className="text-sm text-blue-700 mb-6 space-y-2 text-left font-medium">
          <li>✓ Analyse IA ultra-rapide</li>
          <li>✓ Support prioritaire 24/7</li>
          <li>✓ Exportation des rapports</li>
        </ul>
        <button 
          onClick={() => window.location.href = 'https://buy.stripe.com/test_ton_lien'} 
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition"
        >
          Souscrire maintenant
        </button>
      </div>
    </div>
  </div>
);

/** * 3. LOGIQUE PRINCIPALE
 */
export default function Product() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <div className="text-center mt-20">Chargement...</div>;

  // Si pas connecté, on demande de se connecter
  if (!isSignedIn) {
    return (
      <div className="text-center mt-20">
        <h2 className="text-2xl font-bold mb-4">Veuillez vous connecter</h2>
        <SignInButton mode="modal">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg">Connexion</button>
        </SignInButton>
      </div>
    );
  }

  // LOGIQUE DE VÉRIFICATION PREMIUM
  // On vérifie si l'utilisateur a le badge "premium_subscription"
  const isPremium = user?.publicMetadata?.plan === "premium_subscription";

  return (
    <main className="min-h-screen bg-slate-50 pt-10 pb-20 px-4">
      <div className="max-w-6xl mx-auto flex justify-end mb-8">
        <UserButton showName={true} />
      </div>

      {/* Affichage conditionnel sans passer par le composant <Protect> rigide */}
      {isPremium ? (
        <TicketForm />
      ) : (
        <CustomSubscriptionPage />
      )}
    </main>
  );
}
