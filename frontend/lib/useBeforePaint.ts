"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` where it exists, `useEffect` where it does not.
 *
 * Anything that corrects what the server rendered — a stored preference, a
 * rewound animation — has to do it before the browser paints, or the default
 * flashes first. On the server there is no paint and no layout effect, so the
 * fallback is there purely to keep React quiet.
 */
export const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
