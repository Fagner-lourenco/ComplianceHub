import { useCallback, useEffect, useMemo, useState } from 'react';

export function getChecklistSessionKey(caseId) {
    return `compliancehub:case-checklist:${caseId || 'unknown'}`;
}

function readStoredState(caseId) {
    if (!caseId || typeof window === 'undefined') return {};
    try {
        const raw = window.sessionStorage.getItem(getChecklistSessionKey(caseId));
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeStoredState(caseId, state) {
    if (!caseId || typeof window === 'undefined') return;
    window.sessionStorage.setItem(getChecklistSessionKey(caseId), JSON.stringify(state));
}

export function useChecklistSession(caseId, items = []) {
    const [checkedByKey, setCheckedByKey] = useState(() => readStoredState(caseId));

    useEffect(() => {
        setCheckedByKey(readStoredState(caseId));
    }, [caseId]);

    const validKeys = useMemo(() => new Set(items.map((item) => item.key)), [items]);

    const setItemChecked = useCallback((key, checked) => {
        if (!validKeys.has(key)) return;
        setCheckedByKey((current) => {
            const next = { ...current };
            if (checked) next[key] = true;
            else delete next[key];
            writeStoredState(caseId, next);
            return next;
        });
    }, [caseId, validKeys]);

    const normalizedItems = useMemo(() => items.map((item) => ({
        ...item,
        checked: checkedByKey[item.key] === true,
    })), [items, checkedByKey]);

    const completedCount = normalizedItems.filter((item) => item.checked).length;
    const totalCount = normalizedItems.length;

    return {
        items: normalizedItems,
        checkedByKey,
        completedCount,
        totalCount,
        isComplete: totalCount > 0 && completedCount === totalCount,
        setItemChecked,
    };
}
