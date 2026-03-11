"use client";

import React, { useState } from "react";
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

/**
 * Component displayed when the user does not have a Premium subscription.
 * Uses Clerk's <PricingTable /> to handle monetization.
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">Premium Plan Required</h2>
    <p className="text-gray-600 mb-8">
      You need an active <strong>Premium</strong> subscription to use the AI Ticket Resolver.
    </p>
    <PricingTable />
  </div>
);

function TicketForm() {
  const { getToken } = useAuth();
  const { user } = useUser();

  // --- State Management ---
  const [ticketId, setTicketId] = useState<string>("");
  const [reportedBy, setReportedBy] = useState<string>(user?.fullName || "");
  const [issueCategory, setIssueCategory] = useState<string>("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Handles form submission and initiates Server-Sent Events (SSE) stream
   * to receive real-time AI analysis from the FastAPI backend.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setLoading(true);

    // Retrieve JWT token for backend authentication
    const jwt = await getToken();
    if (!jwt) {
      setOutput("Authentication required.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    // Fetch Event Source handles the streaming connection
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
        // [DONE] is the custom signal sent by FastAPI to close the stream
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }
        // Append incoming text chunks to the output state
        setOutput((prev) => prev + ev.data);
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

      {/* Ticket Submission Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* --- AI Output Section: Styled as a formal technical report --- */}
      {output && (
        <section className="mt-12 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Output Header */}
            <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">
                Resolution Report
              </h2>
              {/* Activity Indicator */}
              {loading && (
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                </span>
              )}
            </div>

            {/* Markdown Body using Tailwind Typography (prose) */}
            <div className="p-10 bg-white">
              <div className="prose prose-slate prose-headings:text-gray-900 prose-p:text-gray-600 prose-strong:text-gray-900 max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {output}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          
          <p className="text-center text-xs text-gray-400 mt-6 tracking-widest uppercase font-medium">
            Generated by TechFix AI Engine
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * Main Product Page. 
 * Wrapped in Clerk's <Protect> to enforce subscription-based access.
 */
export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* User profile button positioned in the top right */}
      <div className="absolute top-4 right-4">
        <UserButton showName={true} />
      </div>

      {/* Access Control Gate */}
      <Protect
        plan="premium_subscription"
        fallback={<PricingFallback />}
      >
        <TicketForm />
      </Protect>
    </main>
  );
}
