import PropTypes from 'prop-types';
import { SidebarShell } from './SidebarShell';
import { ADMIN_NAV, navItemShape, userShape } from './navConfig';
import { Logo } from '../Logo';
import { Badge } from '../Badge';
import { useI18n } from '../i18n';

/**
 * Admin console shell — same chrome as StreamerLayout with an "Admin" marker.
 *   <AdminLayout basePath="/admin" user={{ name: 'Ops' }} badges={{ moderation: 4 }}>…</AdminLayout>
 */
export function AdminLayout({ basePath = '/admin', title, user, badges = {}, headerActions, onLogout, items, children }) {
  const { t } = useI18n();
  const base = basePath.replace(/\/$/, '');
  const navItems =
    items ||
    ADMIN_NAV.map((i) => ({
      to: i.path ? `${base}/${i.path}` : base || '/',
      icon: i.icon,
      labelKey: i.labelKey,
      end: i.end,
      badge: badges[i.path || 'overview'] || undefined,
    }));

  return (
    <SidebarShell
      items={navItems}
      title={title}
      user={user}
      onLogout={onLogout}
      headerActions={headerActions}
      brandSlot={(collapsed) => (
        <span className="flex items-center gap-2">
          <Logo compact={collapsed} />
          {collapsed ? null : (
            <Badge variant="warning" size="sm">
              {t('admin.badge')}
            </Badge>
          )}
        </span>
      )}
    >
      {children}
    </SidebarShell>
  );
}

AdminLayout.propTypes = {
  basePath: PropTypes.string,
  title: PropTypes.node,
  user: userShape,
  badges: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  headerActions: PropTypes.node,
  onLogout: PropTypes.func,
  items: PropTypes.arrayOf(navItemShape),
  children: PropTypes.node,
};
