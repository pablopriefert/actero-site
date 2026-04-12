import { canAccess, PLAN_ORDER } from '../../lib/plans'
import { UpgradeBanner } from './UpgradeBanner'

export const PlanGate = ({ feature, planId, inTrial, children, fallback, minPlan }) => {
  let hasAccess = false

  if (inTrial) hasAccess = true
  else if (feature) hasAccess = canAccess(planId, feature)
  else if (minPlan) {
    const currentIdx = PLAN_ORDER.indexOf(planId)
    const requiredIdx = PLAN_ORDER.indexOf(minPlan)
    hasAccess = currentIdx >= requiredIdx
  }

  if (hasAccess) return children

  // Find minimum plan that has this feature
  let requiredPlan = 'pro'
  if (feature) {
    for (const pid of PLAN_ORDER) {
      if (canAccess(pid, feature)) { requiredPlan = pid; break }
    }
  } else if (minPlan) {
    requiredPlan = minPlan
  }

  if (fallback) return fallback

  return <UpgradeBanner feature={feature} requiredPlan={requiredPlan} />
}
