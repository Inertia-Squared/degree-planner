import {useState} from "react";
import {FaRegEye, FaRegEyeSlash} from "react-icons/fa";

interface ShowIneligibleProps {
    onToggle: (shouldShow: boolean) => void
    className?: string
}

const ShowIneligible = ({onToggle, className}: ShowIneligibleProps) => {
    const [show, setShow] = useState(false);

    function onToggleButton(){
        onToggle(!show);
        setShow(!show)
    }

    if (show) {
        return (<div className={`hover:cursor-pointer z-15 absolute right-0 bottom-1/5 border rounded-l-md w-8 h-8 bg-white`} onClick={()=>onToggleButton()}><FaRegEye size={30}/></div>);
    } else {
        return (<div className={`hover:cursor-pointer z-15 absolute right-0 bottom-1/5 border rounded-l-md w-8 h-8 bg-white`} onClick={()=>onToggleButton()}><FaRegEyeSlash size={30}/></div>);
    }
}

export default ShowIneligible;