import { FormEvent, useState } from "react";
import 'react';

interface LineupSelectorProps {
    onSearchEvent: (programValue: string) => void
    className?: string
}

const LineupSelector = ({ className, onSearchEvent }: LineupSelectorProps) => {
    const [program, setProgram] = useState('Bachelor of Data Science (3769)');

    const searchHandbook = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const programValue = formData.get('program');
        if (programValue && typeof programValue === 'string') {
            console.log("Searching for:", programValue);
            onSearchEvent(programValue)
        }
    }

    return (
        <div className={className}>
            <form onSubmit={searchHandbook}>
                <div className={`form-row`}>
                    <label>Desired Program</label>
                    <div className="input-sizer">
                        <input
                            value={program}
                            onInput={(e)=>setProgram(e.currentTarget.value)}
                            name={'program'}
                        />
                        <span className={`border-2 px-1 rounded-md`}>
                            {program || ' '}
                        </span>
                    </div>
                </div>
                <div className={`form-row`}>
                    <button type={`submit`}>Search Handbook</button>
                    <div className={'grow'} />
                </div>
            </form>
        </div>
    )
}

export default LineupSelector;