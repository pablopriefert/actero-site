import React, { useState } from 'react';
import { Building2, Send, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';
import { useToast } from '../ui/Toast';

function generatePassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let pw = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    pw += chars[array[i] % chars.length];
  }
  return pw;
}

export function AdminAddEnterpriseView({ onNavigateToClients }) {
  const toast = useToast();
  const [form, setForm] = useState({
    brand_name: '',
    contact_email: '',
    shopify_url: '',
    mrr: 999,
    nb_shops: 1,
    account_manager: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { brand, email, password }
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.brand_name.trim() || !form.contact_email.trim()) return;
    setSubmitting(true);

    const tempPassword = generatePassword();

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.contact_email.trim(),
          password: tempPassword,
          brand_name: form.brand_name.trim(),
          shopify_url: form.shopify_url.trim() || undefined,
          plan: 'enterprise',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      setResult({
        brand: form.brand_name.trim(),
        email: form.contact_email.trim(),
        password: tempPassword,
      });

      toast.success?.(`Client ${form.brand_name} cree sur le plan Enterprise`);
    } catch (err) {
      toast.error?.('Erreur: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    if (result?.password) {
      navigator.clipboard.writeText(result.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success state
  if (result) {
    return (
      <div className="max-w-xl mx-auto">
        <SectionCard title="Client Enterprise cree" icon={Building2}>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <p className="text-[14px] font-semibold text-emerald-700">
                Client {result.brand} cree sur le plan Enterprise
              </p>
              <p className="text-[12px] text-emerald-600 mt-1">
                Un email d'invitation a ete envoye a {result.email}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[12px] font-semibold text-amber-700 mb-2">
                Mot de passe temporaire (affiche une seule fois) :
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-200 text-[13px] font-mono text-[#1a1a1a]">
                  {showPassword ? result.password : '••••••••••••••••'}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 text-amber-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleCopyPassword}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-100 text-amber-600"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => onNavigateToClients?.()}
              className="w-full px-4 py-3 rounded-xl text-[13px] font-semibold bg-[#0F5F35] text-white hover:bg-[#0F5F35]/90 transition-colors"
            >
              Voir la liste clients
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  // Form state
  return (
    <div className="max-w-xl mx-auto">
      <SectionCard title="Ajouter un client Enterprise" subtitle="Creation manuelle avec plan Enterprise" icon={Building2}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Brand name */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
              Nom de la marque <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.brand_name}
              onChange={(e) => update('brand_name', e.target.value)}
              placeholder="Maison Durand, Nike FR..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
              required
              autoFocus
            />
          </div>

          {/* Contact email */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
              Email de contact <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) => update('contact_email', e.target.value)}
              placeholder="ceo@brand.com"
              className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
              required
            />
          </div>

          {/* Shopify URL */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
              URL Shopify <span className="text-[#9ca3af]">(optionnel)</span>
            </label>
            <input
              type="url"
              value={form.shopify_url}
              onChange={(e) => update('shopify_url', e.target.value)}
              placeholder="https://brand.myshopify.com"
              className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
            />
          </div>

          {/* MRR + Nb shops row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
                MRR negocie (EUR/mois)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.mrr}
                onChange={(e) => update('mrr', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
                Nombre de boutiques
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.nb_shops}
                onChange={(e) => update('nb_shops', Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Account manager */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
              Account manager assigne <span className="text-[#9ca3af]">(optionnel)</span>
            </label>
            <input
              type="text"
              value={form.account_manager}
              onChange={(e) => update('account_manager', e.target.value)}
              placeholder="Pablo, Marie..."
              className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1.5">
              Notes onboarding <span className="text-[#9ca3af]">(optionnel)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Details sur le client, besoins specifiques..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-[#f0f0f0] bg-[#fafafa] text-[13px] text-[#1a1a1a] focus:outline-none focus:border-[#0F5F35]/40 focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.brand_name.trim() || !form.contact_email.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold bg-[#0F5F35] text-white hover:bg-[#0F5F35]/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Creation en cours...' : 'Creer le client Enterprise'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}
