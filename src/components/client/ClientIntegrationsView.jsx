import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug, X, Loader2, CheckCircle, AlertCircle, ExternalLink,
  RefreshCw, Trash2, Star, Search
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { INTEGRATIONS, ALL_INTEGRATIONS, getIntegrationById } from '../../config/integrations'

const ProviderIcon = ({ provider, connected, size = 40 }) => {
  const config = getIntegrationById(provider.id || provider) || provider;
  const hasIcon = !!config.icon;
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 transition-all overflow-hidden"
      style={{
        width: size,
        height: size,
        opacity: connected ? 1 : 0.5,
      }}
    >
      {hasIcon ? (
        <img
          src={config.icon}
          alt={config.name}
          className="w-full h-full object-contain"
          style={{ filter: connected ? 'none' : 'grayscale(100%)' }}
        />
      ) : (
        <div
          className="w-full h-full rounded-xl flex items-center justify-center font-bold text-white"
          style={{ backgroundColor: connected ? config.color : '#3f3f46', fontSize: size * 0.4 }}
        >
          {config.name?.[0] || '?'}
        </div>
      )}
    </div>
  );
};

const STATUS_BADGES = {
  active: { label: 'Connecté', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  expired: { label: 'Expiré', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  error: { label: 'Erreur', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
  revoked: { label: 'Révoqué', className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  pending: { label: 'En attente', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
};

const IntegrationCard = ({ provider, connection, shopifyConnected, shopifyDomain, onOAuthConnect, onDisconnect, isLight }) => {
  const isShopify = provider.id === 'shopify';
  const isConnected = isShopify ? shopifyConnected : !!connection;
  const status = isShopify ? (shopifyConnected ? 'active' : null) : connection?.status;
  const badge = status ? STATUS_BADGES[status] : null;

  return (
    <div className={`relative rounded-2xl border p-5 transition-all hover:border-white/20 ${
      isLight
        ? `bg-white border-slate-200 ${isConnected ? 'ring-1 ring-emerald-200' : ''}`
        : `bg-[#0a0a0a] border-white/10 ${isConnected ? 'ring-1 ring-emerald-500/20' : ''}`
    }`}>
      {provider.popular && (
        <div className="absolute -top-2.5 right-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Star className="w-3 h-3" /> Recommandé
          </span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <ProviderIcon provider={provider} connected={isConnected} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>{provider.name}</h4>
            {badge && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}
              >
                {badge.label}
              </motion.span>
            )}
          </div>
          <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>{provider.description}</p>

          {isShopify && shopifyDomain && (
            <p className="text-xs text-emerald-400 mt-1">{shopifyDomain}</p>
          )}

          <div className="flex items-center gap-2 mt-3">
            {isConnected ? (
              <>
                {!isShopify && (
                  <button
                    onClick={() => onDisconnect(connection)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Déconnecter
                  </button>
                )}
                {isShopify && (
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> App installée
                  </span>
                )}
              </>
            ) : provider.authType === 'coming_soon' ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 bg-zinc-800 cursor-not-allowed">
                <Plug className="w-3 h-3" /> Bientôt
              </span>
            ) : provider.authType === 'oauth' ? (
              <button
                onClick={() => onOAuthConnect(provider)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors`}
                style={{ backgroundColor: provider.color, color: '#fff' }}
              >
                <ExternalLink className="w-3 h-3" /> Connecter
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConnectModal = ({ provider, onClose, onSuccess, isLight }) => {
  const [credentials, setCredentials] = useState({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleFieldChange = (key, value) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ provider: provider.id, credentials }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Erreur réseau' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          provider: provider.id,
          provider_label: provider.name,
          credentials,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setTestResult({ ok: false, message: data.error || 'Erreur lors de la sauvegarde' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Erreur réseau' });
    } finally {
      setSaving(false);
    }
  };

  const allFieldsFilled = provider.apiKeyFields?.every(f => credentials[f.key]?.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-md mx-4 rounded-2xl border shadow-2xl p-6 max-h-[85vh] overflow-y-auto ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={provider} connected={false} size={36} />
            <div>
              <h3 className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Connecter {provider.name}
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                Entrez vos identifiants pour activer l'intégration
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        {provider.apiKeyInstructions && (
          <div className={`rounded-xl p-4 mb-5 text-sm ${
            isLight ? 'bg-blue-50 text-blue-800 border border-blue-100' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
          }`}>
            <p>{provider.apiKeyInstructions}</p>
            {provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Voir le guide <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {/* Fields */}
        <div className="space-y-4 mb-5">
          {provider.apiKeyFields?.map(field => (
            <div key={field.key}>
              <label className={`block text-xs font-bold mb-1.5 ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>
                {field.label}
              </label>
              <input
                type={field.key.includes('key') || field.key.includes('token') ? 'password' : 'text'}
                value={credentials[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`w-full px-4 py-3 rounded-xl text-sm outline-none transition-all ${
                  isLight
                    ? 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500/40'
                    : 'bg-[#030303] border border-white/10 text-white focus:ring-2 focus:ring-zinc-400'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Test result */}
        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm font-medium ${
                testResult.ok
                  ? (isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/10 text-emerald-400')
                  : (isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/10 text-red-400')
              }`}
            >
              {testResult.ok ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {testResult.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!allFieldsFilled || testing}
            className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
              isLight
                ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                : 'bg-white/10 text-white hover:bg-white/15 border border-white/10'
            }`}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Tester
          </button>
          <button
            onClick={handleSave}
            disabled={!testResult?.ok || saving}
            className="flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Sauvegarder
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DisconnectModal = ({ provider, onClose, onConfirm, disconnecting, isLight }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative w-full max-w-sm mx-4 rounded-2xl border shadow-2xl p-6 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'
      }`}
    >
      <h3 className={`font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>Déconnecter {provider}?</h3>
      <p className={`text-sm mb-5 ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
        Vos automatisations liées à {provider} seront désactivées.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/15'
          }`}
        >
          Annuler
        </button>
        <button
          onClick={onConfirm}
          disabled={disconnecting}
          className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
        >
          {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Déconnecter
        </button>
      </div>
    </motion.div>
  </div>
);

export const ClientIntegrationsView = ({ clientId, clientType, theme }) => {
  const queryClient = useQueryClient();
  const isLight = theme === 'light';
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [search, setSearch] = useState('');
  const [oauthMessage, setOauthMessage] = useState(null);

  // Handle OAuth callback messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    if (success) {
      setOauthMessage({ type: 'success', text: `${success.charAt(0).toUpperCase() + success.slice(1)} connecté avec succès !` });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setOauthMessage({ type: 'error', text: `Erreur de connexion : ${error.replace(/_/g, ' ')}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleOAuthConnect = async (provider) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (provider.oauthPrompt) {
      const value = prompt(provider.oauthPromptLabel);
      if (!value?.trim()) return;
      const url = provider.oauthUrl({ [provider.oauthPrompt]: value.trim(), token: session.access_token });
      window.location.href = url;
    } else if (provider.oauthUrl) {
      const url = provider.oauthUrl({ token: session.access_token });
      window.location.href = url;
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['client-integrations', clientId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/integrations/list', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Erreur chargement');
      return res.json();
    },
    enabled: !!clientId,
  });

  const integrations = data?.integrations || [];
  const shopifyConnected = data?.shopify_connected || false;
  const shopifyDomain = data?.shopify_domain || null;

  const getConnectionForProvider = (providerId) =>
    integrations.find(i => i.provider === providerId);

  // Filter categories by client type
  const categories = [];
  if (clientType === 'ecommerce' || !clientType) {
    categories.push({ key: 'ecommerce', label: 'E-commerce', providers: INTEGRATIONS.ecommerce });
  }
  if (clientType === 'immobilier' || !clientType) {
    categories.push({ key: 'immobilier', label: 'Immobilier', providers: INTEGRATIONS.immobilier });
  }
  categories.push({ key: 'general', label: 'Général', providers: INTEGRATIONS.general });

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ integration_id: disconnectTarget.id }),
      });
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
    } finally {
      setDisconnecting(false);
      setDisconnectTarget(null);
    }
  };

  const connectedCount = integrations.filter(i => i.status === 'active').length + (shopifyConnected ? 1 : 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Intégrations
          </h2>
          <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
            {connectedCount} intégration{connectedCount !== 1 ? 's' : ''} connectée{connectedCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={`relative max-w-xs w-full ${isLight ? '' : ''}`}>
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-zinc-500'}`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all ${
              isLight
                ? 'bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-blue-500/40'
                : 'bg-[#0a0a0a] border border-white/10 text-white focus:ring-2 focus:ring-zinc-400'
            }`}
          />
        </div>
      </div>

      {/* OAuth callback message */}
      <AnimatePresence>
        {oauthMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`flex items-center justify-between gap-3 p-4 rounded-xl ${
              oauthMessage.type === 'success'
                ? (isLight ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20')
                : (isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/20')
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              {oauthMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {oauthMessage.text}
            </div>
            <button onClick={() => setOauthMessage(null)} className="opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className={`w-6 h-6 animate-spin ${isLight ? 'text-slate-400' : 'text-zinc-400'}`} />
        </div>
      ) : (
        categories.map(cat => {
          const filtered = search
            ? cat.providers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
            : cat.providers;
          if (filtered.length === 0) return null;

          // Sort: popular first, then connected, then rest
          const sorted = [...filtered].sort((a, b) => {
            const aConn = a.id === 'shopify' ? shopifyConnected : !!getConnectionForProvider(a.id);
            const bConn = b.id === 'shopify' ? shopifyConnected : !!getConnectionForProvider(b.id);
            if (a.popular && !b.popular) return -1;
            if (!a.popular && b.popular) return 1;
            if (aConn && !bConn) return -1;
            if (!aConn && bConn) return 1;
            return 0;
          });

          return (
            <div key={cat.key}>
              <h3 className={`text-sm font-bold mb-4 ${isLight ? 'text-slate-700' : 'text-zinc-400'}`}>
                {cat.label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map(provider => (
                  <IntegrationCard
                    key={provider.id}
                    provider={provider}
                    connection={getConnectionForProvider(provider.id)}
                    shopifyConnected={shopifyConnected}
                    shopifyDomain={shopifyDomain}
                    onOAuthConnect={handleOAuthConnect}
                    onDisconnect={(conn) => setDisconnectTarget({ ...conn, providerName: provider.name })}
                    isLight={isLight}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Disconnect Modal */}
      <AnimatePresence>
        {disconnectTarget && (
          <DisconnectModal
            provider={disconnectTarget.providerName || disconnectTarget.provider}
            onClose={() => setDisconnectTarget(null)}
            onConfirm={handleDisconnect}
            disconnecting={disconnecting}
            isLight={isLight}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
