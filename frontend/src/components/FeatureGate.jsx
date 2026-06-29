import { useFeatures } from "../context/FeaturesContext";

export default function FeatureGate({ feature, children, fallback = null }) {
  const { hasFeature } = useFeatures();
  return hasFeature(feature) ? children : fallback;
}
