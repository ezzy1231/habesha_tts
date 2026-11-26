import { Link } from 'react-router-dom';
import { Button, Icon, Logo } from '../ui';

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas px-4 text-center font-sans text-fg">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[44rem] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[120px]" />
      <div className="relative flex max-w-md flex-col items-center">
        <Logo />
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-muted">
          Looking for your dashboard? Open the link your Telegram bot sent you — it&apos;s unique to your channel.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button as={Link} to="/" leftIcon={<Icon name="chevronLeft" size={16} />}>
            Back to home
          </Button>
          <Button as="a" href="https://t.me/HabeshaTTS_bot" target="_blank" rel="noreferrer" variant="secondary" leftIcon={<Icon name="message" size={16} />}>
            Open the bot
          </Button>
        </div>
      </div>
    </div>
  );
}
