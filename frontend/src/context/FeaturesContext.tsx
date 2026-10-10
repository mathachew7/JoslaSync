import { createContext, useContext, useEffect, useState, useCallback } from "react";
import API from "../lib/axios";
import { useAuth } from "./AuthContext";

export type FeatureKey = "draft_invoices" | "recurring_invoices" | "multi_user" | "email_reminders";

type Features = Record<FeatureKey, boolean>;

const DEFAULT_FEATURES: Features = {
  draft_invoices: true,
  recurring_invoices: true,
  multi_user: true,
  email_reminders: false, // paid add-on; off until an admin opts the tenant in
};

type Ctx = {
  features: Features;
  hasFeature: (key: FeatureKey) => boolean;
  reloadFeatures: () => void;
};

const FeaturesCtx = createContext<Ctx>({
  features: DEFAULT_FEATURES,
  hasFeature: () => true,
  reloadFeatures: () => {},
});

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const { user, viewingTenant } = useAuth();
  const [features, setFeatures] = useState<Features>(DEFAULT_FEATURES);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await API.get<Features>("/api/company/features");
      setFeatures(data);
    } catch {
      setFeatures(DEFAULT_FEATURES);
    }
  }, [user, viewingTenant]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const hasFeature = useCallback((key: FeatureKey) => features[key] ?? true, [features]);

  return (
    <FeaturesCtx.Provider value={{ features, hasFeature, reloadFeatures: load }}>
      {children}
    </FeaturesCtx.Provider>
  );
}

export const useFeatures = () => useContext(FeaturesCtx);
