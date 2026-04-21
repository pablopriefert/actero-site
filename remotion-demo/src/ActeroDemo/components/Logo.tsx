import React from 'react'
import { COLORS } from '../constants'

/**
 * Actero logo mark — triangle stroké avec cercle central. Repris de
 * index.html → footer du site pour cohérence.
 */
export const ActeroLogo: React.FC<{
  size?: number
  color?: string
  strokeWidth?: number
}> = ({ size = 32, color = COLORS.forest, strokeWidth = 2.5 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 3L29 28H3L16 3Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <circle cx="16" cy="19" r="3" fill={color} />
    </svg>
  )
}
