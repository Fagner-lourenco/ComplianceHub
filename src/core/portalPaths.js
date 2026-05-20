function normalizeLeaf(leaf = '') {
    if (!leaf) return '';
    return leaf.startsWith('/') ? leaf : `/${leaf}`;
}

export function isDemoPortalPath(pathname = '') {
    return pathname.startsWith('/demo/');
}

export function getClientPortalBasePath(pathname = '') {
    return isDemoPortalPath(pathname) ? '/demo/client' : '/client';
}

export function getOpsPortalBasePath(pathname = '') {
    return isDemoPortalPath(pathname) ? '/demo/ops' : '/ops';
}

export function buildClientPortalPath(pathname = '', leaf = '') {
    return `${getClientPortalBasePath(pathname)}${normalizeLeaf(leaf)}`;
}

export function buildOpsPortalPath(pathname = '', leaf = '') {
    return `${getOpsPortalBasePath(pathname)}${normalizeLeaf(leaf)}`;
}
