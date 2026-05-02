import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Minus, ChevronDown } from 'lucide-react'

/**
 * ComparisonTable — tableau comparatif détaillé des plans Actero.
 *
 * Extrait de PricingPage.jsx (anciennement 925 lignes) pour respecter la
 * limite < 400 lignes par fichier de la roadmap 30 jours.
 *
 * Props :
 *   - plans : array de plans Actero (depuis lib/plans)
 *   - comparisonCategories : array de catégories de features
 *   - defaultOpen : boolean (true par défaut — la comparaison est l'artefact
 *     le plus utile sur /tarifs, on ne la cache pas)
 */

const CellValue = ({ value }) => {
  if (value === true) return <Check className="w-5 h-5 text-cta mx-auto" />
  if (value === false) return <Minus className="w-4 h-4 text-gray-300 mx-auto" />
  return <span className="text-sm font-medium text-[#262626]">{value}</span>
}

export const ComparisonTable = ({ plans, comparisonCategories, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mt-24 max-w-6xl mx-auto">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-center gap-2 text-lg font-bold text-[#262626] mb-8 hover:text-cta transition-colors focus-visible:ring-2 focus-visible:ring-[#14A85C] focus-visible:ring-offset-2 rounded-lg"
      >
        Comparatif détaillé
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full min-w-[700px]">
                <thead className="sticky top-16 z-10 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 text-sm font-bold text-[#262626] w-[220px] sticky left-0 bg-white z-10" />
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`p-4 text-center text-sm font-bold text-[#262626] ${
                          plan.highlighted ? 'bg-cta/5' : ''
                        }`}
                      >
                        {plan.name}
                        {plan.highlighted && (
                          <span className="ml-2 text-[10px] bg-cta text-white px-2 py-0.5 rounded-full font-bold uppercase">
                            Populaire
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((cat) => (
                    <React.Fragment key={cat.name}>
                      <tr>
                        <td
                          colSpan={plans.length + 1}
                          className="px-4 pt-6 pb-2 text-xs font-bold text-[#716D5C] uppercase tracking-wider"
                        >
                          {cat.name}
                        </td>
                      </tr>
                      {cat.rows.map((row, idx) => (
                        <tr
                          key={row.label}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fafafa]'}
                        >
                          <td className="p-4 text-sm font-medium text-[#262626] sticky left-0 bg-inherit z-10">
                            {row.label}
                          </td>
                          {row.values.map((val, i) => (
                            <td
                              key={i}
                              className={`p-4 text-center ${
                                plans[i].highlighted ? 'bg-cta/5' : ''
                              }`}
                            >
                              <CellValue value={val} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ComparisonTable
