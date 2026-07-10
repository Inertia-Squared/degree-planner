// Define the shape of our API payload, set up types to have some nice autocomplete when working with the API
interface QueryParam {
    queryField: QueryField
    queryValue: QueryValue & string
}

type QueryField = 'parentAcademicOrg' | 'implementationYear' | 'studyLevel' | 'studyLevelValue'

type parentAcademicOrg = {
    business: QueryValue & string
    healthSciences: QueryValue & string
    psychology: QueryValue & string
    computingDataMaths: QueryValue & string
    humanitiesCommunicationArts: QueryValue & string
    science: QueryValue & string
    education: QueryValue & string
    law: QueryValue & string
    socialSciences: QueryValue & string
    engineeringDesignBuiltEnvironments: QueryValue & string
    medicine: QueryValue & string
    college: QueryValue & string
    graduateResearch: QueryValue & string
    nursingMidwifery: QueryValue & string
}

type implementationYear = {
    current: QueryValue & string
}

type studyLevel = {
    postgraduate: QueryValue & string
    undergraduate: QueryValue & string
}

type studyLevelValue = {
    postgraduate: QueryValue & string
    undergraduate: QueryValue & string
}

type level = {
    major: QueryValue & string
    minor: QueryValue & string
}

type QueryValue = parentAcademicOrg | implementationYear | studyLevel | studyLevelValue | level
type QueryValues = {
    parentAcademicOrg: parentAcademicOrg
    implementationYear: implementationYear
    studyLevel: studyLevel
    studyLevelValue: studyLevelValue
    level: level
}

const queryFields: QueryValues = {
    parentAcademicOrg: {
        business: 'b2c5a5f51b301e9033b264ea234bcbb8' as QueryValue & string,
        healthSciences: '3ec5a5f51b301e9033b264ea234bcbd4' as QueryValue & string,
        psychology: '7ac5a5f51b301e9033b264ea234bcbd7' as QueryValue & string,
        computingDataMaths: 'fac5a5f51b301e9033b264ea234bcbb9' as QueryValue & string,
        humanitiesCommunicationArts: '72c5a5f51b301e9033b264ea234bcbd5' as QueryValue & string,
        science: 'f2c5a5f51b301e9033b264ea234bcbd8' as QueryValue & string,
        education: '76c5a5f51b301e9033b264ea234bcbba' as QueryValue & string,
        law: '32c5a5f51b301e9033b264ea234bcbd6' as QueryValue & string,
        socialSciences: '7ec5a5f51b301e9033b264ea234bcbd8' as QueryValue & string,
        engineeringDesignBuiltEnvironments: '7ec5a5f51b301e9033b264ea234bcbd3' as QueryValue & string,
        medicine: 'bac5a5f51b301e9033b264ea234bcbd6' as QueryValue & string,
        college: '36c5a5f51b301e9033b264ea234bcbdc' as QueryValue & string,
        graduateResearch: 'b2c5a5f51b301e9033b264ea234bcbd4' as QueryValue & string,
        nursingMidwifery: '36c5a5f51b301e9033b264ea234bcbd7' as QueryValue & string
    },
    implementationYear: {
        current: '2026' as QueryValue & string
    },
    studyLevel: {
        postgraduate: '0c2074dcdb6afc5087f743ea13961960' as QueryValue & string,
        undergraduate: '1e3e258f1b52dd102b40c1f61a4bcb0b' as QueryValue & string,
    },
    studyLevelValue: {
        postgraduate: '0c2074dcdb6afc5087f743ea13961960' as QueryValue & string,
        undergraduate: '1e3e258f1b52dd102b40c1f61a4bcb0b' as QueryValue & string,
    },
    level: {
        major: 'major' as QueryValue & string,
        minor: 'minor' as QueryValue & string,
    }
}

/**
 * Query Params:
 *
 *         parentAcademicOrg?: QueryParam
 *         implementationYear?: QueryParam
 *         studyLevel?: QueryParam
 *         studyLevelValue?: QueryParam
 */
type SubjectQuery = {
    siteId: 'wsu-prod-pres',
    contentType: 'subject',
    queryParams: QueryParam[],
    offset: number,
    limit: number,
}

/**
 * Query Params:
 *
 *         parentAcademicOrg?: QueryParam
 *         implementationYear?: QueryParam
 *         studyLevel?: QueryParam
 *         studyLevelValue?: QueryParam
 *         level?: QueryParam
 */
type AOSQuery = {
    siteId: 'wsu-prod-pres',
    contentType: 'aos',
    queryParams: QueryParam[],
    offset: number,
    limit: number,
}

/**
 * Query Params:
 *
 *         parentAcademicOrg?: QueryParam
 *         implementationYear?: QueryParam
 *         studyLevel?: QueryParam
 *         studyLevelValue?: QueryParam
 */
type CourseQuery = {
    siteId: 'wsu-prod-pres',
    contentType: 'course',
    queryParams: QueryParam[],
    offset: number,
    limit: number,
}

type APIQuery = SubjectQuery | AOSQuery | CourseQuery;

async function fetchHandbookData(payload: APIQuery): Promise<Response> {
    const request: RequestInit = {
        "credentials": "include",
        "headers": {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0",
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "text/plain;charset=UTF-8",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "Priority": "u=4",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
        },
        "referrer": "https://studenthandbook.westernsydney.edu.au/browse/By%20School/Business",
        "body": JSON.stringify(payload),
        "method": "POST",
        "mode": "cors"
    }
    console.log(request)
    return fetch("https://studenthandbook.westernsydney.edu.au/api/search/browsepage-academic-items?", request);
}

async function scrapeDatabase() {
    let offset = 0;
    // Note: For some contentTypes, limits above 50 have been observed to cause server errors when sending the request
    const limit = 50;

    const payload: SubjectQuery = {
        siteId: 'wsu-prod-pres',
        contentType: 'subject',
        queryParams: [
            {
                queryField: "parentAcademicOrg",
                queryValue: queryFields.parentAcademicOrg.science
            },
            {
                queryField: "implementationYear",
                queryValue: queryFields.implementationYear.current
            },
            {
                queryField: "studyLevel",
                queryValue: queryFields.studyLevel.undergraduate
            },
            {
                queryField: "studyLevelValue",
                queryValue: queryFields.studyLevelValue.undergraduate
            }
        ],
        offset: offset,
        limit: limit,
    }
    const response = await fetchHandbookData(payload);
    console.log(response);
    return JSON.stringify(await response.json(), null, 2);
}

scrapeDatabase().then(response => {
    console.log(response);
}).catch(error => {
    console.error(error);
});
