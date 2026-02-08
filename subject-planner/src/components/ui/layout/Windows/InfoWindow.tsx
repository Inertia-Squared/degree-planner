import { GraphEdge } from "reagraph";
import {Dispatch, SetStateAction, useEffect} from "react";
import {ExtendedNode} from "@/utils/types";
import {WindowContainer} from "@/components/ui/layout/Containers/WindowContainer";
import {isSubjectNode} from "@/lib/graph/graphUtil";

interface InfoPanelProps {
    item: ExtendedNode<any> | GraphEdge | undefined;
    className?: string;
    showInfo: boolean;
    setShowInfo: Dispatch<SetStateAction<boolean>>;
}

const hiddenTerms = [/*'subjectSequences', */ "code"];

const InfoWindow = ({ item, className, showInfo, setShowInfo }: InfoPanelProps) => {
    const entries = Object.entries(item?.data ?? item ?? []).sort((a, b) => {
        if (a[0].includes("Name")) return -10;
        if (b[0].includes("Name")) return 10;
        if (a[0].includes("type")) return -5;
        if (a[0].includes("school")) return -2;
        if (a[0].includes("disclipline")) return -1;
        return 10;
    });

    useEffect(() => {
        if(entries.length > 0) setShowInfo(true);
        else setShowInfo(false);
    }, [entries, setShowInfo])

    function getTitle(){
        return (entries[0][1] as string).toString();
    }

    function getShortTitle(){
        if (!item) return undefined;
        // in future, we can maybe give shortened version of other items
        switch (true) {
            case isSubjectNode(item):
                return item.data.code;
            default:
                return getTitle();
        }
    }

    return (
        <>
            {showInfo && (
                    <WindowContainer userClosable={false} className={`flex flex-col ${className}`} title={getTitle()} childElement={
                        <div className={`flex flex-col overflow-y-scroll pb-4`}>
                            {entries.map((e, i) => {
                                let shouldTerminate = false;
                                hiddenTerms.forEach((t) => {
                                    if (t == e[0]) shouldTerminate = true;
                                });
                                if (shouldTerminate) return;

                                if (e[0].includes("Link")) {
                                    return (
                                            <li key={e[0]} className={`overflow-x-clip`}>
                                                <strong>Link: </strong>
                                                <a
                                                        target={"_blank"}
                                                        className={`underline text-blue-500`}
                                                        key={e[0]}
                                                        href={e[1] as string}
                                                >
                                                    {getShortTitle()}
                                                </a>
                                            </li>
                                    );
                                } else {
                                    return (
                                            <div key={i}>
                                                {i == 0 ? (
                                                        <></>
                                                ) : (
                                                        <li className={`overflow-x-clip pb-4`}>
                                                            <strong>{e[0].charAt(0).toUpperCase() + e[0].slice(1)}</strong>:{" "}
                                                            <p className="px-4 py-1">{(e[1] as string).toString() == "[]" ? "No Prerequisites" : (e[1] as string).toString()}</p>
                                                        </li>
                                                )}
                                            </div>
                                    );
                                }
                            })}
                        </div>
                    }/>
            )}
        </>
    );
};

export default InfoWindow;
