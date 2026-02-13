import Image from "next/image";
import { BRAND_ASSETS } from "@/config/assets";

type Variant = "full" | "icon" | "title";
type Size = "sm" | "md" | "lg";

const DIMENSIONS: Record<Variant, Record<Size, { width: number; height: number }>> = {
    full: {
        sm: { width: 140, height: 48 },
        md: { width: 200, height: 68 },
        lg: { width: 300, height: 102 },
    },
    icon: {
        sm: { width: 32, height: 32 },
        md: { width: 48, height: 48 },
        lg: { width: 64, height: 64 },
    },
    title: {
        sm: { width: 120, height: 32 },
        md: { width: 180, height: 48 },
        lg: { width: 260, height: 70 },
    },
};

interface BrandLogoProps {
    variant?: Variant;
    size?: Size;
    priority?: boolean;
    className?: string;
}

export function BrandLogo({
    variant = "full",
    size = "md",
    priority = false,
    className,
}: BrandLogoProps) {
    const asset = BRAND_ASSETS.logo[variant];
    const { width, height } = DIMENSIONS[variant][size];
    const useHighRes = size === "lg";

    return (
        <Image
            src={useHighRes ? asset.high : asset.low}
            alt="Próximos Passos"
            width={width}
            height={height}
            priority={priority}
            placeholder="blur"
            blurDataURL={asset.low}
            className={className}
        />
    );
}
