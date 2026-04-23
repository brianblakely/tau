import { ViewTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "../ui/card";

export const Content = ({
  description,
  children,
}: {
  description: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <ViewTransition name="content-card" share="content-sweep" default="none">
      <Card className="mx-auto max-w-2xl w-full">
        <CardHeader>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">{children}</CardContent>
      </Card>
    </ViewTransition>
  );
};
