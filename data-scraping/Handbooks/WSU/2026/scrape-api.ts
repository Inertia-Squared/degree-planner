import fs from 'fs/promises'
import {
    APIQuery,
    APIResponse,
    BaseRequestResponse,
    Entry,
    fetchAPIJSON,
    fetchHandbookData,
    queryFields
} from "./schema/schema";


async function scrapeDatabase<T extends BaseRequestResponse<APIQuery, APIResponse<Entry>>>() {
    let scrapedData: any[] = [];
    const limit = 50;
    let numEntriesReturned = limit;
    let offset = 0;
    while (numEntriesReturned === limit) {
        // Note: For some contentTypes, limits above 50 have been observed to cause server errors when sending the request
        const payload: T['request'] = {
            siteId: 'wsu-prod-pres',
            contentType: 'course',
            queryParams: [
                {
                    queryField: "implementationYear",
                    queryValue: queryFields.implementationYear.current
                },
            ],
            offset: offset,
            limit: limit,
        }
        const response = await fetchHandbookData(payload);
        const json = await response.json();
        const data = json.data as T['response'];
        scrapedData = [...scrapedData, ...data.data];
        numEntriesReturned = data.data.length;
        offset += numEntriesReturned;
    }
    const alldata = scrapedData.length;
    console.log(alldata);

    const setMap = new Map<string, string>();

    const processedData = scrapedData.map(d=>{
        let jsonOut = JSON.parse(d.data as string);
        // re-output fields with the key as the JSON key and the assigned value (i.e. [key]: value)
        jsonOut = Object.fromEntries(Object.entries(jsonOut).map(([key, value]) => {
            const compStr = JSON.stringify(value);
            if (setMap.has(key)) {
                const mapStr = setMap.get(key) as string;
                if (mapStr != compStr || mapStr === 'KEY_IN_USE_1016') {
                    setMap.set(key, 'KEY_IN_USE_1016');
                }
            } else {
                setMap.set(key, compStr);
            }
            return [key, value];
        }));
        return jsonOut;
    });

    const unusedFields: string[] = []
    for(let [key, value] of setMap.entries()) {
        if(value !== 'KEY_IN_USE_1016') {
            unusedFields.push(key);
        }
    }
    console.log(unusedFields);

    const remainingKeys = processedData.map(d=>{
        return Object.fromEntries(Object.entries(d).filter(([key,value])=>{
            return !unusedFields.includes(key);
        }))
    })

    const result = JSON.stringify(remainingKeys, null, 2);
    if(result && result.length > 0) await fs.writeFile('apiData.json', result, 'utf8');
    else console.error('No response.');
    const res = await fetchAPIJSON('subject','COMP1005');
    if (res.ok) {
        const d = await res.json();
        console.log(d);
    }

    return result;
}

scrapeDatabase().then(response => {
    //console.log(response)
}).catch(error => {
    console.error(error);
});
