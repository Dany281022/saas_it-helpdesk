"use client";

import React, { useState, useEffect } from "react";
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


/**
 * Custom renderers for ReactMarkdown.
 *
 * WHY: Tailwind's `prose` class requires @tailwindcss/typography to style
 * markdown elements (h2, ul, ol, li, hr). Without it, ## headings render
 * as unstyled text, numbered lists lose their numbers, and bullet points
 * disappear. Rather than requiring a Tailwind plugin, we supply explicit
 * inline styles via these component overrides — zero extra dependencies.
 */
const markdownComponents = {
  // ## Section headings → bold, larger, with top spacing
  h2: ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "1.5rem", marginBottom: "0.5rem", color: "#1e293b" }}>
      {children}
    </h2>
  ),
  // Numbered lists — keep the numbers visible
  ol: ({ children }: { children: React.ReactNode }) => (
    <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem", marginBottom: "1rem" }}>
      {children}
    </ol>
  ),
  // Bullet lists — keep the dots visible
  ul: ({ children }: { children: React.ReactNode }) => (
    <ul style={{ listStyleType: "disc", paddingLeft: "1.5rem", marginBottom: "1rem" }}>
      {children}
    </ul>
  ),
  // List items — spacing between them
  li: ({ children }: { children: React.ReactNode }) => (
    <li style={{ marginBottom: "0.35rem" }}>{children}</li>
  ),
  // Horizontal rules (---) — visible separator
  hr: () => (
    <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "1.25rem 0" }} />
  ),
  // Strong/bold — slightly darker for contrast
  strong: ({ children }: { children: React.ReactNode }) => (
    <strong style={{ fontWeight: 700, color: "#0f172a" }}>{children}</strong>
  ),
  // Inline code (commands) — monospace with subtle background
  code: ({ children }: { children: React.ReactNode }) => (
    <code style={{ fontFamily: "monospace", backgroundColor: "#f1f5f9", padding: "0.1rem 0.35rem", borderRadius: "4px", fontSize: "0.85em" }}>
      {children}
    </code>
  ),
  // Paragraphs — comfortable line spacing
  p: ({ children }: { children: React.ReactNode }) => (
    <p style={{ marginBottom: "0.75rem", lineHeight: 1.7 }}>{children}</p>
  ),
};


/**
 * Displayed when user does NOT have a Premium subscription
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">
      Premium Plan Required
    </h2>
    <p className="text-gray-600 mb-8">
      You need an active <strong>Premium</strong> subscription to use the AI Ticket Resolver.
    </p>
    <PricingTable />
  </div>
);


function TicketForm() {

  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState("");

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

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

        // FIX: Decode the __NL__ delimiter back into real newlines.
        // The backend encodes \n as __NL__ to avoid breaking SSE frames.
        const decoded = ev.data.replace(/__NL__/g, "\n");
        setOutput(prev => prev + decoded);
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


  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Loading...
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">

      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 flex items-center justify-center gap-3">
        <span>🛠️</span> IT Ticket Resolver
      </h1>

      {/* Ticket Form */}
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
              className="p-2 border rounded-lg"
              placeholder="e.g. TKT-20240312-001"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Reported By
            </label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className="p-2 border rounded-lg"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Issue Category
            </label>
            <select
              value={issueCategory}
              onChange={(e) => setIssueCategory(e.target.value)}
              className="p-2 border rounded-lg bg-white"
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
            <label className="text-sm font-semibold mb-1 text-gray-700">
              Submission Date
            </label>
            <DatePicker
              selected={submittedDate}
              onChange={(date) => setSubmittedDate(date)}
              className="p-2 border rounded-lg w-full"
              dateFormat="yyyy-MM-dd"
            />
          </div>

        </div>

        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-1 text-gray-700">
            Issue Description
          </label>
          <textarea
            required
            rows={8}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            className="w-full p-4 border rounded-lg"
            placeholder="Describe the problem in detail..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg"
        >
          {loading ? "Analyzing Ticket..." : "Get AI Solution"}
        </button>
      </form>


      {/* AI Output */}
      {output && (
        <section className="mt-12 max-w-3xl mx-auto">

          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">

            <div className="bg-gray-50 px-8 py-6 border-b flex justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Resolution Report
              </h2>
              {loading && (
                <span className="animate-pulse text-indigo-500 text-sm">
                  Generating...
                </span>
              )}
            </div>

            <div className="p-10">
              <div style={{ fontSize: "0.95rem", color: "#334155" }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeRaw]}
                  components={markdownComponents}
                >
                  {output}
                </ReactMarkdown>
              </div>
            </div>

          </div>

          <p className="text-center text-xs text-gray-400 mt-6 uppercase tracking-widest">
            Generated by TechFix AI Engine
          </p>

        </section>
      )}

    </div>
  );
}


export default function Product() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      <div className="absolute top-4 right-4">
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
