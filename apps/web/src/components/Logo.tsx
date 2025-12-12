import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  className?: string;
  height?: number;
  width?: number;
  showText?: boolean;
  href?: string;
}

export function Logo({ 
  className = "", 
  height = 40, 
  width, 
  showText = true,
  href 
}: LogoProps) {
  // Calculate width to maintain aspect ratio if not provided
  // The logo is 279x60 pixels, so aspect ratio is ~4.65:1
  const logoWidth = width || (showText ? Math.round(height * 4.65) : height);

  const logoContent = (
    <Image
      src="/assets/dynamicpurchaselogo.png"
      alt="Dynamic Purchase"
      height={height}
      width={logoWidth}
      className="h-auto object-contain"
      priority
    />
  );

  if (href) {
    return (
      <Link href={href} className={`flex items-center ${className}`}>
        {logoContent}
      </Link>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {logoContent}
    </div>
  );
}





