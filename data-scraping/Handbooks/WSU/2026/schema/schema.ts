import {SubjectData, SubjectEntry, SubjectQuery} from "./subject";
import {CourseData, CourseEntry, CourseQuery} from "./course";
import {AosData, AosEntry, AosQuery} from "./aos";

export const queryFields = {
    parentAcademicOrg: {
        business: 'b2c5a5f51b301e9033b264ea234bcbb8',
        healthSciences: '3ec5a5f51b301e9033b264ea234bcbd4',
        psychology: '7ac5a5f51b301e9033b264ea234bcbd7',
        computingDataMaths: 'fac5a5f51b301e9033b264ea234bcbb9',
        humanitiesCommunicationArts: '72c5a5f51b301e9033b264ea234bcbd5',
        science: 'f2c5a5f51b301e9033b264ea234bcbd8',
        education: '76c5a5f51b301e9033b264ea234bcbba',
        law: '32c5a5f51b301e9033b264ea234bcbd6',
        socialSciences: '7ec5a5f51b301e9033b264ea234bcbd8',
        engineeringDesignBuiltEnvironments: '7ec5a5f51b301e9033b264ea234bcbd3',
        medicine: 'bac5a5f51b301e9033b264ea234bcbd6',
        college: '36c5a5f51b301e9033b264ea234bcbdc',
        graduateResearch: 'b2c5a5f51b301e9033b264ea234bcbd4',
        nursingMidwifery: '36c5a5f51b301e9033b264ea234bcbd7'
    },
    implementationYear: {
        current: '2026'
    },
    studyLevel: {
        postgraduate: '0c2074dcdb6afc5087f743ea13961960',
        undergraduate: '1e3e258f1b52dd102b40c1f61a4bcb0b',
    },
    studyLevelValue: {
        postgraduate: '0c2074dcdb6afc5087f743ea13961960',
        undergraduate: '1e3e258f1b52dd102b40c1f61a4bcb0b',
    },
    level: {
        major: 'major',
        minor: 'minor',
        subject: 'subject',
    },
    teachingPeriod: {
        _NOT_IDENTIFIED: '70069e841bf74e103bdbdca4bd4bcbd1'
    },
    location: {
        _NOT_IDENTIFIED: '66d001681b8f86d03bdbdca4bd4bcbb9'
    }
} as const; // Assigned to types that may have a more meaningful mapping, but need to be reverse-engineered.
type QueryField = keyof typeof queryFields;
export type QueryParam<TField extends QueryField = QueryField> = {
    [K in TField]: {
        queryField: K;
        queryValue: (typeof queryFields)[K][keyof (typeof queryFields)[K]];
    }
}[TField];

export interface BaseQuery<TContentType extends string, TAllowedFields extends QueryField> {
    siteId: 'wsu-prod-pres';
    contentType: TContentType;
    queryParams: QueryParam<TAllowedFields>[];
    offset: number;
    limit: number;
}

export type APIQuery = SubjectQuery | AosQuery | CourseQuery;
export type ImportantBaseFields = {
    code: string // e.g. COMP1004
    title: string, // e.g. 'Programming Fundamentals'
    studyLevel: QueryParam<'studyLevel'>, // postgrad/undergrad {UUID}
    implementationYear: QueryParam<'implementationYear'>, // Only "2026" for now
    urlMap: string, // public-facing url to append to base site URL
}
export type MetaBaseFields = {
    // ---- maybe important? ----
    availableInYears: QueryParam<'implementationYear'>[] | QueryParam<'implementationYear'>,
    host: OpaqueString,
    hostName: string,

    // ---- Other Stuff ----
    publishDate: string,
    inode: OpaqueString,
    urlname: string,
    locked: boolean,
    stInode: OpaqueString,
    contentType: OpaqueString,
    identifier: OpaqueString,
    publishUserName: string,
    publishUser: string,
    creationDate: string,
    version: string,
    folder: string,
    hasTitleImage: boolean,
    sortOrder: OpaqueEnum, // integer value on sample, likely using int check as primitive enum, or perhaps applying a bitmask
    modDate: string,
    baseType: OpaqueString,
    archived: boolean,
    ownerUserName: string,
    working: boolean,
    live: boolean,
    owner: string,
    studyLevelValue: QueryParam<'studyLevelValue'>, // seems to be a dupe of studyLevel, we'll treat it as bloat for now
    languageId: number,
    URL_MAP_FOR_CONTENT: string,
    shortyId: string,
    url: string,
    titleImage: string,
    modUserName: string,
    hasLiveVersion: boolean,
    modUser: string,
    __icon__: string,
    contentTypeIcon: string,
    variant: string,
}
export type Data = { data: SubjectData | AosData | CourseData };
export type BaseResponseEntry<TContentType, TOtherFields extends Data> = {
    contentTypeLabel: TContentType
    data: TOtherFields['data'], // all sorts of info
} & ImportantBaseFields & MetaBaseFields & TOtherFields
export type OpaqueString = string;
export type OpaqueObject = {} | string
export type OpaqueArray = any[] | string
export type OpaqueEnum = number | string;
export type Entry = SubjectEntry | CourseEntry | AosEntry;

export interface APIResponse<T> {
    data: T[],
    count: number;
}

export type BaseRequestResponse<Req, Res> = {
    request: Req,
    response: Res
}

export async function fetchHandbookData(payload: APIQuery): Promise<Response> {
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

export async function fetchAPIJSON(contentType: string, code: string): Promise<Response> {
    // todo, ensure cached path (JiKX-R6BwxKr5T6IZ3w7G) doesn't change over time
    return fetch(`https://studenthandbook.westernsydney.edu.au/_next/data/JiKX-R6BwxKr5T6IZ3w7G/${contentType}/2026/${code}.json?year=2026&catchAll=${contentType}&catchAll=2026&catchAll=${code}`)
}