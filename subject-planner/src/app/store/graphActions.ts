import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";
import {
    chooseNode,
    getParentsByType,
    isChoiceNode,
    isMajorNode,
    isMinorNode,
    isProgramNode,
    isSubjectNode
} from "@/lib/graph/graphUtil";
import {GraphEdge} from "reagraph";
import {HeaderItemType} from "@/components/ui/layout/Containers/HeaderBar";
import {
    useDegreeStore
} from "@/app/store/degreeStore";
import {
    ExtendedNode,
    Generic,
    GraphPruningProps,
    Major,
    Minor,
    OfferStatus,
    Prerequisite,
    StudyPeriodItem
} from "@/utils/types";
import {badClusterOptions} from "@/utils/consts";
import {applyGraphColours, isEligibleForSubject} from "@/lib/graph/graphColours";
import {fitGraphCamera} from "@/components/ForceGraph";
import {applyClassificationFilters, applyGraphFilters} from "@/lib/graph/graphFilters";
import {applyGraphLabels} from "@/lib/graph/graphLabels";
import {useGraphDataStore, useGraphRenderStore, useGraphUIStore} from "@/app/store/graphStore";
import {getSubjectsCompleted, hasTaken, isOfferedInCurrentPeriod, moveToNewPeriod} from "@/app/store/degreeActions";

export function getNodeFromId(id: string) {
    return useGraphDataStore.getState().nodes.find((n) => n.id === id);
}

