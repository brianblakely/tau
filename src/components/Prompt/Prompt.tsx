import type { ColDef } from "ag-grid-community";
import { Badge, SendHorizontal } from "lucide-react";
import Link from "next/link";
import { useRef, useState, ViewTransition } from "react";
import { useMlOutput } from "@/hooks/useMlOutput";
import { useSampleData } from "@/hooks/useSampleData";
import {
  compileDashboardConfig,
  type DashboardConfig,
} from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";
import { Content } from "../Content";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { InvalidPromptAlert } from "./InvalidPromptAlert";

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

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [prompt, setPrompt] = useState("");
  const handlePromptChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setIsValid(true);
    setPrompt(event.target.value);
  };
  const handlePromptClear = () => {
    setIsValid(true);
    setPrompt("");
    promptRef.current?.focus();
  };
  const handlePromptSubmit = async () => {
    if (loading) {
      return;
    }

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      promptRef.current?.focus();
      return;
    }

    const didValidationPass = await validate(trimmedPrompt);
    if (!didValidationPass) {
      setIsValid(false);
      return;
    }

    const spec = await parse(trimmedPrompt, schemaSpec);
    const dashboardConfig = compileDashboardConfig(spec);

    onSubmit(trimmedPrompt, dashboardConfig, rowData, columnDefs);
  };
  const handlePromptKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      await handlePromptSubmit();
    }
  };

  return (
    <Content description={<PromptDescription />}>
      <ViewTransition exit="prompt-fade-out" default="none">
        <div className="relative">
          <Textarea
            autoFocus
            className="pb-17 resize-none"
            onChange={handlePromptChange}
            onKeyDown={handlePromptKeyDown}
            ref={promptRef}
            value={prompt}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-10 w-10 rounded-full cursor-pointer"
            aria-label="Send message"
            onClick={handlePromptSubmit}
            disabled={loading}
          >
            {loading ? (
              <Badge className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </Button>
          {!isValid && (
            <InvalidPromptAlert
              className="absolute! left-0 bottom-0"
              onClear={handlePromptClear}
            />
          )}
        </div>
      </ViewTransition>
    </Content>
  );
};
