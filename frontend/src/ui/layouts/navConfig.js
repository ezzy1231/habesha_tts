import PropTypes from 'prop-types';

export const PUBLIC_NAV = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/streamers', labelKey: 'nav.streamers' },
  { to: '/pricing', labelKey: 'nav.pricing' },
];

/** Default streamer nav; paths are relative to `basePath`. */
export const STREAMER_NAV = [
  { path: 'live', icon: 'live', labelKey: 'nav.live' },
  { path: 'donations', icon: 'gift', labelKey: 'nav.donations' },
  { path: 'soundboard', icon: 'music', labelKey: 'nav.soundboard' },
  { path: 'media', icon: 'film', labelKey: 'nav.media' },
  { path: 'overlay', icon: 'layers', labelKey: 'nav.overlay' },
  { path: 'analytics', icon: 'chart', labelKey: 'nav.analytics' },
  { path: 'payouts', icon: 'wallet', labelKey: 'nav.payouts' },
  { path: 'settings', icon: 'settings', labelKey: 'nav.settings' },
];

/** Default admin nav; paths are relative to `basePath`. An empty path is the overview (exact match). */
export const ADMIN_NAV = [
  { path: '', icon: 'chart', labelKey: 'nav.overview', end: true },
  { path: 'streamers', icon: 'users', labelKey: 'nav.users' },
  { path: 'moderation', icon: 'shield', labelKey: 'nav.moderation' },
  { path: 'payments', icon: 'wallet', labelKey: 'nav.payments' },
  { path: 'reports', icon: 'flag', labelKey: 'nav.reports' },
  { path: 'settings', icon: 'settings', labelKey: 'nav.settings' },
];

export const navItemShape = PropTypes.shape({
  to: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  label: PropTypes.node,
  labelKey: PropTypes.string,
  end: PropTypes.bool,
  badge: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
});

export const userShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  subtitle: PropTypes.node,
  avatarUrl: PropTypes.string,
  status: PropTypes.oneOf(['live', 'online', 'offline']),
});
