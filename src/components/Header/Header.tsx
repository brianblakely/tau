import { SiGithub, SiX } from "@icons-pack/react-simple-icons";
import Image from "next/image";
import Link from "next/link";
import tau from "@/../public/tau.svg";
import { cn } from "@/lib/utils";
import { IconLinkedIn } from "./IconLinkedIn";

export const Header = ({ className }: React.ComponentProps<"header">) => {
  return (
    <header className={cn("flex items-end gap-3 align-bottom", className)}>
      <Link href="/" className="inline-block mr-4" aria-label="Tau home">
        <Image src={tau} alt="Tau logo" className="h-12 w-auto" />
      </Link>
      <div className="flex items-baseline gap-3">
        <Link href="/" className="inline-block" aria-label="Tau home">
          <h1 className="text-3xl font-semibold tracking-tight transition-colors">
            Tau.
          </h1>
        </Link>
        <strong className="flex gap-3 text-[12px] text-muted-foreground font-normal italic">
          Brian Blakely
          <Link
            href="https://www.linkedin.com/in/brian-blakely-99b298a/"
            target="_blank"
            className="underline underline-offset-3 hover:text-foreground"
          >
            <IconLinkedIn size={14} />
          </Link>
          <Link
            href="https://github.com/brianblakely"
            target="_blank"
            className="hover:text-foreground"
          >
            <SiGithub size={14} />
          </Link>
          <Link
            href="https://x.com/brianblakely"
            target="_blank"
            className="hover:text-foreground"
          >
            <SiX size={14} />
          </Link>
        </strong>
      </div>
    </header>
  );
};
