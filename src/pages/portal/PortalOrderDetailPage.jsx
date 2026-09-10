import { useEffect, useState } from 'react';

export default function PortalOrderDetailPage({ orderName, navigate }) {
  const [order, setOrder] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch('/api/portal/orders', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((b) => setOrder(b.orders.find((o) => o.name === decodeURIComponent(orderName)) || null));
  }, [orderName]);

  async function act(endpoint, body) {
    const r = await fetch(endpoint, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? 'Demande enregistrée. On te recontacte par email.' : `Erreur: ${b.error || 'unknown'}`);
  }

  async function invoice() {
    const r = await fetch(`/api/portal/order-invoice?orderName=${encodeURIComponent(decodeURIComponent(orderName))}`,
      { credentials: 'same-origin' });
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Facture envoyée à ${b.sentTo}` : 'Erreur envoi facture');
  }

  if (!order) return <p className="text-[#5A5A5A]">Chargement…</p>;

  return (
    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_24px_rgba(0,0,0,0.06)] p-6 space-y-4">
      <button onClick={() => navigate('/portal/orders')} className="text-sm text-[#5A5A5A] hover:text-[#1A1A1A]">← Retour</button>
      <h1 className="text-lg font-semibold text-[#1A1A1A]">Commande {order.name}</h1>
      <p className="text-sm text-[#5A5A5A]">Statut : {order.fulfillment_status || 'en préparation'} · Montant : {order.total} {order.currency}</p>
      <ul className="list-disc pl-5 text-sm text-[#3A3A3A]">{(order.lineItems || []).map((li) => <li key={li.id}>{li.title} × {li.quantity}</li>)}</ul>
      <div className="flex gap-2 flex-wrap pt-4 border-t border-[#E5E5E5]">
        <button onClick={() => act('/api/portal/request-refund', { orderName: order.name, reason: 'via_portal' })}
          className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white hover:bg-[#F4F5F7] text-[#1A1A1A] font-medium px-5 py-2.5 text-[13px] transition">Demander un remboursement</button>
        <button onClick={() => act('/api/portal/request-return', { orderName: order.name, reason: 'via_portal' })}
          className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white hover:bg-[#F4F5F7] text-[#1A1A1A] font-medium px-5 py-2.5 text-[13px] transition">Lancer un retour</button>
        <button onClick={invoice}
          className="rounded-full border border-[rgba(0,0,0,0.08)] bg-white hover:bg-[#F4F5F7] text-[#1A1A1A] font-medium px-5 py-2.5 text-[13px] transition">Télécharger ma facture</button>
      </div>
      {msg && (
        <div className="bg-[#F4F5F7] border border-[rgba(0,0,0,0.06)] text-[#3A3A3A] rounded-2xl px-4 py-3 text-sm">
          {msg}
        </div>
      )}
    </div>
  );
}
