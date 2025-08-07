import {ProgramData} from "./program-scraper";
import {getNumberFromText, highlight, regexMacros, setConfig, throwAndLog} from "../util";
import fs from "fs/promises";
import {MajorMinorData, SpecialisationType} from "../majors-minors/major-minor-scraper";

const CONFIG = {
    inputPath: '../Automation/data/',
    outputFile: './data/programs-refined.json',
    verbose: false,
    showWarnings: false,
}

const desiredLocationHeaders = ['Campus','Attendance','Mode'];
// done
export interface LocationInfo {
    campus?: string // done
    attendance?: string // done
    mode?: string // done
}

// done
export interface SubjectChoice {
    choices: SubjectSummary[] | string // Use string for non-subject instructions
    numberToChoose: number
}

// done
export interface SubjectSummary {
    code: string
    name: string
    creditPoints: number
    subjectLevel?: number
}

// done
export enum SessionType {
    AUTUMN,
    SPRING,
    SUMMER,
    TRIMESTER,
    TERM,
    SEMESTER,
    OTHER = 999 // Prevent old data compatibility issues if other types added later
}

// done
export interface Session {
    sessionType: SessionType
    subjects: (SubjectChoice | SubjectSummary)[]
}

// done
export interface Year {
    year: number
    sessions: Session[]
}

export interface Major {
    name: string
    type: SpecialisationType
    subjects: (SubjectSummary | SubjectChoice)[]
    link: string
    // requiredSubjects?: SubjectSummary[]
    // optionalSubjects?: SubjectChoice[]
}

export interface Minor extends Major {}

// done
export interface Sequence {
    name: string
    sequence: Year[]
}

export interface ProgramSummary {
    name: string // done
    link: string // done
    sequences: Sequence[] // done
    locations: LocationInfo[] // done
    majors?: Major[]
    minors?: Minor[]
}

function containsMatch(arr: string[], exp: RegExp | RegExp[]) {
    if(!arr) return false;
    if (exp instanceof RegExp) {
        for (const string of arr) {
            if (exp.test(string)) return true;
        }
    } else {
        for (let reg of exp){
            for (const string of arr) {
                if (reg.test(string)) return true;
            }
        }
    }
    return false;
}

/**
 * Searches for a string in an array, skipping over values.
 * If index is provided as an object, will permanently skip values checked on behalf of the parent.
 * If index is provided as number, original index value will be preserved.
 * @param rows
 * @param exp
 * @param currentIndex
 */
function matchName(rows: string[][], exp: RegExp, currentIndex: {index: number} | number){
    if(typeof currentIndex === 'number'){
        for(let text of rows[currentIndex]){
            if(text.match(exp)) {
                return text;
            }
        }
    } else {
        for(; currentIndex.index < rows.length; currentIndex.index++){
            for(let text of rows[currentIndex.index]){
                if(text.match(exp)) {
                    return text;
                }
            }
        }
        //console.info('Search failed at index ' + currentIndex.index + ' out of ' + (rows.length - 1) + ' for current program ' + currentProgram)
        return 'YR_ESCAPE_SEQ';
        //throwAndLog("Could not find "+exp.source+". Last tested row: " + (rows[currentIndex.index] ?? 'undefined').toString());
    }
    return '';
}

function matchManyRegex(rows: string[][], exps: RegExp[], currentIndex: {index: number}){
    for(; currentIndex.index < rows.length; currentIndex.index++){
        for (const exp of exps) {
            try {
                const match = matchName(rows, exp, currentIndex.index)
                if(match !== '') return match;
            } catch (e) {}
        }
    }
    //throwAndLog("Could not find "+exps.map(e=>e.source)+". Last tested row: " + rows[currentIndex.index].toString());
    return 'YR_ESCAPE_SEQ';
}

/**
 * Takes the rows of the table, the current index, returns a filled year and the index to the following year.
 * @param rows
 * @param currentIndex
 */
