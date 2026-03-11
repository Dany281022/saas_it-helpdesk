"use client";

import React, { useState } from "react";
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// -----------------------------
// Fallback si l'utilisateur n'a pas le plan Premium
// -----------------------------
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-3xl font-bold mb-4 text-gray-800">🚀 Débloquez la puissance de l'IA</h2>
    <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
      L'accès à l'IT Ticket Resolver est réservé à nos membres Premium. 
      Choisissez un plan ci-dessous pour commencer à résoudre vos tickets en quelques secondes.
    </p>
    <PricingTable />
  </div>
);

// -----------------------------
// TicketForm
// -----------------------------
function TicketForm() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  // Assurer que l'utilisateur est chargé
  if (!isLoaded) return <p className="text-center py-10 text-gray-500">Loading user...</p>;

  const [ticketId, setTicketId] = useState<string>("");
  const [reportedBy, setReportedBy] = useState<string>(user?.fullName || "");
  const [issueCategory, setIssueCategory] = useState<string>("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  // Soumission du formulaire
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setLoading(true);

    const jwt = await getToken();
    if (!jwt) {
      setOutput("Authentication required.");
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
        submitted_date: submittedDate?.toISOString().split("T")[0],
        issue_description: issueDescription,
      }),
      onmessage(ev) {
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }
        setOutput((prev) => prev + ev.data + "\n"); // newline pour Markdown
      },
      onclose() {
        setLoading(false);
      },
      onerror(err) {
        console.error("SSE Error:", err);
        controller.abort();
        setLoading(false);
      },
    });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 flex items-center justify-center gap-3">
        <span>🛠️</span> IT Ticket Resolver
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ticket ID */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Ticket ID</label>
            <input
              type="text"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. TKT-20240312-001"
            />
          </div>

          {/* Reported By */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Reported By</label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Name or employee ID"
            />
          </div>

          {/* Issue Category */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Issue Category</label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="Network">Network</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Access">Access</option>
              <option value="Email">Email</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Submission Date */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Submission Date</label>
            <DatePicker
              selected={submittedDate}
              onChange={(date) => setSubmittedDate(date)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-full"
              dateFormat="yyyy-MM-dd"
            />
          </div>
        </div>

        {/* Issue Description */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-1 text-gray-700">Issue Description</label>
          <textarea
            required
            rows={8}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe the problem in detail..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-all disabled:opacity-50"
        >
          {loading ? "Analyzing Ticket..." : "Get AI Solution"}
        </button>
      </form>

      {/* AI Output */}
      {output && (
        <section className="mt-8 bg-white rounded-xl shadow-2xl border-t-8 border-indigo-600 overflow-hidden">
          <div className="bg-indigo-50 p-4 border-b border-indigo-100">
            <h2 className="text-xl font-bold text-indigo-800 uppercase">📋 AI Resolution Output</h2>
          </div>
          <div className="p-8 prose prose-indigo max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}

// -----------------------------
// Product Page
// -----------------------------
export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* User Button */}
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* Protect Premium */}
      <Protect plan="premium_subscription" fallback={<PricingFallback />}>
        <TicketForm />
      </Protect>
    </main>
  );
}