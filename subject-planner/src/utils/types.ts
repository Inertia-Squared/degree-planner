import { GraphNode } from "reagraph";
import { SpecialisationType } from "../../../data-scraping/majors-minors/major-minor-scraper";
import { NodeTypes } from "@/lib/siteUtil";

export type StudyPeriod = 'autumn' | 'spring' | 'unknown';

export interface ExtendedNode<T> extends GraphNode {
     data: T
}

export interface StudyPeriodItem {
    period: StudyPeriod
    subjectsTaken: ExtendedNode<Subject>[]
}

export enum OfferStatus {
    NO,
    YES,
    UNKNOWN
}

export interface Choice extends Generic {
    type: 'SubjectChoice'
    choiceName: string
    parent: string
}

export interface Minor extends Generic {
    type: 'Minor'
    minorName: string
    minorType: SpecialisationType | string
    minorLocations: string[]
    minorLink: string
    programConnectionId?: string
}

export interface Major extends Generic {
    type: 'Major'
    majorName: string
    majorType: SpecialisationType | string
    majorLocations: string[]
    majorLink: string
    programConnectionId?: string
}

export interface Prerequisite extends Generic {
    type: 'Prerequisites'
    course: string
    subjects: string
    forSubject: string
}

export interface Program extends Generic{
    type: 'Program'
    programName: string,
    programSequences: string[]
}

export interface Subject extends Generic{
    type: 'Subject'
    code: string,
    prerequisites: string
    subjectSequences: string[]
    teachingPeriods: string[]
}

export interface Generic {
    type: NodeTypes
}