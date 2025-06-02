// --- Node Types ---
export const NODE_TYPE_NAMESPACE = 'namespace' as const;
export const NODE_TYPE_PODGROUP = 'podGroup' as const;

// --- Edge Types ---
export const EDGE_TYPE_CUSTOM_RULE = 'customRuleEdge' as const;

// --- Data Transfer Types for Drag & Drop ---
export const DND_APP_TYPE_REACT_FLOW = 'application/reactflow' as const;

// --- Handle IDs ---
export const NS_HANDLE_TARGET_TOP_A = 'ns-target-a' as const;
export const NS_HANDLE_TARGET_LEFT_B = 'ns-target-b' as const;
export const NS_HANDLE_SOURCE_BOTTOM_A = 'ns-source-a' as const;
export const NS_HANDLE_SOURCE_RIGHT_B = 'ns-source-b' as const;

export const PG_HANDLE_TARGET_TOP_A = 'pg-target-a' as const;
export const PG_HANDLE_SOURCE_BOTTOM_A = 'pg-source-a' as const;


// --- UI / Logic Specific Constants ---
export const NAMESPACE_INITIAL_PADDING = 38 as const;
export const NAMESPACE_MIN_WIDTH = 200 as const;
export const NAMESPACE_MIN_HEIGHT = 150 as const;
export const PODGROUP_DEFAULT_WIDTH = 150 as const;
export const PODGROUP_DEFAULT_HEIGHT = 40 as const;
