"use client";

import React, { useState, useEffect } from "react";
import {
  useAuth,
  UserButton,
  useUser,
  Protect,
  PricingTable,
} from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * Affiche quand l'utilisateur n'a PAS d'abonnement Premium
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">
      Abonnement Premium requis
    </h2>
    <p className="text-gray-600 mb-8">
      Vous devez avoir un abonnement <strong>Premium</strong> actif pour utiliser
      le Résolveur de Tickets IA.
    </p>
    <PricingTable />
  </div>
);

function TicketForm() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  // États du formulaire
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState("");

  // États de la réponse IA
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // Pré-remplir le nom de l'utilisateur connecté via Clerk
  useEffect(() => {
    if (isLoaded && user?.fullName) {
      setReportedBy(user.fullName);
    }
  }, [isLoaded, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setOutput("");
    setLoading(true);

    const jwt = await getToken();

    if (!jwt) {
      setOutput("Authentification requise.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    await fetchEventSource("/api", {
      method: "POST",
      signal: controller.signal,

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },

      body: JSON.stringify({
        ticket_id: ticketId,
        reported_by: reportedBy,
        issue_category: issueCategory,
        submitted_date: submittedDate?.toISOString().split("T")[0] ?? "",
        issue_description: issueDescription,
      }),

      onmessage(ev) {
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }

        if (ev.data && ev.data.trim() !== "") {
          // On ajoute le chunk brut → préserve les \n, indentations, markdown
          setOutput((prev) => prev + ev.data);
        }
      },

      onclose() {
        setLoading(false);
      },

      onerror(err) {
        console.error("Erreur SSE :", err);
        controller.abort();
        setLoading(false);
      },
    });

    // Optionnel : reset du formulaire après succès
    // setTicketId("");
    // setIssueDescription("");
    // setSubmittedDate(new Date());
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Chargement...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 flex items-center justify-center gap-3">
        <span>🛠️</span> Résolveur de Tickets IA
      </h1>

      {/* Formulaire */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Ticket ID
            </label>
            <input
              type="text"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex. TKT-20240312-001"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Signalé par
            </label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Catégorie
            </label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="p-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Network">Réseau</option>
              <option value="Hardware">Matériel</option>
              <option value="Software">Logiciel</option>
              <option value="Access">Accès</option>
              <option value="Email">Courriel</option>
              <option value="Other">Autre</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Date de soumission
            </label>
            <DatePicker
              selected={submittedDate}
              onChange={(date) => setSubmittedDate(date)}
              className="p-2 border rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
              dateFormat="yyyy-MM-dd"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-1 text-gray-700">
            Description du problème
          </label>
          <textarea
            required
            rows={8}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Décrivez le problème en détail..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-6 text-white font-bold rounded-lg transition-colors ${
            loading
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "Analyse en cours..." : "Obtenir la solution IA"}
        </button>
      </form>

      {/* Résultat IA */}
      {output && (
        <section className="mt-12 max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
            <div className="bg-gray-50 px-8 py-6 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Rapport de résolution
              </h2>
              {loading && (
                <span className="animate-pulse text-indigo-500 text-sm">
                  Génération en cours...
                </span>
              )}
            </div>

            <div className="p-8 md:p-10 prose prose-slate max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {output}
              </ReactMarkdown>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6 uppercase tracking-widest">
            Généré par l'IA TechFix
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Page principale protégée par abonnement
 */
export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="absolute top-4 right-4 z-10">
        <UserButton showName />
      </div>

      <Protect plan="premium_subscription" fallback={<PricingFallback />}>
        <TicketForm />
      </Protect>
    </main>
  );
}
