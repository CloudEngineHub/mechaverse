import { ExampleRobot } from "@/types/robot";
import Image from "next/image";

interface RobotCardProps {
  index: number;
  example: ExampleRobot;
  isSelected: boolean;
  handleExampleClick: (example: ExampleRobot) => void;
  compact?: boolean;
}

export default function RobotCard({
  index,
  example,
  isSelected,
  handleExampleClick,
  compact = false,
}: RobotCardProps) {
  return (
    <button
      key={index}
      onClick={() => handleExampleClick(example)}
      className={`group relative overflow-hidden rounded-md ${
        compact ? "p-2" : "p-4"
      } text-left transition-all flex-shrink-0 w-full ${
        isSelected ? "bg-[#FBE651]" : "bg-[#FCF4DD] hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-left items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div
            className={`${
              compact ? "w-6 h-6 mr-2" : "w-10 h-10 mr-3"
            } rounded flex items-center justify-center`}
          >
            <Image
              src={example.imagePath!}
              alt={example.display_name}
              width={256}
              height={200}
            />
          </div>
          <span
            className={`font-mono text-[#968612] ${
              compact ? "text-[0.85rem]" : "text-[1rem]"
            } not-italic font-normal leading-normal`}
          >
            {example.display_name}
          </span>
        </div>
        <div className="flex items-center space-between gap-2">
          <div
            className={`${
              compact ? "px-2" : "px-3"
            } border-1 border-[#968612] rounded-sm items-center justify-center`}
          >
            <span
              className={`font-mono ${
                compact ? "text-[0.7rem]" : "text-[0.875rem]"
              } not-italic font-normal leading-normal text-[#968612]`}
            >
              {example.fileType.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
