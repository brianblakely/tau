import { SendHorizontal } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";
import { Textarea } from "../ui/textarea";

export const Prompt = () => {
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          Enter a prompt to visualize our sample (retail sales) dataset.{" "}
          <Link
            href="/data"
            target="_blank"
            className="underline underline-offset-3 hover:text-foreground"
          >
            Explore the dataset.
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Textarea autoFocus className="pb-14 resize-none"></Textarea>
          <Button
            type="submit"
            size="icon"
            className="absolute right-2 bottom-2 h-10 w-10 rounded-full cursor-pointer"
            aria-label="Send message"
          >
            <SendHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
