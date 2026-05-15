import Image from 'next/image'
import clsx from 'clsx'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  xs: 32,
  sm: 44,
  md: 56,
  lg: 72,
  xl: 96,
}

export default function Logo({ size = 'md', className }: LogoProps) {
  const px = sizes[size]

  return (
    <Image
      src="/logo.jpeg"
      alt="Aldanex Consultancy"
      width={px}
      height={px}
      className={clsx('object-contain shrink-0 rounded-xl', className)}
      priority
    />
  )
}
