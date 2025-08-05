import RobotViewer from "@/components/viewer/RobotViewer";
import { RobotProvider } from "@/contexts/RobotContext";
import { DragAndDropProvider } from "@/contexts/DragAndDropContext";

export default function Home() {
  return (
    <div className="w-full h-screen">
      <main className="w-full h-full">
        <RobotProvider>
          <DragAndDropProvider>
            <RobotViewer />
          </DragAndDropProvider>
        </RobotProvider>
      </main>
    </div>
  );
}
