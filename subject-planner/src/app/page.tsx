// app/page.tsx
'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import {GraphEdge, GraphNode, LayoutTypes} from 'reagraph';
import LineupSelector from "@/components/LineupSelector";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";
import {HEXGBA, nodeFillMap, NodeTypes} from "@/lib/siteUtil";
import InfoPanel from "@/components/InfoPanel";
import {LogicalPrerequisite} from "../../../neo4j/upload-data-to-db";
import {util} from "zod";
import assertIs = util.assertIs;

// todo add type extensions for cringe node data fields

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

export interface ExtendedNode<T> extends GraphNode {
     data: T
}

interface GenericNode {
    type: NodeTypes
    school: string,
    coordinator: string,
    discipline: string,
    sequences: string,
}

interface SubjectExtension extends GenericNode{
    type: 'Subject'
    code: string,
    prerequisites: (string | LogicalPrerequisite)[]
    subjectSequences: string[]
}

interface ProgramExtension extends GenericNode{
    type: 'Program'
    programName: string,
    programSequences: string[]
}

enum expandModes {
    NeighboursOnly,
    ExpandPrerequisites,
    ExpandPrerequisiteChain
}

const badClusterOptions = [
    'subjectSequences',
    'programSequences',
    'choiceSequences',
    'description',
    'subjectLink',
    'programLink',
    'majorLink',
    'minorLink',
    'code',
    'prerequisites',
    'creditPoints',
    'subjectName',

]

const displayOptions = {
    ['Overview']: 'forceatlas2',
    ['Analyse']: 'forceDirected2d',
} as const;

type displayOptionKeys = keyof typeof displayOptions;

