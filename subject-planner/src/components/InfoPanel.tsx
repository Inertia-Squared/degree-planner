import {ExtendedNode} from "@/app/page";
import {GraphEdge} from "reagraph";

interface InfoPanelProps {
    item: ExtendedNode<any> | GraphEdge | undefined
    className?: string
}


const hiddenTerms = [/*'subjectSequences', */'code']

const InfoPanel = ({item, className}: InfoPanelProps) => {
    const entries = Object.entries(item?.data ?? []).sort((a,b)=> {
        if (a[0].includes('Name')) return -10;
        if (b[0].includes('Name')) return 10;
        if (a[0].includes('type')) return -5;
        if (a[0].includes('school')) return -2;
        if (a[0].includes('disclipline')) return -1;
        return 10;
    });

  //  console.log(JSON.stringify(entries))
    return(<div className={`${className}`}>
        {entries.map((e)=>{
            let shouldTerminate = false;
            hiddenTerms.forEach((t)=>{
                if (t == e[0]) shouldTerminate = true;
            })
            if (shouldTerminate) return;

            return <li key={e[0]} className={`overflow-x-clip`}><strong>{e[0]}</strong>: <p className={``}>{(e[1] as string).toString()}</p></li>
        })}
    </div>)
}

export default InfoPanel;