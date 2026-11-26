import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { cn, focusRing, Icon, LanguageToggle, Logo, ThemeToggle, useI18n } from '../../ui';
import { BOT_URL, LANDING_NAV } from './strings';
import { CtaLink, TiletBand } from './parts';


function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

/** Sticky landing header: transparent at the top, solid once you scroll. */
export function LandingHeader() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onNav = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    // Let the mobile menu collapse before measuring the target.
    setTimeout(() => scrollToId(id), 0);
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200',
        scrolled || open ? 'border-b border-line bg-canvas/85 backdrop-blur-md' : 'border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <a href="#top" onClick={onNav('top')} className={cn('rounded-lg', focusRing)} aria-label={t('app.name')}>
          <Logo />
        </a>
        <nav aria-label={t('nav.mainNav')} className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={onNav(item.id)}
                  className={cn('rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-fg', focusRing)}
                >
                  {t(item.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageToggle className="hidden sm:inline-flex" />
          <ThemeToggle size="sm" />
          <CtaLink href={BOT_URL} external size="md" className="hidden md:inline-flex">
            {t('lp.cta.start')}
          </CtaLink>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')}
            className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden', focusRing)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>
      {open ? (
        <div id="landing-mobile-menu" className="animate-ui-fade-in border-t border-line bg-canvas lg:hidden">
          <nav aria-label={t('nav.mainNav')} className="mx-auto max-w-6xl px-4 pb-5 pt-2 sm:px-6">
            <ul className="flex flex-col">
              {LANDING_NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={onNav(item.id)}
                    className={cn('flex items-center justify-between rounded-lg px-2 py-3 text-base font-medium text-fg hover:bg-surface-2', focusRing)}
                  >
                    {t(item.labelKey)}
                    <Icon name="chevronRight" size={16} className="text-subtle" />
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
              <LanguageToggle className="self-start" />
              <CtaLink href={BOT_URL} external icon="chevronRight">
                {t('lp.cta.start')}
              </CtaLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function FooterLink({ href, children }) {
  const external = /^https?:/.test(href);
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={cn('rounded text-sm text-muted transition-colors hover:text-fg', focusRing)}
    >
      {children}
    </a>
  );
}

FooterLink.propTypes = { href: PropTypes.string.isRequired, children: PropTypes.node };

export function LandingFooter() {
  const { t } = useI18n();
  return (
    <footer className="bg-surface">
      <TiletBand />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{t('lp.footer.blurb')}</p>
          <div className="mt-5 flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle size="sm" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">{t('lp.footer.product')}</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {LANDING_NAV.map((item) => (
              <li key={item.id}>
                <FooterLink href={`#${item.id}`}>{t(item.labelKey)}</FooterLink>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-subtle">{t('lp.footer.contact')}</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            <li>
              <FooterLink href={BOT_URL}>{t('lp.footer.telegram')}</FooterLink>
            </li>
            <li>
              <FooterLink href="mailto:support@habeshatts.com">{t('lp.footer.email')}</FooterLink>
            </li>
            <li>
              <FooterLink href="tel:+251939976687">{t('lp.footer.call')}</FooterLink>
            </li>
            <li>
              <FooterLink href="https://www.instagram.com/habeshatts/">{t('lp.footer.instagram')}</FooterLink>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-subtle sm:px-6">
          <span>
            © {new Date().getFullYear()} {t('app.name')}. {t('footer.rights')}
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-2 w-6 overflow-hidden rounded-sm" aria-hidden="true">
              <span className="flex-1 bg-flag-green" />
              <span className="flex-1 bg-flag-yellow" />
              <span className="flex-1 bg-flag-red" />
            </span>
            {t('footer.madeIn')}
          </span>
        </div>
      </div>
    </footer>
  );
}
