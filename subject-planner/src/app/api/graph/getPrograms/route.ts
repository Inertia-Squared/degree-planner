import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {ExtendedNode} from "@/app/page";
import {nodeFillMap, nodeSizeMap} from "@/lib/siteUtil";

export interface getProgramsInterface {
    programs: ExtendedNode[]
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const searchString = searchParams.get('programName');

    if (!searchString) {
        return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }

    try {
        const result = await read(
            `MATCH (a:Program) WHERE a.programName contains "${searchString}" RETURN a, id(a) as ID`,
        );
        const programs = result.map(record => {
            const program = record.a;
            return {
                id: record.ID.toNumber().toString(),
                label: program.properties.programName,
                type: 'Program',
                fill: nodeFillMap['Program'],
                size: nodeSizeMap['Program']
            } as ExtendedNode;
        });

        return NextResponse.json({programs} as getProgramsInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}