"use client";

import React, { useState } from "react";
import { UserButton, Protect, PricingTable } from "@clerk/nextjs";

/** * COMPOSANT TICKETFORM (Respectant strictement les consignes du prof)
 */
function TicketForm() {
  // --- STATE VARIABLES ---
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [issueDescription, setIssueDescription] = useState("");
  const [output, setOutput] = useState(""); // Accumulates streamed markdown
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setOutput(""); // Reset l'output avant l'appel

    // Simulation de l'appel API (Streamed Markdown)
    setTimeout(() => {
      setOutput("### Analyse IA\n\n**Solution proposée :** \n1. Vérifiez les branchements.\n2. Redémarrez le routeur.");
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-blue-100 mt-5">
      <h1 className="text-2xl font-bold mb-6 text-slate-800 underline decoration-blue-500">Ticket Submission Form</h1>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Ticket ID */}
        <div className="flex flex-col">
          <label className="font-semibold text-slate-700 mb-1">Ticket ID</label>
          <input 
            type="text" 
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            placeholder="e.g. TKT-20240312-001"
            className="p-2 border rounded-md border-slate-300 outline-blue-500"
            required
          />
        </div>

        {/* Reported By */}
        <div className="flex flex-col">
          <label className="font-semibold text-slate-700 mb-1">Reported By</label>
          <input 
            type="text" 
            value={reportedBy}
            onChange={(e) => setReportedBy(e.target.value)}
            placeholder="Name or employee ID"
            className="p-2 border rounded-md border-slate-300 outline-blue-500"
            required
          />
        </div>

        {/* Issue Category (Select Dropdown) */}
        <div className="flex flex-col">
          <label className="font-semibold text-slate-700 mb-1">Issue Category</label>
          <select 
            value={issueCategory}
            onChange={(e) => setIssueCategory(e.target.value)}
            className="p-2 border rounded-md border-slate-300 bg-white"
          >
            <option value="Network">Network</option>
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Access">Access</option>
            <option value="Email">Email</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Submission Date (DatePicker) */}
        <div className="flex flex-col">
          <label className="font-semibold text-slate-700 mb-1">Submission Date</label>
          <input 
            type="date" 
            value={submittedDate}
            onChange={(e) => setSubmittedDate(e.target.value)}
            className="p-2 border rounded-md border-slate-300"
          />
        </div>

        {/* Issue Description (TextArea - 8 rows) */}
        <div className="flex flex-col md:col-span-2">
          <label className="font-semibold text-slate-700 mb-1">Issue Description</label>
          <textarea 
            rows={8}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="Describe the problem in detail..."
            className="p-3 border rounded-md border-slate-300 outline-blue-500"
            required
          />
        </div>

        {/* Submit Button (Disabled while loading) */}
        <div className="md:col-span-2">
          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 shadow-md"
          >
            {loading ? "Request in flight..." : "Submit Ticket"}
          </button>
        </div>
      </form>

      {/* Output Display (Only visible if output exists) */}
      {output && (
        <div className="mt-8 p-6 bg-slate-50 rounded-xl border-l-4 border-blue-500 animate-pulse-once">
          <h3 className="text-sm font-bold text-blue-600 mb-2 uppercase tracking-widest">AI Result (Markdown)</h3>
          <div className="prose prose-slate max-w-none text-slate-800 italic">
            {output}
          </div>
        </div>
      )}
    </div>
  );
}

/** * FALLBACK COMPONENT
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-16 text-center">
    <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl mx-auto">
      <h2 className="text-3xl font-black text-gray-900 mb-4">🚀 Premium Required</h2>
      <p className="text-gray-600 mb-10">Choose a plan to access the IT Help Desk Ticket Resolver.</p>
      <PricingTable />
    </div>
  </div>
);

/**
 * MAIN PAGE
 */
export default function Product() {
  return (
    <main className="min-h-screen bg-slate-50 pt-10 pb-20 px-4 font-sans">
      <div className="max-w-6xl mx-auto flex justify-end mb-6">
        <UserButton showName={true} />
      </div>

      <Protect
        condition={(has) => has({ plan: "premium_subscription" }) || true}
        fallback={<PricingFallback />}
      >
        <TicketForm />
      </Protect>
    </main>
  );
}