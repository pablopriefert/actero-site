import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, ChevronLeft, ChevronRight, Check, Save, Rocket,
  Building2, ShoppingBag, Globe, Mail, Workflow, Loader2,
  User, Phone, Link, HelpCircle, FileText, Search,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const ECOMMERCE_WORKFLOWS = [
  { id: 'sav', label: 'Agent SAV', description: 'Répond automatiquement aux tickets SAV avec le contexte de la marque', default: true },
  { id: 'cart_recovery', label: 'Paniers abandonnés', description: 'Relance intelligente des paniers abandonnés par email', default: true },
];

const IMMOBILIER_WORKFLOWS = [
  { id: 'lead_qualification', label: 'Qualification leads / Prise RDV', description: 'Qualifie les leads et propose des créneaux de visite automatiquement', default: true },
  { id: 'document_collection', label: 'Collecte documents', description: 'Envoie et suit la collecte des documents nécessaires', default: true },
  { id: 'prospect_followup', label: 'Relance prospects', description: 'Relance automatique des prospects inactifs avec un message personnalisé', default: true },
];

const STEPS = [
  { id: 'basics', label: 'Infos de base', icon: User },
  { id: 'business', label: 'Infos métier', icon: Building2 },
  { id: 'email', label: 'Config email', icon: Mail },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
];

const TICKETING_OPTIONS = [
  { value: 'gorgias', label: 'Gorgias' },
  { value: 'zendesk', label: 'Zendesk' },
  { value: 'freshdesk', label: 'Freshdesk' },
  { value: 'email_only', label: 'Email uniquement' },
  { value: 'none', label: 'Aucun' },
];

