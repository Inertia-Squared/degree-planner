import {ExtendedNode, Generic, NodeStatus} from "@/utils/types";
import {isChoiceNode, isPrerequisiteNode, isSubjectNode} from "@/lib/graph/graphUtil";

const subjectSuffixes = [
    "\n(Selected)",
    "\n(Required)",
    "\n(Prerequisite)",
    "\n(Elective)",
    "\n(Ineligible)"
];

export function applyGraphLabels(nodes: ExtendedNode<Generic>[]) {
    nodes.forEach(n => {
        switch(true){
            case isSubjectNode(n):
                n.label = n.data.code + subjectSuffixes[n.data.status];
                break;
            case isPrerequisiteNode(n):
                n.label = n.data.status === NodeStatus.INELIGIBLE ? 'Requirements Not Met' : 'Requirements Met';
                break;
            case isChoiceNode(n):
                break;

        }
    });
}
