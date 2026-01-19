"use client";

import { useRouter } from "next/navigation";
import Popup from "@/components/Popup";

type LoginSuccessGateProps = {
  nextPath: string;
};

export default function LoginSuccessGate({ nextPath }: LoginSuccessGateProps) {
  const router = useRouter();

  return (
    <Popup
      tone="success"
      title="Success"
      message="Login successful."
      onClose={() => router.replace(nextPath)}
    />
  );
}
