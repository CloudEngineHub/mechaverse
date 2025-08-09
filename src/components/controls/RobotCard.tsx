import { ExampleRobot } from "@/types/robot";
import { DM_Mono } from "next/font/google";

const dmMono = DM_Mono({ subsets: ["latin"], weight: "400" });

interface RobotCardProps {
  index: number;
  example: ExampleRobot;
  isSelected: boolean;
  handleExampleClick: (example: ExampleRobot) => void;
}

export default function RobotCard({
  index,
  example,
  isSelected,
  handleExampleClick,
}: RobotCardProps) {
  return (
    <button
      key={index}
      onClick={() => handleExampleClick(example)}
      className={`group relative overflow-hidden rounded-md p-4 text-left transition-all flex-shrink-0 w-full ${
        isSelected ? "bg-[#FBE651]" : "bg-[#FCF4DD] hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-left items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center mr-3">
            <span className="text-gray-400 text-xl">🦾</span>
          </div>
          <span
            className={`${dmMono.className} text-[#968612]`}
            style={{
              fontSize: "1rem",
              fontStyle: "normal",
              fontWeight: 400,
              lineHeight: "normal",
            }}
          >
            {example.name}
          </span>
        </div>
        <div className="flex items-center space-between gap-2">
          <div className="border-1 border-[#968612] rounded-sm px-3 items-center justify-center">
            <span
              className={`${dmMono.className} text-[0.875rem] not-italic font-normal leading-normal text-[#968612]`}
            >
              {example.fileType.toUpperCase()}
            </span>
          </div>
          {example.fileType.toUpperCase() === "MJCF" && (
            <div className="flex gap-1 py-1 rounded-sm px-2 items-center justify-center bg-[#FB5151]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 18 18"
                fill="none"
              >
                <mask
                  id="mask0_2_288"
                  style={{ maskType: "alpha" }}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="18"
                  height="18"
                >
                  <rect width="18" height="18" fill="#D9D9D9" />
                </mask>
                <g mask="url(#mask0_2_288)">
                  <path
                    d="M3.61873 9.01874L6.52498 11.925C6.66248 12.0625 6.73123 12.2375 6.73123 12.45C6.73123 12.6625 6.66248 12.8375 6.52498 12.975C6.38748 13.1125 6.21248 13.1812 5.99998 13.1812C5.78748 13.1812 5.61248 13.1125 5.47498 12.975L2.02498 9.52499C1.94998 9.44999 1.89685 9.36874 1.8656 9.28124C1.83435 9.19374 1.81873 9.09999 1.81873 8.99999C1.81873 8.89999 1.83435 8.80624 1.8656 8.71874C1.89685 8.63124 1.94998 8.54999 2.02498 8.47499L5.47498 5.02499C5.62498 4.87499 5.8031 4.79999 6.00935 4.79999C6.2156 4.79999 6.39373 4.87499 6.54373 5.02499C6.69373 5.17499 6.76873 5.35311 6.76873 5.55936C6.76873 5.76561 6.69373 5.94374 6.54373 6.09374L3.61873 9.01874ZM14.3812 8.98124L11.475 6.07499C11.3375 5.93749 11.2687 5.76249 11.2687 5.54999C11.2687 5.33749 11.3375 5.16249 11.475 5.02499C11.6125 4.88749 11.7875 4.81874 12 4.81874C12.2125 4.81874 12.3875 4.88749 12.525 5.02499L15.975 8.47499C16.05 8.54999 16.1031 8.63124 16.1343 8.71874C16.1656 8.80624 16.1812 8.89999 16.1812 8.99999C16.1812 9.09999 16.1656 9.19374 16.1343 9.28124C16.1031 9.36874 16.05 9.44999 15.975 9.52499L12.525 12.975C12.375 13.125 12.2 13.1969 12 13.1906C11.8 13.1844 11.625 13.1062 11.475 12.9562C11.325 12.8062 11.25 12.6281 11.25 12.4219C11.25 12.2156 11.325 12.0375 11.475 11.8875L14.3812 8.98124Z"
                    fill="#890A0A"
                  />
                </g>
              </svg>
              <span
                className={`${dmMono.className} text-[#890A0A] text-[0.875rem] not-italic font-normal leading-normal`}
                style={{ fontFamily: '"DM Mono"' }}
              >
                Beta
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
