import { useContext } from 'react';
import { TenantContext } from './tenant-context';

export function useTenant() {
    const context = useContext(TenantContext);

    if (!context) {
        throw new Error('useTenant must be used inside TenantProvider');
    }

    return context;
}
