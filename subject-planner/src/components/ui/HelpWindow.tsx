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
            <div className={`cursor-pointer text-lg font-bold ${showHelp && "text-blue-800"}`} onClick={() => {
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

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <p>
                                 To get started, you can type part or
                                all of a program name into the search bar, the dropdown will fill automatically
                                with any matching courses.
                            </p>
                            <p>
                                Selecting a Major or Minor is optional (if you don't want one, just don't
                                select it), once you are happy with your choices, click 'Start Exploring' to
                                plan your degree!
                            </p>
                        </div>

                        <div className="space-y-4">
                            <strong>IMPORTANT:</strong>
                            <ul>
                                <li>- To view information about a node, click it once.</li>
                                <li>
                                    - To add a subject to your Degree Timeline, double-click it. You can
                                    only add subjects you are eligible for (i.e. are not greyed out)
                                </li>
                                <li>
                                    - As you complete more subjects, you will be eligible for the subjects
                                    that were previously greyed out.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpWindow;
