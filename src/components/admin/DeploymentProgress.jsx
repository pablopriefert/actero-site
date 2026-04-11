import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  X, Loader2, CheckCircle2, AlertTriangle, XCircle,
  Clock, ChevronDown, ChevronUp, ExternalLink, Copy,
  Check, Rocket, PartyPopper, Workflow, Shield,
  Mail, Globe, Zap, FileCheck, Play, Flag
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const STEP_ICONS = {
  validate: Shield,
  brand_context: Globe,
  email_config: Mail,
  deploy_workflows: Workflow,
  checklist: FileCheck,
  test_workflows: Play,
  activate: Zap,
  finalize: Flag,
};

const STATUS_STYLES = {
  pending: { color: 'text-[#71717a]', bg: 'bg-[#fafafa]0/10', border: 'border-gray-500/20', label: 'En attente' },
  running: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'En cours' },
  success: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Succes' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Warning' },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Echec' },
};

export const DeploymentProgress = ({ deploymentId, clientName, onClose }) => {
  const [expandedStep, setExpandedStep] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const startTimeRef = useRef(Date.now());

  // Poll deployment status
  const { data: deployment, isLoading } = useQuery({
    queryKey: ['deployment', deploymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deployments')
        .select('*')
        .eq('id', deploymentId)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' ? 2000 : false;
    },
    enabled: !!deploymentId,
  });

  // Timer
  useEffect(() => {
    if (!deployment || deployment.status === 'running') {
      const interval = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 100);
      return () => clearInterval(interval);
    } else if (deployment?.total_duration_ms) {
      setElapsed(deployment.total_duration_ms);
    }
  }, [deployment?.status]);

  // Auto-expand running step
  useEffect(() => {
    if (deployment?.steps) {
      const runningStep = deployment.steps.find(s => s.status === 'running');
      if (runningStep) setExpandedStep(runningStep.name);
    }
  }, [deployment?.steps]);

  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  };

  const steps = deployment?.steps || [];
  const completedSteps = steps.filter(s => ['success', 'warning'].includes(s.status)).length;
  const totalSteps = steps.length;
  const isRunning = deployment?.status === 'running';
  const isCompleted = ['completed', 'completed_with_warnings'].includes(deployment?.status);
  const isFailed = deployment?.status === 'failed';
  const workflowsDeployed = deployment?.workflows_deployed || [];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (isLoading && !deployment) {
    return (
      <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#1a1a1a] animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-white/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#f0f0f0]">
          <div>
            <h2 className="text-[15px] font-bold text-[#1a1a1a] flex items-center gap-2">
              <Rocket className="w-5 h-5 text-emerald-500" />
              Deploiement — {clientName}
            </h2>
            <p className="text-[12px] text-[#71717a] mt-0.5">
              {isRunning ? 'En cours...' : isCompleted ? 'Termine' : isFailed ? 'Echec' : 'Initialisation...'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Timer */}
            <div className={`font-mono text-[15px] font-bold ${isRunning ? 'text-blue-400' : isCompleted ? 'text-emerald-500' : 'text-red-400'}`}>
              {formatDuration(elapsed)}
            </div>
            {!isRunning && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#fafafa] transition-colors">
                <X className="w-5 h-5 text-[#71717a]" />
              </button>
            )}
          </div>
        </div>

        {/* Global progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] text-[#71717a]">{completedSteps}/{totalSteps} etapes</span>
            <span className="text-[12px] text-[#71717a]">{totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-[#fafafa] rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isFailed ? 'bg-red-500' : 'bg-emerald-500'}`}
              animate={{ width: `${totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {steps.map((step, i) => {
            const StepIcon = STEP_ICONS[step.name] || Clock;
            const style = STATUS_STYLES[step.status] || STATUS_STYLES.pending;
            const isExpanded = expandedStep === step.name;
            const duration = step.duration_ms ? `${(step.duration_ms / 1000).toFixed(1)}s` : null;

            return (
              <motion.div
                key={step.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.name)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${style.bg} ${style.border}`}
                >
                  {/* Status icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                    {step.status === 'running' ? (
                      <Loader2 className={`w-4 h-4 ${style.color} animate-spin`} />
                    ) : step.status === 'success' ? (
                      <CheckCircle2 className={`w-4 h-4 ${style.color}`} />
                    ) : step.status === 'warning' ? (
                      <AlertTriangle className={`w-4 h-4 ${style.color}`} />
                    ) : step.status === 'failed' ? (
                      <XCircle className={`w-4 h-4 ${style.color}`} />
                    ) : (
                      <StepIcon className={`w-4 h-4 ${style.color}`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#1a1a1a]">{step.label}</p>
                    {step.details && !isExpanded && (
                      <p className="text-[12px] text-[#71717a] truncate mt-0.5">{step.details}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {duration && (
                      <span className="text-[10px] font-mono text-[#71717a]">{duration}</span>
                    )}
                    {(step.details || step.error) && (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-[#71717a]" /> : <ChevronDown className="w-4 h-4 text-[#71717a]" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (step.details || step.error) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 mx-3 mt-1 bg-[#fafafa] rounded-lg border border-[#f0f0f0]">
                        {step.details && (
                          <p className="text-[12px] text-[#71717a]">{step.details}</p>
                        )}
                        {step.error && (
                          <p className="text-[12px] text-red-400 mt-1">{step.error}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Completion summary */}
        {(isCompleted || isFailed) && (
          <div className="p-6 border-t border-[#f0f0f0]">
            {isCompleted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <PartyPopper className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#1a1a1a]">Deploiement termine !</p>
                    <p className="text-[12px] text-[#71717a]">
                      {workflowsDeployed.filter(w => w.n8n_id).length} workflows deployes, {deployment?.tests_passed || 0} tests passes
                      {deployment?.tests_failed > 0 && `, ${deployment.tests_failed} echecs`}
                    </p>
                  </div>
                </div>

                {/* Deployed workflows */}
                {workflowsDeployed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[12px] font-medium text-[#71717a] uppercase tracking-wider">Workflows deployes</p>
                    {workflowsDeployed.map((wf, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-[#fafafa] rounded-lg border border-[#f0f0f0]">
                        <div className={`w-2 h-2 rounded-full ${wf.error ? 'bg-red-400' : wf.skipped ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#1a1a1a] truncate">{wf.name}</p>
                          {wf.error && <p className="text-[12px] text-red-400 mt-0.5">{wf.error}</p>}
                          {wf.skipped && <p className="text-[12px] text-amber-400 mt-0.5">Deja existant — ignore</p>}
                        </div>
                        {wf.webhook_url && (
                          <button
                            onClick={() => copyToClipboard(wf.webhook_url)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#71717a] bg-[#fafafa] rounded-md hover:bg-[#fafafa] transition-colors"
                          >
                            {copiedUrl === wf.webhook_url ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            Webhook
                          </button>
                        )}
                        {wf.n8n_id && (
                          <a
                            href={`${import.meta.env.VITE_N8N_URL || '#'}/workflow/${wf.n8n_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[#71717a] hover:text-[#1a1a1a] transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-3 bg-white text-[#1a1a1a] rounded-xl text-[13px] font-bold hover:bg-gray-200 transition-colors"
                >
                  Fermer
                </button>
              </motion.div>
            )}

            {isFailed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-red-400">Deploiement echoue</p>
                    <p className="text-[12px] text-[#71717a] mt-0.5">Verifiez les details des etapes ci-dessus pour comprendre l'erreur.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-[#fafafa] text-[#1a1a1a] rounded-xl text-[13px] font-bold hover:bg-[#f5f5f5] transition-colors"
                >
                  Fermer
                </button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
