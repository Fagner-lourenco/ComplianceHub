import Modal from '../../../ui/components/Modal/Modal';

export default function ChecklistModal({
    open,
    onClose,
    items = [],
    completedCount = 0,
    totalCount = 0,
    onToggleItem,
}) {
    return (
        <Modal open={open} onClose={onClose} title="Checklist operacional" maxWidth={680}>
            <div className="caso-checklist-modal">
                <p className="caso-checklist-modal__summary">
                    {completedCount} de {totalCount} fases revisadas
                </p>
                <div className="caso-checklist-modal__items">
                    {items.map((item) => (
                        <label key={item.key} className="caso-checklist-modal__item">
                            <input
                                type="checkbox"
                                checked={item.checked}
                                aria-label={`${item.checked ? 'Desmarcar' : 'Marcar'} ${item.label} como revisada`}
                                onChange={(event) => onToggleItem?.(item.key, event.target.checked)}
                            />
                            <span>
                                <strong>{item.label}</strong>
                                {item.description ? <small>{item.description}</small> : null}
                            </span>
                        </label>
                    ))}
                </div>
                <p className="caso-checklist-modal__note">
                    Este checklist fica salvo apenas nesta sessao do navegador. As regras criticas continuam sendo validadas pelo backend.
                </p>
            </div>
        </Modal>
    );
}