function extractYearData(rows: string[][], currentIndex: {index: number}): Year {
    let year = {} as Year;
    year.sessions = []
    const yearName = matchName(rows, regexMacros.year, currentIndex);
    if (yearName === 'YR_ESCAPE_SEQ') return {year: -1} as Year; // shhhh we don't talk about it
    /**
     * Extract year number
     * Throws if we can't get the number, we could probably just allow it,
     * but let's be strict to catch parsing/logic errors early
     */
    if(CONFIG.verbose) console.log('Got yearName: ' + yearName);
    let yearStr = yearName.match(regexMacros.getYearNumber);
    if(CONFIG.verbose) console.log('Got yearStr: ' + yearStr);
    if (yearStr) {
        year.year = parseInt(yearStr[1]) ?? NaN; // NaN is probs redundant here
        if (isNaN(year.year)) {
            year.year = getNumberFromText(yearName);
            if(CONFIG.verbose) console.log(`Value ${yearStr[1]} is NaN, returning ${year.year} instead`)
        }
    } else {
        year.year = getNumberFromText(yearName);
        if(CONFIG.verbose) console.log(`No match on yearStr, returning ${year.year} instead`)
    }
    if(year.year === -1) {
        throwAndLog("Could not parse year number from: " + yearStr);
    }

    if(CONFIG.verbose) console.log('Extracting sessions in year...')
    /**
     *  Get sessions.
     *  Sessions will then get subjects, so we expect a returned session to be 'full'.
     */
    for(currentIndex.index++;
        currentIndex.index < rows.length &&
        !containsMatch(rows[currentIndex.index], regexMacros.totalCreditPoints) &&
        !containsMatch(rows[currentIndex.index], regexMacros.year);
        currentIndex.index++)
    {
        if (containsMatch(rows[currentIndex.index], regexMacros.session)){
            if(CONFIG.verbose) console.log('Extracting for session at ' + rows[currentIndex.index]);
            const session = extractSessionData(rows, currentIndex);
            currentIndex.index--; // ensure we don't skip year accidentally
            year.sessions.push(session);
        }
    }

    if(year.sessions.length < 1){
        throwAndLog("Could not find any sessions in year: " + year + " at index " + currentIndex);
    }

    return year;
}

function getSessionType(sessionName: string): SessionType {
    switch (true) { // Black magic fuckery
        case regexMacros.isAutumn.test(sessionName):
            return SessionType.AUTUMN;
        case regexMacros.isSpring.test(sessionName):
            return SessionType.SPRING;
        case regexMacros.isSummer.test(sessionName):
            return SessionType.SUMMER;
        case regexMacros.isTrimester.test(sessionName):
            return SessionType.TRIMESTER;
        case regexMacros.isTerm.test(sessionName):
            return SessionType.TERM;
        case regexMacros.isSemester.test(sessionName):
            return SessionType.SEMESTER;
        default:
            return SessionType.OTHER;
    }
}

function extractSessionData(rows: string[][], currentIndex: {index: number}): Session {
    let session = {} as Session;
    session.subjects = []

    if(CONFIG.verbose) console.log('Getting session name...')
    const sessionName = matchName(rows, regexMacros.session, currentIndex);
    if(CONFIG.verbose) console.log('Got name: ' + sessionName);
    session.sessionType = getSessionType(sessionName);
    if(CONFIG.verbose) console.log('Evaluated name to type ' + session.sessionType);

    for(currentIndex.index++;
        currentIndex.index < rows.length &&
        !containsMatch(rows[currentIndex.index], regexMacros.totalCreditPoints) &&
        !containsMatch(rows[currentIndex.index], regexMacros.year) &&
        !containsMatch(rows[currentIndex.index], regexMacros.session);
        currentIndex.index++)
    {
        if (containsMatch(rows[currentIndex.index], [regexMacros.subjectCode, regexMacros.hasChoice, regexMacros.choiceEdgeCase])){
            if (containsMatch(rows[currentIndex.index], regexMacros.isReplaced)) continue; // We already checked this during extractSubjectData()
            if(CONFIG.verbose) console.log('Extracting for subject at ' + rows[currentIndex.index]);
            const subject = extractSubjectData(rows, currentIndex);
            if (!subject) {
                // #005
                if(CONFIG.showWarnings) console.warn('WARN005: Subject returned undefined when value is expected');
                break;
            }
            // ignore duplicate subjects that have already been replaced
            if('creditPoints' in subject && (subject.creditPoints === undefined || isNaN(subject.creditPoints) || subject.creditPoints < 0)) continue;
            session.subjects.push(subject);
        }
    }
    currentIndex.index--; // ensure we don't skip session accidentally
    
    if (session.subjects.length < 1) {
        if(CONFIG.verbose) console.log('Failed at index ' + currentIndex.index + ' out of ' + (rows.length - 1) + ' for current program ' + currentProgram)
        throwAndLog("Could not find any subjects in session: " + JSON.stringify(session) + " for data " + rows + " at index " + currentIndex.index)
    }
    return session;
}

