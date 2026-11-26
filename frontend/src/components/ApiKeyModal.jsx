import PropTypes from 'prop-types';
import { Button, Icon, Input, Modal } from '../ui';

export default function ApiKeyModal({ isOpen, onClose, onSubmit, title, message }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const input = e.target.elements.apiKey;
    if (input.value) {
      onSubmit(input.value);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={title} description={message} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          label="Access key"
          placeholder="Paste your key"
          autoComplete="off"
          required
          leftIcon={<Icon name="key" size={16} />}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Unlock</Button>
        </div>
      </form>
    </Modal>
  );
}

ApiKeyModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
};
