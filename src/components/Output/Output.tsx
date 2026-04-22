"use client";

import { useEffect, useState, ViewTransition } from "react";
import { Content } from "../Content";

const OutputDescription = ({ prompt }: { prompt: string }) => (
  <>{`"${prompt}"`}</>
);

export const Output = () => {
  const [prompt, setPrompt] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState("");

  useEffect(() => {
    const storedPrompt = sessionStorage.getItem("userPrompt");
    const storedDashboardConfig = sessionStorage.getItem("dashboardConfig");
    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
    if (storedDashboardConfig) {
      setDashboardConfig(storedDashboardConfig);
    }
  }, []);

  return (
    <Content description={<OutputDescription prompt={prompt} />}>
      <ViewTransition enter="output-fade-in" default="none">
        <code className="p-4 text-sm leading-6">{dashboardConfig}</code>
      </ViewTransition>
    </Content>
  );
};
