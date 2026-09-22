'use client'

import React from 'react'
import Link from 'next/link'
import { cn } from '@/utils'

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  href?: string
  to?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'gray' | 'white'
  variant?: 'solid' | 'ghost' | 'outline'
  className?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  href,
  to,
  size = 'md',
  color = 'primary',
  variant = 'solid',
  className,
  type = 'button',
  disabled = false
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-5 py-2.5 text-lg',
    xl: 'px-6 py-3 text-lg'
  }

  const colorClasses = {
    primary: {
      solid: 'bg-primary-500 text-white hover:bg-primary-600',
      ghost: 'text-primary-600 hover:bg-primary-50',
      outline: 'border-2 border-primary-500 text-primary-600 hover:bg-primary-50'
    },
    gray: {
      solid: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
      ghost: 'text-gray-700 hover:bg-gray-100',
      outline: 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
    },
    white: {
      solid: 'bg-white text-gray-900 hover:bg-gray-100',
      ghost: 'text-white hover:bg-white/10',
      outline: 'border-2 border-white text-white hover:bg-white/10'
    }
  }

  const baseClasses = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

  const classes = cn(
    baseClasses,
    sizeClasses[size],
    colorClasses[color][variant],
    className
  )

  const link = to || href

  if (link) {
    return (
      <Link href={link} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={classes}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export default Button
