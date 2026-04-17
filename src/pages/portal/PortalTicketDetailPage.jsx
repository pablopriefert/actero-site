import { useEffect, useState } from 'react';

export default function PortalTicketDetailPage({ ticketId, navigate }) {
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/portal/tickets', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((b) => setTicket(b.tickets.find((x) => x.id === ticketId) || null));
  }, [ticketId]);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch('/api/portal/ticket-reply', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId, message: reply }),
    });
    setBusy(false);
    if (r.ok) { setReply(''); navigate('/portal/tickets'); }
  }

  if (!ticket) return <p>Chargement…</p>;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <button onClick={() => navigate('/portal/tickets')} className="text-sm text-neutral-500 mb-4">← Retour</button>
      <h1 className="text-lg font-semibold mb-2">{ticket.subject || '(sans objet)'}</h1>
      {ticket.customer_message && <div className="text-sm text-neutral-600 mb-3 whitespace-pre-wrap"><strong>Ton message initial :</strong><br/>{ticket.customer_message}</div>}
      <div className="prose prose-sm max-w-none mb-6 whitespace-pre-wrap"><strong>Réponse :</strong><br/>{ticket.ai_response || ticket.human_response || '(pas encore de réponse)'}</div>
      {ticket.customer_follow_up && <div className="text-sm text-neutral-600 mb-3 whitespace-pre-wrap"><strong>Ton dernier message :</strong><br/>{ticket.customer_follow_up}</div>}
      <form onSubmit={send}>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4}
          className="w-full border rounded p-3 mb-3" placeholder="Ta réponse…" />
        <button disabled={busy || !reply.trim()} className="bg-black text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-neutral-800 transition">
          Envoyer
        </button>
      </form>
    </div>
  );
}
