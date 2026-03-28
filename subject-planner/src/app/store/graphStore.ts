import {create} from 'zustand';
import {ExtendedNode, Generic, Major, Minor, OfferStatus, Prerequisite} from "@/utils/types";
import {GraphCanvasRef, GraphEdge} from "reagraph";
import {RefObject} from "react";
import {HeaderItem} from "@/components/ui/layout/Containers/HeaderBar";
import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";
import {chooseNode, getParentsByType, isChoiceNode, isSubjectNode} from "@/lib/graph/graphUtil";
import {fitGraphCamera} from "@/components/ForceGraph";
import {getCompletedSubjects, hasTaken, useDegreeStore} from "@/app/store/degreeStore";
import {isEligibleForSubject} from "@/lib/graph/graphColours";

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

export const useGraphDataStore = create<GraphDataState>()((set) => ({
    nodes: [],
    edges: [],
    nodeMap: new Map(),
    adjacencyList: new Map(),
    addedNodes: [],
    exploringStarted: false,
    nodesHot: false,
}));

export function getNodeFromId(id: string){
    return useGraphDataStore.getState().nodes.find((n) => n.id === id);
}

export async function getConnected(id: string | string[]){
        const state = useGraphDataStore.getState();
        if (typeof id === "string") {
            id = [id];
        }
        const response = await fetch(`/api/graph/getConnected`, {
            method: "POST",
            body: JSON.stringify({ parentNodeIds: id }),
        });
        if (!response.ok) {
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`);
        }
        const data = (await response.json()) as getConnectedNodesInterface;
        const newNodes = [];
        const newEdges = [];
        for (const connection of data.connections) {
            const nodeAlreadyExists = state.nodes.find((node) => node.id == connection.connectedNode.id);
            const edgeAlreadyExists = state.edges.find((edge) => {
                return (
                    edge.id ==
                    connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id
                );
            });
            if (!nodeAlreadyExists) {
                const newNode = connection.connectedNode;
                newNode.id = connection.connectedNode.id;
                if (isChoiceNode(newNode)){
                    newNode.label = `Choose ${newNode.label}`
                }
                newNodes.push(newNode);
            }
            if (!edgeAlreadyExists) {
                const newEdge: GraphEdge = {
                    id:
                        connection.relation.id +
                        ":" +
                        connection.relation.source +
                        connection.connectedNode.id,
                    source: connection.relation.source,
                    target: connection.connectedNode.id,
                    label: connection.relation.label,
                };
                newEdges.push(newEdge);
            }
        }
        useGraphDataStore.setState({ addedNodes: newNodes });
        return { newNodes, newEdges };
}

export async function addConnected(params: {
    id?: string;
    manualAdd?: { newNodes: ExtendedNode<Generic>[]; newEdges: GraphEdge[] };
}){
    const state = useGraphDataStore.getState();
    let newNodes;
    let newEdges;
    if (params.id) {
        let oldNodes = state.nodes;
        let oldEdges = state.edges;
        let result;
        switch (getNodeFromId(params.id)?.data.type) {
            case "Program":
                result = chooseNode(params.id, "Program", { oldNodes, oldEdges });
                break;
            case "Major":
                result = chooseNode(params.id, "Major", { oldNodes, oldEdges });
                break;
            case "Minor":
                result = chooseNode(params.id, "Minor", { oldNodes, oldEdges });
                break;
        }
        if (result) {
            oldNodes = result.oldNodes;
            oldEdges = result.oldEdges;
        }
        const connected = await getConnected(params.id);

        newNodes = [...oldNodes, ...connected.newNodes];
        newEdges = [...oldEdges, ...connected.newEdges];
    } else if (params.manualAdd) {
        newNodes = [...state.nodes, ...params.manualAdd.newNodes];
        newEdges = [...state.edges, ...params.manualAdd.newEdges];
    } else {
        throw new Error("Unreachable code reached!?!? PANIC!!!!");
    }

    const nmap = new Map(newNodes.map((n) => [n.id, n]));

    const adjacency = new Map<string, string[]>();
    newEdges.forEach((e) => {
        if (!adjacency.has(e.source)) {
            adjacency.set(e.source, []);
        }
        adjacency.get(e.source)?.push(e.target);
    });

   useGraphDataStore.setState({ nodeMap: nmap, adjacencyList: adjacency, nodes: newNodes, edges: newEdges });
    if (newNodes.length > 0) {
        setTimeout(()=>{
            fitGraphCamera();
        },250)
    }
}

export async function expandConnected(nodesToExpand: ExtendedNode<Generic>[]){
        const connectionsToAdd: {
            newNodes: ExtendedNode<Generic>[];
            newEdges: GraphEdge[];
        } = { newNodes: [], newEdges: [] };
        const idsToAdd = nodesToExpand.map((n) => n.id);
        const connections = await getConnected(idsToAdd);
        connectionsToAdd.newNodes.push(...connections.newNodes);
        connectionsToAdd.newEdges.push(...connections.newEdges);
        await addConnected({ manualAdd: connectionsToAdd });
}

export function forceAddSpecialisation(node: ExtendedNode<Major | Minor>){
    const {nodes, selectedProgram, edges} = {...useGraphDataStore.getState(), ...useDegreeStore.getState()};

    if (!node.data.programConnectionId || !selectedProgram || nodes.includes(node)) return;

    node.size = 40;
    const newNodes = [...nodes.filter((n) => n.data.type !== node.data.type), node];

    const newEdgeId = node.data.programConnectionId + ":" + selectedProgram.id + node.id;
    const newEdge: GraphEdge = {
        id: newEdgeId,
        source: selectedProgram.id,
        target: node.id,
        label: "HAS_SPECIALISATION",
    };
    const newEdges = [...edges.filter((e) => newNodes.find((n) => n.id === e.target)), newEdge];

    useGraphDataStore.setState({ nodes: newNodes, edges: newEdges });
}



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

export const useGraphUIStore = create<GraphUIState>()((set) => ({
    showInfo: false,
    showSequences: true,

    selectedHeaderItem: HeaderItem.NONE,
}));

/*
    todo due to messy implementation, removed a fix which prevents recently added nodes from being added again
     (to fix rerender race conditions). Re-implement when possible through Zustand or address the race
     condition more directly.

     Old implementation added a node to a set (via useRef) which would have a timeout to remove that element in one second.
     It would then have a check at the start to make sure the current node didn't exist in the set already.
*/
export function onNodeDoubleClicked(id: string) {
    useGraphRenderStore.setState({updateToggle: !useGraphRenderStore.getState().updateToggle});

    const {nodes, adjacencyList, nodeMap, currentPeriod, subjectsTaken} = {...useGraphDataStore.getState(), ...useDegreeStore.getState()};

    const node = getNodeFromId(id);
    if (node && isSubjectNode(node)) {
        if (hasTaken(node)) {
            return;
        }
        const parentPrerequisites = getParentsByType<Prerequisite>(
            node,
            nodes,
            adjacencyList,
            nodeMap,
            "Prerequisites"
        ).filter((p) => p.data.forSubject === node.data.code);
        if (
            !isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) ||
            isOfferedInCurrentPeriod(node) === OfferStatus.NO
        ) {
            return;
        }

        // Double check if already in current period
        if (currentPeriod.subjectsTaken.some(n => n.id === node.id)) return;

        useGraphUIStore.setState({showSequences: false, selectedHeaderItem: HeaderItem.TIMELINE});


        let newCurrentPeriod = { ...currentPeriod };
        newCurrentPeriod.subjectsTaken = [...newCurrentPeriod.subjectsTaken, node];

        useDegreeStore.setState({subjectsTaken: [...subjectsTaken, node]});
        if (newCurrentPeriod.subjectsTaken.length % 4 === 0) {
            moveToNewPeriod(newCurrentPeriod);
        } else {
            useDegreeStore.setState({currentPeriod: newCurrentPeriod});
        }
    }
}

