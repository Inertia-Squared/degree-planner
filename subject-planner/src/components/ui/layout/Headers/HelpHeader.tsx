import { HeaderItem, HeaderItemProps, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { TbHelpHexagon } from "react-icons/tb";

const TimelineHeader = ({ onHeaderClicked, selectedHeaderItem }: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.HELP;
    return (
        <div onClick={() => onHeaderClicked(itemIdentifier)} className="header-button">
            <div
                className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"} flex space-x-2 justify-start items-center`}
            >
                <TbHelpHexagon />
                <span>Help</span>
            </div>
        </div>
    );
};

export default TimelineHeader;