// this is bad, everything is getting duplicated, but it works so shush
function extractSpecialisationData(rows: string[][], currentIndex: {index: number}): Session {
    let session = {} as Session;
    session.subjects = []
    if(!rows) return session;
    for(currentIndex.index++;
        currentIndex.index < rows.length &&
        !containsMatch(rows[currentIndex.index], regexMacros.totalCreditPoints);
        currentIndex.index++)
    {
        if (containsMatch(rows[currentIndex.index], [regexMacros.subjectCode, regexMacros.hasChoice, regexMacros.choiceEdgeCase])){
            if (containsMatch(rows[currentIndex.index], regexMacros.isReplaced)) continue; // We already checked this during extractSubjectData()
            if(CONFIG.verbose) console.log('Extracting for subject at ' + rows[currentIndex.index]);
            const subject = extractSubjectData(rows, currentIndex);
            if (!subject) break;
            // ignore duplicate subjects that have already been replaced
            // todo find better way to detect if subject is a duplicate here, as it overlaps with other patterns
            //if('creditPoints' in subject && (subject.creditPoints === undefined || isNaN(subject.creditPoints) || subject.creditPoints < 0)) continue;
            session.subjects.push(subject);
        }
    }
    currentIndex.index--; // ensure we don't skip session accidentally

    if (session.subjects.length < 1) {
        if(CONFIG.verbose) console.log('Failed at index ' + currentIndex.index + ' out of ' + (rows.length - 1) + ' for current program ' + currentProgram)
        throwAndLog("Could not find any subjects in session: " + JSON.stringify(session) + " for data " + rows + " at index " + currentIndex.index)
    }
    return session;
}

function extractSubjectSummary(row: string[], overrideCreditPoints?: number): SubjectSummary | undefined{
    if(CONFIG.verbose) console.log('Extracting summary data for ' + row);
    if(!overrideCreditPoints && isNaN(parseInt(row[2]))) {
        if(CONFIG.showWarnings) console.warn('WARN001: No credit point value provided on subject');
    }
    if(!row) return undefined;
    return {
        code: row[0], // Maybe we filter out the nbsp here? It's annoying, but also, consistency may be better.
        name: row[1],
        creditPoints: overrideCreditPoints ?? parseInt(row[2]) ?? -10, // responsibility of parent function to ensure row[2] is valid
    }
}

