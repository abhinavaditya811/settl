import type { Metadata } from "next";
import StyledComponentsRegistry from "@/lib/registry";
import AppThemeProvider from "@/lib/ThemeContext";
import BoardProvider from "@/lib/BoardContext";
import Shell from "@/components/shell/Shell";

export const metadata: Metadata = {
  title: "Settl — Recovery Dashboard",
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
          <AppThemeProvider>
            <BoardProvider>
              <Shell>{children}</Shell>
            </BoardProvider>
          </AppThemeProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
