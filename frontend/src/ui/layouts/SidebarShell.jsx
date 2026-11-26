import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { cn, focusRing } from '../utils';
import { Icon } from '../icons';
import { Button } from '../Button';
import { Logo } from '../Logo';
import { Avatar } from '../Avatar';
import { ThemeToggle, LanguageToggle } from '../Toggles';
import { useI18n } from '../i18n';
import { navItemShape, userShape } from './navConfig';

const COLLAPSE_KEY = 'ui.sidebarCollapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function NavItems({ items, collapsed, onNavigate }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const label = item.labelKey ? t(item.labelKey) : item.label;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
                  focusRing,
                  collapsed && 'justify-center px-0',
                  isActive ? 'bg-brand-500/10 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-500" aria-hidden="true" />
                  ) : null}
                  <Icon
                    name={item.icon}
                    size={18}
                    className={cn('shrink-0', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-subtle group-hover:text-fg')}
                  />
                  <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
                  {item.badge !== undefined && item.badge !== null && !collapsed ? (
                    <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white">
                      {item.badge}
                    </span>
                  ) : null}
                  {item.badge && collapsed ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

NavItems.propTypes = {
  items: PropTypes.array.isRequired,
  collapsed: PropTypes.bool,
  onNavigate: PropTypes.func,
};

/**
 * Shared dashboard chrome used by StreamerLayout and AdminLayout:
 * collapsible desktop sidebar (persisted), mobile drawer, sticky top bar.
 */
export function SidebarShell({ items, brandSlot, sidebarFooter, title, headerActions, user, onLogout, children }) {
  const { t } = useI18n();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector('a, button')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen, closeDrawer]);

  const userBlock = (isCollapsed) =>
    user ? (
      <div className={cn('flex items-center gap-3 rounded-lg p-2', isCollapsed && 'justify-center p-0')}>
        <Avatar name={user.name} src={user.avatarUrl} size="sm" status={user.status} />
        {isCollapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
            {user.subtitle ? <p className="truncate text-xs text-muted">{user.subtitle}</p> : null}
          </div>
        )}
        {onLogout && !isCollapsed ? (
          <Button variant="ghost" size="sm" iconOnly aria-label={t('nav.logout')} title={t('nav.logout')} onClick={onLogout} className="text-muted">
            <Icon name="logout" size={16} />
          </Button>
        ) : null}
      </div>
    ) : null;

  return (
    <div className="min-h-screen bg-canvas font-sans text-fg">
      <a
        href="#main-content"
        className="sr-only z-[70] rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        {t('nav.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'gap-2 px-4')}>
          {brandSlot ? brandSlot(collapsed) : <Logo compact={collapsed} />}
        </div>
        <nav aria-label={t('nav.mainNav')} className="flex-1 overflow-y-auto p-3">
          <NavItems items={items} collapsed={collapsed} />
        </nav>
        {sidebarFooter && !collapsed ? <div className="px-3 pb-2">{sidebarFooter}</div> : null}
        <div className="flex flex-col gap-2 border-t border-line p-3">
          {userBlock(collapsed)}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            aria-expanded={!collapsed}
            className={cn('text-muted', collapsed ? 'w-full px-0' : 'justify-start')}
            leftIcon={<Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={16} />}
          >
            {collapsed ? null : <span className="text-xs">{t('nav.collapse')}</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-ui-fade-in bg-black/60" aria-hidden="true" onClick={closeDrawer} />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.mainNav')}
            className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] animate-ui-slide-in flex-col border-r border-line bg-surface shadow-overlay"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              {brandSlot ? brandSlot(false) : <Logo />}
              <Button variant="ghost" size="sm" iconOnly aria-label={t('nav.closeMenu')} onClick={closeDrawer} className="text-muted">
                <Icon name="close" size={18} />
              </Button>
            </div>
            <nav aria-label={t('nav.mainNav')} className="flex-1 overflow-y-auto p-3">
              <NavItems items={items} onNavigate={() => setDrawerOpen(false)} />
            </nav>
            {sidebarFooter ? <div className="px-3 pb-2">{sidebarFooter}</div> : null}
            <div className="flex items-center justify-between gap-2 border-t border-line p-3">
              <LanguageToggle />
              <ThemeToggle size="sm" />
            </div>
            {user ? <div className="border-t border-line p-3">{userBlock(false)}</div> : null}
          </div>
        </div>
      ) : null}

      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6">
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={t('nav.openMenu')}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="-ml-1.5 text-muted lg:hidden"
          >
            <Icon name="menu" size={20} />
          </Button>
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1> : title}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {headerActions}
            <LanguageToggle className="hidden sm:inline-flex" />
            <ThemeToggle size="sm" className="hidden sm:inline-flex" />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children ?? <Outlet />}</div>
        </main>
      </div>
    </div>
  );
}

SidebarShell.propTypes = {
  items: PropTypes.arrayOf(navItemShape).isRequired,
  brandSlot: PropTypes.func,
  sidebarFooter: PropTypes.node,
  title: PropTypes.node,
  headerActions: PropTypes.node,
  user: userShape,
  onLogout: PropTypes.func,
  children: PropTypes.node,
};
