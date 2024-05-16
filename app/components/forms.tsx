import { useInputControl } from "@conform-to/react";
import { REGEXP_ONLY_DIGITS_AND_CHARS, type OTPInputProps } from "input-otp";
import type React from "react";
import { useId } from "react";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "./ui/input-otp.tsx";
import {
	Checkbox,
	TextArea,
	type TextAreaProps,
	TextField,
	type CheckboxProps,
	Flex,
	Text,
} from "@radix-ui/themes";
import { Label } from "./ui/label.tsx";

export type ListOfErrors = Array<string | null | undefined> | null | undefined;

export function ErrorList({
	id,
	errors,
}: {
	errors?: ListOfErrors;
	id?: string;
}) {
	const errorsToRender = errors?.filter(Boolean);
	if (!errorsToRender?.length) return null;
	return (
		<ul id={id} className="flex flex-col gap-1">
			{errorsToRender.map((e) => (
				<li key={e}>
					<Text as="span" color="red" size="1">
						{e}
					</Text>
				</li>
			))}
		</ul>
	);
}

export function Field({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
	inputProps: TextField.RootProps;
	errors?: ListOfErrors;
	className?: string;
}) {
	const fallbackId = useId();
	const id = inputProps.id ?? fallbackId;
	const errorId = errors?.length ? `${id}-error` : undefined;
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<TextField.Root
				variant="surface"
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			/>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	);
}

export function OTPField({
	labelProps,
	inputProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
	inputProps: Partial<OTPInputProps & { render: never }>;
	errors?: ListOfErrors;
	className?: string;
}) {
	const fallbackId = useId();
	const id = inputProps.id ?? fallbackId;
	const errorId = errors?.length ? `${id}-error` : undefined;
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<InputOTP
				pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
				maxLength={6}
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...inputProps}
			>
				<InputOTPGroup>
					<InputOTPSlot index={0} />
					<InputOTPSlot index={1} />
					<InputOTPSlot index={2} />
				</InputOTPGroup>
				<InputOTPSeparator />
				<InputOTPGroup>
					<InputOTPSlot index={3} />
					<InputOTPSlot index={4} />
					<InputOTPSlot index={5} />
				</InputOTPGroup>
			</InputOTP>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	);
}

export function TextareaField({
	labelProps,
	textareaProps,
	errors,
	className,
}: {
	labelProps: React.LabelHTMLAttributes<HTMLLabelElement>;
	textareaProps: TextAreaProps;
	errors?: ListOfErrors;
	className?: string;
}) {
	const fallbackId = useId();
	const id = textareaProps.id ?? textareaProps.name ?? fallbackId;
	const errorId = errors?.length ? `${id}-error` : undefined;
	return (
		<div className={className}>
			<Label htmlFor={id} {...labelProps} />
			<TextArea
				id={id}
				aria-invalid={errorId ? true : undefined}
				aria-describedby={errorId}
				{...textareaProps}
			/>
			<div className="min-h-[32px] px-4 pb-3 pt-1">
				{errorId ? <ErrorList id={errorId} errors={errors} /> : null}
			</div>
		</div>
	);
}

export function CheckboxField({
	labelProps,
	buttonProps,
	errors,
	className,
}: {
	labelProps: JSX.IntrinsicElements["label"];
	buttonProps: CheckboxProps & {
		name: string;
		form: string;
		value?: string;
	};
	errors?: ListOfErrors;
	className?: string;
}) {
	const { key, defaultChecked, ...checkboxProps } = buttonProps;
	const fallbackId = useId();
	const checkedValue = buttonProps.value ?? "on";
	const input = useInputControl({
		key,
		name: buttonProps.name,
		formId: buttonProps.form,
		initialValue: defaultChecked ? checkedValue : undefined,
	});
	const id = buttonProps.id ?? fallbackId;
	const errorId = errors?.length ? `${id}-error` : undefined;

	return (
		<div className={className}>
			<Flex gap="2" align="center">
				<Checkbox
					{...checkboxProps}
					id={id}
					aria-invalid={errorId ? true : undefined}
					aria-describedby={errorId}
					checked={input.value === checkedValue}
					onCheckedChange={(state) => {
						input.change(state.valueOf() ? checkedValue : "");
						buttonProps.onCheckedChange?.(state);
					}}
					onFocus={(event) => {
						input.focus();
						buttonProps.onFocus?.(event);
					}}
					onBlur={(event) => {
						input.blur();
						buttonProps.onBlur?.(event);
					}}
					type="button"
				/>
				<label
					htmlFor={id}
					{...labelProps}
					className="self-center text-body-xs text-muted-foreground"
				/>
			</Flex>
			{errorId ? (
				<div className="px-4 pb-3 pt-1">
					<ErrorList id={errorId} errors={errors} />
				</div>
			) : null}
		</div>
	);
}
