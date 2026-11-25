import PropTypes from 'prop-types';
import { SidebarShell } from './SidebarShell';
import { STREAMER_NAV, navItemShape, userShape } from './navConfig';
import { Badge } from '../Badge';
import { useI18n } from '../i18n';

/**
 * Streamer dashboard shell.
 *   <Route path="/streamer/:uuid/*" element={<StreamerLayout basePath={`/streamer/${uuid}`} user={…} live />}>
 *     <Route path="live" element={<LivePage/>} /> …
 *   </Route>
 * Renders `children` if given, otherwise an <Outlet/>.
 * `badges` maps nav path → count, e.g. { media: 3 } for pending media-share approvals.
 */
export function StreamerLayout({ basePath = '', title, user, live = false, badges = {}, headerActions, onLogout, items, children }) {
  const { t } = useI18n();
  const base = basePath.replace(/\/$/, '');
  const navItems =
    items ||
    STREAMER_NAV.map((i) => ({ to: `${base}/${i.path}`, icon: i.icon, labelKey: i.labelKey, badge: badges[i.path] || undefined }));

  return (
    <SidebarShell
      items={navItems}
      title={title}
      user={user ? { ...user, status: live ? 'live' : user.status } : undefined}
      onLogout={onLogout}
      headerActions={
        <>
          {live ? (
            <Badge variant="danger" dot pulse>
              {t('status.live')}
            </Badge>
          ) : (
            <Badge variant="neutral" dot className="hidden sm:inline-flex">
              {t('status.offline')}
            </Badge>
          )}
          {headerActions}
        </>
      }
    >
      {children}
    </SidebarShell>
  );
}

StreamerLayout.propTypes = {
  basePath: PropTypes.string,
  title: PropTypes.node,
  user: userShape,
  live: PropTypes.bool,
  badges: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  headerActions: PropTypes.node,
  onLogout: PropTypes.func,
  items: PropTypes.arrayOf(navItemShape),
  children: PropTypes.node,
};
