"use client";

// React core — useState manages form and output state,
// useEffect runs side effects like prefilling the reporter name.
import React, { useState, useEffect } from "react";

// Clerk components:
// - useAuth: provides getToken() to retrieve the signed-in user's JWT
// - UserButton: renders the avatar/sign-out button in the top-right corner
// - useUser: provides the current user's profile (name, email, etc.)
// - Protect: gates content behind a subscription plan check
// - PricingTable: renders Clerk's built-in pricing UI for upselling
import { useAuth, UserButton, useUser, Protect, PricingTable } from "@clerk/nextjs";

// ReactMarkdown converts the raw markdown string returned by the AI
// into properly rendered HTML elements (headings, lists, bold, code, etc.)
import ReactMarkdown from "react-markdown";

// remarkGfm adds GitHub Flavored Markdown support: tables, strikethrough,
// task lists, and autolinks — extends standard markdown parsing.
import remarkGfm from "remark-gfm";

// remarkBreaks treats single newlines as <br> tags, which is important
// for preserving line breaks in the streamed AI output.
import remarkBreaks from "remark-breaks";

// rehypeRaw allows raw HTML nodes in the markdown to be rendered as-is,
// useful when the AI output contains inline HTML elements.
import rehypeRaw from "rehype-raw";

// fetchEventSource is a robust SSE client that supports POST requests
// and custom headers (unlike the native EventSource API which only supports GET).
// We need this to send the ticket payload and the Authorization header.
import { fetchEventSource } from "@microsoft/fetch-event-source";

// DatePicker provides a calendar UI for selecting dates, which is more
// reliable than a plain text input — it guarantees a valid date format
// and improves the user experience significantly.
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
  // Horizontal rules (---) — visible separator between the three report sections
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
 * Displayed when user does NOT have a Premium subscription.
 * The <Protect> component renders this fallback automatically
 * when the plan check fails — no manual conditional logic needed.
 */
const PricingFallback = () => (
  <div className="container mx-auto px-4 py-12 text-center">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">
      Premium Plan Required
    </h2>
    <p className="text-gray-600 mb-8">
      You need an active <strong>Premium</strong> subscription to use the AI Ticket Resolver.
    </p>
    {/* PricingTable renders Clerk's built-in subscription plans UI,
        allowing the user to upgrade without leaving the page. */}
    <PricingTable />
  </div>
);


