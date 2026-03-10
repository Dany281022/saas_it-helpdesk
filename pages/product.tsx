"use client";

import React, { useState } from "react";
import { useAuth, Protect, UserButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const PricingTable = () => (
  <div className="p-12 text-center border-2 border-dashed rounded-xl bg-gray-50 max-w-2xl mx-auto mt-20">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">Premium Plan Required</h2>
    <p className="text-gray-600 mb-6">
      You need an active subscription to use the AI Ticket Resolver.
    </p>
    <button className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
      Upgrade Now
    </button>
  </div>
);

function TicketResolverForm() {
  const { getToken, user } = useAuth();
  const [ticketId, setTicketId] = useState<string>("");
  const [reportedBy, setReportedBy] = useState<string>(user?.fullName || "");
  const [issueCategory, setIssueCategory] = useState<string>("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const formatOutput = (text: string) => {
    if (!text) return "";
    return text
      .replace(/###\s?/g, "\n\n### ")
      .replace(/(DIAGNOSTIC|SUMMARY|STEPS|RECOMMENDATION)([0-9]|[A-Z])/g, "$1\n\n$2")
      .replace(/(\d\.)\s?/g, "\n\n$1 ")
      .replace(/\s-\s/g, "\n\n- ")
      .replace(/(SUMMARY|RECOMMENDATION)\s+([A-Z])/g, "$1\n\n$2")
      .replace(/\n\n\n+/g, "\n\n")
      .trim();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput("");
    setLoading(true);

    try {
      const jwt = await getToken();
      if (!jwt) throw new Error("Authentication required");

      await fetchEventSource("/api", {
        method: "POST",
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
          console.error(err);
          setLoading(false);
        },
      });
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 flex items-center justify-center gap-3">
        <span>🛠️</span> IT Ticket Resolver
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Ticket ID</label>
            <input
              type="text"
              placeholder="Ex: TKT-20260310-001"
              required
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Reported By</label>
            <input
              type="text"
              placeholder="Your name"
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
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Submission Date</label>
            <DatePicker
              selected={submittedDate}
              onChange={(date) => setSubmittedDate(date)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              dateFormat="yyyy-MM-dd"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-1 text-gray-700">Issue Description</label>
          <textarea
            required
            rows={5}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe the technical issue..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Analyzing Ticket..." : "Get AI Solution"}
        </button>
      </form>

      {output && (
        <section className="mt-8 bg-white rounded-xl shadow-2xl border-t-8 border-indigo-600 overflow-hidden animate-in fade-in duration-500">
          <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex justify-between items-center">
            <h2 className="text-xl font-bold text-indigo-800 flex items-center gap-2 uppercase tracking-tight">
              <span>📋</span> IT Incident Report
            </h2>
            <span className="text-sm font-bold text-indigo-600 bg-white px-3 py-1 rounded-full shadow-sm">
              DATE: {new Date().toLocaleDateString()}
            </span>
          </div>

          <div className="p-8">
            <div className="prose prose-indigo max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatOutput(output)}</ReactMarkdown>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function Product() {
  return (
    <main className="min-h-screen bg-gray-50 pt-10 pb-20">
      <div className="absolute top-4 right-4">
        <UserButton afterSignOutUrl="/" />
      </div>
      <Protect fallback={<PricingTable />}>
        <TicketResolverForm />
      </Protect>
    </main>
  );
}
