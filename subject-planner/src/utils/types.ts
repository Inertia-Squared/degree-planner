import {GraphEdge, GraphNode} from "reagraph";
import {SpecialisationType} from "../../../data-scraping/majors-minors/major-minor-scraper";

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

export enum NodeStatus {
    NONE,
    REQUIRED,
    PREREQUISITE,
    ELECTIVE,
    INELIGIBLE
}

export enum FilteredReasons {
    SUBJECT_NOT_IN_SEQUENCE,
    PREREQUISITE_NOT_IN_COURSE,
    NOT_REQUIRED_ELECTIVE,
    IMPOSSIBLE_PREREQUISITE,
    DANGLING_PREREQUISITE_SUBJECT,
    LEAF_PREREQUISITE_NODE,
    NONE
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

export type NodeTypes = 'Program' | 'Subject' | 'Major' | 'Minor' | 'Prerequisites' | 'SubjectChoice';

export interface Generic {
    type: NodeTypes
    filtered?: FilteredReasons
    status: NodeStatus
}

export interface GraphCommonProps {
    nodes: ExtendedNode<Generic>[],
    edges: GraphEdge[],
    adjacencyList: Map<string, string[]>,
    nodeMap: Map<string, ExtendedNode<Generic>>,
}

export interface GraphFilterProps extends GraphCommonProps {
    selectedProgram: ExtendedNode<Program> | undefined,
    selectedProgramSequence: string | undefined,
    showPotentialElectives: boolean
}

export interface GraphColourProps extends GraphCommonProps {
    getCompletedSubjects: () => ExtendedNode<Subject>[],
    isOfferedInCurrentPeriod: (node: ExtendedNode<Subject>) => OfferStatus,
    hasTaken: (node: ExtendedNode<Generic>) => boolean
}

export interface GraphPruningProps {
    newNodes: ExtendedNode<Generic>[],
    newEdges: GraphEdge[],
    adjacencyList: Map<string, string[]>,
    showAllIneligible: boolean
}