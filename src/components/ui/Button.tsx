import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'cyber-btn',
  ghost: [
    'relative font-semibold tracking-wide rounded-xl',
    'transition-all duration-300',
    'bg-white/10 border border-white/20 text-gray-700',
    'hover:bg-white/20 hover:border-white/30',
  ].join(' '),
  danger: [
    'relative font-semibold tracking-wide rounded-lg',
    'transition-all duration-300',
    'bg-red-500 text-white',
    'hover:bg-red-600',
  ].join(' '),
}

const primarySizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'text-sm',
  md: '',
  lg: 'py-4 px-12 text-lg',
}

const altSizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3',
  lg: 'px-12 py-4 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  asChild = false,
  children,
  ...rest
}: ButtonProps) {
  const base = variantClasses[variant]
  const sz = variant === 'primary' ? primarySizeClasses[size] : altSizeClasses[size]
  const computedClassName = [base, sz, 'disabled:opacity-50', className].filter(Boolean).join(' ')

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return React.cloneElement(child, {
      className: [computedClassName, child.props?.className].filter(Boolean).join(' '),
    })
  }

  return (
    <button className={computedClassName} {...rest}>
      {children}
    </button>
  )
}
