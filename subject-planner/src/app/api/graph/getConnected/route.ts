import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {nodeDisplayNameKeys, nodeDisplayNameMap, nodeFillMap, nodeSizeMap} from "@/lib/siteUtil";
import {ExtendedNode} from "@/app/page";

export interface getConnectedNodesInterface {
    connections: {
        connectedNode: ExtendedNode,
        relation: {
            id: string,
            label: string
        }
    }[]
}



export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const parentNodeId = searchParams.get('parentNodeId');
    const nodeFilter = searchParams.get('nodeFilter');
    const relationFilter = searchParams.get('relationFilter');

    if (!parentNodeId) {
        return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }

    try {
        const result = await read(
            `MATCH (a)-[r${relationFilter ? `:${relationFilter}` : ''}]->(b${nodeFilter ? `:${nodeFilter}` : ''}) WHERE ID(a) = ${parentNodeId} RETURN TYPE(r) as r,b, id(r) as rID, id(b) as bID`,
        );
        console.log(`MATCH (a)-[r${relationFilter ? `:${relationFilter}` : ''}]->(b${nodeFilter ? `:${nodeFilter}` : ''}) WHERE ID(a) = ${parentNodeId} RETURN TYPE(r) as r,b, id(r) as rID, id(b) as bID, labels(b) as bLabels`)
        const connections = result.map(record => {
            //console.log(`props: ${JSON.stringify(record.b,null,1)}`)
            // console.log(`For this node use ${nodeDisplayNameMap[record.b.labels[0]]}, yield ${record.b.properties[nodeDisplayNameMap[record.b.labels[0]]]}`)
            //console.log(`Returning node with id ${JSON.stringify(record.bID)} and edge with id ${JSON.stringify(record.rID)}`)
            return {
                connectedNode: {
                    id: record.bID.toNumber().toString(),
                    label: record.b.properties[nodeDisplayNameMap[record.b.labels[0] as nodeDisplayNameKeys]],
                    type: record.b.labels[0],
                    fill: nodeFillMap[record.b.labels[0] as nodeDisplayNameKeys],
                    size: nodeSizeMap[record.b.labels[0] as nodeDisplayNameKeys],
                } as ExtendedNode,
                relation: {
                    id: record.rID.toNumber().toString(),
                    label: record.r,
                }
            };
        });

        return NextResponse.json({connections} as getConnectedNodesInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}