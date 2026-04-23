import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { usePortalTone } from '../../hooks/usePortalTone.js';
import { applyTone } from '../../lib/portal-tone.js';

export default function PortalOrdersListPage({ navigate }) {
  const tone = usePortalTone();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/portal/orders', { credentials: 'same-origin' })
      .then((r) => r.ok ? r.json() : Promise.reject(r))
      .then((b) => setOrders(b.orders))
      .catch(() => setError('Chargement impossible'));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!orders) return <p className="text-[#5A5A5A]">Chargement…</p>;
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="Aucune commande"
        description={applyTone(
          'Les commandes associées à ton email apparaîtront ici.',
          'Les commandes associées à votre email apparaîtront ici.',
          tone,
        )}
      />
    );
  }

  function fulfillmentChip(status) {
    const s = status || 'pending';
    if (s === 'fulfilled') {
      return (
        <span className="text-xs px-2.5 py-0.5 rounded-full border bg-[#E8F5EC] text-[#1F3A12] border-[#A8C490]">
          {s}
        </span>
      );
    }
    return (
      <span className="text-xs px-2.5 py-0.5 rounded-full border bg-[#FEF3C7] text-[#8B7A50] border-[#F59E0B]/30">
        {s}
      </span>
    );
  }

  return (
    <ul className="divide-y bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] shadow-[0_2px_24px_rgba(0,0,0,0.06)] overflow-hidden">
      {orders.map((o) => (
        <li key={o.id}>
          <button onClick={() => navigate(`/portal/orders/${encodeURIComponent(o.name)}`)}
            className="w-full text-left px-4 py-3 hover:bg-[#FAFAFA] flex justify-between items-center">
            <span>
              <span className="font-semibold text-[#1A1A1A]">{o.name}</span>
              <span className="ml-2 text-xs text-[#8B8070]">{new Date(o.created_at).toLocaleDateString()}</span>
            </span>
            <span className="flex items-center gap-2 text-sm text-[#5A5A5A]">
              {o.total} {o.currency}
              {fulfillmentChip(o.fulfillment_status)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
