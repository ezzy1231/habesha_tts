import PropTypes from 'prop-types';
import { Button, PublicLayout, useI18n } from '../../ui';
import { extendDictionaries } from '../../ui/i18n';
import { Link } from 'react-router-dom';
import { getAccountToken } from '../../lib/accountApi';
import '../../lib/accountStrings';

const BOT_URL = 'https://t.me/HabeshaTTS_bot';

extendDictionaries({
  en: { 'viewer.cta': 'Start streaming', 'viewer.nav.pricing': 'Pricing', 'viewer.footer.telegram': 'Telegram', 'viewer.footer.email': 'Email' },
  am: { 'viewer.cta': 'ስትሪም ይጀምሩ', 'viewer.nav.pricing': 'ዋጋ', 'viewer.footer.telegram': 'ቴሌግራም', 'viewer.footer.email': 'ኢሜይል' },
});

const NAV = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/streamers', labelKey: 'nav.streamers' },
  { href: '/#pricing', labelKey: 'viewer.nav.pricing' },
];

const FOOTER = [
  { href: BOT_URL, labelKey: 'viewer.footer.telegram' },
  { href: 'mailto:support@habeshatts.com', labelKey: 'viewer.footer.email' },
];

/** Public shell for the viewer pages (directory, donate, return). */
export function ViewerLayout({ children }) {
  const { t } = useI18n();
  // Signed-in state only changes the header label; no request needed.
  const account = Boolean(getAccountToken());
  return (
    <PublicLayout
      nav={NAV}
      footerLinks={FOOTER}
      cta={
        <>
          <Button as={Link} to="/account" size="sm" variant="ghost">
            {account ? t('acct.nav') : t('acct.signIn')}
          </Button>
          <Button as="a" href={BOT_URL} target="_blank" rel="noreferrer" size="sm" variant="secondary">
            {t('viewer.cta')}
          </Button>
        </>
      }
    >
      {children}
    </PublicLayout>
  );
}

ViewerLayout.propTypes = { children: PropTypes.node };
