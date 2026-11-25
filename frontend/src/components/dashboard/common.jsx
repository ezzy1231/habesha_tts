import PropTypes from 'prop-types';
import { Badge, Icon } from '../../ui';

/** Title row at the top of each dashboard page. */
export function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

PageHeader.propTypes = { title: PropTypes.node.isRequired, description: PropTypes.node, actions: PropTypes.node };

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-[#e5484d]" role="alert">
      <Icon name="alert" size={16} />
      {children}
    </p>
  );
}

ErrorNote.propTypes = { children: PropTypes.node };

const KIND = {
  tts: { label: 'Voice', icon: 'mic', variant: 'brand' },
  sound: { label: 'Sound', icon: 'music', variant: 'info' },
  media: { label: 'Media', icon: 'film', variant: 'warning' },
};

export function KindBadge({ kind }) {
  const k = KIND[kind] || KIND.tts;
  return (
    <Badge variant={k.variant} size="sm">
      <Icon name={k.icon} size={12} />
      {k.label}
    </Badge>
  );
}

KindBadge.propTypes = { kind: PropTypes.string };

export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
