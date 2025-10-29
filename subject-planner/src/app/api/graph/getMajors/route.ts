import { NextResponse } from 'next/server';
import { read } from "@/lib/neo4j";
import {ExtendedNode, MajorExtension} from "@/app/page";
import {nodeFillMap, nodeSizeMap} from "@/lib/siteUtil";

export interface getMajorsInterface {
    majors: ExtendedNode<MajorExtension>[]
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
            `MATCH (a:Major)<-[r]-(b:Program) where toLower(b.programName) contains '${searchString.toLowerCase()}' RETURN a, id(a) as ID, id(r) as rID`,
        );
        const majors = result.map(record => {
            const major = record.a;
            return {
                id: record.ID.toNumber().toString(),
                label: major.properties.majorName,
                data: {
                    type: 'Major',
                    programConnectionId: record.rID.toNumber().toString(),
                    ...major.properties
                },
                fill: nodeFillMap['Major'],
                size: nodeSizeMap['Major']
            } as ExtendedNode<MajorExtension>;
        });

        return NextResponse.json({majors} as getMajorsInterface);
    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch data from Neo4j' }, { status: 500 });
    }
}