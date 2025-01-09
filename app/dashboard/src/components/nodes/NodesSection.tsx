import { NodeType } from "@/contexts/NodesContext";
import useDirDetection from "@/hooks/use-dir-detection";
import Node from "./Node";

const NodesSection = ({ nodes }: { nodes: NodeType[] | undefined }) => {
  const dir = useDirDetection();

  return (
    <div
      dir={dir}
      className="px-8 py-10 gap-4 lg:gap-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    >
      {nodes?.map((node: NodeType) => (
        <Node node={node} key={node.id} />
      ))}
    </div>
  );
};

export default NodesSection;
