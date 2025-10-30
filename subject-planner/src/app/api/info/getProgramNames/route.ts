import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";

export type getProgramNamesInterface = string[];

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    let searchString = searchParams.get('programName');

    if (!searchString) {
        return NextResponse.json({ error: 'programName is required' }, { status: 400 });
    }
    searchString = searchString.replace(/['";]/g, '');
    try {
        const result = await read(
            `MATCH (a:Program) WHERE toLower(a.programName) CONTAINS "${searchString.toLowerCase()}" RETURN a.programName as name`,
        );
        const programNames = result.map(record => {
            return record.name as string
        });

        return NextResponse.json(programNames as getProgramNamesInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}