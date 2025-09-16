// components/ForceGraph.js

import {GraphCanvas, GraphEdge, GraphNode} from 'reagraph';
import LineupSelector from "@/components/LineupSelector";
// import { nodes as initialNodes, edges as initialEdges } from '../lib/data';

interface ForceGraphProps {
    initialNodes: GraphNode[],
    initialEdges: GraphEdge[],
    className?: string,
}

const ForceGraph = ({initialNodes, initialEdges, className}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-full relative`;
    return (
        <div className={classN}>
            <GraphCanvas nodes={initialNodes} edges={initialEdges}/>
        </div>
);
};

export default ForceGraph;