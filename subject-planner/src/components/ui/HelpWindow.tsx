import React, { Dispatch, SetStateAction } from "react";
import { RxCross1 } from "react-icons/rx";

const HelpWindow = ({
    showHelp,
    onSetShowHelp,
}: {
    showHelp: boolean;
    onSetShowHelp: Dispatch<SetStateAction<boolean>>;
}) => {
    return (
        <div>
            <div className={`cursor-pointer text-lg font-bold ${showHelp && "text-[#7CB342]"}`} onClick={() => {
                onSetShowHelp(!showHelp);
            }}>
                Help
            </div>
                
            {showHelp && (
                <div
                    className={`absolute right-0 rounded-bl-lg p-4 max-w-[430px] w-full min-w-[250px] overflow-y-scroll bg-white shadow-lg`}
                >
                    <div className="w-full h-5 flex justify-between items-center py-4 border-b-[0.5px] border-black" >
                        <div>Welcome to <strong>MyDegree.help!</strong></div>
                        <RxCross1 className="cursor-pointer" onClick={() => onSetShowHelp(value => !value)} />
                    </div>

                    <div className="space-y-8 py-4">
                        <div className="space-y-4 px-2">
                            <p>
                                 To get started, you can type part or
                                all of a program name into the search bar, the dropdown will fill automatically
                                with any matching courses.
                            </p>
                            <p>
                                Selecting a Major or Minor is optional (if you don&apos;t want one, just don&apos;t
                                select it), once you are happy with your choices, click <span className='font-bold'>Start Exploring</span> to
                                plan your degree!
                            </p>
                        </div>

                        <div className="space-y-4">
                            <strong>IMPORTANT:</strong>
                            <ol className='px-2'>
                                <li>1. To view information about a node, click it once.</li>
                                <li>
                                    2. To add a subject to your Degree Timeline, double-click it. You can
                                    only add subjects you are eligible for (i.e. are not greyed out)
                                </li>
                                <li>
                                    3. As you complete more subjects, you will be eligible for the subjects
                                    that were previously greyed out.
                                </li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpWindow;
