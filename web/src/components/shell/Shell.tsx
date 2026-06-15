"use client";

import styled from "styled-components";
import Sidebar from "./Sidebar";
import Toaster from "@/components/Toaster";

const Layout = styled.div`
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
`;

const Main = styled.main`
  padding: 34px 40px 72px;
`;

const Content = styled.div`
  max-width: 1000px;
  margin: 0 auto;
`;

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <Sidebar />
      <Main>
        <Content>{children}</Content>
      </Main>
      <Toaster />
    </Layout>
  );
}
