import neo4j, {Driver} from "neo4j-driver";

const URI = 'neo4j://localhost:7687';
const USER = 'neo4j';
const PASSWORD = process.env.NEO4J_PASSWORD ?? '';


const driver: Driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
await driver.getServerInfo({database: 'neo4j'}).then((r)=>{
    console.log(r)
    console.log('connected!')
})

export async function read(cypher: string, params = {}) {
    // 1. Open a session
    const session = driver.session({database: 'neo4j'})
    try {
        // 2. Execute a Cypher Statement
        const res = await session.executeRead(tx => tx.run(cypher, params))
        // 3. Process the Results
        return res.records.map(record => record.toObject())
    }
    finally {
        // 4. Close the session
        await session.close()
    }
}

export async function write(cypher: string, params = {}) {
    // 1. Open a session
    const session = driver.session({database: 'subset-it-programs'})

    try {
        // 2. Execute a Cypher Statement
        const res = await session.executeWrite(tx => tx.run(cypher, params))

        // 3. Process the Results
        return res.records.map(record => record.toObject())
    }
    finally {
        // 4. Close the session
        await session.close()
    }
}