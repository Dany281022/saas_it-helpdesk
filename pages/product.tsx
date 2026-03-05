"use client";

import React, { useState } from 'react';
import { useAuth, Protect, UserButton } from '@clerk/nextjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchEventSource } from '@microsoft/fetch-event-source';

// Composant de repli si l'utilisateur n'a pas accès (Subscription Gating)
const PricingTable = () => (
  <div className="p-12 text-center border-2 border-dashed rounded-xl bg-gray-50 max-w-2xl mx-auto mt-20">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">Premium Plan Required</h2>
    <p className="text-gray-600 mb-6">You need an active subscription to use the AI Ticket Resolver.</p>
    <button className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
      Upgrade Now
    </button>
  </div>
);

function TicketResolverForm() {
  const { getToken } = useAuth();
  const [subject, setSubject] = useState<string>('');
  const [category, setCategory] = useState<string>('Software');
  const [priority, setPriority] = useState<string>('Medium');
  const [description, setDescription] = useState<string>('');
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Nettoyage et formatage pour assurer un rendu Markdown propre
  const formatOutput = (text: string) => {
    return text
      .replace(/### (Diagnostic|Solution|Steps|Recommendation|Conclusion)/gi, '\n\n### $1\n\n')
      .trim();
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOutput('');
    setLoading(true);
    try {
      const jwt = await getToken();
      if (!jwt) return;
      
      await fetchEventSource('/api/ticket', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${jwt}` 
        },
        body: JSON.stringify({
          title: subject,
          category: category,
          priority: priority,
          description: description,
        }),
        onmessage(ev) {
          if (ev.data === "[DONE]") { setLoading(false); return; }
          // On ajoute les données au fur et à mesure pour l'effet streaming
          setOutput((prev) => prev + ev.data);
        },
        onclose() { setLoading(false); },
        onerror(err) { console.error(err); setLoading(false); }
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col md:col-span-1">
            <label className="text-sm font-semibold mb-1 text-gray-700">Issue Subject</label>
            <input 
              type="text" 
              placeholder="Ex: Printer not working" 
              required 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)} 
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="Software">Software</option>
              <option value="Hardware">Hardware</option>
              <option value="Network">Network</option>
              <option value="Access">Access/Identity</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Priority</label>
            <select 
              value={priority} 
              onChange={(e) => setPriority(e.target.value)}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent / Critical</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-semibold mb-1 text-gray-700">Detailed Description</label>
          <textarea 
            required 
            rows={5} 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            className="w-full p-4 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
            placeholder="Describe the technical issue in detail..." 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? 'Analyzing Ticket...' : 'Get AI Solution'}
        </button>
      </form>

      {/* Affichage de la réponse IA avec formatage Markdown */}
      {output && (
        <section className="mt-8 bg-white p-8 rounded-xl shadow-2xl border-t-4 border-indigo-500 animate-in fade-in duration-500">
          <h2 className="text-xl font-bold text-indigo-700 mb-6 flex items-center gap-2 border-b pb-2">
             <span>🤖</span> AI Diagnostic & Resolution
          </h2>
          
          <div className="prose prose-indigo max-w-none break-words">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({...props}) => <h3 className="text-lg font-bold text-gray-900 mt-6 mb-2 border-l-4 border-indigo-200 pl-3" {...props} />,
                p: ({...props}) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
                ul: ({...props}) => <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700" {...props} />,
                ol: ({...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-gray-700" {...props} />,
                strong: ({...props}) => <strong className="font-bold text-indigo-900" {...props} />,
                code: ({...props}) => <code className="bg-gray-100 text-red-600 px-1 rounded" {...props} />,
              }}
            >
              {formatOutput(output)}
            </ReactMarkdown>
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
