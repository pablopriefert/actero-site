import React from 'react'

export const GlowCard = ({ children, className = '' }) => {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  )
}
