import { useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useState } from "react";
import React from "react";
interface CreateUserObject {
  name?: string;
  email?: string;
  password?: string;
}

export type ProviderInfo = {
  name: string;
  clientId: string;
  clientSecret: string;
};

interface SetupContext {
  getUser: () => CreateUserObject;
  updateUser: (user: Partial<CreateUserObject>) => void;
  getStep: () => number;
  nextStep: () => void;
  prevStep: () => void;
  getErr: () => string;
  setErr: (err: string) => void;
  toggleProvider: (provider: string) => void;
  getProviders: () => string[];
  getProviderInfo: () => ProviderInfo[];
  updateProviderInfo: (providers: ProviderInfo[]) => void;
}

const SetupContext = createContext<SetupContext | undefined>(undefined);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryParams = useSearchParams();

  const [user, setUser] = useState<CreateUserObject>({});
  const [err, _setErr] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  const [providerInfo, setProviderInfo] = useState<ProviderInfo[]>([]);

  const getUser = () => user;
  const updateUser = (_user: Partial<CreateUserObject>) => {
    setUser({ ...user, ..._user });
  };

  const getStep = () => Number.parseInt(queryParams.get("step") ?? "1");
  const setStep = (step: number) => {
    router.push(`?step=${step}`);
  };
  const nextStep = () => {
    const step = getStep() + 1;
    setStep(step);
  };
  const prevStep = () => {
    const step = getStep() - 1;
    setStep(step);
  };

  const toggleProvider = (provider: string) => {
    const newProviders = [...selectedProviders];
    if (newProviders.includes(provider)) {
      newProviders.splice(newProviders.indexOf(provider), 1);
    } else {
      newProviders.push(provider);
    }
    setSelectedProviders(newProviders);
  };

  const getProviders = () => selectedProviders;

  const getProviderInfo = () => providerInfo;
  const updateProviderInfo = (providers: ProviderInfo[]) => {
    setProviderInfo(providers);
  };

  const getErr = () => err;
  const setErr = (_err: string) => _setErr(_err);

  const contextValue: SetupContext = {
    getUser,
    updateUser,
    getStep,
    nextStep,
    prevStep,
    getErr,
    setErr,
    toggleProvider,
    getProviders,
    getProviderInfo,
    updateProviderInfo,
  };

  return (
    <SetupContext.Provider value={contextValue}>
      {children}
    </SetupContext.Provider>
  );
}

export function useSetup() {
  const context = useContext(SetupContext);
  if (!context) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
}
