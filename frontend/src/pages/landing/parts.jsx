import PropTypes from 'prop-types';
import { cn, focusRing, Icon, useI18n } from '../../ui';

/*
 * Small presentational pieces shared by the landing sections.
 */

const TILET_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="14" viewBox="0 0 32 14">` +
    `<rect width="32" height="1.5" fill="#F2B705"/><rect y="12.5" width="32" height="1.5" fill="#F2B705"/>` +
    `<polygon points="8,3 12,7 8,11 4,7" fill="#078930"/><polygon points="8,5.5 9.5,7 8,8.5 6.5,7" fill="#FCDD09"/>` +
    `<polygon points="24,3 28,7 24,11 20,7" fill="#DA121A"/><polygon points="24,5.5 25.5,7 24,8.5 22.5,7" fill="#FCDD09"/>` +
    `<rect x="15" y="6.25" width="2" height="1.5" fill="#F2B705"/><rect x="0" y="6.25" width="1" height="1.5" fill="#F2B705"/><rect x="31" y="6.25" width="1" height="1.5" fill="#F2B705"/>` +
    `</svg>`,
);

/** Woven "tilet" border, like the hem of a habesha kemis. Decorative. */
export function TiletBand({ className }) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-[14px] w-full', className)}
      style={{ backgroundImage: `url("data:image/svg+xml,${TILET_SVG}")`, backgroundRepeat: 'repeat-x', backgroundSize: '32px 14px' }}
    />
  );
}

TiletBand.propTypes = { className: PropTypes.string };

/** Primary (gold) / secondary (outline) call-to-action link. */
export function CtaLink({ href, variant = 'primary', size = 'lg', external = false, icon, children, className }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-150',
        focusRing,
        size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-4 text-sm',
        variant === 'primary' &&
          'bg-gold-bright text-[#1e160e] shadow-[0_8px_24px_-8px_rgba(242,183,5,0.55)] hover:-translate-y-px hover:bg-[#ffc81a] active:translate-y-0',
        variant === 'secondary' && 'border border-line-strong bg-surface/60 text-fg backdrop-blur hover:border-fg/40 hover:bg-surface',
        className,
      )}
    >
      {children}
      {icon ? <Icon name={icon} size={size === 'lg' ? 18 : 16} /> : null}
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

/** Small uppercase label above a section title. */
export function Eyebrow({ children, className }) {
  return (
    <p className={cn('inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold', className)}>
      <span className="h-px w-6 bg-gold" aria-hidden="true" />
      {children}
    </p>
  );
}

Eyebrow.propTypes = { children: PropTypes.node, className: PropTypes.string };

/** Eyebrow + serif title + optional body, used by every section. */
export function SectionHeader({ id, eyebrow, title, body, center = false, className }) {
  return (
    <div className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      {eyebrow ? <Eyebrow className={center ? 'justify-center' : undefined}>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="mt-3 font-display text-3xl font-bold leading-[1.15] tracking-tight text-fg sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{body}</p> : null}
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

/** Animated equaliser bars (pauses for reduced-motion users). */
export function Equalizer({ bars = 18, className }) {
  return (
    <span className={cn('flex h-5 items-end gap-[3px]', className)} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-bottom animate-eq-bar rounded-full bg-gold-bright motion-reduce:animate-none"
          style={{ animationDelay: `${(i * 137) % 900}ms`, animationDuration: `${700 + ((i * 89) % 600)}ms` }}
        />
      ))}
    </span>
  );
}

Equalizer.propTypes = { bars: PropTypes.number, className: PropTypes.string };

/**
 * The on-stream alert, styled like the real OBS overlay (OverlayPage):
 * flag stripe, gold donor name, amount, message, equaliser.
 */
export function AlertCard({ name, amount, message, className }) {
  const { t } = useI18n();
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-white/10 bg-[#120e0a]/90 text-white shadow-overlay backdrop-blur', className)}>
      <div className="flex h-1" aria-hidden="true">
        <span className="flex-1 bg-flag-green" />
        <span className="flex-1 bg-flag-yellow" />
        <span className="flex-1 bg-flag-red" />
      </div>
      <div className="p-4 font-ethiopic sm:p-5">
        <p className="truncate text-lg font-extrabold text-flag-yellow sm:text-xl">
          {name} <span className="text-sm font-medium text-white/65">{t('lp.alert.sent')}</span>
        </p>
        <p className="mt-0.5 text-3xl font-extrabold leading-tight tabular-nums sm:text-4xl">
          <span className="bg-gradient-to-r from-emerald-400 via-flag-yellow to-red-400 bg-clip-text text-transparent">
            {Number(amount).toLocaleString('en-US')}
          </span>{' '}
          <span className="text-base text-white/75 sm:text-lg">ETB</span>
        </p>
        <p className="mt-2 line-clamp-3 break-words text-base font-medium leading-snug sm:text-lg">{message}</p>
        <div className="mt-3 flex items-center gap-3">
          <Equalizer bars={16} />
          <span className="text-xs text-white/55">{t('lp.alert.reading')}</span>
        </div>
      </div>
    </div>
  );
}

AlertCard.propTypes = {
  name: PropTypes.node.isRequired,
  amount: PropTypes.number.isRequired,
  message: PropTypes.node,
  className: PropTypes.string,
};
