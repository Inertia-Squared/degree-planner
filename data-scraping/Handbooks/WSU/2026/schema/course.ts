// AI-Generated based on subject.ts schema as a reference
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
export type ImportantCourseFields = {
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
}

export type MetaCourseFields = {
    // ---- maybe important? ----
    CurriculumStructure: OpaqueString, // shared with Major

    // ---- Other Stuff ----
    urlYear: string // unique to Course; e.g. "2026handbooks"
}

export type CourseEntry = BaseResponseEntry<'Program', ImportantCourseFields & MetaCourseFields>;

export type CourseRR = BaseRequestResponse<CourseQuery, APIResponse<CourseEntry>>;

// extracted and synthesised data
export interface CoursePageData {
    // likely abstractable to base type
    creditPoints: number
    description: string
    code: string
    link: string
    parentAcademicOrg: QueryParam<'parentAcademicOrg'>

    // important course data we care about
    durationFullTime: number
    durationPartTime: number
    studyLevel: 'Postgraduate' | 'Undergraduate'
    structure: CurriculumStructure


    // interesting stuff that might get cut or lumped into a generic field on the frontend
    aqfLevel: string // e.g. 'Bachelor Degree'

}

export interface CurriculumStructure {

}