import { HeaderItem, HeaderItemProps, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { RiTimeLine } from "react-icons/ri";

const TimelineHeader = ({ onHeaderClicked, selectedHeaderItem }: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.TIMELINE;
    return (
        <div onClick={() => onHeaderClicked(itemIdentifier)} className="header-button">
            <div
                className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"} flex space-x-2 justify-start items-center`}
            >
                <RiTimeLine />
                <span>Timeline</span>
            </div>
        </div>
    );
};

export default TimelineHeader;
