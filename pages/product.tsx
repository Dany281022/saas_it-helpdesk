"use client";

import React, { useState, useEffect } from "react";
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * Component displayed when the user does not have a Premium subscription.
 * Requirement: Step 7b - Subscription Gate
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-3xl font-bold mb-4 text-gray-800">
      Premium Access Required
    </h2>
    <p className="text-gray-600 mb-8 max-w-md mx-auto">
      The AI Ticket Resolver is a premium feature. Please subscribe to our 
      <strong> Premium Plan</strong> to generate automated resolution reports.
    </p>
    <PricingTable />
  </div>
);

function TicketForm() {
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  // Step 5 - Form State Management (Controlled Components)
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState("");

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill reporter name once Clerk loads the user profile
  useEffect(() => {
    if (isLoaded && user?.fullName) {
      setReportedBy(user.fullName);
    }
  }, [isLoaded, user]);

  /**
   * Step 6 - Connect Frontend to Backend
   * Handles the streaming response from FastAPI
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setLoading(true);

    const jwt = await getToken();

    if (!jwt) {
      setOutput("Error: Authentication required.");
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
        // Mapping camelCase (frontend) to snake_case (backend)
        ticket_id: ticketId,
        reported_by: reportedBy,
        issue_category: issueCategory,
        submitted_date: submittedDate?.toISOString().split("T")[0], // YYYY-MM-DD
        issue_description: issueDescription,
      }),

      onmessage(ev) {
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }

        // Optimization: append chunks directly to maintain Markdown flow
        // The backend already handles line breaks for headers and lists
        setOutput((prev) => prev + ev.data);
      },

      onclose() {
        setLoading(false);
      },

      onerror(err) {
        console.error("SSE Error:", err);
        controller.abort();
        setLoading(false);
        setOutput((prev) => prev + "\n\n**Error:** The stream was interrupted.");
      },
    });
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-4">
          <span className="bg-indigo-100 p-2 rounded-lg">🛠️</span> IT Ticket Resolver
        </h1>
        <p className="text-gray-500 mt-2">Automated Incident Analysis & Resolution Guides</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-700">Ticket ID</label>
            <input
              type="text"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="e.g. TKT-2024-001"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-700">Reported By</label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-700">Issue Category</label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="p-3 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            >
              <option value="Network">Network</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Access">Access</option>
              <option value="Email">Email</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-700">Submission Date</label>
            <DatePicker
              selected={submittedDate}
              onChange={(date) => setSubmittedDate(date)}
              className="p-3 border border-gray-300 rounded-xl w-full focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              dateFormat="yyyy-MM-dd"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-bold mb-2 text-gray-700">Issue Description</label>
          <textarea
            required
            rows={6}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder="Provide a detailed description of the technical incident..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all ${
            loading 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Incident...
            </span>
          ) : "Generate AI Resolution"}
        </button>
      </form>

      {/* Step 6 - Display Streaming Output */}
      {output && (
        <section className="mt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-slate-900 px-8 py-5 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white tracking-wide uppercase">
                AI Analysis Report
              </h2>
              {loading && (
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                  </span>
                  <span className="text-indigo-300 text-xs font-medium">Streaming</span>
                </div>
              )}
            </div>

            <div className="p-8 md:p-12">
              <div className="prose prose-slate prose-headings:text-indigo-900 prose-strong:text-indigo-700 max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {output}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400 mt-8 uppercase tracking-[0.2em]">
            Enterprise Grade AI Solution • Support Operations
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Main Product Page
 * Requirement: Step 7 - Authentication and Subscription Gate
 */
export default function Product() {
  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      {/* User profile button */}
      <div className="fixed top-6 right-6 z-50 bg-white p-1 rounded-full shadow-md border">
        <UserButton showName />
      </div>

      <Protect
        plan="premium_subscription"
        fallback={<PricingFallback />}
      >
        <TicketForm />
      </Protect>
    </main>
  );
}