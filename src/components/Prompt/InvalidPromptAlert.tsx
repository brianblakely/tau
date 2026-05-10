import { AlertCircleIcon, EraserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

export const InvalidPromptAlert = ({
  className,
  onClear,
}: {
  className?: string;
  onClear: () => void;
}) => (
  <Alert
    variant="destructive"
    className={cn("fade-wipe border-transparent bg-clip-padding", className)}
  >
    <AlertCircleIcon className="me-2" />
    <AlertTitle>Try a different request</AlertTitle>
    <AlertDescription>
      Ask for a chart, dashboard, or visual summary using your data.
    </AlertDescription>
    <AlertAction>
      <Button className="cursor-pointer" size="sm" onClick={onClear}>
        <EraserIcon />
        Clear
      </Button>
    </AlertAction>
  </Alert>
);
