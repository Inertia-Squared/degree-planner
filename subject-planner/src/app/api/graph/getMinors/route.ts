import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {ExtendedNode, Minor} from "@/utils/types";

import {nodeFillMap, nodeSizeMap} from "@/utils/consts";

export interface getMinorsInterface {
    minors: ExtendedNode<Minor>[]
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    let searchString = searchParams.get('programName');

    if (!searchString) {
        return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }
    searchString = searchString.replace(/['";]/g, '');
    try {
        const result = await read(
            `MATCH (a:Minor)<-[r]-(b:Program) where toLower(b.programName) contains '${searchString.toLowerCase()}' RETURN a, id(a) as ID, id(r) as rID`,
        );
        const minors = result.map(record => {
            const minor = record.a;
            return {
                id: record.ID.toNumber().toString(),
                label: minor.properties.minorName,
                data: {
                    type: 'Minor',
                    programConnectionId: record.rID.toNumber().toString(),
                    ...minor.properties
                },
                fill: nodeFillMap['Minor'],
                size: nodeSizeMap['Minor']
            } as ExtendedNode<Minor>;
        });

        return NextResponse.json({minors} as getMinorsInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}