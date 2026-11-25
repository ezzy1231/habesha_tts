import { useState } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { Button, Card, Input, StatCard, formatETB, useToast } from '../../ui';
import { useStreamerApi } from '../../lib/streamerApi';
import { ErrorNote, PageHeader } from '../../components/dashboard/common';

export default function PayoutsPage({ balance, onWithdrawn }) {
  const { uuid } = useParams();
  const call = useStreamerApi(uuid);
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const value = Number(amount);
  const available = balance === undefined || balance === null ? null : Number(balance);
  const phoneOk = /^(\+?251|0)?9\d{8}$/.test(phone.replace(/\s+/g, ''));
  const valid = value > 0 && (available === null || value <= available) && username.trim() && phoneOk;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await call(`/streamer/${uuid}/withdraw`, { method: 'POST', json: { amount: value, telebirrUsername: username.trim(), phoneNumber: phone.replace(/\s+/g, '') } });
      toast.success('Withdrawal requested', { description: `${formatETB(value)} will be sent to your Telebirr after review.` });
      onWithdrawn?.(value);
      setAmount('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Payouts" description="Withdraw your balance to Telebirr. Your balance is already after the platform fee, so you receive the full amount you request." />
      <StatCard label="Available balance" value={available === null ? '—' : formatETB(available)} icon="wallet" loading={available === null} />
      <Card className="mt-6">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Amount (birr)"
            type="number"
            min={1}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={available !== null && value > available ? 'More than your available balance' : undefined}
            rightSlot={available ? <button type="button" className="text-xs font-semibold text-brand-600 dark:text-brand-400" onClick={() => setAmount(String(available))}>Max</button> : null}
          />
          <Input label="Telebirr name" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="name" />
          <Input
            label="Telebirr phone number"
            inputMode="tel"
            placeholder="09XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={phone && !phoneOk ? 'Enter an Ethiopian mobile number, e.g. 0912345678' : undefined}
          />
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" loading={busy} disabled={!valid}>Request withdrawal</Button>
        </form>
      </Card>
    </div>
  );
}

PayoutsPage.propTypes = { balance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), onWithdrawn: PropTypes.func };
