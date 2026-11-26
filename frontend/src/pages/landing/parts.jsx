import PropTypes from 'prop-types';
import { cn, focusRing, Icon, useI18n } from '../../ui';

/*
 * Small presentational pieces shared by the landing sections.
 */

/** Primary (solid) / secondary (glass) call-to-action link. */
export function CtaLink({ href, variant = 'primary', size = 'lg', external = false, icon, children, className }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn(
        'group/cta relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200',
        focusRing,
        size === 'lg' ? 'h-12 px-6 text-[15px]' : 'h-10 px-4 text-sm',
        variant === 'primary' &&
          'bg-fg text-canvas shadow-[0_10px_30px_-12px_rgb(124_58_237/0.55)] hover:-translate-y-0.5 hover:bg-fg/90 hover:shadow-[0_16px_40px_-12px_rgb(124_58_237/0.7)] active:translate-y-0',
        variant === 'secondary' &&
          'border border-line-strong/80 bg-surface/50 text-fg backdrop-blur-md hover:border-fg/30 hover:bg-surface-2/80',
        className,
      )}
    >
      {children}
      {icon ? (
        <Icon name={icon} size={size === 'lg' ? 18 : 16} className="transition-transform duration-200 group-hover/cta:translate-x-0.5" />
      ) : null}
    </a>
  );
}

CtaLink.propTypes = {
  href: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary']),
  size: PropTypes.oneOf(['md', 'lg']),
  external: PropTypes.bool,
  icon: PropTypes.string,
  children: PropTypes.node,
  className: PropTypes.string,
};

/** Small pill label above a section title. */
export function Eyebrow({ children, className }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted backdrop-blur',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-400 to-sky-400" aria-hidden="true" />
      {children}
    </p>
  );
}

Eyebrow.propTypes = { children: PropTypes.node, className: PropTypes.string };

/** Eyebrow + display title + optional body, used by every section. */
export function SectionHeader({ id, eyebrow, title, body, center = false, className }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className="mt-5 text-balance font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.03em] text-fg sm:text-5xl"
      >
        {title}
      </h2>
      {body ? <p className="mt-4 text-pretty text-base leading-relaxed text-muted sm:text-lg">{body}</p> : null}
    </div>
  );
}

SectionHeader.propTypes = {
  id: PropTypes.string.isRequired,
  eyebrow: PropTypes.node,
  title: PropTypes.node.isRequired,
  body: PropTypes.node,
  center: PropTypes.bool,
  className: PropTypes.string,
};

/** A surface card with a soft inner highlight. */
export function Panel({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag
      className={cn(
        'relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_0_rgb(255_255_255/0.04)_inset,0_20px_50px_-30px_rgb(0_0_0/0.45)]',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

Panel.propTypes = { as: PropTypes.elementType, className: PropTypes.string, children: PropTypes.node };

/** Animated equaliser bars (pauses for reduced-motion users). */
export function Equalizer({ bars = 18, className, barClassName = 'bg-brand-400' }) {
  return (
    <span className={cn('flex h-5 items-end gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn('h-full w-[3px] origin-bottom animate-eq-bar rounded-full motion-reduce:animate-none', barClassName)}
          style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 89) % 600)}ms` }}
        />
      ))}
    </span>
  );
}

Equalizer.propTypes = { bars: PropTypes.number, className: PropTypes.string, barClassName: PropTypes.string };

/** Fake window chrome (traffic lights + title) around a mockup. */
export function WindowFrame({ title, right, className, children }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] text-white shadow-2xl', className)}>
      <div className="flex h-9 items-center gap-3 border-b border-white/[0.07] bg-white/[0.03] px-3.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="truncate text-[11px] font-medium text-white/45">{title}</span>
        {right ? <span className="ml-auto">{right}</span> : null}
      </div>
      {children}
    </div>
  );
}

WindowFrame.propTypes = { title: PropTypes.node, right: PropTypes.node, className: PropTypes.string, children: PropTypes.node };

/** Red LIVE chip. */
export function LiveChip({ className }) {
  const { t } = useI18n();
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md bg-[#e11d2e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white', className)}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden="true" />
      {t('lp.alert.live')}
    </span>
  );
}

LiveChip.propTypes = { className: PropTypes.string };

/**
 * The on-stream alert, styled like the real OBS overlay (OverlayPage):
 * donor name, amount, message, equaliser.
 */
export function AlertCard({ name, amount, message, compact = false, className }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/15 bg-[#0c0c0e]/85 text-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl',
        className,
      )}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-brand-400/70 to-transparent" aria-hidden="true" />
      <div className={cn('font-ethiopic', compact ? 'p-3.5' : 'p-4 sm:p-5')}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn('truncate font-extrabold text-white', compact ? 'text-base' : 'text-lg sm:text-xl')}>
            {name} <span className="text-sm font-medium text-white/60">{t('lp.alert.sent')}</span>
          </p>
          <p className={cn('shrink-0 font-display font-extrabold tabular-nums', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>
            <span className="lp-text-gradient">{Number(amount).toLocaleString('en-US')}</span>{' '}
            <span className="text-xs font-semibold text-white/60">ETB</span>
          </p>
        </div>
        <p className={cn('mt-1.5 line-clamp-3 break-words font-medium leading-snug text-white/95', compact ? 'text-sm' : 'text-base sm:text-lg')}>
          {message}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Equalizer bars={compact ? 12 : 16} />
          <span className="text-[11px] text-white/50">{t('lp.alert.reading')}</span>
        </div>
      </div>
    </div>
  );
}

AlertCard.propTypes = {
  name: PropTypes.node.isRequired,
  amount: PropTypes.number.isRequired,
  message: PropTypes.node,
  compact: PropTypes.bool,
  className: PropTypes.string,
};
