import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Próximos Passos",
    description: "Próximos Passos App",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body>{children}</body>
        </html>
    );
}
