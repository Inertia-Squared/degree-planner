// app/page.tsx
'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import {GraphEdge, GraphNode} from 'reagraph';
import LineupSelector from "@/components/LineupSelector";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

export default function Home() {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([])

    // const [stagedNodes, setStagedNodes] = useState<GraphNode[]>([]);
    // const [stagedEdges, setStagedEdges] = useState<GraphEdge[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const searchProgram = async (searchString: string)=>{
        const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
        if (!response.ok) {
            throw new Error(`Failed to get programs at /api/graph/getPrograms with search string ${searchString}`);
        }

        const data = await response.json() as getProgramsInterface;
        console.log(`Found nodes with IDs ${data.programs.map(node=>node.id)}`)
        const newPrograms = data.programs.map((program)=>{
            const newGraphNode: GraphNode = {
                id: program.id.toString(),
                label: program.label
            }
            return newGraphNode;
        })
        if(data.programs !== nodes) setNodes(newPrograms);
    }

    const addConnected = async (id: string) => {
        const response = await fetch(`/api/graph/getConnected?parentNodeId=${id}`);
        if(!response.ok){
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`)
        }
        const data = await response.json() as getConnectedNodesInterface;
        let newNodes = nodes;
        let newEdges = edges;
        for(let connection of data.connections){
            const nodeAlreadyExists = nodes.find(node=>node.id==connection.connectedNode.id);
            const edgeAlreadyExists = edges.find(edge=>edge.id==connection.relation.id);
            if (!nodeAlreadyExists){
                let newNode = connection.connectedNode;
                newNode.id = connection.connectedNode.id.toString();
                newNodes.push(newNode);
            }
            if(!edgeAlreadyExists) {
                const newEdge: GraphEdge = {
                    id: connection.relation.id.toString(),
                    source: id.toString(),
                    target: connection.connectedNode.id.toString(),
                    label: connection.relation.label.toString()
                };
                newEdges.push(newEdge);
            }
        }
        setNodes([...newNodes]);
        setEdges([...newEdges]);
    }

    useEffect(() => {
        console.log(`Nodes present: ${nodes.map(node=>JSON.stringify(node))}`)
    }, [nodes]);

    useEffect(() => {
        console.log(`Edges present: ${edges.map(edge=>edge.id)}`)
    }, [edges]);

    useEffect(() => {
        const fetchPrograms = async () => {
            try {
                // Fetch data from your new API endpoint
                await searchProgram('Bachelor of Data Science (3769)');
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPrograms();
    }, []); // Empty dependency array ensures this runs once on mount

    if (isLoading) return <p>Loading...</p>;
    if (error) return <p>Error: {error}</p>;

    return (
        <main className={`h-[100vh] flex flex-col p-4`}>
            <div className={`border-2 p-1`}>
                <h1 className={`col-span-1`}>Please Choose a Lineup to Begin.</h1>
                <hr/>
                <LineupSelector onSearchEvent={searchProgram} className={`p-1`}/>
            </div>
            <ForceGraph doubleClickNodeAction={addConnected} className={`grow w-full relative`} edges={edges} nodes={nodes} />
        </main>
    );
}