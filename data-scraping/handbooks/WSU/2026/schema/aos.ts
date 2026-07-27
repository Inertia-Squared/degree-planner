// AI-Generated based on subject.ts schema as a reference
import {
    APIResponse,
    BaseQuery,
    BaseRequestResponse,
    BaseResponseEntry,
    OpaqueObject,
    OpaqueString,
    QueryParam
} from "./schema";

export type AosQuery = BaseQuery<
    'aos',
    'parentAcademicOrg' | 'implementationYear' | 'studyLevel' | 'studyLevelValue'
>;

export type AosData = OpaqueObject;

export type AoSAPIFields = {
    contentTypeLabel: 'Major' | 'Minor'
    mode: OpaqueString, // shared with Subject
    status: 'Active', // shared with Subject
    level: QueryParam<'level'> // shared with Subject; e.g. 'major'
    subclass: string, // unique to Major; e.g. 'major'
    admissionType: OpaqueString, // unique to Major; e.g. "N/A"
    parentAcademicOrg: QueryParam<'parentAcademicOrg'>, // e.g. School of Science
    location: QueryParam<'location'>, // shared with Subject
    CurriculumStructure: OpaqueString, // shared with Course
    data: AosData
}

export type AosEntry = BaseResponseEntry<'Major' | 'Minor', AoSAPIFields>;

export type AosRR = BaseRequestResponse<AosQuery, APIResponse<AosEntry>>;