export const CallNotesWizard = ({ client, onClose, onDeployReady }) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    company_name: client?.brand_name || '',
    website_url: '',
    contact_name: '',
    contact_email: client?.contact_email || '',
    contact_phone: '',
    vertical: client?.client_type || 'ecommerce',
    // Ecommerce
    shopify_store_url: '',
    ticketing_tool: null,
    monthly_ticket_volume: '',
    avg_ticket_time_minutes: 5,
    hourly_support_cost: 25,
    wants_chatbot: false,
    avg_cart_value: '',
    monthly_abandoned_carts: '',
    // Immobilier
    agency_zones: '',
    agency_hours: '',
    visit_process: '',
    agents_names: '',
    agents_emails: '',
    crm_used: '',
    monthly_leads_volume: '',
    avg_response_time_hours: '',
    hourly_agent_cost: 30,
    // Email
    support_email: '',
    email_sending_preference: 'resend',
    smtp_host: '',
    smtp_port: '',
    smtp_user: '',
    smtp_password: '',
    url_cgv: '',
    url_livraison: '',
    url_retours: '',
    url_faq: '',
    url_about: '',
    // Workflows
    workflows_requested: [],
    // Status
    status: 'draft',
  });

  // Load existing call notes
  const { data: existingNotes, isLoading } = useQuery({
    queryKey: ['call-notes', client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data } = await supabase
        .from('call_notes')
        .select('*')
        .eq('client_id', client.id)
        .maybeSingle();
      return data;
    },
    enabled: !!client?.id,
  });

  // Load Shopify connection
  const { data: shopifyConn } = useQuery({
    queryKey: ['shopify-conn', client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data } = await supabase
        .from('client_shopify_connections')
        .select('shop_domain')
        .eq('client_id', client.id)
        .maybeSingle();
      return data;
    },
    enabled: !!client?.id,
  });

  // Populate form from existing notes
  useEffect(() => {
    if (existingNotes) {
      setForm(prev => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(existingNotes).filter(([k, v]) => v !== null && k in prev)
        ),
        workflows_requested: existingNotes.workflows_requested || [],
      }));
    }
  }, [existingNotes]);

  // Pre-fill Shopify URL
  useEffect(() => {
    if (shopifyConn?.shop_domain && !form.shopify_store_url) {
      setForm(prev => ({ ...prev, shopify_store_url: shopifyConn.shop_domain }));
    }
  }, [shopifyConn]);

  // Set default workflows when vertical changes
  useEffect(() => {
    if (!existingNotes && form.workflows_requested.length === 0) {
      const defaults = form.vertical === 'ecommerce'
        ? ECOMMERCE_WORKFLOWS.filter(w => w.default).map(w => w.id)
        : IMMOBILIER_WORKFLOWS.filter(w => w.default).map(w => w.id);
      setForm(prev => ({ ...prev, workflows_requested: defaults }));
    }
  }, [form.vertical, existingNotes]);

  const updateField = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Auto-save draft on step change
  const saveDraft = useCallback(async () => {
    if (!client?.id) return;
    setSaving(true);
    try {
      const payload = {
        client_id: client.id,
        company_name: form.company_name || client.brand_name || 'Sans nom',
        website_url: form.website_url || 'https://',
        contact_name: form.contact_name || 'Non renseigné',
        contact_email: form.contact_email || 'non@renseigne.fr',
        contact_phone: form.contact_phone || null,
        vertical: form.vertical,
        shopify_store_url: form.shopify_store_url || null,
        ticketing_tool: form.ticketing_tool || null,
        monthly_ticket_volume: form.monthly_ticket_volume ? parseInt(form.monthly_ticket_volume) : null,
        avg_ticket_time_minutes: parseInt(form.avg_ticket_time_minutes) || 5,
        hourly_support_cost: parseInt(form.hourly_support_cost) || 25,
        wants_chatbot: form.wants_chatbot,
        avg_cart_value: form.avg_cart_value ? parseInt(form.avg_cart_value) : null,
        monthly_abandoned_carts: form.monthly_abandoned_carts ? parseInt(form.monthly_abandoned_carts) : null,
        agency_zones: form.agency_zones || null,
        agency_hours: form.agency_hours || null,
        visit_process: form.visit_process || null,
        agents_names: form.agents_names || null,
        agents_emails: form.agents_emails || null,
        crm_used: form.crm_used || null,
        monthly_leads_volume: form.monthly_leads_volume ? parseInt(form.monthly_leads_volume) : null,
        avg_response_time_hours: form.avg_response_time_hours ? parseInt(form.avg_response_time_hours) : null,
        hourly_agent_cost: parseInt(form.hourly_agent_cost) || 30,
        support_email: form.support_email || null,
        email_sending_preference: form.email_sending_preference,
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port ? parseInt(form.smtp_port) : null,
        smtp_user: form.smtp_user || null,
        smtp_password: form.smtp_password || null,
        url_cgv: form.url_cgv || null,
        url_livraison: form.url_livraison || null,
        url_retours: form.url_retours || null,
        url_faq: form.url_faq || null,
        url_about: form.url_about || null,
        workflows_requested: form.workflows_requested,
        status: 'draft',
      };

      const { error } = await supabase
        .from('call_notes')
        .upsert(payload, { onConflict: 'client_id' });

      if (error) console.error('Save draft error:', error);
    } catch (err) {
      console.error('Save draft error:', err);
    }
    setSaving(false);
  }, [client?.id, form]);

  const handleStepChange = async (newStep) => {
    await saveDraft();
    setCurrentStep(newStep);
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const payload = {
        client_id: client.id,
        company_name: form.company_name || client.brand_name || 'Sans nom',
        website_url: form.website_url || 'https://',
        contact_name: form.contact_name || 'Non renseigné',
        contact_email: form.contact_email || 'non@renseigne.fr',
        contact_phone: form.contact_phone || null,
        vertical: form.vertical,
        shopify_store_url: form.shopify_store_url || null,
        ticketing_tool: form.ticketing_tool || null,
        monthly_ticket_volume: form.monthly_ticket_volume ? parseInt(form.monthly_ticket_volume) : null,
        avg_ticket_time_minutes: parseInt(form.avg_ticket_time_minutes) || 5,
        hourly_support_cost: parseInt(form.hourly_support_cost) || 25,
        wants_chatbot: form.wants_chatbot,
        avg_cart_value: form.avg_cart_value ? parseInt(form.avg_cart_value) : null,
        monthly_abandoned_carts: form.monthly_abandoned_carts ? parseInt(form.monthly_abandoned_carts) : null,
        agency_zones: form.agency_zones || null,
        agency_hours: form.agency_hours || null,
        visit_process: form.visit_process || null,
        agents_names: form.agents_names || null,
        agents_emails: form.agents_emails || null,
        crm_used: form.crm_used || null,
        monthly_leads_volume: form.monthly_leads_volume ? parseInt(form.monthly_leads_volume) : null,
        avg_response_time_hours: form.avg_response_time_hours ? parseInt(form.avg_response_time_hours) : null,
        hourly_agent_cost: parseInt(form.hourly_agent_cost) || 30,
        support_email: form.support_email || null,
        email_sending_preference: form.email_sending_preference,
        smtp_host: form.smtp_host || null,
        smtp_port: form.smtp_port ? parseInt(form.smtp_port) : null,
        smtp_user: form.smtp_user || null,
        smtp_password: form.smtp_password || null,
        url_cgv: form.url_cgv || null,
        url_livraison: form.url_livraison || null,
        url_retours: form.url_retours || null,
        url_faq: form.url_faq || null,
        url_about: form.url_about || null,
        workflows_requested: form.workflows_requested,
        status: 'complete',
        completed_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('call_notes')
        .upsert(payload, { onConflict: 'client_id' });

      if (error) throw error;

      setForm(prev => ({ ...prev, status: 'complete' }));
      queryClient.invalidateQueries({ queryKey: ['call-notes', client.id] });
    } catch (err) {
      console.error('Complete error:', err);
    }
    setSaving(false);
  };

  const handleAutoDetect = async () => {
    if (!form.website_url) return;
    setAutoDetecting(true);
    const baseUrl = form.website_url.replace(/\/+$/, '');
    const attempts = [
      { field: 'url_cgv', paths: ['/policies/terms-of-service', '/pages/cgv', '/cgv'] },
      { field: 'url_livraison', paths: ['/policies/shipping-policy', '/pages/livraison', '/livraison'] },
      { field: 'url_retours', paths: ['/policies/refund-policy', '/pages/retours', '/retours'] },
      { field: 'url_faq', paths: ['/pages/faq', '/faq'] },
      { field: 'url_about', paths: ['/pages/about', '/pages/a-propos', '/about'] },
    ];

    const newUrls = {};
    for (const attempt of attempts) {
      for (const path of attempt.paths) {
        try {
          const testUrl = `${baseUrl}${path}`;
          const res = await fetch(testUrl, { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(3000) });
          newUrls[attempt.field] = testUrl;
          break;
        } catch {
          continue;
        }
      }
    }

    setForm(prev => ({ ...prev, ...newUrls }));
    setAutoDetecting(false);
  };

  const toggleWorkflow = (wfId) => {
    setForm(prev => ({
      ...prev,
      workflows_requested: prev.workflows_requested.includes(wfId)
        ? prev.workflows_requested.filter(id => id !== wfId)
        : [...prev.workflows_requested, wfId],
    }));
  };

  const isComplete = form.status === 'complete' || existingNotes?.status === 'complete';
  const isDeployed = form.status === 'deployed' || existingNotes?.status === 'deployed';

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1a1a1a] animate-spin" />
      </div>
    );
  }

  const availableWorkflows = form.vertical === 'ecommerce' ? ECOMMERCE_WORKFLOWS : IMMOBILIER_WORKFLOWS;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#f0f0f0]">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1a1a]">Notes de call — {client?.brand_name}</h2>
            <p className="text-[12px] text-[#71717a] mt-0.5">
              {isDeployed ? 'Deploye' : isComplete ? 'Complet — pret pour le deploiement' : 'Brouillon'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 text-[#71717a] animate-spin" />}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#fafafa] transition-colors">
              <X className="w-5 h-5 text-[#71717a]" />
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 border-b border-[#f0f0f0]">
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === currentStep;
              const isDone = i < currentStep;
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => handleStepChange(i)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                      isActive
                        ? 'bg-[#fafafa] text-[#1a1a1a]'
                        : isDone
                        ? 'text-emerald-500 hover:bg-[#fafafa]'
                        : 'text-[#71717a] hover:bg-[#fafafa]'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <StepIcon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px ${isDone ? 'bg-emerald-500/30' : 'bg-[#fafafa]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-[#fafafa] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <StepBasics form={form} updateField={updateField} key="step-0" />
            )}
            {currentStep === 1 && (
              <StepBusiness form={form} updateField={updateField} key="step-1" />
            )}
            {currentStep === 2 && (
              <StepEmail form={form} updateField={updateField} onAutoDetect={handleAutoDetect} autoDetecting={autoDetecting} key="step-2" />
            )}
            {currentStep === 3 && (
              <StepWorkflows form={form} toggleWorkflow={toggleWorkflow} workflows={availableWorkflows} key="step-3" />
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#f0f0f0] flex items-center justify-between">
          <button
            onClick={() => currentStep > 0 && handleStepChange(currentStep - 1)}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#71717a] hover:text-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="flex items-center gap-3">
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={() => handleStepChange(currentStep + 1)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1a1a1a] rounded-xl text-[13px] font-bold hover:bg-gray-200 transition-colors"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                {!isComplete && !isDeployed && (
                  <button
                    onClick={handleComplete}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-[13px] font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder les notes
                  </button>
                )}
                {(isComplete && !isDeployed) && (
                  <button
                    onClick={() => onDeployReady?.(client.id)}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl text-[13px] font-bold hover:from-emerald-500 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Rocket className="w-5 h-5" />
                    Lancer le deploiement
                  </button>
                )}
                {isDeployed && (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl text-[13px] font-bold border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                    Deploye
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- Step Components ---

function InputField({ label, value, onChange, type = 'text', placeholder, suffix, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[12px] font-medium text-[#71717a] mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-[#fafafa] border border-[#f0f0f0] rounded-lg text-[13px] text-[#1a1a1a] placeholder-gray-600 outline-none focus:border-gray-300 transition-colors"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#71717a]">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#71717a] mb-1.5">{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-[#fafafa] border border-[#f0f0f0] rounded-lg text-[13px] text-[#1a1a1a] placeholder-gray-600 outline-none focus:border-gray-300 transition-colors resize-none"
      />
    </div>
  );
}

function StepBasics({ form, updateField }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <InputField label="Nom de l'entreprise" value={form.company_name} onChange={v => updateField('company_name', v)} placeholder="Ma Boutique" />
      <InputField label="URL du site web" value={form.website_url} onChange={v => updateField('website_url', v)} placeholder="https://maboutique.com" />

      <div className="grid grid-cols-2 gap-4">
        <InputField label="Nom du contact" value={form.contact_name} onChange={v => updateField('contact_name', v)} placeholder="Jean Dupont" />
        <InputField label="Email du contact" value={form.contact_email} onChange={v => updateField('contact_email', v)} placeholder="jean@maboutique.com" type="email" />
      </div>

      <InputField label="Telephone" value={form.contact_phone} onChange={v => updateField('contact_phone', v)} placeholder="06 12 34 56 78" type="tel" />

      {/* Vertical selection */}
      <div>
        <label className="block text-[12px] font-medium text-[#71717a] mb-2">Verticale</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'ecommerce', label: 'E-commerce', icon: ShoppingBag, color: 'emerald' },
            { value: 'immobilier', label: 'Immobilier', icon: Building2, color: 'violet' },
          ].map(opt => {
            const Icon = opt.icon;
            const selected = form.vertical === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateField('vertical', opt.value)}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  selected
                    ? `border-${opt.color}-500/30 bg-${opt.color}-500/10`
                    : 'border-[#f0f0f0] bg-[#fafafa] hover:border-gray-300'
                }`}
              >
                <Icon className={`w-5 h-5 ${selected ? `text-${opt.color}-400` : 'text-[#71717a]'}`} />
                <span className={`text-[13px] font-medium ${selected ? 'text-[#1a1a1a]' : 'text-[#71717a]'}`}>{opt.label}</span>
                {selected && <Check className={`w-4 h-4 ml-auto text-${opt.color}-400`} />}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function StepBusiness({ form, updateField }) {
  if (form.vertical === 'ecommerce') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-4"
      >
        <InputField label="URL boutique Shopify" value={form.shopify_store_url} onChange={v => updateField('shopify_store_url', v)} placeholder="monstore.myshopify.com" />

        <div>
          <label className="block text-[12px] font-medium text-[#71717a] mb-1.5">Outil de ticketing</label>
          <select
            value={form.ticketing_tool || ''}
            onChange={e => updateField('ticketing_tool', e.target.value || null)}
            className="w-full px-3 py-2 bg-[#fafafa] border border-[#f0f0f0] rounded-lg text-[13px] text-[#1a1a1a] outline-none focus:border-gray-300 transition-colors"
          >
            <option value="">Selectionner...</option>
            {TICKETING_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField label="Volume tickets/mois" value={form.monthly_ticket_volume} onChange={v => updateField('monthly_ticket_volume', v)} type="number" placeholder="200" />
          <InputField label="Temps moyen par ticket" value={form.avg_ticket_time_minutes} onChange={v => updateField('avg_ticket_time_minutes', v)} type="number" suffix="min" />
        </div>

        <InputField label="Cout horaire support" value={form.hourly_support_cost} onChange={v => updateField('hourly_support_cost', v)} type="number" suffix="EUR/h" />

        <div className="flex items-center justify-between p-3 bg-[#fafafa] border border-[#f0f0f0] rounded-lg">
          <span className="text-[13px] text-[#71717a]">Chatbot souhaite ?</span>
          <button
            onClick={() => updateField('wants_chatbot', !form.wants_chatbot)}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.wants_chatbot ? 'bg-emerald-500' : 'bg-[#fafafa]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.wants_chatbot ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField label="Panier moyen" value={form.avg_cart_value} onChange={v => updateField('avg_cart_value', v)} type="number" suffix="EUR" placeholder="80" />
          <InputField label="Paniers abandonnes/mois" value={form.monthly_abandoned_carts} onChange={v => updateField('monthly_abandoned_carts', v)} type="number" placeholder="500" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <TextareaField label="Zones couvertes" value={form.agency_zones} onChange={v => updateField('agency_zones', v)} placeholder="Paris 1er-8e, Neuilly-sur-Seine, Levallois..." />
      <InputField label="Horaires d'ouverture" value={form.agency_hours} onChange={v => updateField('agency_hours', v)} placeholder="Lun-Ven 9h-19h, Sam 10h-17h" />
      <TextareaField label="Process de visite" value={form.visit_process} onChange={v => updateField('visit_process', v)} placeholder="Premier contact telephonique, puis visite sous 48h..." />
      <TextareaField label="Noms des agents (un par ligne)" value={form.agents_names} onChange={v => updateField('agents_names', v)} placeholder="Marie Dupont\nJean Martin" />
      <TextareaField label="Emails des agents (un par ligne)" value={form.agents_emails} onChange={v => updateField('agents_emails', v)} placeholder="marie@agence.fr\njean@agence.fr" />
      <InputField label="CRM utilise" value={form.crm_used} onChange={v => updateField('crm_used', v)} placeholder="Apimo, Hektor, autre..." />

      <div className="grid grid-cols-2 gap-4">
        <InputField label="Volume leads portails/mois" value={form.monthly_leads_volume} onChange={v => updateField('monthly_leads_volume', v)} type="number" placeholder="50" />
        <InputField label="Temps de reponse actuel" value={form.avg_response_time_hours} onChange={v => updateField('avg_response_time_hours', v)} type="number" suffix="h" placeholder="24" />
      </div>

      <InputField label="Cout horaire agent" value={form.hourly_agent_cost} onChange={v => updateField('hourly_agent_cost', v)} type="number" suffix="EUR/h" />
    </motion.div>
  );
}

function StepEmail({ form, updateField, onAutoDetect, autoDetecting }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <InputField label="Email de support" value={form.support_email} onChange={v => updateField('support_email', v)} placeholder="support@maboutique.com" type="email" />

      <div>
        <label className="block text-[12px] font-medium text-[#71717a] mb-2">Preference d'envoi</label>
        <div className="space-y-2">
          {[
            { value: 'resend', label: 'Resend (recommande)', desc: 'Emails depuis le domaine du client' },
            { value: 'smtp_client', label: 'SMTP client', desc: 'Utilise le serveur SMTP du client' },
            { value: 'smtp_actero', label: 'SMTP Actero', desc: 'Emails depuis @actero.fr' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => updateField('email_sending_preference', opt.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                form.email_sending_preference === opt.value
                  ? 'border-emerald-500/30 bg-emerald-500/10'
                  : 'border-[#f0f0f0] bg-[#fafafa] hover:border-gray-300'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                form.email_sending_preference === opt.value ? 'border-emerald-500' : 'border-gray-600'
              }`}>
                {form.email_sending_preference === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#1a1a1a]">{opt.label}</p>
                <p className="text-[12px] text-[#71717a]">{opt.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {form.email_sending_preference === 'smtp_client' && (
        <div className="space-y-3 p-4 bg-[#fafafa] border border-[#f0f0f0] rounded-lg">
          <InputField label="Hote SMTP" value={form.smtp_host} onChange={v => updateField('smtp_host', v)} placeholder="smtp.gmail.com" />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Port" value={form.smtp_port} onChange={v => updateField('smtp_port', v)} type="number" placeholder="587" />
            <InputField label="Utilisateur" value={form.smtp_user} onChange={v => updateField('smtp_user', v)} placeholder="user@email.com" />
          </div>
          <InputField label="Mot de passe" value={form.smtp_password} onChange={v => updateField('smtp_password', v)} type="password" placeholder="********" />
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[12px] font-medium text-[#71717a]">Liens du site (pour le brand context)</label>
          <button
            onClick={onAutoDetect}
            disabled={autoDetecting || !form.website_url}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-emerald-500 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
          >
            {autoDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
            Auto-detecter
          </button>
        </div>
        <div className="space-y-3">
          <InputField label="CGV" value={form.url_cgv} onChange={v => updateField('url_cgv', v)} placeholder="https://site.com/policies/terms-of-service" />
          <InputField label="Livraison" value={form.url_livraison} onChange={v => updateField('url_livraison', v)} placeholder="https://site.com/policies/shipping-policy" />
          <InputField label="Retours" value={form.url_retours} onChange={v => updateField('url_retours', v)} placeholder="https://site.com/policies/refund-policy" />
          <InputField label="FAQ" value={form.url_faq} onChange={v => updateField('url_faq', v)} placeholder="https://site.com/pages/faq" />
          <InputField label="A propos" value={form.url_about} onChange={v => updateField('url_about', v)} placeholder="https://site.com/pages/about" />
        </div>
      </div>
    </motion.div>
  );
}

function StepWorkflows({ form, toggleWorkflow, workflows }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-3"
    >
      <p className="text-[13px] text-[#71717a] mb-4">
        Selectionnez les workflows a deployer pour ce client ({form.vertical === 'ecommerce' ? 'E-commerce' : 'Immobilier'})
      </p>
      {workflows.map(wf => {
        const selected = form.workflows_requested.includes(wf.id);
        return (
          <button
            key={wf.id}
            onClick={() => toggleWorkflow(wf.id)}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
              selected
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-[#f0f0f0] bg-[#fafafa] hover:border-gray-300'
            }`}
          >
            <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
              selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-600'
            }`}>
              {selected && <Check className="w-3 h-3 text-[#1a1a1a]" />}
            </div>
            <div>
              <p className="text-[13px] font-medium text-[#1a1a1a]">{wf.label}</p>
              <p className="text-[12px] text-[#71717a] mt-0.5">{wf.description}</p>
            </div>
          </button>
        );
      })}
    </motion.div>
  );
}