function getReplaced(subject: SubjectSummary, rowAfterSubject: string[]){
    if(CONFIG.verbose) console.log('checking if subject ' + subject.code + ' should be replaced with {' + rowAfterSubject + '}')
    if(!rowAfterSubject) return subject;
    const replace = rowAfterSubject[0].match(regexMacros.isReplaced);
    if(!replace) {
        if(CONFIG.verbose) console.log('Will not be replaced.')
        return subject;
    }
    if (replace[1] !== subject.code) {
        if(CONFIG.showWarnings) console.warn("WARN002: Attempted to replace on row that is not related to original subject, could be signs of parsing failure.");
        return subject;
    }
    if(CONFIG.verbose) console.log('Replacing subject...')
    if(CONFIG.verbose) console.log('Getting credit points...')
    const creditPoints = parseInt(rowAfterSubject[1]);
    if(CONFIG.verbose) console.log('Got ' + creditPoints)
    return {
        code: replace[2], // the new code
        name: `Replaces ${replace[1]}`, // can't get name, so we do the best we can. Can fix from subject db later // todo low priority
        creditPoints: isNaN(creditPoints) ? subject.creditPoints : creditPoints
    } as SubjectSummary
}
let currentProgram = '';
function extractSubjectData(rows: string[][], currentIndex: {index: number}): SubjectSummary | SubjectChoice | undefined {
    if(CONFIG.verbose) console.log('Getting subject data...');
    let subjectInfo = matchManyRegex(rows, [regexMacros.hasChoice, regexMacros.subjectCode, regexMacros.choiceEdgeCase], currentIndex);
    if(CONFIG.verbose) console.log('Got subject data: ' + subjectInfo);
    if(CONFIG.verbose) console.log('Checking type of entry...')
    if(regexMacros.hasChoice.test(subjectInfo) || regexMacros.choiceEdgeCase.test(subjectInfo)) {
        let subject = {} as SubjectChoice;
        if(CONFIG.verbose) console.log('Entry was a selection')
        if(regexMacros.areSelectionsGiven.test(subjectInfo)){
            if(CONFIG.verbose) console.log('Selection has set options')
            // SubjectChoice w\ SubjectSummaries
            const creditPoints = parseInt(rows[currentIndex.index][1]) ?? NaN;
            subject.choices = []
            currentIndex.index++;
            if(CONFIG.verbose) console.log(`Checking if ${rows[currentIndex.index]} is valid...`)
            let levelPool;
            for (;rows[currentIndex.index] && !containsMatch(rows[currentIndex.index], regexMacros.creditPointsText); currentIndex.index++){
                if(rows[currentIndex.index].length === 2){
                    if (containsMatch(rows[currentIndex.index], regexMacros.levelPool)){
                        const match = rows[currentIndex.index][0].match(regexMacros.levelPool); // assume level pool on index 0
                        if(match) levelPool = match[1];
                        continue;
                    }
                    if (!containsMatch(rows[currentIndex.index], regexMacros.looseSubjectCode)) break;

                    return {
                        code: 'SPECIAL',
                        name: rows[currentIndex.index][0],
                        creditPoints: 0
                    } as SubjectSummary
                }
                if(CONFIG.verbose) console.log(`SUCCESS: ${rows[currentIndex.index]} is valid!`)
                let summary = extractSubjectSummary(
                    rows[currentIndex.index],
                    !isNaN(creditPoints) ? creditPoints : undefined
                );
                if (!summary) {
                    if(currentIndex.index >= rows.length) return undefined;
                    else continue;
                }
                summary = getReplaced(summary, rows[currentIndex.index+1]);
                if (levelPool) summary.subjectLevel = parseInt(levelPool) ?? -1;
                subject.choices.push(summary);
                if(CONFIG.verbose) console.log(`Checking if ${rows[currentIndex.index]} is valid...`)
            }
            if(CONFIG.verbose) console.log(`FAIL: ${rows[currentIndex.index]} is NOT valid!`)
        } else {
            // SubjectChoice w\ string
            if(CONFIG.verbose) console.log('Selection is open-ended');
            subject.choices = subjectInfo;
        }

        if(CONFIG.verbose) console.log('Getting number of choices...')
        subject.numberToChoose = getNumberFromText(subjectInfo);
        if(CONFIG.verbose) console.log('Got ' + subject.numberToChoose + ' Choices.')
        if(subject.numberToChoose === -1) {
            subject.numberToChoose = 1; // assume it was implied singular
            if(CONFIG.showWarnings) {
                console.warn("WARN003: " +
                    "Failed to parse number of subject choices. " +
                    "This may be a false flag, but could hint towards other issues.");
            }
        }
        if(CONFIG.verbose) console.log('Final subject value is ' + Object.entries(subject));
        return subject;
    } else {
        if(CONFIG.verbose) console.log('Entry was a normal subject')
        let subject = extractSubjectSummary(rows[currentIndex.index]);
        if (!subject) {
            if(CONFIG.verbose) console.log('Subject was undefined')
            return undefined;
        }
        subject = getReplaced(subject, rows[currentIndex.index+1]);
        if(CONFIG.verbose) console.log('Final subject value is ' + Object.entries(subject))
        return subject;
    }
}

function getLocationData(data: ProgramData){
    const locationHeaders = new Map<string, string>();
    if(!data || data.locations.length <= 0) return;
    Object.entries(data.locations[0]).forEach((entry)=>{
        const key = entry[0];
        const value = entry[1];
        if(desiredLocationHeaders.includes(value)) locationHeaders.set(value, key);
    });
    const locations = [] as LocationInfo[];
    for (let i = 1; i < data.locations.length; i++){
        const loc = data.locations[i];
        const location = {
            campus: loc[locationHeaders.get('Campus') ?? ''] ?? 'Unknown',
            attendance: loc[locationHeaders.get('Attendance') ?? ''] ?? 'Unknown',
            mode: loc[locationHeaders.get('Mode') ?? ''] ?? 'Unknown'
        } as LocationInfo;
        locations.push(location);
    }
    if(CONFIG.verbose) console.log(locations);
    return locations;
}

