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

import {
    filterDisconnectedEdges, filterLeafPrerequisites,
    filterPrerequisitesNotInCourse,
    filterSubjectsNotInSequence
} from "@/lib/graph/graphFilters";
import {
    isEligibleForSubject,
    isRequiredByProgramOrSpecialisation,
    prerequisiteIsFulfilled
} from "@/lib/graph/graphColours";
import {getParentsByType} from "@/lib/graph/graphUtil";

// todo add type extensions for cringe node data fields

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

function containsAll(object: any, components: string[]){
    let missingComponent = false;
    components.forEach((component)=>{
        if (!(component in object)) {
            missingComponent = true;
        }
    })
    return !missingComponent;
}

export interface ExtendedNode<T> extends GraphNode {
     data: T
}
export function isExtendedNode(obj: any){
    return 'data' in obj;
}

export interface GenericNode {
    type: NodeTypes
}
export function isGenericNode(obj: any){
    return isExtendedNode(obj) && containsAll(obj.data, ['type']);
}

export interface SubjectExtension extends GenericNode{
    type: 'Subject'
    code: string,
    prerequisites: string[]
    subjectSequences: string[]
}
export function isSubjectNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['code','prerequisites','subjectSequences']);
}

export interface ProgramExtension extends GenericNode{
    type: 'Program'
    programName: string,
    programSequences: string[]
}
export function isProgramNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data,['programName','programSequences']);
}

export interface PrerequisiteExtension extends GenericNode {
    type: 'Prerequisites'
    course: string
    subjects: string[]
}
export function isPrerequisiteNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['course', 'subjects']);
}

export function showNodeInfo(node: ExtendedNode<any>){
    console.log(`Info on Node | Is Generic: ${isGenericNode(node)}, 
    Is Subject: ${isSubjectNode(node)}, Is Program: ${isProgramNode(node)}, 
    Is Prerequisite: ${isPrerequisiteNode(node)}`)
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
    const [displayedNodes, setDisplayedNodes] = useState<ExtendedNode<GenericNode>[]>([]);
    const [nodeMap, setNodeMap] = useState<Map<string, ExtendedNode<GenericNode>>>(new Map());
    const [adjacencyList, setAdjacencyList] = useState<Map<string, string[]>>(new Map())
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [displayedEdges, setDisplayedEdges] = useState<GraphEdge[]>([]);
    const [addedNodes, setAddedNodes] = useState<ExtendedNode<GenericNode>[]>([]);

    const [expandMode, setExpandMode] = useState<expandModes>(expandModes.ExpandPrerequisiteChain);

    const [clusterOptions, setClusterOptions] = useState(['select a node to see cluster options']);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<GenericNode> | GraphEdge | undefined>(undefined);
    const [displayMode, setDisplayMode] = useState<LayoutTypes>(Object.values(displayOptions)[0]);

    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<ProgramExtension> | undefined>(undefined);
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(undefined);

    const [completedSubjects, setCompletedSubjects] = useState<ExtendedNode<SubjectExtension>[]>();

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

        const nmap = new Map(newNodes.map(n=>[n.id,n]));
        setNodeMap(nmap);

        const adjacency = new Map<string, string[]>();
        newEdges.forEach(e=>{
            if (!adjacency.has(e.source)) {
                adjacency.set(e.source, []);
            }
            adjacency.get(e.source)?.push(e.target);
        })
        setAdjacencyList(adjacency);

        setNodes(newNodes);
        setEdges(newEdges);
    }

    const getConnected = async (id: string | string[]) => {
        if (typeof id === 'string'){
            id = [id];
        }
        const response = await fetch(`/api/graph/getConnected`, {
            method: "POST",
            body: JSON.stringify({parentNodeIds: id})
        });
        if(!response.ok){
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`);
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

    useEffect(() => {
        if(addedNodes.length > 0) expandConnected(addedNodes);
        // console.log(addedNodes.map(n=>n.data.sequences))
    }, [addedNodes]);

    useEffect(() => {
        let newNodes = nodes;
        let newEdges = edges;

        /**
         * Graph Filtering Pass
         */
        // filter out nodes not relevant to selected program
        if(selectedProgram) newNodes = newNodes.filter(n=> {
            if (!isSubjectNode(n)) return true;
            return filterSubjectsNotInSequence(n as ExtendedNode<SubjectExtension>, selectedProgram.data.programName, selectedProgramSequence ?? '');
        });

        // filter out prerequisites we know are not part of course
        if(selectedProgram) newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterPrerequisitesNotInCourse(n as ExtendedNode<PrerequisiteExtension>, selectedProgram.data.programName);
        });

        // filter out edges that are no longer visible
        newEdges = newEdges.filter(e=>filterDisconnectedEdges(e, newNodes));

        // filter out prerequisite nodes that do not lead to a visible subject
        newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterLeafPrerequisites(n as ExtendedNode<PrerequisiteExtension>, newEdges);
        });

        /**
         * Graph Semantic Highlighting Pass
         */
        newNodes.forEach(n=>{
            if (!isSubjectNode(n)) return;
            const parentPrerequisites = getParentsByType(n as ExtendedNode<SubjectExtension>, newNodes, adjacencyList, nodeMap, 'Prerequisites');
            if (isEligibleForSubject(parentPrerequisites as ExtendedNode<PrerequisiteExtension>[], completedSubjects)){
                n.fill = nodeFillMap['Subject'];
            } else {
                n.fill = '#AAAAAA'
            }
        });

        newNodes.forEach(n=>{
           if (!isSubjectNode(n) || !n.fill) return;
           if (!isRequiredByProgramOrSpecialisation(n as ExtendedNode<SubjectExtension>, newNodes, adjacencyList, nodeMap)){
               n.fill = (new HEXGBA(n.fill).multiply(0.55).toHex());
           }
        });

        newNodes.forEach(n=>{
            if (!isPrerequisiteNode(n)) return;
            if (prerequisiteIsFulfilled(n as ExtendedNode<PrerequisiteExtension>, completedSubjects)) {
                n.fill = nodeFillMap['Prerequisites'];
            } else {
                n.fill = '#AAAAAA'
            }
        })

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
    }, [nodes, selectedProgramSequence, selectedProgram]);

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
            <ForceGraph layoutMode={displayMode} clickAction={selectElement} clickCanvas={resetSelectedElement} clusterBy={clusterBy} doubleClickNodeAction={(id) => addConnected({id})} className={`grow w-full relative`}
                        edges={displayedEdges} nodes={displayedNodes}/>
            <InfoPanel className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit max-h-1/2 max-w-1/5 border-2 absolute right-1 top-0 bottom-0 my-auto overflow-y-scroll`} item={selectedElement}/>
        </main>
    );
}