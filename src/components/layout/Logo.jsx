import React from 'react'

export const Logo = ({ className = "w-8 h-8", light = false }) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} text-white`}
  >
    <path d="M16 2L2 30H10L16 18L22 30H30L16 2Z" fill="currentColor" />
  </svg>
)
