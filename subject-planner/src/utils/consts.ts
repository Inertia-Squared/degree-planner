import { LayoutTypes } from 'reagraph';
import { StudyPeriod } from './types';

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
]

export const displayMode: LayoutTypes = 'forceDirected2d';

export const colours = {
    inaccessible: '#AAAAAA'
}