export default function Home() {
    const [nodes, setNodes] = useState<ExtendedNode<GenericNode>[]>([]);
    const [nodeMap, setNodeMap] = useState<Map<string, ExtendedNode<GenericNode>>>(new Map());
    const [adjacencyList, setAdjacencyList] = useState<Map<string, string[]>>(new Map())
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [edgeMap, setEdgeMap] = useState<Map<string, GraphEdge>>(new Map())
    const [addedNodes, setAddedNodes] = useState<ExtendedNode<GenericNode>[]>([]);

    const [expandMode, setExpandMode] = useState<expandModes>(expandModes.ExpandPrerequisiteChain);

    const [clusterOptions, setClusterOptions] = useState(['select a node to see cluster options']);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<GenericNode> | GraphEdge | undefined>(undefined);
    const [displayMode, setDisplayMode] = useState<LayoutTypes>(Object.values(displayOptions)[0]);

    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<GenericNode> | undefined>(undefined);
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(undefined);

    const [collapsedByProgramSequence, setCollapsedByProgramSequence] = useState<ExtendedNode<GenericNode>[]>([]);
    const [collapsedByNotRelevant, setCollapsedByNotRelevant] = useState<ExtendedNode<GenericNode>[]>([]);
    const [collapsedNodes, setCollapsedNodes] = useState<string[]>([]);


    const [isLoading, setIsLoading] = useState(true);

    const searchProgram = async (searchString: string)=>{
        const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
        if (!response.ok) {
            throw new Error(`Failed to get programs at /api/graph/getPrograms with search string ${searchString}`);
        }

        const data = await response.json() as getProgramsInterface;
        if(data.programs !== nodes) setNodes(data.programs);
    }

    function getNodeFromId(id: string){
        return nodes.find(n=>n.id===id);
    }

    function selectElement(id: string, isNode: boolean = true) {
        const element =
            isNode ? nodes.find(n=>n.id===id) : edges.find(e=>e.id===id);
        setSelectedElement(element);
        if(isNode) {
            if (element && element.data.type === 'Program') {
                setSelectedProgram(element as ExtendedNode<ProgramExtension>);
                const sequences = element.data['programSequences'];
                if (sequences.length > 0) setSelectedProgramSequence(sequences[0])
                // console.log(element)
            }
            setClusterOptions(Object.keys(element?.data).filter(key=>!badClusterOptions.find(o=>o==key)));
        }
    }

    function resetSelectedElement(){
        setSelectedElement(undefined);
        setClusterOptions(['select a node to see cluster options']);
        setClusterBy('not clustering')
    }


    /**
     * Filters out all nodes of a type excluding the one selected.
     * Selected node is excluded as this function is intended to be a way to narrow down options.
     * @param excludeId
     * @param filterType
     * @param graph
     */
    function chooseNode(excludeId: string, filterType: NodeTypes, graph: { oldNodes: ExtendedNode<GenericNode>[], oldEdges: GraphEdge[]}){
        const nodesToRemove = new Set<string>();

        // Initial nodes to remove based on the filterType
        graph.oldNodes.forEach(n => {
            if (n.data.type === filterType && n.id !== excludeId) {
                nodesToRemove.add(n.id);
            }
        });

        // Recursively find and mark all children for removal
        let  newNodesAdded = true;
        while (newNodesAdded) {
            newNodesAdded = false;
            graph.oldEdges.forEach(edge => {
                if (nodesToRemove.has(edge.source) && ! nodesToRemove.has(edge.target)) {
                    nodesToRemove.add(edge.target);
                    newNodesAdded = true;
                }
            });
        }

        // Filter out the marked nodes and their  edges
        graph.oldNodes = graph.oldNodes.filter(n => !nodesToRemove.has(n.id));
        graph.oldEdges = graph.oldEdges.filter(e => !nodesToRemove.has(e.source) && !nodesToRemove.has(e.target));

        return graph;
    }

    async function addConnected(params: {id: string}): Promise<void>;
    async function addConnected(params: {manualAdd: {newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[]}}): Promise<void>;

    async function addConnected(params: {id?: string, manualAdd?: { newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[] }
    }) {
        let newNodes;
        let newEdges;
        if (params.id) {
            let oldNodes = nodes;
            let oldEdges = edges;
            let result;
            switch (getNodeFromId(params.id)?.data.type) {
                case 'Program':
                    result = chooseNode(params.id, 'Program', {oldNodes, oldEdges})
                    break;
                case 'Major':
                    result = chooseNode(params.id, 'Major', {oldNodes, oldEdges})
                    break;
                case 'Minor':
                    result = chooseNode(params.id, 'Minor', {oldNodes, oldEdges})
                    break;
            }
            if (result){
                oldNodes = result.oldNodes;
                oldEdges = result.oldEdges;
            }
            const connected = await getConnected(params.id);

            newNodes = [...oldNodes,...connected.newNodes]
            newEdges = [...oldEdges, ...connected.newEdges]
        } else if(params.manualAdd) {
            newNodes = [...nodes,...params.manualAdd.newNodes];
            newEdges = [...edges, ...params.manualAdd.newEdges];
        } else {
            throw new Error('Unreachable code reached!?!? PANIC!!!!')
        }

        setNodes(newNodes);
        setEdges(newEdges)

        const nmap = new Map(newNodes.map(n=>[n.id,n]));
        setNodeMap(nmap);

        const adjacency = new Map<string, string[]>();
        const emap = new Map();
        newEdges.forEach(e=>{
            emap.set(e.id,e);
            if (!adjacency.has(e.source)) {
                adjacency.set(e.source, []);
            }
            adjacency.get(e.source)?.push(e.target);
        })
        setAdjacencyList(adjacency);

        newEdges.forEach(e=>e.fill='#DDDDDD')

        const irrelevantNodes: ExtendedNode<GenericNode>[] = [];
        newNodes.forEach((n: ExtendedNode<GenericNode>)=>{
            const shouldHighlight = shouldBeHighlighted(n, adjacency, nmap);
            n.fill = shouldHighlight ? nodeFillMap[n.data.type] : '#DDDDDD';
            if(shouldHighlight) {
                newEdges.forEach(e=>{
                    if (e.target === n.id && shouldBeHighlighted(nmap.get(e.source) as ExtendedNode<GenericNode>, adjacency, nmap)) e.fill = '#555555';
                })
            }
            let isVisible = false;
            if(!shouldHighlight) {
                isVisible = shouldBeVisible(n, adjacency, nmap);
                n.fill = isVisible ? new HEXGBA(nodeFillMap[n.data.type]).multiply(0.72).toHex().slice(0,7) : '#DDDDDD';
            }


            n.labelVisible = shouldHighlight || isVisible;
            if(!(shouldHighlight || isVisible)) irrelevantNodes.push(n);
        })

        setCollapsedByNotRelevant(irrelevantNodes);
    }

    function hasChildOfType(queryNode: ExtendedNode<GenericNode>, type: NodeTypes, adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
        const children = adjacencyList.get(queryNode.id) || [];
        for (const child of children){
            if (nodeMap.get(child)?.data.type === type) return true;
        }
        return false;
    }

    function hasParentOfType(queryNode: ExtendedNode<GenericNode>, type: NodeTypes, adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
        for (const parent of adjacencyList.keys()){
            if (adjacencyList.get(parent)?.includes(queryNode.id)
                && nodeMap.get(parent)?.data.type === type) {
                return true;
            }
        }
        return false;
    }

    // function getParentsOfType(queryNode: ExtendedNode, type: NodeTypes){
    //     const finalParents = [];
    //     for (const parent of adjacencyList.keys()){
    //         if (adjacencyList.get(parent)?.includes(queryNode.id)
    //             && nodeMap.get(parent)?.data.type === type) {
    //             finalParents.push(nodeMap.get(parent));
    //         }
    //     }
    //     return finalParents;
    // }
    //
    // function getChildrenOfType(queryNode: ExtendedNode, type: NodeTypes){
    //     const children = adjacencyList.get(queryNode.id) || [];
    //     const finalChildren = []
    //     for (const child of children){
    //         if (nodeMap.get(child)?.data.type === type) finalChildren.push(nodeMap.get(child));
    //     }
    //     return finalChildren;
    // }

    const getConnected = async (id: string | string[]) => {
        if (typeof id === 'string'){
            id = [id];
        }
        const response = await fetch(`/api/graph/getConnected`, {
            method: "POST",
            body: JSON.stringify({parentNodeIds: id})
        });
        if(!response.ok){
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`)
        }
        const data = await response.json() as getConnectedNodesInterface;
        //console.log(data)
        const newNodes = [];
        const newEdges = [];
        for(const connection of data.connections){
            const nodeAlreadyExists = nodes.find(node=>node.id==connection.connectedNode.id);
            const edgeAlreadyExists = edges.find(edge=> {
                return edge.id == connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id
            });
            if (!nodeAlreadyExists){
                const newNode = connection.connectedNode;
                newNode.id = connection.connectedNode.id;
                newNodes.push(newNode);
            }
            if(!edgeAlreadyExists) {
                const newEdge: GraphEdge = {
                    id: connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id,
                    source: connection.relation.source,
                    target: connection.connectedNode.id,
                    label: connection.relation.label
                };
                newEdges.push(newEdge);
            }
        }

        setAddedNodes(newNodes);
        return {newNodes: newNodes, newEdges: newEdges}
    }

    const expandConnected = async (nodesToExpand: ExtendedNode<GenericNode>[])=> {
        const connectionsToAdd: { newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[] } = {newNodes: [], newEdges: []}
        const idsToAdd = []
        for (const node of nodesToExpand){
            if(node.data.type === 'SubjectChoice' || (expandMode >= 1 && node.data.type === 'Prerequisites') || (expandMode >= 2 && node.data.type === 'Subject')){
                idsToAdd.push(node.id);
            }
        }
        const connections = await getConnected(idsToAdd);
        connectionsToAdd.newNodes.push(...connections.newNodes);
        connectionsToAdd.newEdges.push(...connections.newEdges);
        await addConnected({manualAdd: connectionsToAdd});
    }

    function shouldBeVisible(node: ExtendedNode<GenericNode>, adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
        if (node.data.type === 'Subject'){
            const n = node as ExtendedNode<SubjectExtension>;
            console.log(n.data['prerequisites'].length)
            if (n.data['prerequisites'].length <= 2){
                console.log(n.data['prerequisites'])
                return true;
            }
        }

        return false;
    }

    // TODO: change highlight logic to be prerequsite-based (present/satisfied/not-present) and use remnants of this logic for darker vs. lighter logic
    function shouldBeHighlighted(node: ExtendedNode<GenericNode>, adjacencyList: Map<string, string[]>, nodeMap: Map<string, ExtendedNode<GenericNode>>){
        if (node.data.type === 'Program') return true;

        if((node.data.type === 'Prerequisites' || node.data.type === 'SubjectChoice')
            && hasParentOfType(node, 'Program', adjacencyList, nodeMap)) return true;

        if(node.data.type === 'Subject' && hasChildOfType(node, 'Prerequisites', adjacencyList, nodeMap)) {
            // @ts-ignore
            const code= node.data['code'];
            const match = code.match(/^\w{4}.1.../);
            // console.log(code, match)
            if (match && !hasParentOfType(node, 'Prerequisites', adjacencyList, nodeMap)) return true;
            return false;
        }

        if (hasParentOfType(node, 'Program', adjacencyList, nodeMap) || hasParentOfType(node, 'Major', adjacencyList, nodeMap) || hasParentOfType(node, 'Minor', adjacencyList, nodeMap)){
            return true;
        }

        return false;
    }

    useEffect(() => {
        if(addedNodes.length > 0) expandConnected(addedNodes)
        // console.log(addedNodes.map(n=>n.data.sequences))
    }, [addedNodes]);

    useEffect(() => {
        const toBeCollapsed = nodes.map(n=>{
            if (n.data.type !== 'Subject') return;
            const sequences = (n as ExtendedNode<SubjectExtension>).data['subjectSequences'];
            //console.log(sequences)
            let inAnySequencesForThisProgram = false;
            let containsSelectedProgram = false;
            for (const sequence of sequences) {
                if (sequence.includes((selectedProgram as ExtendedNode<ProgramExtension>)?.data['programName'])) {
                    inAnySequencesForThisProgram = true;
                    //if(selectedProgramSequence) console.log(`The sequence ${selectedProgramSequence} when paired with ${sequence} evaluates to includes=${sequence.includes(selectedProgramSequence)}`, '\nNode data:', n)
                    if (selectedProgramSequence && sequence.includes(selectedProgramSequence)) {
                        containsSelectedProgram = true;
                    }
                }

            }
            if (inAnySequencesForThisProgram && !containsSelectedProgram) return n;
        }).filter(f=>f!==undefined);
        setCollapsedByProgramSequence(toBeCollapsed);


    }, [nodes, edges, selectedProgramSequence]);

    useEffect(() => {
        const collapsed = Array.from(new Set([...collapsedByProgramSequence.map(n=>n.id), ...collapsedByNotRelevant.map(n=>n.id)]));
        setCollapsedNodes([...collapsed]);
    }, [collapsedByProgramSequence, collapsedByNotRelevant]); // any nodes to be collapsed get added here

    useEffect(() => {
        const fetchPrograms = async () => {
            await searchProgram('Bachelor of Information Systems (3687)');
            setIsLoading(false);
        };
        fetchPrograms();
    }, []); // Empty dependency array ensures this runs once on mount

    if (isLoading) return <p>Loading...</p>;

    return (
        <main className={`h-[100vh] flex flex-col p-4`}>
            <div className={`border-2 p-1 flex`}>
                <div className={`flex-2`}>
                    <h1>Please Choose a Lineup to Begin.</h1>
                    <hr/>
                    <LineupSelector onSearchEvent={searchProgram} className={`p-1`}/>
                    {selectedProgram && <div>
                        <label>Choose your study period:</label>
                        <select onChange={(s)=>setSelectedProgramSequence(s.currentTarget.value)}>{(selectedProgram as ExtendedNode<ProgramExtension>).data['programSequences'].map(s=>{
                            return <option key={s} value={s}>{s}</option>
                        })}</select>
                    </div>}
                </div>
                <div className={`border-r-2 mx-2`}></div>
                <div className={`flex-3 flex`}>
                    <div className={`max-w-[460px]`}>
                        <h2>When double-clicking nodes, how should they expand?</h2>
                        <input onChange={()=>setExpandMode(expandModes.ExpandPrerequisiteChain)} checked={expandMode==expandModes.ExpandPrerequisiteChain} type="radio" id="expand-fully" name="expand_behaviour" value="Fully"/>
                        <label htmlFor="expand-fully"> Fully (show any relevant for electives)</label><br/>
                        <input onChange={()=>setExpandMode(expandModes.ExpandPrerequisites)} checked={expandMode==expandModes.ExpandPrerequisites} type="radio" id="expand-partially" name="expand_behaviour" value="Partially"/>
                        <label htmlFor="expand-partially"> Partially (show all needed for degree)</label><br/>
                        <input onChange={()=>setExpandMode(expandModes.NeighboursOnly)} checked={expandMode==expandModes.NeighboursOnly} type="radio" id="expand-touching" name="expand_behaviour" value="Touching"/>
                        <label htmlFor="expand-touching"> Only Touching Nodes (let me explore)</label><br/>
                    </div>
                    <div className={`border-r-2 mx-2`}></div>
                    <div className={'flex flex-col'}>
                        <div>
                            <label>Graph Display Mode: </label>
                            <select onChange={(s)=>setDisplayMode(displayOptions[s.currentTarget.value as displayOptionKeys])}>
                                {(Object.keys(displayOptions) as displayOptionKeys[]).map((c)=>{
                                    return <option key={c} value={c}>{c}</option>
                                })}
                            </select>
                        </div>
                        {displayMode === 'forceDirected2d' && <div>
                            <label>Cluster Nodes By: </label>
                            <select onChange={(s) => setClusterBy(s.currentTarget.value)}>
                                {clusterOptions.map(c => {
                                    return <option key={c} value={c}>{c}</option>
                                })}
                            </select>
                        </div>}
                    </div>
                    <div className={`border-r-2 mx-2`}></div>
                    <div className={`grow`}></div>
                </div>
            </div>
            <div>
            </div>
            <ForceGraph collapsedNodeIds={collapsedNodes} layoutMode={displayMode} clickAction={selectElement} clickCanvas={resetSelectedElement} clusterBy={clusterBy} doubleClickNodeAction={(id) => addConnected({id})} className={`grow w-full relative`}
                        edges={edges} nodes={nodes}/>
            <InfoPanel className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit max-h-1/2 max-w-1/5 border-2 absolute right-1 top-0 bottom-0 my-auto overflow-y-scroll`} item={selectedElement}/>
        </main>
    );
}