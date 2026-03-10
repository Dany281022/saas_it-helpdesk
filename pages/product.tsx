"use client";

import React, { useState } from "react";
import { useAuth, UserButton, useUser, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PricingFallback = () => (
  <div className="px-4 py-12 text-center max-w-3xl mx-auto mt-10">
    <h2 className="text-2xl font-bold mb-2 text-gray-800">Premium Plan Required</h2>
    <p className="text-gray-600 mb-8">
      You need an active <strong>Premium</strong> subscription to use the AI Ticket Resolver.
    </p>
    <PricingTable />
  </div>
);

function TicketResolverForm() {
  const { getToken } = useAuth();
  const { user } = useUser();

  const [ticketId, setTicketId] = useState<string>("");
  const [reportedBy, setReportedBy] = useState<string>(user?.fullName || "");
  const [issueCategory, setIssueCategory] = useState<string>("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setLoading(true);

    const controller = new AbortController();

    try {
      const jwt = await getToken();
      if (!jwt) {
        setOutput("Authentication required. Please sign in.");
        setLoading(false);
        return;
      }

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
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
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
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Ticket ID</label>
            <input
              type="text"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ex: TKT-2026-001"
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
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Category</label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Network">Network</option>
              <option value="Access">Access/Identity</option>
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
            rows={6}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe the problem..."
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

export default function Product() {
  const { has, isLoaded } = useAuth();

  if (!isLoaded) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500 text-lg">Loading...</p>
    </div>
  );

  const hasPremium = has?.({ plan: "premium_subscription" });

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pt-10 pb-20">
      <div className="absolute top-4 right-4">
        <UserButton showName={true} afterSignOutUrl="/" />
      </div>

      {hasPremium ? <TicketResolverForm /> : <PricingFallback />}
    </main>
  );
}
