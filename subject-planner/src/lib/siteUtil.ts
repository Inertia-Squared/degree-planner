export const nodeDisplayNameMap: Record<nodeDisplayNameKeys, string> = {
    ['Program']: 'programName',
    ['Subject']: 'code',
    ['Major']: 'majorName',
    ['Minor']: 'minorName',
    ['Prerequisites']: 'course',
    ['SubjectChoice']: 'choices'
}

export type nodeDisplayNameKeys = 'Program' | 'Subject' | 'Major' | 'Minor' | 'Prerequisites' | 'SubjectChoice';
