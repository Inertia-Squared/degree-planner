
import {
    APIResponse, BaseQuery,
    BaseRequestResponse,
    BaseResponseEntry,
    OpaqueArray,
    OpaqueEnum,
    OpaqueObject,
    OpaqueString, QueryParam
} from "./schema";


export type SubjectQuery = BaseQuery<
    'subject',
    'parentAcademicOrg' | 'implementationYear' | 'studyLevel' | 'studyLevelValue' | 'teachingPeriod'
>;

export type SubjectData = OpaqueObject;

export type ImportantSubjectFields = {
    contentTypeLabel: 'Subject'
    mode: OpaqueString, // mode of study; e.g. on-site or remote {UUID}
    status: 'Active', // fail-fast to ensure we get all variants of this field
    attendanceType: OpaqueString, // ??? seems important
    level: QueryParam<'level'> // major, minor, subject
    studentTypes: OpaqueArray, // which students is it offered to, e.g. domestic and/or international
    studyLevelRefDisplay: string, // postgrade/undergrad (human-readable)
    subjectLevel: string, // Number as string: 'Difficulty' level, maps to the expected min. years of study
    teachingPeriod: QueryParam<'teachingPeriod'>, // Spring, Autumn, etc. {UUID}
    parentAcademicOrg: QueryParam<'parentAcademicOrg'>, // e.g. School of Business, SoCDMS, etc. {UUID}
    location: QueryParam<'location'>, // e.g. Parramatta City Campus {UUID}
    data: SubjectData
}

export type MetaSubjectFields = {
    // ---- maybe important? ----

    // ---- Other Stuff ----
    active: OpaqueEnum // sample showed "0" instead of bool, indicating this is likely some sort of enum internally
    publishedInHandbook: number,
    sysId: string
}

export type SubjectEntry = BaseResponseEntry<'Subject', ImportantSubjectFields & MetaSubjectFields>;

export type SubjectRR = BaseRequestResponse<SubjectQuery, APIResponse<SubjectEntry>>