import type { Metadata } from "next";
import StyledComponentsRegistry from "@/lib/registry";
import Providers from "@/lib/Providers";
import AppThemeProvider from "@/lib/ThemeContext";

export const metadata: Metadata = {
  title: "Settl - Recovery Dashboard",
  description:
    "Autonomous invoice recovery: see what the agent decided, and approve what needs a human.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <Providers>
            <AppThemeProvider>{children}</AppThemeProvider>
          </Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