async function main(){
    const progData = JSON.parse(
        await fs.readFile(`${CONFIG.inputPath}programs-unrefined.json`, {encoding: 'utf-8'})) as ProgramData[];
    const majorData = JSON.parse(
        await fs.readFile(`${CONFIG.inputPath}programMajorData.json`, {encoding: 'utf-8'})) as MajorMinorData[];
    const minorData = JSON.parse(
        await fs.readFile(`${CONFIG.inputPath}programMinorData.json`, {encoding: 'utf-8'})) as MajorMinorData[];

    const programs = [] as ProgramSummary[];
    let majorList = [] as Major[];
    let minorList = [] as Minor[];

    if (CONFIG.verbose) highlight('PROCESSING MAJOR DATA')
    for (let major of majorData){
        const majorInfo = {} as Major;
        const structure = Object.values(major.sequences)[0] as string[][];
        if(structure && structure.length < 1) continue;
        const currentIndex = {index: 0}


        majorInfo.name = major.name;
        majorInfo.subjects = extractSpecialisationData(structure,currentIndex).subjects;
        majorInfo.type = major.type;
        majorInfo.link = major.originalLink;

        majorList.push(majorInfo);
    }
    if (CONFIG.verbose) highlight('PROCESSING MINOR DATA')
    for (let minor of minorData){
        const minorInfo = {} as Minor;
        const structure = minor.sequences['structure'] as string[][];
        if(structure && structure.length < 1) continue;
        const currentIndex = {index: 0}

        minorInfo.name = minor.name;
        minorInfo.subjects = extractSpecialisationData(structure,currentIndex).subjects;
        minorInfo.type = minor.type;
        minorInfo.link = minor.originalLink;

        minorList.push(minorInfo);
    }

    for (const programData of progData) {
        if (CONFIG.verbose) highlight('PROCESSING PROGRAM')
        const program = {} as ProgramSummary;
        program.name = programData.name;
        currentProgram = (program.name.match(/[^\t\n]*/)??[])[0] ?? 'Unknown'; // need to regex out tabs, should probably have done this earlier // todo
        program.locations = getLocationData(programData) as LocationInfo[];
        program.link = programData.originalLink;

        const recommendedSequence = programData.sequence["structure"];
        let sequences = [] as Sequence[]

        let currentIndex = {index: 0}
        for (let i = 0; currentIndex.index < recommendedSequence.length - 1; i++) {
            let skip = false;
            let sequence = {} as Sequence;
            sequence.sequence = [];
            sequence.name = `Sequence ${i+1}`; // Currently scraper does not get title for sequence which may have important info // todo high prio
            for(; !containsMatch(recommendedSequence[currentIndex.index], regexMacros.totalCreditPoints); ) {
                const year = extractYearData(recommendedSequence, currentIndex);
                sequence.sequence.push(year);
                if (!year || !year.sessions){
                    if (year.year === -1){
                        //console.info('Discarding Year that was ejected by escape sequence')
                    } else {
                        if(CONFIG.showWarnings) {
                            console.warn('WARN004: Removing Empty Year, this could be a parsing error');
                        }
                    }
                    sequence.sequence.pop();
                    skip = true;
                    break;
                }
            }
            currentIndex.index++;
            if(!skip) sequences.push(sequence);
        }

        program.majors = majorList.map(m=>{
            if(programData.links?.majors.includes(m.link)) return m;
        }).filter(m=>m !== undefined);
        program.minors = minorList.map(m=>{
            if(programData.links?.minors.includes(m.link)) return m;
        }).filter(m=>m !== undefined);


        program.sequences = sequences;

        programs.push(program);
    }


    if(CONFIG.verbose) console.log(JSON.stringify(programs, null, 2))
    console.log('Writing data to file...');
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(programs,null,2), {encoding: 'utf-8'});
}

setConfig(CONFIG.inputPath).then((r)=> {
        CONFIG.inputPath = r.inputFile ?? CONFIG.inputPath;
        CONFIG.outputFile = r.outputFile ?? CONFIG.outputFile;
        main().then(() => {
            console.log('Programs Data Translation Complete!')
        }).catch(e=>{
            console.error(e)
        })
    }
)
