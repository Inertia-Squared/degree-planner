export const nodeDisplayNameMap: Record<nodeDisplayNameKeys, string> = {
    ['Program']: 'programName',
    ['Subject']: 'code',
    ['Major']: 'majorName',
    ['Minor']: 'minorName',
    ['Prerequisites']: 'course',
    ['SubjectChoice']: 'choices'
}

export const nodeFillMap: Record<nodeDisplayNameKeys, string> = {
    ['Program']: '#0C3C51',
    ['Subject']: '#ff95b6',
    ['Major']: '#195db0',
    ['Minor']: '#969bf9',
    ['Prerequisites']: '#F79767',
    ['SubjectChoice']: '#ffdc80'
}

export const nodeSizeMap: Record<nodeDisplayNameKeys, number> = {
    ['Program']: 30,
    ['Subject']: 15,
    ['Major']: 25,
    ['Minor']: 20,
    ['Prerequisites']: 10,
    ['SubjectChoice']: 10
}

export type nodeDisplayNameKeys = 'Program' | 'Subject' | 'Major' | 'Minor' | 'Prerequisites' | 'SubjectChoice';
