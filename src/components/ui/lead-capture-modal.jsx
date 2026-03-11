import React, { useState } from 'react';
import { X, ArrowRight, Loader2, Sparkles } from 'lucide-react';

export const LeadCaptureModal = ({ isOpen, onClose, onSubmit }) => {
    const [email, setEmail] = useState('');
    const [brand, setBrand] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !brand) return;

        setIsSubmitting(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        setIsSubmitting(false);

        // Call parent handler
        onSubmit({ email, brand });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={!isSubmitting ? onClose : undefined}
            ></div>

            {/* Modal */}
            <div className="relative bg-[#0a0a0a] rounded-3xl p-8 md:p-10 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 z-10 border border-white/10 overflow-hidden">

                {/* Glow effect */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 blur-3xl rounded-full pointer-events-none"></div>

                <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-8">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/5">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Prêt à automatiser ?</h3>
                    <p className="text-gray-400 text-sm">Laissez-nous vos coordonnées, notre IA générera immédiatement une ébauche de solution pour votre marque.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="brandName" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nom de la marque</label>
                        <input
                            id="brandName"
                            type="text"
                            required
                            disabled={isSubmitting}
                            value={brand}
                            onChange={(e) => setBrand(e.target.value)}
                            placeholder="ex: Acme Corp"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label htmlFor="emailAddress" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email</label>
                        <input
                            id="emailAddress"
                            type="email"
                            required
                            disabled={isSubmitting}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@entreprise.com"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-colors disabled:opacity-50"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !email || !brand}
                        className="w-full mt-6 bg-white text-black px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Analyse de votre marque...</>
                        ) : (
                            <>Générer mon plan d'action <ArrowRight className="w-4 h-4" /></>
                        )}
                    </button>
                </form>

                <p className="text-[11px] text-gray-500 text-center mt-6">
                    Vos données sont sécurisées. Aucun spam prélevé.
                </p>

            </div>
        </div>
    );
};
