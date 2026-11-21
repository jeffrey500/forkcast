"use client";

import { useMemo } from "react";
import { useApp } from "./AppProvider";
import { forecast, requiredAgreements } from "@/lib/inventory";
import { today } from "@/lib/dates";
import type { Meal } from "@/lib/types";

export function useForecast() {
  const { state } = useApp();
  return useMemo(() => {
    const t = today();
    const f = forecast({
      meals: state.meals,
      recipes: state.recipes,
      fridge: state.fridge,
      shopping: state.shopping,
      settings: state.settings,
      today: t,
    });
    const memberIds = new Set(state.users.map((u) => u.id));
    const needed = requiredAgreements(state.settings.agreementRule, state.users.length);
    const agreeCount = (m: Meal) => m.agreedBy.filter((id) => memberIds.has(id)).length;
    return {
      ...f,
      today: t,
      needed,
      agreeCount,
      isAgreed: (m: Meal) => agreeCount(m) >= needed,
    };
  }, [state]);
}
