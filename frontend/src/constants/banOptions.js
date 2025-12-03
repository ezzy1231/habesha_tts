export const BAN_DURATION_OPTIONS = [
  { value: '1h', label: '1 hour', minutes: 60 },
  { value: '6h', label: '6 hours', minutes: 360 },
  { value: '12h', label: '12 hours', minutes: 720 },
  { value: '24h', label: '24 hours', minutes: 1440 },
  { value: '3d', label: '3 days', minutes: 4320 },
  { value: '7d', label: '7 days', minutes: 10080 },
  { value: 'permanent', label: 'Permanent ban' },
  { value: 'custom', label: 'Custom duration…' },
];

export function resolveBanDurationMinutes(selectedValue, customMinutesInput) {
  if (!selectedValue || selectedValue === 'permanent') {
    return null;
  }
  if (selectedValue === 'custom') {
    const parsed = Number.parseInt(customMinutesInput, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }
  const preset = BAN_DURATION_OPTIONS.find((opt) => opt.value === selectedValue);
  return typeof preset?.minutes === 'number' ? preset.minutes : null;
}
