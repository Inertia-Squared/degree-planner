import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";

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
        const nodes = result.map(record => {
            return {
                connectedNode: {
                    id: record.bID,
                    label: Object.values(record.b.props)[0] // temporary
                },
                relation: {
                    id: record.rID,
                    label: record.r
                }
            };
        });

        return NextResponse.json({ nodes });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}