import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";

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
        const nodes = result.map(record => {
            const program = record.a;
            return {
                id: record.ID.low,
                label: program.properties.programName
            };
        });

        return NextResponse.json({ nodes });
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}