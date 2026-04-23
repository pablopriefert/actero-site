import { useEffect, useState } from 'react';
import AttachmentUploader from '../../components/portal/AttachmentUploader';
import { usePortalTone } from '../../hooks/usePortalTone.js';
import { applyTone } from '../../lib/portal-tone.js';

export default function PortalTicketDetailPage({ ticketId, navigate }) {
  const tone = usePortalTone();
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');
  const [imagePaths, setImagePaths] = useState([]);
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
      body: JSON.stringify({ ticketId, message: reply, image_paths: imagePaths }),
    });
    setBusy(false);
    if (r.ok) { setReply(''); setImagePaths([]); navigate('/portal/tickets'); }
  }

  if (!ticket) return <p className="text-[#5A5A5A]">Chargement…</p>;

  return (
    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_24px_rgba(0,0,0,0.06)] p-6">
      <button onClick={() => navigate('/portal/tickets')} className="text-sm text-[#5A5A5A] hover:text-[#1A1A1A] mb-4 block">← Retour</button>
      <h1 className="text-lg font-semibold text-[#1A1A1A] mb-2">{ticket.subject || '(sans objet)'}</h1>
      {ticket.customer_message && <div className="text-sm text-[#5A5A5A] mb-3 whitespace-pre-wrap"><strong>Ton message initial :</strong><br/>{ticket.customer_message}</div>}
      <div className="prose prose-sm max-w-none mb-6 whitespace-pre-wrap text-[#1A1A1A]"><strong>Réponse :</strong><br/>{ticket.ai_response || ticket.human_response || '(pas encore de réponse)'}</div>
      {ticket.customer_follow_up && <div className="text-sm text-[#5A5A5A] mb-3 whitespace-pre-wrap"><strong>Ton dernier message :</strong><br/>{ticket.customer_follow_up}</div>}
      <form onSubmit={send}>
        <div className="mb-3">
          <AttachmentUploader onChange={setImagePaths} />
        </div>
        <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4}
          className="w-full border border-[#E5E5E5] rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-[#1F3A12]/10 focus:border-[#1F3A12]/40"
          placeholder={applyTone('Ta réponse…', 'Votre réponse…', tone)} />
        <button disabled={busy || !reply.trim()}
          className="text-white rounded-full bg-[#1F3A12] hover:bg-[#162C0D] font-medium px-5 py-2 disabled:opacity-50 transition">
          Envoyer
        </button>
      </form>
    </div>
  );
}
