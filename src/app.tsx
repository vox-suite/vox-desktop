import { useEffect, useState } from "react";
import { HomeShell } from "@/components/home-shell";
import { PhoneEntryScreen } from "@/components/phone-entry-screen";
import { PhoneVerifyScreen } from "@/components/phone-verify-screen";
import { useDesktopControl } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { SignInScreen } from "@/components/sign-in-screen";
import { useAuth } from "@/hooks/use-auth";
import { useCallSession } from "@/hooks/use-call-session";

export default function App() {
  const auth = useAuth();
  const callSession = useCallSession(auth.auth.signed_in);

  const context = useDesktopControl(auth.auth.signed_in);
  const activeTab = context.page;
  const setActiveTab = desktopStore.navigate.bind(desktopStore);
  const [verifySkipped, setVerifySkipped] = useState(false);

  const {
    auth: authState,
    authLoading,
    authBusy,
    authError,
    googleSignIn,
    signOut,
    linkPhone,
    phoneJustLinked,
    startPhoneVerification,
    confirmPhoneVerification,
  } = auth;
  const {
    callState,
    isActive,
    isBusy,
    isVoxSpeaking,
    micLevel,
    callError,
    toggleCall,
    endCall,
  } = callSession;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,[contenteditable=true]")
        ) &&
        authState.signed_in &&
        activeTab === "agent" &&
        !isActive &&
        !isBusy
      ) {
        void toggleCall();
      } else if (e.key === "Escape") {
        if (activeTab !== "agent") setActiveTab("agent");
        else if (isActive || callState === "connecting") void endCall();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers use latest state via closure refresh
  }, [authState.signed_in, activeTab, isActive, isBusy, callState]);

  async function handleGoogleSignIn() {
    await googleSignIn();
  }

  if (authLoading) {
    return (
      <main
        className="relative h-full w-full overflow-hidden bg-background"
        tabIndex={0}
      />
    );
  }

  if (!authState.signed_in) {
    return (
      <SignInScreen
        busy={authBusy}
        error={authError}
        onSignIn={() => void handleGoogleSignIn()}
      />
    );
  }

  if (!authState.has_phone) {
    return (
      <PhoneEntryScreen
        busy={authBusy}
        error={authError}
        onSubmit={(phoneNumber) => void linkPhone(phoneNumber)}
      />
    );
  }

  if (!authState.phone_verified && !verifySkipped) {
    return (
      <PhoneVerifyScreen
        autoSend={phoneJustLinked}
        onSend={startPhoneVerification}
        onConfirm={confirmPhoneVerification}
        onSkip={() => setVerifySkipped(true)}
      />
    );
  }

  return (
    <main
      className="relative h-full w-full overflow-hidden bg-background"
      tabIndex={0}
    >
      <HomeShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        accountLabel={authState.email ?? authState.user_id ?? "Signed in"}
        userName={
          authState.user_name ??
          (authState.email ? authState.email.replace(/@.*/, "") : "User")
        }
        avatarUrl={authState.avatar_url ?? null}
        onSignOut={() => void signOut()}
        isActive={isActive}
        voxSpeaking={isVoxSpeaking}
        micLevel={micLevel}
        callState={callState}
        callError={callError}
        onToggleCall={() => void toggleCall()}
        collections={[]}
      />
    </main>
  );
}
