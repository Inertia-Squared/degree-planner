import {
    APIResponse,
    BaseQuery,
    BaseRequestResponse,
    BaseResponseEntry,
    OpaqueArray,
    OpaqueObject,
    OpaqueString, QueryParam
} from "./schema";

export type CourseQuery = BaseQuery<
    'course',
    'parentAcademicOrg' | 'implementationYear' | 'studyLevel' | 'studyLevelValue'
>;

export type CourseData = OpaqueObject;

// Raw data
export type CourseAPIFields = {
    contentTypeLabel: 'Program'
    attendanceType: OpaqueString, // shared with Subject
    studentTypes: OpaqueArray, // shared with Subject
    studyLevelRefDisplay: string, // shared with Subject
    name: string, // unique to Course; human-readable title
    aqfLevel: string, // unique to Course; e.g. "07"
    awardType: string, // unique to Course; e.g. "10"
    durationFtStd: string, // unique to Course; full-time duration in years
    durationPtStd: string, // unique to Course; part-time duration in years
    admissionCalendar: string, // unique to Course; e.g. ","
    parentAcademicOrg: QueryParam<'parentAcademicOrg'>, // e.g. School of Science
    data: CourseData
    CurriculumStructure: OpaqueString, // shared with Major
}

export type CourseEntry = BaseResponseEntry<'Program', CourseAPIFields>;

export type CourseRR = BaseRequestResponse<CourseQuery, APIResponse<CourseEntry>>;

/**
 * Fields currently always the same between all samples, which may change at a later date.
 * Due to the automatic duplicate detection, a field can be removed from this list if multiple values are added.
 */
export const courseConstantData = {
    contentTypeLabel: 'Program',
    implementationYear: '2026',
}

// extracted and synthesised data
export interface CoursePageData {
    // likely abstractable to base type
    title: string
    creditPoints: number
    description: string
    code: string
    link: string
    parentAcademicOrg: QueryParam<'parentAcademicOrg'>
    coordinator: string // subject, program, AoS(???)
    contactEmail: string

    // important course data we care about
    durationFullTime: number
    durationPartTime: number
    studyLevel: 'Postgraduate' | 'Undergraduate' | 'Foundation Studies'

    // These two could be grouped together into a single on the frontend like "A (B)"
    aqfLevel: string // e.g. 'Bachelor Degree'
    awardType: string // e.g. 'Bachelor's Honours'
    //

    structure: CurriculumStructure
    creditArrangements: string // Special requirements for eligibility
    progression: string // Pathways for entry
    // codes: string[] // Accreditation codes. Exclude for now.
    // fees: {feeType: string, offeredTo: string} // todo this would be good to add next
    // externalAccreditations: string[] // Exclude for now.
    // learningOutcomes: {...} // todo this would be good to add next
    // awardDetails: {...} // todo this would be good to add next
    // associations: {...} // Seems to be mostly exit pathways. // todo this would be good to add next
    // admissionRequirements: {description: string, requirements: {...}[]} // todo this would be good to add next
    offering: {location: string, studentType: string}[] // todo this can be expanded to add more info
    studentTypes: string[]


    // interesting stuff that might get cut or lumped into a generic field on the frontend

}

export interface CurriculumStructure {

}

export interface StructureItem {
    title: string
    description: string
    creditPoints: string
    parentConnector: 'AND' | 'OR'
    relationship: (StructureItem & {
        code: string
    })[]
}

export async function extractImportantFields(data: any){

}