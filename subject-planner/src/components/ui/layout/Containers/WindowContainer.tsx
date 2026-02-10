import {RxCross2} from "react-icons/rx";
import {JSX} from "react";

export const WindowContainer =
        ({
             title,
             description,
             onClose,
             className,
             childElement,
             userClosable = true
        }: {
             title: string,
             description?: string,
             className?: string,
             childElement: JSX.Element,
             onClose?: () => void,
             userClosable?: boolean
         })=>{
    return(
            <div className={`h-fit header-window md:flex flex-col py-2 ${className}`}>
                <div className={`w-full flex font-bold text-xl justify-between items-center`}>
                    <div>{title}</div>
                    {userClosable && <div className='cursor-pointer' onClick={() => {if(onClose) onClose()}}>
                        <RxCross2 size={24}/>
                    </div>}
                </div>
                {description && <div className={'text-xs'}>{description}</div>}
                <hr className={`my-1`}/>
                {childElement}
            </div>
    )
}