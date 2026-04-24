import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plug, X, Loader2, CheckCircle, AlertCircle, ExternalLink,
  RefreshCw, Trash2, Star, Search, Mail
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { INTEGRATIONS, ALL_INTEGRATIONS, INTEGRATION_CATEGORIES, getIntegrationById, getConflictingActive, getConflictGroup, CONFLICT_GROUPS } from '../../config/integrations'
import { EmptyState } from '../ui/EmptyState'

const ProviderIcon = ({ provider, connected, size = 40 }) => {
  const config = getIntegrationById(provider.id || provider) || provider;
  const hasIcon = !!config.icon;
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 transition-all overflow-hidden"
      style={{ width: size, height: size }}
    >
      {hasIcon ? (
        <img
          src={config.icon}
          alt={config.name}
          className="w-full h-full object-contain"
        />
      ) : (
        <div
          className="w-full h-full rounded-xl flex items-center justify-center font-bold text-[#1a1a1a]"
          style={{ backgroundColor: config.color || '#3f3f46', fontSize: size * 0.4 }}
        >
          {config.name?.[0] || '?'}
        </div>
      )}
    </div>
  );
};

const STATUS_BADGES = {
  active: { label: 'Connecté', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  expired: { label: 'Expiré', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Erreur', className: 'bg-red-50 text-red-600 border-red-200' },
  revoked: { label: 'Révoqué', className: 'bg-[#f5f5f5] text-[#9ca3af] border-[#ebebeb]' },
  pending: { label: 'En attente', className: 'bg-blue-50 text-blue-600 border-blue-200' },
};

const IntegrationCard = ({ provider, connection, shopifyConnected, shopifyDomain, onOAuthConnect, onDisconnect, onTest, isLight, blockedBy }) => {
  const isShopify = provider.id === 'shopify';
  const isConnected = isShopify ? shopifyConnected : !!connection;
  const status = isShopify ? (shopifyConnected ? 'active' : null) : connection?.status;
  const badge = status ? STATUS_BADGES[status] : null;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const isBlocked = !!blockedBy && !isConnected;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
      isConnected
        ? 'border-cta/20 bg-cta/[0.03]'
        : isBlocked
          ? 'border-[#f0f0f0] bg-white opacity-70'
          : 'border-[#f0f0f0] bg-white hover:border-[#e0e0e0]'
    }`}>
        <ProviderIcon provider={provider} connected={isConnected} size={32} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-[13px] text-[#1a1a1a]">{provider.name}</h4>
            {badge && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.className}`}
              >
                {badge.label}
              </motion.span>
            )}
            {isBlocked && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                Remplacerait {getIntegrationById(blockedBy.provider)?.name || blockedBy.provider}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#9ca3af] truncate">{provider.description}</p>
        </div>

          {isShopify && shopifyDomain && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0">{shopifyDomain}</span>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {isConnected ? (
              <>
                {!isShopify && (status === 'expired' || status === 'error') && (
                  <button
                    onClick={() => onOAuthConnect(provider)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
                    style={{ backgroundColor: provider.color || '#0E653A' }}
                  >
                    <RefreshCw className="w-3 h-3" /> Reconnecter
                  </button>
                )}
                {!isShopify && status === 'active' && (
                  <button
                    onClick={async () => {
                      setTesting(true);
                      setTestResult(null);
                      const result = await onTest(connection.id);
                      setTestResult(result);
                      setTesting(false);
                      if (result?.ok) setTimeout(() => setTestResult(null), 3000);
                    }}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-cta bg-[#f5f5f5] hover:bg-[#ebebeb] border border-[#ebebeb] transition-colors disabled:opacity-50"
                  >
                    {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {testing ? 'Test...' : 'Tester'}
                  </button>
                )}
                {!isShopify && (
                  <button
                    onClick={() => onDisconnect(connection)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Déconnecter
                  </button>
                )}
                {isShopify && (
                  <span className="text-xs text-cta font-medium flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> App installée
                  </span>
                )}
                {testResult && (
                  <span className={`text-xs font-medium flex items-center gap-1 ${testResult.ok ? 'text-cta' : 'text-red-500'}`}>
                    {testResult.ok ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    {testResult.message}
                  </span>
                )}
              </>
            ) : provider.authType === 'coming_soon' ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#9ca3af] bg-[#f5f5f5] cursor-not-allowed">
                <Plug className="w-3 h-3" /> Bientot
              </span>
            ) : provider.authType === 'smtp' ? (
              <button
                onClick={() => onOAuthConnect(provider)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors bg-cta text-white hover:bg-[#003725]"
              >
                <Plug className="w-3 h-3" /> Configurer
              </button>
            ) : provider.authType === 'api_key' ? (
              <button
                onClick={() => onOAuthConnect(provider)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-cta text-white hover:bg-[#003725]"
              >
                <Plug className="w-3 h-3" /> Connecter
              </button>
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
      <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-white p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ProviderIcon provider={provider} connected={false} size={36} />
            <div>
              <h3 className={`font-bold text-[#1a1a1a]`}>
                Connecter {provider.name}
              </h3>
              <p className={`text-xs text-[#9ca3af]`}>
                Entrez vos identifiants pour activer l'intégration
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#1a1a1a] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        {provider.apiKeyInstructions && (
          <div className="rounded-xl p-4 mb-5 text-[13px] bg-blue-50 text-blue-800 border border-blue-100">
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
              <label className={`block text-xs font-bold mb-1.5 text-[#9ca3af]`}>
                {field.label}
              </label>
              <input
                type={field.key.includes('key') || field.key.includes('token') ? 'password' : 'text'}
                value={credentials[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`w-full px-4 py-3 rounded-lg text-[13px] outline-none transition-all bg-[#fafafa] border border-[#ebebeb] text-[#1a1a1a] focus:ring-1 focus:ring-cta/20`}
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
              className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm font-medium ${testResult.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}
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
            className={`flex-1 flex justify-center items-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb] rounded-lg`}
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
    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-white p-6"
    >
      <h3 className={`font-bold mb-2 text-[#1a1a1a]`}>Déconnecter {provider}?</h3>
      <p className={`text-sm mb-5 text-[#9ca3af]`}>
        Vos automatisations liées à {provider} seront désactivées.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]`}
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
  const { success: toastSuccess, error: toastError } = useToast();
  const isLight = theme === 'light';
  const [disconnectTarget, setDisconnectTarget] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [search, setSearch] = useState('');
  const [oauthMessage, setOauthMessage] = useState(null);
  const [oauthPromptProvider, setOauthPromptProvider] = useState(null);
  const [oauthPromptValue, setOauthPromptValue] = useState('');

  // Handle OAuth callback messages
  // Supports two formats:
  //   1. Legacy: ?success=notion or ?error=...
  //   2. New: ?integration=notion&status=success OR ?integration=notion&status=error&message=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // New format (from /api/integrations/*/callback)
    const integration = params.get('integration');
    const status = params.get('status');
    const message = params.get('message');
    if (integration && status) {
      const providerLabel = getIntegrationById(integration)?.name || integration;
      if (status === 'success') {
        setOauthMessage({ type: 'success', text: `${providerLabel} connecté avec succès !` });
        queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      } else {
        setOauthMessage({
          type: 'error',
          text: `Erreur ${providerLabel} : ${(message || 'connexion échouée').replace(/_/g, ' ')}`,
        });
      }
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    // Legacy format
    const success = params.get('success');
    const error = params.get('error');
    if (success) {
      setOauthMessage({ type: 'success', text: `${success.charAt(0).toUpperCase() + success.slice(1)} connecté avec succès !` });
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      setOauthMessage({ type: 'error', text: `Erreur de connexion : ${error.replace(/_/g, ' ')}` });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

  const handleTestConnection = async (integrationId) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ integration_id: integrationId }),
      });
      const data = await res.json();
      // Refetch integrations list to get updated status
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      return data;
    } catch {
      return { ok: false, message: 'Erreur reseau' };
    }
  };

  const [apiKeyProvider, setApiKeyProvider] = useState(null);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeySaving, setApiKeySaving] = useState(false);

  const [smtpProvider, setSmtpProvider] = useState(null);
  const [smtpValues, setSmtpValues] = useState({});
  const [smtpSaving, setSmtpSaving] = useState(false);

  const handleSmtpSubmit = async () => {
    if (!smtpProvider || !clientId) return;
    // Validate required fields
    const required = ['email', 'smtp_host', 'smtp_port', 'imap_host', 'imap_port', 'username', 'password'];
    const missing = required.filter(key => !smtpValues[key] || String(smtpValues[key]).trim() === '');
    if (missing.length > 0) {
      toastError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setSmtpSaving(true);
    try {
      const { error } = await supabase.from('client_integrations').upsert({
        client_id: clientId,
        provider: smtpProvider.id,
        provider_label: 'Email personnalisé (SMTP/IMAP)',
        auth_type: 'smtp',
        status: 'active',
        api_key: String(smtpValues.password),
        extra_config: {
          email: String(smtpValues.email),
          smtp_host: String(smtpValues.smtp_host),
          smtp_port: parseInt(smtpValues.smtp_port) || 587,
          imap_host: String(smtpValues.imap_host),
          imap_port: parseInt(smtpValues.imap_port) || 993,
          username: String(smtpValues.username),
          use_ssl: smtpValues.use_ssl !== false,
        },
        connected_at: new Date().toISOString(),
      }, { onConflict: 'client_id,provider' });
      if (error) {
        console.error('SMTP save error:', error);
        toastError('Erreur: ' + error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
        setSmtpProvider(null);
        setSmtpValues({});
        toastSuccess('Configuration SMTP enregistrée');
      }
    } catch (err) {
      console.error('SMTP error:', err);
      toastError('Erreur: ' + err.message);
    }
    setSmtpSaving(false);
  };

  const handleOAuthConnect = async (provider) => {
    // Check integration limit before connecting
    try {
      const { getLimit, getPlanConfig } = await import('../../lib/plans.js')
      const { data: clientRow } = await supabase.from('clients').select('plan').eq('id', clientId).maybeSingle()
      const plan = clientRow?.plan || 'free'

      const integLimit = getLimit(plan, 'integrations')
      const connectedCount = integrations?.filter(i => i.status === 'active')?.length || 0
      if (integLimit !== Infinity && connectedCount >= integLimit) {
        const planName = getPlanConfig(plan).name
        toast?.error?.(`Limite atteinte : ${integLimit} integration${integLimit > 1 ? 's' : ''} sur le plan ${planName}. Passez au plan superieur.`)
        return
      }
    } catch { /* skip if plans.js not available */ }

    // Check conflict groups (e.g. only one e-commerce platform, one helpdesk, one email sender)
    const conflicting = getConflictingActive(provider.id, integrations || [])
    if (conflicting) {
      const [, group] = getConflictGroup(provider.id) || []
      const conflictConfig = getIntegrationById(conflicting.provider)
      const confirmed = window.confirm(
        `${group?.message || 'Conflit d\'intégration détecté.'}\n\n` +
        `${conflictConfig?.name || conflicting.provider} est déjà connecté. ` +
        `Voulez-vous le déconnecter et connecter ${provider.name} à la place ?`
      )
      if (!confirmed) return
      // Disconnect the conflicting integration
      try {
        await supabase.from('client_integrations').update({ status: 'disconnected' }).eq('id', conflicting.id)
        queryClient.invalidateQueries({ queryKey: ['client-integrations'] })
      } catch (err) {
        console.error('Failed to disconnect conflicting integration:', err)
        return
      }
    }

    if (provider.authType === 'smtp') {
      setSmtpProvider(provider);
      setSmtpValues({});
      return;
    }
    if (provider.authType === 'api_key') {
      setApiKeyProvider(provider);
      setApiKeyValue('');
      return;
    }
    if (provider.authType === 'embedded_signup' && provider.wizardRoute) {
      window.location.href = provider.wizardRoute;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (provider.oauthPrompt) {
      setOauthPromptProvider(provider);
      setOauthPromptValue('');
    } else if (provider.oauthUrl) {
      const url = provider.oauthUrl({ token: session.access_token, client_id: clientId });
      window.location.href = url;
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKeyValue.trim() || !apiKeyProvider || !clientId) return;
    setApiKeySaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/integrations/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          provider: apiKeyProvider.id,
          provider_label: apiKeyProvider.name,
          credentials: { api_key: apiKeyValue.trim() },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // If API test failed, save anyway but show warning
        if (data.test_failed) {
          toastError('Test de connexion échoué (' + data.error + '). Clé sauvegardée — vérifiez vos identifiants.');
        } else {
          throw new Error(data.error || 'Erreur connexion');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
      setApiKeyProvider(null);
      setApiKeyValue('');
      if (res.ok) toastSuccess('Intégration connectée');
    } catch (err) {
      // Fallback: save directly to DB
      try {
        const { error } = await supabase.from('client_integrations').upsert({
          client_id: clientId,
          provider: apiKeyProvider.id,
          provider_label: apiKeyProvider.name || apiKeyProvider.id,
          auth_type: 'api_key',
          status: 'active',
          api_key: apiKeyValue.trim(),
          connected_at: new Date().toISOString(),
        }, { onConflict: 'client_id,provider' });
        if (error) {
          toastError('Erreur: ' + error.message);
        } else {
          queryClient.invalidateQueries({ queryKey: ['client-integrations'] });
          setApiKeyProvider(null);
          setApiKeyValue('');
          toastSuccess('Intégration connectée');
        }
      } catch (e) {
        toastError('Erreur: ' + e.message);
      }
    }
    setApiKeySaving(false);
  };

  const handleOAuthPromptSubmit = async () => {
    if (!oauthPromptValue.trim() || !oauthPromptProvider) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const url = oauthPromptProvider.oauthUrl({
      [oauthPromptProvider.oauthPrompt]: oauthPromptValue.trim(),
      token: session.access_token,
      client_id: clientId,
    });
    setOauthPromptProvider(null);
    window.location.href = url;
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

  // Build categories from INTEGRATION_CATEGORIES — preserves order and descriptions
  const categories = INTEGRATION_CATEGORIES.map((cat) => ({
    key: cat.id,
    label: cat.label,
    description: cat.description,
    providers: cat.ids.map((id) => getIntegrationById(id)).filter(Boolean),
  })).filter((cat) => cat.providers.length > 0);

  // Check if a provider is blocked by a conflict (same group already has active integration)
  const isConflictBlocked = (providerId) => {
    const conflicting = getConflictingActive(providerId, integrations || [])
    return conflicting && conflicting.provider !== providerId ? conflicting : null
  }

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-2xl italic tracking-tight text-[#1a1a1a]"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400 }}
        >
          Intégrations
        </h2>
        <p className="text-[15px] mt-1 text-[#5A5A5A]">
          Connecte tes outils pour que ton agent puisse agir — lire les commandes, répondre aux tickets, mettre à jour les clients.
        </p>
      </div>

      {/* Overview banner */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gradient-to-br from-cta/5 via-white to-white border border-cta/10 rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cta/10 flex items-center justify-center">
            <Plug className="w-5 h-5 text-cta" />
          </div>
          <div>
            <p className="text-xl font-bold text-[#1a1a1a]">{connectedCount}</p>
            <p className="text-[11px] text-[#71717a] uppercase tracking-wider font-semibold">
              Intégration{connectedCount > 1 ? 's' : ''} active{connectedCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une intégration…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all bg-white border border-gray-200 text-[#1a1a1a] focus:ring-2 focus:ring-cta/20 focus:border-cta/30"
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
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-red-50 text-red-600 border border-red-200'
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

      {!isLoading && connectedCount === 0 && (
        <div className="rounded-2xl border border-cta/20 bg-cta/[0.03]">
          <EmptyState
            icon={Plug}
            tone="cta"
            title="Aucune intégration connectée"
            description="Connecte Shopify en premier pour que ton agent accède aux commandes et réponde précisément à tes clients. Les autres outils (Gmail, Gorgias…) viennent ensuite."
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className={`w-6 h-6 animate-spin text-[#9ca3af]`} />
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

          const connectedInCategory = sorted.filter((p) => {
            const conn = p.id === 'shopify' ? shopifyConnected : !!getConnectionForProvider(p.id)
            return conn
          }).length

          return (
            <div key={cat.key}>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h3 className="text-[13px] font-bold text-[#1a1a1a]">
                    {cat.label}
                  </h3>
                  {cat.description && (
                    <p className="text-[11px] text-[#9ca3af] mt-0.5">{cat.description}</p>
                  )}
                </div>
                {connectedInCategory > 0 && (
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                    {connectedInCategory} connecté{connectedInCategory > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sorted.map(provider => {
                  const blockedBy = isConflictBlocked(provider.id)
                  return (
                    <IntegrationCard
                      key={provider.id}
                      provider={provider}
                      connection={getConnectionForProvider(provider.id)}
                      shopifyConnected={shopifyConnected}
                      shopifyDomain={shopifyDomain}
                      onOAuthConnect={handleOAuthConnect}
                      onTest={handleTestConnection}
                      onDisconnect={(conn) => setDisconnectTarget({ ...conn, providerName: provider.name })}
                      isLight={isLight}
                      blockedBy={blockedBy}
                    />
                  )
                })}
              </div>
            </div>
          );
        })
      )}

      {/* OAuth Prompt Modal (Shopify domain, Gorgias subdomain, etc.) */}
      <AnimatePresence>
        {oauthPromptProvider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" onClick={() => setOauthPromptProvider(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm mx-4 rounded-2xl border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] bg-white p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <ProviderIcon provider={oauthPromptProvider} connected={false} size={36} />
                <div>
                  <h3 className={`font-bold text-[#1a1a1a]`}>
                    Connecter {oauthPromptProvider.name}
                  </h3>
                </div>
              </div>
              <label className={`block text-xs font-bold mb-2 text-[#9ca3af]`}>
                {oauthPromptProvider.oauthPromptLabel}
              </label>
              <input
                type="text"
                value={oauthPromptValue}
                onChange={(e) => setOauthPromptValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOAuthPromptSubmit()}
                autoFocus
                placeholder={oauthPromptProvider.oauthPromptPlaceholder || 'ma-boutique'}
                className={`w-full px-4 py-3 rounded-lg text-[13px] outline-none transition-all bg-[#fafafa] border border-[#ebebeb] text-[#1a1a1a] focus:ring-1 focus:ring-cta/20`}
              />
              {oauthPromptProvider.oauthPromptHint && (
                <p className={`text-xs mt-1.5 mb-4 text-[#9ca3af]`}>
                  {oauthPromptProvider.oauthPromptHint}
                </p>
              )}
              {!oauthPromptProvider.oauthPromptHint && <div className="mb-5" />}
              <div className="flex gap-3">
                <button
                  onClick={() => setOauthPromptProvider(null)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    'bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb]'
                  }`}
                >
                  Annuler
                </button>
                <button
                  onClick={handleOAuthPromptSubmit}
                  disabled={!oauthPromptValue.trim()}
                  className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold text-[#1a1a1a] disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: oauthPromptProvider.color || '#10b981' }}
                >
                  <ExternalLink className="w-4 h-4" /> Connecter
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      {apiKeyProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm" onClick={() => setApiKeyProvider(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-sm mx-4 rounded-2xl border shadow-2xl p-6 bg-white border-[#ebebeb]"
          >
            <div className="flex items-center gap-3 mb-5">
              <ProviderIcon provider={apiKeyProvider} connected={false} size={36} />
              <div>
                <h3 className="font-bold text-[#1a1a1a]">Connecter {apiKeyProvider.name}</h3>
                <p className="text-xs text-[#9ca3af]">{apiKeyProvider.description}</p>
              </div>
            </div>
            <label className="block text-xs font-bold mb-2 text-[#9ca3af]">
              {apiKeyProvider.apiKeyLabel || 'Clé API'}
            </label>
            <input
              type="text"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
              autoFocus
              placeholder={apiKeyProvider.apiKeyPlaceholder || 'Votre clé API...'}
              className="w-full px-4 py-3 rounded-lg text-[13px] outline-none bg-[#fafafa] border border-[#ebebeb] text-[#1a1a1a] focus:ring-1 focus:ring-cta/20"
            />
            {apiKeyProvider.apiKeyHint && (
              <p className="text-xs mt-1.5 mb-4 text-[#9ca3af]">{apiKeyProvider.apiKeyHint}</p>
            )}
            {!apiKeyProvider.apiKeyHint && <div className="mb-5" />}
            <div className="flex gap-3">
              <button
                onClick={() => setApiKeyProvider(null)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleApiKeySubmit}
                disabled={!apiKeyValue.trim() || apiKeySaving}
                className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-cta text-white hover:bg-[#003725] disabled:opacity-50 transition-colors"
              >
                {apiKeySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                Connecter
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SMTP Config Modal */}
      {smtpProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSmtpProvider(null)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl p-6 bg-white border border-[#f0f0f0]"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-[14px] text-[#1a1a1a]">Email personnalise</h3>
                <p className="text-[11px] text-[#9ca3af]">Connectez votre adresse email professionnelle</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {(smtpProvider.smtpFields || []).map(field => (
                <div key={field.key}>
                  <label className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wider">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[12px] text-[#1a1a1a]">{field.label}</span>
                      <button
                        onClick={() => setSmtpValues(v => ({ ...v, [field.key]: !(v[field.key] ?? field.defaultValue) }))}
                        className={`relative w-10 h-5 rounded-full transition-colors ${(smtpValues[field.key] ?? field.defaultValue) ? 'bg-cta' : 'bg-[#e5e5e5]'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${(smtpValues[field.key] ?? field.defaultValue) ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={smtpValues[field.key] || ''}
                      onChange={(e) => setSmtpValues(v => ({ ...v, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="mt-1 w-full px-3 py-2.5 bg-[#fafafa] border border-[#ebebeb] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setSmtpProvider(null)}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[#f5f5f5] text-[#71717a] hover:bg-[#ebebeb] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSmtpSubmit}
                disabled={smtpSaving}
                className="flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#003725] disabled:opacity-50 transition-colors"
              >
                {smtpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                Connecter
              </button>
            </div>
          </motion.div>
        </div>
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
