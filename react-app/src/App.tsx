import { Navigate, Route, Routes } from "react-router-dom";
import { HomeScreen } from "./pages/home/HomeScreen";
import { PostsScreen } from "./pages/posts/PostsScreen";
import { PendingScreen } from "./pages/shared/PendingScreen";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Home/Index" replace />} />

      <Route path="/Home/*" element={<HomeScreen />} />
      <Route path="/Posts/*" element={<PostsScreen />} />

      <Route path="/Tags/*" element={<PendingScreen featureLabel="Tags" />} />
      <Route path="/Blogs/*" element={<PendingScreen featureLabel="Blogs" />} />
      <Route path="/PostsAsync/*" element={<PendingScreen featureLabel="Posts Async" />} />
      <Route path="/TagsAsync/*" element={<PendingScreen featureLabel="Tags Async" />} />

      <Route path="*" element={<Navigate to="/Home/Index" replace />} />
    </Routes>
  );
}
