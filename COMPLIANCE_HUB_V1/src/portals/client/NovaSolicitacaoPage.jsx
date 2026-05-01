import { useLocation, useNavigate } from 'react-router-dom';
import { buildClientPortalPath } from '../../core/portalPaths';
import NovaSolicitacaoPanel from './NovaSolicitacaoPanel';

/**
 * Standalone page route for /nova-solicitacao.
 * Renders the off-canvas panel in always-open mode so the URL remains
 * bookmarkable. Closing navigates back to the solicitations list.
 */
export default function NovaSolicitacaoPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const handleClose = () => {
        navigate(buildClientPortalPath(location.pathname, 'solicitacoes'));
    };

    return (
        <NovaSolicitacaoPanel
            open={true}
            onClose={handleClose}
            onSuccess={() => {}}
        />
    );
}