function TicketForm() {

  // getToken() retrieves the current user's signed JWT from Clerk.
  // We send this token in the Authorization header with every API request
  // so the backend can verify the user's identity.
  const { getToken } = useAuth();

  // useUser gives us access to the authenticated user's profile data.
  // We use it to prefill the "Reported By" field with the user's full name.
  const { user, isLoaded } = useUser();

  // Controlled component state — each input field has its own state variable.
  // This is the React pattern for form inputs: the state drives the input value,
  // and the onChange handler updates the state on every keystroke.
  const [ticketId, setTicketId] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [issueCategory, setIssueCategory] = useState("Software");
  const [submittedDate, setSubmittedDate] = useState<Date | null>(new Date());
  const [issueDescription, setIssueDescription] = useState("");

  // output accumulates the streamed markdown text from the AI as it arrives.
  // loading disables the submit button and shows a spinner while a request is in flight.
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  // Once the Clerk user profile loads, prefill the "Reported By" field
  // with the user's full name. This runs only when isLoaded becomes true.
  useEffect(() => {
    if (isLoaded && user?.fullName) {
      setReportedBy(user.fullName);
    }
  }, [isLoaded, user]);


  async function handleSubmit(e: React.FormEvent) {
    // Prevent the browser's default form submission behavior (page reload).
    // In a single-page application, we handle the submission ourselves via fetch.
    e.preventDefault();
    setOutput("");
    setLoading(true);

    // Retrieve the JWT from Clerk. This token proves the user is authenticated
    // and will be sent to the backend in the Authorization header.
    const jwt = await getToken();

    if (!jwt) {
      setOutput("Authentication required.");
      setLoading(false);
      return;
    }

    // AbortController allows us to cancel the SSE stream programmatically.
    // We call controller.abort() in the onerror handler to stop the stream
    // if an error occurs, preventing memory leaks or zombie connections.
    const controller = new AbortController();

    await fetchEventSource("/api", {
      method: "POST",
      signal: controller.signal,

      headers: {
        "Content-Type": "application/json",
        // Send the JWT as a Bearer token — the backend's Clerk guard
        // will extract and verify it before processing the ticket.
        Authorization: `Bearer ${jwt}`,
      },

      // Map camelCase frontend state variables to snake_case backend field names.
      // FastAPI's Pydantic model expects snake_case (ticket_id, reported_by, etc.)
      // while JavaScript convention uses camelCase (ticketId, reportedBy, etc.).
      // A mismatch here would cause a 422 Unprocessable Entity error from FastAPI.
      body: JSON.stringify({
        ticket_id: ticketId,
        reported_by: reportedBy,
        issue_category: issueCategory,
        // Convert the JavaScript Date object to a YYYY-MM-DD string.
        // The Pydantic model expects a string, not a Date object.
        submitted_date: submittedDate?.toISOString().split("T")[0],
        issue_description: issueDescription,
      }),

      onmessage(ev) {
        // The backend sends "[DONE]" as the final SSE event to signal
        // that the stream is complete. We use this to stop the loading spinner.
        if (ev.data === "[DONE]") {
          setLoading(false);
          return;
        }

        // Decode the __NL__ delimiter back into real newlines.
        // The backend encodes \n as __NL__ to avoid breaking SSE frames,
        // since a literal newline in an SSE "data:" line would end the event prematurely.
        const decoded = ev.data.replace(/__NL__/g, "\n");

        // Append the decoded chunk to the existing output.
        // Using the functional form of setOutput (prev => ...) ensures
        // we always append to the latest state, even during rapid updates.
        setOutput(prev => prev + decoded);
      },

      onclose() {
        setLoading(false);
      },

      onerror(err) {
        console.error("SSE Error:", err);
        // Abort the stream to release resources and prevent further callbacks.
        controller.abort();
        setLoading(false);
      },
    });
  }


  // Wait until Clerk has finished loading the user session before rendering
  // the form. Without this check, the "Reported By" field would be empty
  // on first render and the prefill useEffect would have no data to work with.
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

      {/* Ticket Form — all inputs are controlled components tied to state variables */}
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

          {/* Select dropdown enforces a controlled vocabulary for the issue category.
              This helps the AI produce more consistent output and makes
              future filtering or analytics easier than free-text input. */}
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

          {/* DatePicker provides a calendar UI instead of a plain text input.
              It guarantees a valid date is selected and returns a JavaScript Date object,
              which we convert to YYYY-MM-DD string format before sending to the backend. */}
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

        {/* Disable the button while a request is in flight to prevent duplicate submissions */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg"
        >
          {loading ? "Analyzing Ticket..." : "Get AI Solution"}
        </button>
      </form>


      {/* AI Output — only rendered once the first chunk of output arrives */}
      {output && (
        <section className="mt-12 max-w-3xl mx-auto">

          <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">

            <div className="bg-gray-50 px-8 py-6 border-b flex justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                Resolution Report
              </h2>
              {/* Show an animated "Generating..." indicator while the stream is active */}
              {loading && (
                <span className="animate-pulse text-indigo-500 text-sm">
                  Generating...
                </span>
              )}
            </div>

            <div className="p-10">
              {/* ReactMarkdown renders the accumulated markdown string as HTML.
                  - remarkGfm: enables GitHub Flavored Markdown (tables, task lists, etc.)
                  - remarkBreaks: treats single newlines as <br> for proper line breaks
                  - rehypeRaw: allows raw HTML nodes from the AI output to render correctly
                  - components: custom renderers that apply inline styles since Tailwind's
                    prose class requires @tailwindcss/typography to work properly */}
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


/**
 * Main product page export.
 * - UserButton is positioned absolutely in the top-right corner for easy access.
 * - Protect gates the entire TicketForm behind a Clerk subscription check.
 *   If the user does not have the "premium_subscription" plan, the PricingFallback
 *   is shown instead. The actual security enforcement happens on the backend —
 *   this is a UX gate, not a security gate.
 */
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
