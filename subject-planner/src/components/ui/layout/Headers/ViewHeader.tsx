import {HeaderItem, HeaderItemProps, shouldShowItem} from "@/components/ui/layout/Containers/HeaderBar";
import { MdGridView } from "react-icons/md";

const SearchHeader = ({ onHeaderClicked, selectedHeaderItem}: HeaderItemProps) => {
    const itemIdentifier = HeaderItem.VIEW;
    return (
            <div
                    onClick={() => onHeaderClicked(itemIdentifier)}
                    className={`header-button`}
            >
                <div className={`${shouldShowItem(selectedHeaderItem, itemIdentifier) && "header-button-selected"} flex space-x-2 justify-start items-center`}>
                    <MdGridView />
                    <span>View</span>
                </div>
            </div>
    );
};

export default SearchHeader;
