import { lazy, Suspense } from "react";
import { createBrowserRouter, Outlet } from "react-router";

const Layout = lazy(() => import("./components/Layout").then(m => ({ default: m.Layout })));
const HomePage = lazy(() => import("./components/HomePage").then(m => ({ default: m.HomePage })));
const PlaceholderPage = lazy(() => import("./components/PlaceholderPage").then(m => ({ default: m.PlaceholderPage })));

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function LayoutRoute() {
  return <Wrap><Layout /></Wrap>;
}
function HomeRoute() {
  return <Wrap><HomePage /></Wrap>;
}
function NoteRoute() {
  return <Wrap><PlaceholderPage title="Notes" icon="note" /></Wrap>;
}
function FinanceRoute() {
  return <Wrap><PlaceholderPage title="Finance" icon="finance" /></Wrap>;
}
function PersonalRoute() {
  return <Wrap><PlaceholderPage title="Personal" icon="personal" /></Wrap>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LayoutRoute,
    children: [
      { index: true, Component: HomeRoute },
      { path: "note", Component: NoteRoute },
      { path: "finance", Component: FinanceRoute },
      { path: "personal", Component: PersonalRoute },
    ],
  },
]);
