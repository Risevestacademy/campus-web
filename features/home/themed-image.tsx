import { cn } from "cn";
import Image, { type ImageProps, type StaticImageData } from "next/image";

// An image with a dark variant. Both are in the page and CSS shows one, so
// there is no flash on load and nothing waits for the theme to be read.
export function ThemedImage({
  light,
  dark,
  alt,
  className,
  ...props
}: Omit<ImageProps, "src"> & {
  light: StaticImageData;
  dark: StaticImageData;
}) {
  return (
    <>
      <Image
        src={light}
        alt={alt}
        className={cn(className, "dark:hidden")}
        {...props}
      />
      <Image
        src={dark}
        alt={alt}
        className={cn(className, "hidden dark:inline")}
        {...props}
      />
    </>
  );
}
