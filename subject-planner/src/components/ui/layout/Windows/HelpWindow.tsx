import { HeaderItemType } from "@/components/ui/layout/Containers/HeaderBar";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { useGraphUIStore } from "@/app/store/graphStore";

const HelpWindow = ({ className }: { className?: string }) => {
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);
    const itemIdentifier = HeaderItemType.HELP;
    
    return (
        selectedHeaderItem === itemIdentifier && (
            <WindowContainer
                className={className}
                onClose={() => useGraphUIStore.setState({ selectedHeaderItem: HeaderItemType.NONE })}
                title={'Welcome to MyDegree.help!'}
                childElement={
                    <div className="space-y-8 py-4">
                        <div className="space-y-4 px-2">
                            <strong className={`-ml-2`}>Getting Started:</strong>
                            <p>
                                To get started, you can type part or all of a program name into the search bar, 
                                the dropdown will fill automatically with any matching courses.
                            </p>
                            <p>
                                Selecting a Major or Minor is optional (if you don&apos;t want one, just don&apos;t select it), 
                                once you are happy with your choices, click <span className='font-bold'>Start Exploring</span> to plan your degree!
                            </p>
                            <strong className={`-ml-2`}>Quick Tips:</strong>
                            <div className="space-y-4">
                                <ul className='px-2 space-y-4 list-disc'>
                                    <li>To view information about a node, click it once.</li>
                                    <li>
                                        To add a subject to your Degree Timeline, double-click it. You can
                                        only add subjects you are eligible for (i.e. are not greyed out).
                                    </li>
                                    <li>
                                        As you complete more subjects, you will be eligible for the subjects
                                        that were previously greyed out.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                }
            />
        )
    );
};

export default HelpWindow;