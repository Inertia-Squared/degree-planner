import {LayoutTypes} from 'reagraph';
import {NodeTypes, StudyPeriod} from './types';

export const studyPeriods: StudyPeriod[] = ['autumn','spring','unknown'];

export const badClusterOptions = [
    'subjectSequences',
    'programSequences',
    'choiceSequences',
    'description',
    'subjectLink',
    'programLink',
    'majorLink',
    'minorLink',
    'code',
    'prerequisites',
    'creditPoints',
    'subjectName',
    'teachingPeriods',
    'type',
    'filtered'
]

export const displayMode: LayoutTypes = 'forceDirected2d';

export const colours = {
    inaccessible: '#AAAAAA'
}
export const nodeDisplayNameMap: Record<NodeTypes, string> = {
    ['Program']: 'programName',
    ['Subject']: 'code',
    ['Major']: 'majorName',
    ['Minor']: 'minorName',
    ['Prerequisites']: 'course',
    ['SubjectChoice']: 'choices'
}
export const nodeFillMap: Record<NodeTypes, string> = {
    ['Program']: '#0C3C51',
    ['Subject']: '#ffa5d6',
    ['Major']: '#195db0',
    ['Minor']: '#969bf9',
    ['Prerequisites']: '#F79767',
    ['SubjectChoice']: '#ffdc80'
}
export const nodeSizeMap: Record<NodeTypes, number> = {
    ['Program']: 50,
    ['Subject']: 20,
    ['Major']: 40,
    ['Minor']: 40,
    ['Prerequisites']: 10,
    ['SubjectChoice']: 10
}

export const CustomEvents = {
    closeBurger: new CustomEvent('closeBurger')
}