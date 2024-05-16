import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const EpicToaster = ({ theme, ...props }: ToasterProps) => {
	return (
		<Sonner
			theme={theme}
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-[var(--olive-1)] group-[.toaster]:text-[color:var(--olive-12)] group-[.toaster]:border-border group-[.toaster]:shadow-[var(--shadow-5)]",
					description: "group-[.toast]:text-[color:var(--olive-12)]",
					actionButton:
						"group-[.toast]:bg-[var(--mint-1)] group-[.toast]:text-[color:var(--mint-12)]",
					cancelButton:
						"group-[.toast]:bg-[var(--olive-1)]  group-[.toast]:text-[color:var(--olive-12)]",
				},
			}}
			{...props}
		/>
	);
};

export { EpicToaster };
