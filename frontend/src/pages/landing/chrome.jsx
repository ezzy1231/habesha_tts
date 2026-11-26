import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from '@ui-sdk/react/drawer';
import { cn, focusRing, Icon, LanguageToggle, Logo, ThemeToggle, useI18n } from '../../ui';
import { BOT_URL, LANDING_NAV } from './strings';
import { CtaLink } from './parts';

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

const onNav = (id, after) => (e) => {
  e.preventDefault();
  after?.();
  // Let a closing drawer give focus back before we scroll.
  setTimeout(() => scrollToId(id), 0);
};

/** Mobile navigation in a ui-sdk Drawer that slides in from the right. */
function MobileNav() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Drawer side="right" open={open} onOpenChange={setOpen} preventEdgeSwipe>
      <DrawerTrigger
        aria-label={t('nav.openMenu')}
        className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg lg:hidden', focusRing)}
      >
        <Icon name="menu" size={20} />
      </DrawerTrigger>
      <DrawerBackdrop className="bg-black/50 backdrop-blur-sm" />
      <DrawerContent className="theme-studio flex h-full w-[min(86vw,360px)] flex-col border-l border-line bg-canvas p-5 text-fg shadow-2xl">
        <div className="flex items-center justify-between">
          <DrawerTitle className="sr-only">{t('nav.mainNav')}</DrawerTitle>
          <Logo />
          <DrawerClose
            aria-label={t('nav.closeMenu')}
            className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg', focusRing)}
          >
            <Icon name="close" size={20} />
          </DrawerClose>
        </div>
        <nav aria-label={t('nav.mainNav')} className="mt-8">
          <ul className="flex flex-col gap-1">
            {LANDING_NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={onNav(item.id, () => setOpen(false))}
                  className={cn('flex items-center justify-between rounded-xl px-3 py-3.5 font-display text-xl font-semibold text-fg hover:bg-surface-2', focusRing)}
                >
                  {t(item.labelKey)}
                  <Icon name="chevronRight" size={18} className="text-subtle" />
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto flex flex-col gap-4 border-t border-line pt-5">
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle size="sm" />
          </div>
          <CtaLink href={BOT_URL} external icon="chevronRight">
            {t('lp.cta.start')}
          </CtaLink>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Floating glass header that tightens once you scroll. */
export function LandingHeader() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          'mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-full border px-3 pl-4 transition-all duration-300',
          scrolled
            ? 'border-line bg-canvas/75 shadow-[0_10px_40px_-20px_rgb(0_0_0/0.5)] backdrop-blur-xl'
            : 'border-transparent bg-transparent',
        )}
      >
        <a href="#top" onClick={onNav('top')} className={cn('rounded-lg', focusRing)} aria-label={t('app.name')}>
          <Logo />
        </a>
        <nav aria-label={t('nav.mainNav')} className="ml-4 hidden lg:block">
          <ul className="flex items-center">
            {LANDING_NAV.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={onNav(item.id)}
                  className={cn('rounded-full px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2/70 hover:text-fg', focusRing)}
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
          <MobileNav />
        </div>
      </div>
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
    <footer className="relative overflow-hidden border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{t('lp.footer.blurb')}</p>
          <div className="mt-6 flex items-center gap-2">
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
      {/* Oversized wordmark, cropped by the footer edge. */}
      <p
        aria-hidden="true"
        className="pointer-events-none mx-auto -mb-[0.28em] max-w-6xl select-none px-4 font-display text-[22vw] font-extrabold leading-none tracking-[-0.06em] text-fg/[0.04] sm:px-6 lg:text-[15rem]"
      >
        ሀበሻ TTS
      </p>
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
