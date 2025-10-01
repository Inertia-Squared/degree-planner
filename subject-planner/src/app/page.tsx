// app/page.tsx
'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import {GraphEdge, GraphNode} from 'reagraph';
import LineupSelector from "@/components/LineupSelector";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";
import {nodeDisplayNameKeys} from "@/lib/siteUtil";
import InfoPanel from "@/components/InfoPanel";

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

export interface ExtendedNode extends GraphNode {
    data: {
        type: nodeDisplayNameKeys
        school: string,
        coordinator: string,
        discipline: string,
        sequences: string,
    }
}

enum expandModes {
    NeighboursOnly ,
    ExpandPrerequisites ,
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
    'minorLink'
]

export default function Home() {
    const [nodes, setNodes] = useState<ExtendedNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([])
    const [addedNodes, setAddedNodes] = useState<ExtendedNode[]>([]);
    const [expandMode, setExpandMode] = useState<expandModes>(expandModes.ExpandPrerequisites);
    const [clusterOptions, setClusterOptions] = useState(['none', 'type', 'school', 'discipline', 'coordinator']);
    const [clusterBy, setClusterBy] = useState<string>(clusterOptions[0]);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode | GraphEdge | undefined>(undefined);


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
            setClusterOptions(Object.keys(element?.data).filter(key=>!badClusterOptions.find(o=>o==key)))
        }
    }

    function resetSelectedElement(){
        setSelectedElement(undefined);
        setClusterOptions([]);
        setClusterBy('not clustering')
    }


    /**
     * Filters out all nodes of a type excluding the one selected.
     * Selected node is excluded as this function is intended to be a way to narrow down options.
     * @param excludeId
     * @param filterType
     * @param graph
     */
    function chooseNode(excludeId: string, filterType: nodeDisplayNameKeys, graph: { oldNodes: ExtendedNode[], oldEdges: GraphEdge[]}){
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
        graph.oldNodes = graph.oldNodes.filter(n => !nodesToRemove.has(n. id));
        graph.oldEdges = graph.oldEdges.filter(e => !nodesToRemove.has( e.source) && !nodesToRemove.has(e.target));

        return graph;
    }

    async function addConnected(params: {id: string}): Promise<void>;
    async function addConnected(params: {manualAdd: {newNodes: ExtendedNode[], newEdges: GraphEdge[]}}): Promise<void>;

    async function addConnected(params: {id?: string, manualAdd?: { newNodes: ExtendedNode[], newEdges: GraphEdge[] }
    }) {
        if (params.id){
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
            setNodes([...oldNodes,...connected.newNodes]);
            setEdges([...oldEdges, ...connected.newEdges]);
        } else if(params.manualAdd) {
            setNodes([...nodes,...params.manualAdd.newNodes]);
            setEdges([...edges, ...params.manualAdd.newEdges]);
        } else {
            throw new Error('Unreachable code reached!?!? PANIC!!!!')
        }
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
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`)
        }
        const data = await response.json() as getConnectedNodesInterface;
        console.log(data)
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

    const expandConnected = async (nodesToExpand: ExtendedNode[])=> {
        const connectionsToAdd: { newNodes: ExtendedNode[], newEdges: GraphEdge[] } = {newNodes: [], newEdges: []}
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
        console.log(addedNodes.map(n=>n.data.sequences))
    }, [addedNodes]);

    useEffect(() => {
        //console.log(`Edges present: ${edges.map(edge=>edge.id)}`)
    }, [edges]);

    useEffect(() => {
        const fetchPrograms = async () => {
            await searchProgram('Bachelor of Data Science (3769)');
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
                    <div>
                        <label>Cluster Nodes By: </label>
                        <select onChange={(s)=>setClusterBy(s.currentTarget.value)}>
                            {clusterOptions.map(c=>{
                                return <option key={c} value={c}>{c}</option>
                            })}
                        </select>
                    </div>
                    <div className={`border-r-2 mx-2`}></div>
                    <div className={`grow`}></div>
                </div>
            </div>
            <div>
            </div>
            <ForceGraph clickAction={selectElement} clickCanvas={resetSelectedElement} clusterBy={clusterBy} doubleClickNodeAction={(id) => addConnected({id})} className={`grow w-full relative`}
                        edges={edges} nodes={nodes}/>
            <InfoPanel className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit max-h-1/2 max-w-1/5 border-2 absolute right-1 top-0 bottom-0 my-auto overflow-y-scroll`} item={selectedElement}/>
        </main>
    );
}