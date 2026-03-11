import React from 'react'

export const SkeletonRow = ({ height = "h-4", width = "w-full", className = "" }) => (
  <div className={`${height} ${width} bg-white/5 rounded animate-pulse ${className}`} />
);
