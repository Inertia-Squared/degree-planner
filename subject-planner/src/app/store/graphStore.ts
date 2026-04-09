import {create} from 'zustand';
import {ExtendedNode, Generic} from "@/utils/types";
import {GraphEdge} from "reagraph";
import {HeaderItem} from "@/components/ui/layout/Containers/HeaderBar";

// note: Zustand recommends using Immer to update nested states without messy destructuring

// currently migrating everything 1:1 to be on the safe side, but a lot of this can be simplified, will annotate where appropriate

export interface GraphDataState {
    // simple list of nodes and data
    nodes: ExtendedNode<Generic>[]
    edges: GraphEdge[]

    /** @brief Special data structure for efficient computations
     * @caveat In Zustand we need to create a new Map (or Set) when updating them.
     * @example
     * // updating nodeMap state
     * set((state) => ({
     *     nodeMap: new Map(state.nodeMap).set(key, value),
     * }));
     * @reference https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/maps-and-sets-usage.md
     **/
    nodeMap: Map<string, ExtendedNode<Generic>>
    /** @brief Special data structure for efficient computations
     * @caveat In Zustand we need to create a new Map (or Set) when updating them.
     * @example
     * // updating adjacencyList state
     * set((state) => ({
     *     adjacencyList: new Map(state.adjacencyList).set(key, value),
     * }));
     * @reference https://github.com/pmndrs/zustand/blob/main/docs/learn/guides/maps-and-sets-usage.md
     **/
    adjacencyList: Map<string, string[]>

    // rename to connectedNodesFound to better reflect its function and temporary nature
    addedNodes: ExtendedNode<Generic>[]

    // rename this to queryStarted to match backend terms instead of user-facing terms
    exploringStarted: boolean

    // rename to isQueryActive, possibly change behaviour to be based on if we are awaiting the async fetch
    nodesHot: boolean //move to graphRenderState?
}

/**
 * @fields
 * **Graph State**:
 * nodes,
 * edges
 *
 * **Algo-Friendly Mirror States**:
 * nodeMap,
 * adjacencyList
 *
 * **Graph Temporary State Data**:
 * addedNodes,
 * exploringStarted,
 * nodesHot
 */
export const useGraphDataStore = create<GraphDataState>()((set) => ({
    nodes: [],
    edges: [],
    nodeMap: new Map(),
    adjacencyList: new Map(),
    addedNodes: [],
    exploringStarted: false,
    nodesHot: false,
    // hook into update of nodes specifically and do some additional logic without needing to duplicate each time
    setState: (params: any) => {
        if('nodes' in params) {
            set({...params, nodesHot: true});
        } else {
            set(params);
        }
    }
}));



export interface GraphRenderState {
    displayedNodes: ExtendedNode<Generic>[]
    displayedEdges: GraphEdge[]

    clusterOptions: string[]
    clusterBy: string | undefined

    selectedElement: ExtendedNode<Generic> | GraphEdge | undefined

    showPotentialElectives: boolean
    showAllIneligible: boolean

    updateToggle: boolean // todo: see if this can be removed - it is a variable to force updates but may be causing issues
}

/**
 * @fields
 * **Nodes**:
 * displayedNodes,
 * displayedEdges
 *
 * **Clustering**:
 * clusterOptions,
 * clusterBy
 *
 * **Interaction Status**:
 * selectedElement
 *
 * **Display Options**:
 * showPotentialElectives,
 * showAllIneligible
 *
 * **State Management**:
 * updateToggle
 */
export const useGraphRenderStore = create<GraphRenderState>()((set) => ({
    displayedNodes: [],
    displayedEdges: [],

    clusterOptions: ["Select a node to see cluster options"],
    clusterBy: undefined,

    selectedElement: undefined,

    showPotentialElectives: false,
    showAllIneligible: false,

    updateToggle: false,
}));

export interface GraphUIState {
    // similar to below (I wrote below first, sue me) but called in selectElement (useSubjectCriteria.ts), it seems we have a lot of binary state changes from specific actions, some custom events would simplify this greatly.
    showInfo: boolean
    // Is only passed to SearchWindow, and only set (to false) in onNodeDoubleClicked (useSubjectCriteria.ts) - maybe we create a custom event for this which components can listen to?
    showSequences: boolean

    selectedHeaderItem: HeaderItem
}

/**
 * @fields
 * **Show/Hide**:
 * showInfo,
 * showSequences
 *
 * **Menu State**:
 * selectedHeaderItem
 */
export const useGraphUIStore = create<GraphUIState>()((set) => ({
    showInfo: false,
    showSequences: true,

    selectedHeaderItem: HeaderItem.NONE,
}));

