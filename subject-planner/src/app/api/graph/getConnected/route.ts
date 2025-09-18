import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {nodeDisplayNameKeys, nodeDisplayNameMap} from "@/lib/siteUtil";

export interface getConnectedNodesInterface {
    connections: {
        connectedNode: {
            id: string,
            label: string
        },
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
            `MATCH (a)-[r${relationFilter ? `:${relationFilter}` : ''}]->(b ${nodeFilter ? `:${nodeFilter}` : ''}) WHERE ID(a) = ${parentNodeId} RETURN TYPE(r) as r,b, id(r) as rID, id(b) as bID`,
        );
        const connections = result.map(record => {
            //console.log(`props: ${JSON.stringify(record.b,null,1)}`)
            // console.log(`For this node use ${nodeDisplayNameMap[record.b.labels[0]]}, yield ${record.b.properties[nodeDisplayNameMap[record.b.labels[0]]]}`)
            console.log(`Returning node with id ${JSON.stringify(record.bID)} and edge with id ${JSON.stringify(record.rID)}`)
            return {
                connectedNode: {
                    id: record.bID.low,
                    label: record.b.properties[nodeDisplayNameMap[record.b.labels[0] as nodeDisplayNameKeys]]
                },
                relation: {
                    id: record.rID.high,
                    label: record.r
                }
            };
        });

        return NextResponse.json({connections} as getConnectedNodesInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}