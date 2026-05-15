import Image from 'next/image'
import clsx from 'clsx'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  /** 'icon' = image only (default), 'full' = image + text wordmark */
  variant?: 'icon' | 'full'
  /** Text colour when variant='full'. 'dark' = white text, 'light' = navy text */
  theme?: 'dark' | 'light'
  className?: string
}

const sizes = {
  xs: { img: 32, text: 'text-xs',   sub: 'text-[8px]' },
  sm: { img: 44, text: 'text-sm',   sub: 'text-[9px]' },
  md: { img: 56, text: 'text-base', sub: 'text-[10px]' },
  lg: { img: 72, text: 'text-xl',   sub: 'text-xs' },
  xl: { img: 96, text: 'text-3xl',  sub: 'text-sm' },
}

export default function Logo({
  size = 'md',
  variant = 'icon',
  theme = 'light',
  className,
}: LogoProps) {
  const s = sizes[size]

  return (
    <div className={clsx('flex items-center gap-2.5 shrink-0', className)}>
      <Image
        src="/logo.jpeg"
        alt="Aldanex Consultancy"
        width={s.img}
        height={s.img}
        className="object-contain shrink-0 rounded-xl"
        priority
      />
      {variant === 'full' && (
        <div className="leading-none">
          <span className={clsx(
            'font-bold tracking-wide block leading-tight',
            s.text,
            theme === 'dark' ? 'text-white' : 'text-brand-900'
          )}>
            ALDANEX
          </span>
          <span className={clsx(
            'font-medium tracking-widest uppercase block leading-tight',
            s.sub,
            theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
          )}>
            Consultancy
          </span>
        </div>
      )}
    </div>
  )
}
