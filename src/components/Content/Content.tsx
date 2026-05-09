import { ViewTransition } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "../ui/card";

export const Content = ({
  description,
  action,
  children,
}: {
  description: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <ViewTransition name="content-card" share="content-sweep" default="none">
      <Card className="mx-auto max-w-2xl w-full">
        <CardHeader>
          <CardDescription>{description}</CardDescription>
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
        <CardContent className="flex flex-col">{children}</CardContent>
      </Card>
    </ViewTransition>
  );
};
