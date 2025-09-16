// lib/data.js
export const nodes = [
    { id: 'n-1', label: 'Node 1' },
    { id: 'n-2', label: 'Node 2' },
    { id: 'n-3', label: 'Node 3' },
    { id: 'n-4', label: 'Node 4' },
    { id: 'n-5', label: 'Node 5' },
];

export const edges = [
    { id: 'e-1', source: 'n-1', target: 'n-2', label: 'Edge 1-2' },
    { id: 'e-2', source: 'n-1', target: 'n-3', label: 'Edge 1-3' },
    { id: 'e-3', source: 'n-2', target: 'n-4', label: 'Edge 2-4' },
    { id: 'e-4', source: 'n-3', target: 'n-5', label: 'Edge 3-5' },
    { id: 'e-5', source: 'n-4', target: 'n-5', label: 'Edge 4-5' },
];