import {ExtendedNode} from "@/app/page";
import {GraphEdge} from "reagraph";
import {BsArrowRightShort} from "react-icons/bs";
import {useState} from "react";
import {BiBook} from "react-icons/bi";

interface InfoPanelProps {
    item: ExtendedNode<any> | GraphEdge | undefined
    className?: string
}


const hiddenTerms = [/*'subjectSequences', */'code']

const InfoPanel = ({item, className}: InfoPanelProps) => {
    const entries = Object.entries(item?.data ?? item ?? []).sort((a,b)=> {
        if (a[0].includes('Name')) return -10;
        if (b[0].includes('Name')) return 10;
        if (a[0].includes('type')) return -5;
        if (a[0].includes('school')) return -2;
        if (a[0].includes('disclipline')) return -1;
        return 10;
    });
    const [show, setShow] = useState(false);

    if (show) {
        return(<div className={`flex flex-col ${className}`}>

            <div className={`flex flex-row font-bold text-center text-xl items-center mx-2 `}>
                <div className={`hover:cursor-pointer flex-1`} onClick={()=>setShow(!show)}><BsArrowRightShort size={24}/></div>
                Info Panel
                <div className={`flex-1`}></div>
            </div>
            <div className={`text-xs`}>This panel provides info on the selected node. It will be more readable in the future!</div>
            <hr/>
            <hr/>
            <hr/>
            <div className={`flex flex-col overflow-y-scroll`}>
                {entries.map((e)=>{
                    let shouldTerminate = false;
                    hiddenTerms.forEach((t)=>{
                        if (t == e[0]) shouldTerminate = true;
                    })
                    if (shouldTerminate) return;

                    if (e[0].includes('Link')){
                        return <li key={e[0]} className={`overflow-x-clip`}><strong>{e[0]}</strong>: <a target={'_blank'} className={`underline text-blue-500`} key={e[0]} href={e[1] as string}>WSU Handbook</a></li>
                    } else {
                        return <li key={e[0]} className={`overflow-x-clip`}><strong>{e[0]}</strong>: <p className={``}>{(e[1] as string).toString()}</p></li>
                    }
                })}
            </div>
        </div>)
    } else {
        return (<div className={`hover:cursor-pointer z-20 absolute right-0 top-4/5 bottom-1/5 border rounded-l-md w-8 h-8 bg-white`} onClick={()=>setShow(!show)}><BiBook size={30}/></div>);
    }
}

export default InfoPanel;