// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Tooltip } from "@cloudflare/kumo";
import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "agentic-inbox-color-mode";

export type ColorMode = "light" | "dark";

function getStoredColorMode(): ColorMode {
	if (typeof window === "undefined") return "dark";
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "light" || stored === "dark") return stored;
	} catch {
		/* ignore */
	}
	return "dark";
}

function applyColorMode(mode: ColorMode) {
	document.documentElement.dataset.theme = "kumo";
	document.documentElement.dataset.mode = mode;
	document.documentElement.style.colorScheme = mode;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		/* ignore */
	}
}

/** Inline boot script — set before paint to avoid a light flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=localStorage.getItem("${STORAGE_KEY}");if(m!=="light"&&m!=="dark")m="dark";var e=document.documentElement;e.dataset.theme="kumo";e.dataset.mode=m;e.style.colorScheme=m}catch(e){document.documentElement.dataset.theme="kumo";document.documentElement.dataset.mode="dark";document.documentElement.style.colorScheme="dark"}})();`;

export default function ThemeToggle({ className }: { className?: string }) {
	const [mode, setMode] = useState<ColorMode>("dark");

	useEffect(() => {
		setMode(getStoredColorMode());
	}, []);

	const toggle = () => {
		const next: ColorMode = mode === "dark" ? "light" : "dark";
		applyColorMode(next);
		setMode(next);
	};

	return (
		<Tooltip
			content={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
			side="bottom"
			asChild
		>
			<Button
				variant="ghost"
				shape="square"
				icon={mode === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
				onClick={toggle}
				aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
				className={className}
			/>
		</Tooltip>
	);
}