export async function getConnected(id: string | string[]) {
    const state = useGraphDataStore.getState();
    if (typeof id === "string") {
        id = [id];
    }
    const response = await fetch(`/api/graph/getConnected`, {
        method: "POST",
        body: JSON.stringify({parentNodeIds: id}),
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
            if (isChoiceNode(newNode)) {
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
    useGraphDataStore.setState({addedNodes: newNodes});
    return {newNodes, newEdges};
}

export async function addConnected(params: {
    id?: string;
    manualAdd?: { newNodes: ExtendedNode<Generic>[]; newEdges: GraphEdge[] };
}) {
    const state = useGraphDataStore.getState();
    let newNodes;
    let newEdges;
    if (params.id) {
        let oldNodes = state.nodes;
        let oldEdges = state.edges;
        let result;
        switch (getNodeFromId(params.id)?.data.type) {
            case "Program":
                result = chooseNode(params.id, "Program", {oldNodes, oldEdges});
                break;
            case "Major":
                result = chooseNode(params.id, "Major", {oldNodes, oldEdges});
                break;
            case "Minor":
                result = chooseNode(params.id, "Minor", {oldNodes, oldEdges});
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

    useGraphDataStore.setState({nodeMap: nmap, adjacencyList: adjacency, nodes: newNodes, edges: newEdges});
    if (newNodes.length > 0) {
        setTimeout(() => {
            fitGraphCamera();
        }, 250)
    }
}

export async function expandConnected(nodesToExpand: ExtendedNode<Generic>[]) {
    const connectionsToAdd: {
        newNodes: ExtendedNode<Generic>[];
        newEdges: GraphEdge[];
    } = {newNodes: [], newEdges: []};
    const idsToAdd = nodesToExpand.map((n) => n.id);
    const connections = await getConnected(idsToAdd);
    connectionsToAdd.newNodes.push(...connections.newNodes);
    connectionsToAdd.newEdges.push(...connections.newEdges);
    await addConnected({manualAdd: connectionsToAdd});
}

export function forceAddSpecialisation(node: ExtendedNode<Major | Minor>) {
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

    useGraphDataStore.setState({nodes: newNodes, edges: newEdges});
}

export function updateGraphVisualisation() {
    let {newNodes, newEdges} = applyGraphFilters();
    applyGraphColours();
    const pruningProps: GraphPruningProps = {
        newNodes: newNodes,
        newEdges: newEdges,
    };
    const newValues = applyClassificationFilters(pruningProps);
    newNodes = newValues.newNodes;
    newEdges = newValues.newEdges;

    applyGraphLabels(newNodes);

    // Force React to see this as a brand-new array with brand-new objects for certain edge-cases,
    // array elements are spread to prevent js from reusing the old object reference
    const forcedNewNodes = newNodes.map(node => ({ ...node }));
    const forcedNewEdges = newEdges.map((e) => ({ ...e }));

    useGraphRenderStore.setState({displayedNodes: forcedNewNodes, displayedEdges: forcedNewEdges});

    const {addedNodes} = useGraphDataStore.getState();
    if (addedNodes.length > 0) expandConnected(addedNodes);
}

/*
    todo due to messy implementation, removed a fix which prevents recently added nodes from being added again
     (to fix rerender race conditions). Re-implement when possible through Zustand or address the race
     condition more directly.

     Old implementation added a node to a set (via useRef) which would have a timeout to remove that element in one second.
     It would then have a check at the start to make sure the current node didn't exist in the set already.
*/
export function onNodeDoubleClicked(id: string) {
    useGraphRenderStore.setState({updateToggle: !useGraphRenderStore.getState().updateToggle});

    const {
        nodes,
        adjacencyList,
        nodeMap,
        currentPeriod,
        subjectsTaken
    } = {...useGraphDataStore.getState(), ...useDegreeStore.getState()};

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
            !isEligibleForSubject(parentPrerequisites, getSubjectsCompleted()) ||
            isOfferedInCurrentPeriod(node) === OfferStatus.NO
        ) {
            return;
        }

        // Double check if already in current period
        if (currentPeriod.subjectsTaken.some(n => n.id === node.id)) return;

        useGraphUIStore.setState({showSequences: false, selectedHeaderItem: HeaderItemType.TIMELINE});


        let newCurrentPeriod = {...currentPeriod};
        newCurrentPeriod.subjectsTaken = [...newCurrentPeriod.subjectsTaken, node];

        useDegreeStore.setState({subjectsTaken: [...subjectsTaken, node]});
        if (newCurrentPeriod.subjectsTaken.length % 4 === 0) {
            moveToNewPeriod(<StudyPeriodItem>newCurrentPeriod);
        } else {
            useDegreeStore.setState({currentPeriod: newCurrentPeriod});
        }
    }
    updateGraphVisualisation();
}

export function startExploring() {
    const nodes = useGraphDataStore.getState().nodes;
    const newNodes = nodes.filter((n) => isProgramNode(n) || isMinorNode(n) || isMajorNode(n));

    useGraphDataStore.setState({nodes: newNodes, exploringStarted: true});
    useGraphUIStore.setState({selectedHeaderItem: HeaderItemType.SEARCH});

    const startPeriod = useDegreeStore.getState().startPeriod;
    useDegreeStore.setState({currentPeriod: {period: startPeriod, subjectsTaken: []}})

    expandConnected(newNodes);
}

export function selectElement(id: string, isNode: boolean = true) {
    const {nodes, edges} = useGraphDataStore.getState();

    const element = isNode ? nodes.find((n) => n.id === id) : edges.find((e) => e.id === id);
    useGraphUIStore.setState({showInfo: true});
    useGraphRenderStore.setState({selectedElement: element});

    if (isNode) {
        if (element && isProgramNode(element)) {
            const sequences = element.data["programSequences"];
            let seq = undefined;
            if (sequences.length > 0) seq = sequences[0];
            useDegreeStore.setState({selectedProgram: element, selectedProgramSequence: seq})
        }
        const options = Object.keys(element?.data).filter((key) => !badClusterOptions.find((o) => o == key));
        useGraphRenderStore.setState({clusterOptions: options});
    }
}

export function exportToJSON(){
    const { displayedNodes, displayedEdges } = useGraphRenderStore.getState();

    const createJsonAndDownload = (fileName: string, json: string) => {
        if (!json) return;
        const blob = new Blob([json], { type: 'text/json;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Nodes Json
    if (displayedNodes.length > 0) {
        createJsonAndDownload('nodes.json', JSON.stringify(displayedNodes, null, 2));
    }

    // Edges Json
    if (displayedNodes.length > 0) {
        createJsonAndDownload('edges.json', JSON.stringify(displayedEdges, null, 2));
    }
}