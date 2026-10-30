import Link from "next/link";
import Image from "next/image";
import orangeIcon from "../../public/images/logo-icon-orange.png";
import darkIcon from "../../public/images/logo-icon-dark.png";
import transparentMark from "../../public/images/logo-mark.png";
import darkLogo from "../../public/images/logo-text-dark.png";
import lightLogo from "../../public/images/logo-text-light.png";

export function BrandMark({
  className = "h-8 w-8",
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "orange" | "dark" | "transparent";
}) {
  if (variant === "orange") {
    return (
      <Image
        src={orangeIcon}
        alt="Sentrix Mark"
        className={`object-contain rounded-lg ${className}`}
      />
    );
  }
  if (variant === "dark") {
    return (
      <Image
        src={darkIcon}
        alt="Sentrix Mark"
        className={`object-contain rounded-lg ${className}`}
      />
    );
  }
  if (variant === "transparent") {
    return (
      <Image
        src={transparentMark}
        alt="Sentrix Mark"
        className={`object-contain ${className}`}
      />
    );
  }

  // Auto variant adapts to theme:
  // In dark mode: Orange icon pops with high contrast
  // In light mode: Dark icon pops with high contrast
  return (
    <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <Image
        src={orangeIcon}
        alt="Sentrix Mark"
        className="h-full w-full object-contain rounded-lg logo-dark-theme"
      />
      <Image
        src={darkIcon}
        alt="Sentrix Mark"
        className="h-full w-full object-contain rounded-lg logo-light-theme shadow-xs"
      />
    </span>
  );
}

export function Brand({
  compact = false,
  href = "/",
  className = "",
  size = "md",
}: {
  compact?: boolean;
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const heightClass =
    size === "sm" ? "h-6" : size === "lg" ? "h-9 sm:h-10" : "h-7 sm:h-8";

  if (compact) {
    return (
      <Link
        href={href}
        className={`inline-flex items-center focus:outline-none ${className}`}
        aria-label="Sentrix"
      >
        <BrandMark className={heightClass + " w-auto"} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center focus:outline-none transition-opacity hover:opacity-90 ${className}`}
      aria-label="Sentrix"
    >
      {/* Dark theme logo: white text + orange bolt */}
      <Image
        src={darkLogo}
        alt="Sentrix"
        className={`${heightClass} w-auto object-contain logo-dark-theme`}
      />
      {/* Light theme logo: dark text + orange bolt */}
      <Image
        src={lightLogo}
        alt="Sentrix"
        className={`${heightClass} w-auto object-contain logo-light-theme`}
      />
    </Link>
  );
}

