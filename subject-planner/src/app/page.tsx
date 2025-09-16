// app/page.tsx
'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { GraphNode } from 'reagraph';
import LineupSelector from "@/components/LineupSelector";

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

export default function Home() {
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const searchProgram = async (query: string)=>{
        const response = await fetch(`/api/graph/getPrograms?programName=${query}`);
        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        if(data.nodes !== nodes) setNodes(data.nodes);
    }

    // const searchConnected = async ()

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
            <ForceGraph className={`grow w-full relative`} initialEdges={[]} initialNodes={nodes} />
        </main>
    );
}