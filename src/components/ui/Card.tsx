import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  children: React.ReactNode
}

export function Card({
  hover = true,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={['cyber-card', className].filter(Boolean).join(' ')}
      data-hover={hover ? undefined : 'false'}
      {...rest}
    >
      {children}
    </div>
  )
}
