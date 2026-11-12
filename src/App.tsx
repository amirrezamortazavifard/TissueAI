import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "./contexts/NotificationContext";
import ToastContainer from "./components/ToastContainer";
import MainLayout from "./components/Layout/MainLayout";
import ChatLayout from "./components/Layout/ChatLayout";
import Home from "./components/pages/Home";
import { useChatHydration } from "./hooks/useChatHydration";
import ErrorDialog from "./containers/dialogs/ErrorDialog";
import OutOfContextPromiseModal from "./containers/dialogs/OutOfContextDialog";

const Settings = lazy(() => import("./components/pages/Settings"));
const ProviderDetail = lazy(() => import("./pages/settings/ProviderDetail"));
const About = lazy(() => import("./components/pages/About"));
const Help = lazy(() => import("./components/pages/Help"));
const Detection = lazy(() => import("./components/tools/Detection"));
const MultiSlide = lazy(() => import("./components/tools/MultiSlide"));
const Trainable = lazy(() => import("./components/tools/Trainable"));
const ColorAnalysis = lazy(() => import("./components/tools/ColorAnalysis"));
const Editor = lazy(() => import("./components/tools/Editor"));
const ThreeViewer = lazy(() => import("./components/tools/ThreeViewer/ThreeViewer"));
const Segmentation = lazy(() => import("./components/tools/Segmentation"));
const AgentWorkspace = lazy(() => import("./components/tools/agent-workspace/index.tsx"));
const AnatomyApp = lazy(() => import("./components/anatomy/AnatomyApp").then(m => ({ default: m.AnatomyApp })));
const LlmModelsPage = lazy(() => import("./pages/llm/ModelsPage"));
const LlmThreadDetail = lazy(() => import("./pages/llm/ThreadDetail"));
const LlmMonitoring = lazy(() => import("./pages/llm/Monitoring"));
const LlmSettings = lazy(() => import("./pages/llm/Settings"));
const McpSettings = lazy(() => import("./pages/llm/McpSettings"));
const ProjectPage = lazy(() => import("./pages/project/ProjectPage"));

function PageLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center" style={{ background: "transparent" }}>
      <div className="spinner-lg" />
    </div>
  );
}

function App() {
  useChatHydration();

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).__splashExit) {
      (window as any).__splashExit();
    }
  }, []);

  // Global Desktop Security: Disable Browser Context Menu (Right-Click Inspect) & Shortcuts (F12, Ctrl+R, F5)
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Prevent browser right click context menu everywhere in the app
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12 (Developer Tools)
      if (e.key === "F12") {
        e.preventDefault();
      }

      // Disable Ctrl+R, Ctrl+Shift+R, F5 (Page Refresh)
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R") || e.key === "F5") {
        e.preventDefault();
      }

      // Disable Ctrl+P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
      }

      // Disable Ctrl+S (Save Page)
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
      }

      // Disable Ctrl+U (View Page Source)
      if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <NotificationProvider>
      <ToastContainer />
      <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route
          path="settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          }
        />
        <Route
          path="settings/providers/:providerName"
          element={
            <Suspense fallback={<PageLoader />}>
              <ProviderDetail />
            </Suspense>
          }
        />
        <Route
          path="help"
          element={
            <Suspense fallback={<PageLoader />}>
              <Help />
            </Suspense>
          }
        />
        <Route
          path="about"
          element={
            <Suspense fallback={<PageLoader />}>
              <About />
            </Suspense>
          }
        />
        <Route path="chat" element={<Navigate to="/llm/chat" replace />} />
        <Route
          path="detection"
          element={
            <Suspense fallback={<PageLoader />}>
              <Detection />
            </Suspense>
          }
        />
        <Route
          path="multi-slide"
          element={
            <Suspense fallback={<PageLoader />}>
              <MultiSlide />
            </Suspense>
          }
        />
        <Route
          path="trainable"
          element={
            <Suspense fallback={<PageLoader />}>
              <Trainable />
            </Suspense>
          }
        />
        <Route
          path="color-analysis"
          element={
            <Suspense fallback={<PageLoader />}>
              <ColorAnalysis />
            </Suspense>
          }
        />
        <Route
          path="editor"
          element={
            <Suspense fallback={<PageLoader />}>
              <Editor />
            </Suspense>
          }
        />
        <Route
          path="three"
          element={
            <Suspense fallback={<PageLoader />}>
              <ThreeViewer />
            </Suspense>
          }
        />
        <Route
          path="anatomy"
          element={
            <Suspense fallback={<PageLoader />}>
              <AnatomyApp />
            </Suspense>
          }
        />
        <Route
          path="segmentation"
          element={
            <Suspense fallback={<PageLoader />}>
              <Segmentation />
            </Suspense>
          }
        />
        <Route
          path="agent-workspace"
          element={
            <Suspense fallback={<PageLoader />}>
              <AgentWorkspace />
            </Suspense>
          }
        />
        <Route
          path="llm"
          element={
            <Suspense fallback={<PageLoader />}>
              <LlmModelsPage />
            </Suspense>
          }
        />
        <Route
          path="llm/monitoring"
          element={
            <Suspense fallback={<PageLoader />}>
              <LlmMonitoring />
            </Suspense>
          }
        />
        <Route
          path="llm/settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <LlmSettings />
            </Suspense>
          }
        />
        <Route path="agent-settings" element={<Navigate to="/llm" replace />} />
        <Route
          path="mcp-settings"
          element={
            <Suspense fallback={<PageLoader />}>
              <McpSettings />
            </Suspense>
          }
        />
      </Route>
      <Route path="/llm/chat" element={<ChatLayout />}>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <LlmThreadDetail />
          </Suspense>
        } />
        <Route path=":threadId" element={
          <Suspense fallback={<PageLoader />}>
            <LlmThreadDetail />
          </Suspense>
        } />
      </Route>
      <Route path="/project/:projectId" element={<ChatLayout />}>
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <ProjectPage />
          </Suspense>
        } />
      </Route>
      </Routes>
      <ErrorDialog />
      <OutOfContextPromiseModal />
    </NotificationProvider>
  );
}

export default App;
