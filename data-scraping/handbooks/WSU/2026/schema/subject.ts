import {
    APIResponse, BaseQuery,
    BaseRequestResponse,
    BaseResponseEntry,
    OpaqueArray,
    OpaqueObject,
    OpaqueString, QueryParam
} from "./schema";


export type SubjectQuery = BaseQuery<
    'subject',
    'parentAcademicOrg' | 'implementationYear' | 'studyLevel' | 'studyLevelValue' | 'teachingPeriod'
>;

export type SubjectData = OpaqueObject;

export type SubjectAPIFields = {
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

export type SubjectEntry = BaseResponseEntry<'Subject', SubjectAPIFields>;

export type SubjectRR = BaseRequestResponse<SubjectQuery, APIResponse<SubjectEntry>>