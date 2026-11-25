import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { cn, focusRing } from '../utils';
import { Icon } from '../icons';
import { Button } from '../Button';
import { Logo } from '../Logo';
import { FlagBar } from '../Card';
import { ThemeToggle, LanguageToggle } from '../Toggles';
import { useI18n } from '../i18n';
import { PUBLIC_NAV } from './navConfig';

/** Renders a nav/footer item: `to` → router NavLink/Link, `href` → plain anchor (in-page #hash or external). */
function NavItemLink({ item, className, onClick, children }) {
  if (item.href) {
    const external = /^https?:/.test(item.href);
    return (
      <a
        href={item.href}
        onClick={onClick}
        className={typeof className === 'function' ? className({ isActive: false }) : className}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <NavLink to={item.to} end={item.end} onClick={onClick} className={className}>
      {children}
    </NavLink>
  );
}

NavItemLink.propTypes = {
  item: PropTypes.object.isRequired,
  className: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  onClick: PropTypes.func,
  children: PropTypes.node,
};

const linkItemShape = PropTypes.shape({
  to: PropTypes.string,
  href: PropTypes.string,
  label: PropTypes.node,
  labelKey: PropTypes.string,
  end: PropTypes.bool,
});

/**
 * Marketing / viewer-facing shell: sticky top nav, mobile menu, footer.
 *   <PublicLayout>…</PublicLayout>  or as a parent route with <Outlet/>.
 * Nav and footer items take `to` (router path) or `href` (#anchor / external URL).
 * `cta` replaces the default right-hand buttons (login / sign up).
 */
export function PublicLayout({
  nav = PUBLIC_NAV,
  cta,
  homeHref = '/',
  loginHref = '/login',
  signupHref = '/signup',
  supportHref = '/support',
  footerLinks,
  children,
}) {
  const { t } = useI18n();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const label = (item) => (item.labelKey ? t(item.labelKey) : item.label);
  const defaultCta = (
    <>
      <Button as={Link} to={loginHref} variant="ghost" size="sm">
        {t('nav.login')}
      </Button>
      <Button as={Link} to={signupHref} size="sm">
        {t('nav.signup')}
      </Button>
    </>
  );
  const footerItems = footerLinks || [
    { to: '/terms', labelKey: 'footer.terms' },
    { to: '/privacy', labelKey: 'footer.privacy' },
    { href: supportHref, labelKey: 'footer.support' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-canvas font-sans text-fg">
      <a
        href="#main-content"
        className="sr-only z-[70] rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('nav.skip')}
      </a>
      <FlagBar height={3} />
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to={homeHref} className={cn('rounded-lg', focusRing)}>
            <Logo />
          </Link>
          <nav aria-label={t('nav.mainNav')} className="ml-4 hidden md:block">
            <ul className="flex items-center gap-1">
              {nav.map((item) => (
                <li key={item.to || item.href}>
                  <NavItemLink
                    item={item}
                    className={({ isActive }) =>
                      cn(
                        'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        focusRing,
                        isActive ? 'text-fg' : 'text-muted hover:text-fg',
                      )
                    }
                  >
                    {label(item)}
                  </NavItemLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LanguageToggle className="hidden sm:inline-flex" />
            <ThemeToggle size="sm" />
            <div className="hidden items-center gap-2 md:flex">{cta ?? defaultCta}</div>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              className="text-muted md:hidden"
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={menuOpen}
              aria-controls="public-mobile-menu"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
            </Button>
          </div>
        </div>
        {menuOpen ? (
          <div id="public-mobile-menu" className="animate-ui-fade-in border-t border-line bg-surface md:hidden">
            <nav aria-label={t('nav.mainNav')} className="mx-auto max-w-6xl px-4 py-3">
              <ul className="flex flex-col gap-1">
                {nav.map((item) => (
                  <li key={item.to || item.href}>
                    <NavItemLink
                      item={item}
                      onClick={(e) => {
                        setMenuOpen(false);
                        // Collapsing the menu shifts the page, so scroll to in-page anchors after it closes.
                        if (item.href?.startsWith('#')) {
                          e.preventDefault();
                          setTimeout(() => {
                            document.getElementById(item.href.slice(1))?.scrollIntoView({ behavior: 'smooth' });
                            window.history.replaceState(null, '', item.href);
                          }, 0);
                        }
                      }}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2.5 text-sm font-medium',
                          focusRing,
                          isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      {label(item)}
                    </NavItemLink>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
                <LanguageToggle className="self-start" />
                {cta ?? defaultCta}
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children ?? <Outlet />}
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <Logo />
            <p className="max-w-xs text-sm text-muted">{t('app.tagline')}</p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              {footerItems.map((item) => (
                <li key={item.to || item.href}>
                  <NavItemLink item={item} className={cn('rounded hover:text-fg', focusRing)}>
                    {label(item)}
                  </NavItemLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-subtle sm:px-6">
            <span>
              © {new Date().getFullYear()} {t('app.name')}. {t('footer.rights')}
            </span>
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <FlagBar className="w-6 shrink-0 overflow-hidden rounded-sm" height={8} />
              {t('footer.madeIn')}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

PublicLayout.propTypes = {
  nav: PropTypes.arrayOf(linkItemShape),
  cta: PropTypes.node,
  homeHref: PropTypes.string,
  loginHref: PropTypes.string,
  signupHref: PropTypes.string,
  supportHref: PropTypes.string,
  footerLinks: PropTypes.arrayOf(linkItemShape),
  children: PropTypes.node,
};
