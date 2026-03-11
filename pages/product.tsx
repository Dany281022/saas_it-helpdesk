"use client";

import React, { useState, useEffect } from "react";
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";


/**
 * PricingFallback
 * Displayed when the user does NOT have an active premium subscription.
 * Clerk automatically handles plan upgrade through the PricingTable.
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">
      Premium Plan Required
    </h2>

    <p className="text-gray-600 mb-8">
      You need an active <strong>Premium</strong> subscription to access the AI Ticket Resolver.
    </p>

    <PricingTable />
  </div>
);


/**
 * TicketForm Component
 * Handles ticket submission and streams the AI response from the FastAPI backend.
 */
function TicketForm() {

  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();

  // -------------------------------
  // Form State
  // -------------------------------
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState("");

  // AI response state
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);


  /**
   * Pre-fill reporter name when Clerk loads the user
   */
  useEffect(() => {
    if (isLoaded && user?.fullName) {
      setReportedBy(user.fullName);
    }
  }, [isLoaded, user]);


  /**
   * Handles ticket submission and starts SSE streaming
   */
  async function handleSubmit(e: React.FormEvent) {

    e.preventDefault();
    setOutput("");
    setLoading(true);

    // Get Clerk JWT for backend verification
    const jwt = await getToken();

    if (!jwt) {
      setOutput("Authentication required.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    // Connect to FastAPI backend via SSE
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

        // Stream finished
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }

        // Append streaming text
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


  // Prevent rendering before Clerk user loads
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">

      {/* Page Title */}
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-900 flex items-center justify-center gap-3">
        <span>🛠️</span> IT Ticket Resolver
      </h1>


      {/* -------------------------------
          Ticket Form
      ------------------------------- */}
      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-xl shadow-lg border border-gray-200"
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Ticket ID */}
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


          {/* Reported By */}
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


          {/* Issue Category */}
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


          {/* Date Picker */}
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


        {/* Issue Description */}
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


        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg"
        >
          {loading ? "Analyzing Ticket..." : "Get AI Solution"}
        </button>

      </form>


      {/* -------------------------------
          AI Output Section
      ------------------------------- */}
      {output && (

        <section className="mt-12 max-w-3xl mx-auto">

          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">

            {/* Output Header */}
            <div className="bg-gray-50 px-8 py-6 border-b flex justify-between">

              <h2 className="text-xl font-bold text-gray-800">
                Resolution Report
              </h2>

              {loading && (
                <span className="text-indigo-500 text-sm">
                  Generating...
                </span>
              )}

            </div>


            {/* Markdown Output */}
            <div className="p-10">

              <div className="prose prose-slate max-w-none">

                <ReactMarkdown remarkPlugins={[remarkGfm]}>
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


/**
 * Product Page
 * Protected using Clerk's Protect component.
 * Only users with "premium_subscription" can access the TicketForm.
 */
export default function Product() {

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

      {/* User profile button */}
      <div className="absolute top-4 right-4">
        <UserButton showName />
      </div>

      {/* Subscription protection */}
      <Protect
        plan="premium_subscription"
        fallback={<PricingFallback />}
      >
        <TicketForm />
      </Protect>

    </main>
  );
}
