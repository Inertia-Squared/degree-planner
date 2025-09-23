// components/ForceGraph.js
import {GraphCanvas, GraphEdge} from 'reagraph';
import {ExtendedNode} from "@/app/page";

interface ForceGraphProps {
    nodes: ExtendedNode[],
    edges: GraphEdge[],
    doubleClickNodeAction: (id: string) => void
    className?: string,
}

const ForceGraph = ({nodes, edges, className, doubleClickNodeAction}: ForceGraphProps) => {
    const classN = className ?? `w-[300px] h-full relative`;
    return (
        <div className={classN}>
            <GraphCanvas onNodeDoubleClick={(node) => doubleClickNodeAction(node.id)} nodes={nodes} edges={edges}/>
        </div>
    );
};

export default ForceGraph;