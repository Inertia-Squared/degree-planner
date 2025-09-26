import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {nodeDisplayNameKeys, nodeDisplayNameMap, nodeFillMap, nodeSizeMap} from "@/lib/siteUtil";
import {ExtendedNode} from "@/app/page";
import {keyOf, PropsKey} from "../../../../../../neo4j/upload-data-to-db";

export interface getConnectedNodesInterface {
    connections: {
        connectedNode: ExtendedNode,
        relation: {
            id: string,
            label: string
            source: string
        }
    }[]
}


export async function POST(request: Request) {
    const {parentNodeIds}: {parentNodeIds: string[]} = await request.json();
    if (!parentNodeIds) {
        return NextResponse.json({ error: 'array of programNames required' }, { status: 400 });
    }

    try {
        const query = `MATCH (a)-[r]->(b) WHERE ID(a) IN ${JSON.stringify(parentNodeIds.map(i=>Number(i)))} RETURN TYPE(r) as r,b, id(r) as rID, id(b) as bID, id(a) as aID`;
        console.log(query)
        const result = await read(query);
        const connections = result.map(record => {
            return {
                connectedNode: {
                    id: record.bID.toNumber().toString(),
                    label: record.b.properties[nodeDisplayNameMap[record.b.labels[0] as nodeDisplayNameKeys]],
                    data: {
                        type: record.b.labels[0] as nodeDisplayNameKeys,
                        ...record.b.properties
                    },
                    fill: nodeFillMap[record.b.labels[0] as nodeDisplayNameKeys],
                    size: nodeSizeMap[record.b.labels[0] as nodeDisplayNameKeys],
                } as ExtendedNode,
                relation: {
                    id: record.rID.toNumber().toString(),
                    label: record.r,
                    source: record.aID.toNumber().toString(),
                }
            };
        });

        return NextResponse.json({connections} as getConnectedNodesInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}