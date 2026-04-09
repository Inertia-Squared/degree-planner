import { useEffect } from "react";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { isSubjectNode } from "@/lib/graph/graphUtil";
import { useGraphRenderStore, useGraphUIStore } from "@/app/store/graphStore";

interface InfoPanelProps {
    className?: string;
}

const hiddenTerms = ["code"];

const InfoWindow = ({ className }: InfoPanelProps) => {

    const item = useGraphRenderStore((state) => state.selectedElement);
    const showInfo = useGraphUIStore((state) => state.showInfo);

    const entries = Object.entries(item?.data ?? item ?? []).sort((a, b) => {
        if (a[0].includes("Name")) return -10;
        if (b[0].includes("Name")) return 10;
        if (a[0].includes("type")) return -5;
        if (a[0].includes("school")) return -2;
        if (a[0].includes("disclipline")) return -1;
        return 10;
    });

    useEffect(() => {
        if (entries.length > 0) useGraphUIStore.setState({ showInfo: true });
        else useGraphUIStore.setState({ showInfo: false });
    }, [entries]);

    function getTitle() {
        return (entries[0]?.[1] as string)?.toString();
    }

    function getShortTitle() {
        if (!item) return undefined;
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
                <WindowContainer
                    userClosable={false}
                    className={`flex flex-col ${className}`}
                    title={getTitle()}
                    childElement={
                        <div className={`flex flex-col overflow-y-scroll pb-4`}>
                            {entries.map((e, i) => {
                                let shouldTerminate = false;
                                hiddenTerms.forEach((t) => {
                                    if (t === e[0]) shouldTerminate = true;
                                });
                                if (shouldTerminate) return null;

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
                                            {i === 0 ? (
                                                <></>
                                            ) : (
                                                <li className={`overflow-x-clip pb-4`}>
                                                    <strong>{e[0].charAt(0).toUpperCase() + e[0].slice(1)}</strong>:{" "}
                                                    {e[0] === "subjectSequences" ? (
                                                        <ol className="px-4 py-1 space-y-2 list-disc">
                                                            {(e[1] as string[]).map((s: string, index: number) => (
                                                                <li key={index}>{s}</li>
                                                            ))}
                                                        </ol>
                                                    ) : e[0] === "teachingPeriods" ? (
                                                        <div className="px-4 py-1 space-y-2">
                                                            {(e[1] as any).map((tp: any, index: number) => (
                                                                <ol key={index} className='list-disc'>
                                                                    <li>
                                                                        {JSON.parse(tp)["period"]} at{" "}
                                                                        {JSON.parse(tp)["locations"].map(
                                                                            (l: string, index: number) => (
                                                                                <p key={index}>{l} Campus</p>
                                                                            ),
                                                                        )}
                                                                    </li>
                                                                </ol>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="px-4 py-1">
                                                            {(e[1] as string).toString() === "[]" && e[1] === "prerequisites"
                                                                ? "No Prerequisites"
                                                                : (e[1] as string).toString()}
                                                        </p>
                                                    )}
                                                </li>
                                            )}
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    }
                />
            )}
        </>
    );
};

export default InfoWindow;