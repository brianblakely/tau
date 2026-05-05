import type { ColDef } from "ag-grid-community";
import { AlertCircleIcon, Badge, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, ViewTransition } from "react";
import { useMlOutput } from "@/hooks/useMlOutput";
import { useSampleData } from "@/hooks/useSampleData";
import {
  compileDashboardConfig,
  type DashboardConfig,
} from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";
import { Content } from "../Content";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const PromptDescription = () => (
  <>
    Enter a prompt to visualize our sample (retail sales) dataset.{" "}
    <Link
      href="/data"
      target="_blank"
      className="inline-block underline underline-offset-3 hover:text-foreground"
    >
      Explore the dataset.
    </Link>
  </>
);

export const Prompt = ({
  onSubmit,
}: {
  onSubmit: (
    prompt: string,
    config: DashboardConfig,
    rowData: Row[],
    columnDefs: ColDef<Row>[],
  ) => void;
}) => {
  const { validate, parse, loading } = useMlOutput();
  const { rowData, columnDefs, schemaSpec } = useSampleData();

  const [isValid, setIsValid] = useState<boolean>(true);
  const [prompt, setPrompt] = useState("");
  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setIsValid(true);
    setPrompt(event.target.value.trim());
  };
  const handlePromptSubmit = async () => {
    if (!prompt) return;

    const didValidationPass = await validate(prompt);
    if (!didValidationPass) {
      setIsValid(false);
      return;
    }

    const spec = await parse(prompt, schemaSpec);
    const dashboardConfig = compileDashboardConfig(spec);

    onSubmit(prompt, dashboardConfig, rowData, columnDefs);
  };

  return (
    <Content description={<PromptDescription />}>
      {!isValid && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircleIcon className="me-2" />
          <AlertTitle>Invalid prompt</AlertTitle>
          <AlertDescription>
            Sorry, I couldn't understand that. Please try rephrasing your
            prompt.
          </AlertDescription>
        </Alert>
      )}
      <ViewTransition exit="prompt-fade-out" default="none">
        <div className="relative">
          <Textarea
            autoFocus
            className="pb-14 resize-none"
            onChange={handlePromptChange}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-10 w-10 rounded-full cursor-pointer"
            aria-label="Send message"
            onClick={handlePromptSubmit}
          >
            {loading ? (
              <Badge className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
        </div>
      </ViewTransition>
    </Content>
  );
};
