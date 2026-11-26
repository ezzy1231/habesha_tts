import PropTypes from 'prop-types';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/react/menu';
import { Avatar, Badge, cn, focusRing, Icon } from '../ui';
import Balance from './Balance';

const FLAG_ACTION_OPTIONS = [
  { value: 'temp_ban', icon: 'clock', label: 'Time ban' },
  { value: 'permanent_ban', icon: 'ban', label: 'Ban donor' },
  { value: 'unban_request', icon: 'checkCircle', label: 'Unban request' },
];

const formatTime = (dateString) => {
  try {
    return new Date(dateString).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: '2-digit' });
  } catch {
    return '';
  }
};

/** One donation in the streamer's feed: donor, amount, message, status and a flag-to-admin menu. */
export default function DonationCard({ donation, isPlaying = false, onFlagAction = null, isFlagging = false }) {
  const hasPendingFlag = donation.flag?.status === 'pending';
  const disableFlagMenu = !onFlagAction || hasPendingFlag || isFlagging;
  const flagTimestamp = donation.flag?.created_at ? formatTime(donation.flag.created_at) : null;
  const name = donation.donor_name || 'Anonymous';

  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border bg-surface p-4 transition-all duration-200 sm:p-5',
        isPlaying
          ? 'border-brand-500/50 shadow-[0_0_0_1px_rgb(139_92_246/0.35),0_12px_40px_-16px_rgb(139_92_246/0.55)]'
          : 'border-line hover:border-line-strong hover:shadow-[0_12px_32px_-20px_rgb(0_0_0/0.45)]',
      )}
    >
      <header className="flex items-start gap-3">
        <Avatar name={name} size="md" status={isPlaying ? 'live' : undefined} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg sm:text-[15px]">{name}</p>
          <p className="mt-0.5 text-xs text-subtle">{formatTime(donation.created_at)}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums text-fg">
            <Balance value={donation.amount} showLabel={false} hideButton className="gap-0" />
          </span>
          {onFlagAction ? (
            <Menu onAction={(value) => !disableFlagMenu && onFlagAction(value)}>
              <MenuTrigger
                disabled={disableFlagMenu}
                aria-label={hasPendingFlag ? 'Awaiting admin review' : 'Notify admins about this donor'}
                title={hasPendingFlag ? 'Awaiting admin review' : 'Notify admins about this donor'}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 data-[open]:bg-surface-2 data-[open]:text-fg',
                  focusRing,
                )}
              >
                <Icon name="more" size={16} />
              </MenuTrigger>
              <MenuContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="z-50 m-0 w-52 rounded-xl border border-line bg-surface p-1 text-fg shadow-overlay transition-[opacity,scale] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
              >
                {FLAG_ACTION_OPTIONS.map((option) => (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-2"
                  >
                    <Icon name={option.icon} size={15} className="text-muted" />
                    {option.label}
                  </MenuItem>
                ))}
                <p className="mt-1 border-t border-line px-2.5 pb-1 pt-2 text-[11px] text-subtle">Sends an instant alert to admins.</p>
              </MenuContent>
            </Menu>
          ) : null}
        </div>
      </header>

      <p className="mt-4 flex-1 whitespace-pre-wrap break-words font-ethiopic text-[15px] leading-relaxed text-fg/90">{donation.text}</p>

      <footer className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge size="sm" variant={donation.status === 'paid' ? 'success' : 'warning'} dot>
          {donation.status || 'pending'}
        </Badge>
        {isPlaying ? (
          <Badge size="sm" variant="brand" dot pulse>
            Playing
          </Badge>
        ) : (
          <Badge size="sm" variant={donation.played ? 'neutral' : 'info'}>
            {donation.played ? 'Played' : 'Unplayed'}
          </Badge>
        )}
        {isFlagging ? <span className="text-[11px] text-amber-600 dark:text-amber-300">Sending review…</span> : null}
      </footer>

      {donation.flag ? (
        <div className="mt-4 flex flex-col gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
          <div className="flex items-center gap-2">
            <Icon name="flag" size={13} />
            <span className="truncate font-semibold">{donation.flag.actionLabel || 'Flagged'}</span>
            <Badge size="sm" variant={donation.flag.status === 'pending' ? 'warning' : 'success'} className="ml-auto">
              {donation.flag.status === 'pending' ? 'Pending review' : donation.flag.status}
            </Badge>
          </div>
          {donation.flag.reason ? <p className="leading-snug opacity-90">{donation.flag.reason}</p> : null}
          {flagTimestamp ? <span className="text-[11px] opacity-70">Sent {flagTimestamp}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

DonationCard.propTypes = {
  donation: PropTypes.shape({
    donor_name: PropTypes.string,
    created_at: PropTypes.string,
    amount: PropTypes.number,
    status: PropTypes.string,
    text: PropTypes.string,
    played: PropTypes.bool,
    flag: PropTypes.shape({
      action: PropTypes.string,
      actionLabel: PropTypes.string,
      status: PropTypes.string,
      reason: PropTypes.string,
      created_at: PropTypes.string,
    }),
  }).isRequired,
  isPlaying: PropTypes.bool,
  onFlagAction: PropTypes.func,
  isFlagging: PropTypes.bool,
};
