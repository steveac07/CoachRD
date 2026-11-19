// Piezas de interfaz del panel del coach, con la paleta de la demo aprobada.
import { type Href, Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import type { StatusLevel } from '@/lib/coach/planReview';
import type { Level } from '@/lib/nutrition/targets';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-dark"
      contentContainerClassName="w-full max-w-5xl self-center gap-4 px-4 py-5"
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <View className={`gap-3 rounded-2xl border border-line bg-surface p-4 dark:border-line-dark dark:bg-surface-dark ${className}`}>
      {title ? (
        <Text className="text-xs font-semibold uppercase tracking-wider text-muted dark:text-muted-dark">{title}</Text>
      ) : null}
      {children}
    </View>
  );
}

export function Heading({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <View className="gap-1">
      {eyebrow ? (
        <Text className="text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</Text>
      ) : null}
      <Text accessibilityRole="header" className="text-2xl font-bold text-ink dark:text-ink-dark">
        {children}
      </Text>
    </View>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <Text className={muted ? 'text-sm text-muted dark:text-muted-dark' : 'text-base text-ink dark:text-ink-dark'}>
      {children}
    </Text>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-3">
      <Text className="text-sm text-muted dark:text-muted-dark">{label}</Text>
      <Text className="text-base font-semibold text-ink dark:text-ink-dark" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

const PILL: Record<StatusLevel, string> = {
  neutral: 'bg-muted/10 text-muted dark:text-muted-dark',
  good: 'bg-good/10 text-good dark:text-good-dark',
  warn: 'bg-warn/10 text-warn dark:text-warn-dark',
  bad: 'bg-bad/10 text-bad dark:text-bad-dark',
};

export function Pill({ level, children }: { level: StatusLevel; children: ReactNode }) {
  return (
    <Text className={`self-start overflow-hidden rounded-full px-2.5 py-0.5 text-xs font-semibold ${PILL[level]}`}>
      {children}
    </Text>
  );
}

const NOTICE: Record<Level, string> = {
  good: 'border-good/30 bg-good/10',
  warn: 'border-warn/30 bg-warn/10',
  bad: 'border-bad/30 bg-bad/10',
};

export function Notice({ level, children }: { level: Level; children: ReactNode }) {
  return (
    <View accessibilityRole="alert" className={`rounded-xl border px-3 py-2.5 ${NOTICE[level]}`}>
      <Text className="text-sm text-ink dark:text-ink-dark">{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const off = disabled || busy;
  const look = variant === 'primary'
    ? 'bg-brand active:opacity-80'
    : 'border border-line bg-surface active:bg-surface2 dark:border-line-dark dark:bg-surface-dark';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-xl px-4 py-2.5 ${look} ${off ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={off}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#0E7C74'} /> : null}
      <Text className={`text-base font-semibold ${variant === 'primary' ? 'text-white' : 'text-ink dark:text-ink-dark'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Enlace con aspecto de botón (navega con Expo Router). */
export function LinkButton({ label, href, variant = 'secondary' }: { label: string; href: Href; variant?: 'primary' | 'secondary' }) {
  const look = variant === 'primary'
    ? 'bg-brand active:opacity-80'
    : 'border border-line bg-surface active:bg-surface2 dark:border-line-dark dark:bg-surface-dark';
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" className={`min-h-11 items-center justify-center rounded-xl px-4 py-2.5 ${look}`}>
        <Text className={`text-base font-semibold ${variant === 'primary' ? 'text-white' : 'text-ink dark:text-ink-dark'}`}>
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (text: string) => void;
  error?: string;
}) {
  return (
    <View className="min-w-36 flex-1 gap-1">
      <Text nativeID={`${id}-label`} className="text-sm font-medium text-muted dark:text-muted-dark">
        {label}
      </Text>
      <View
        className={`flex-row items-center rounded-xl border bg-surface px-3 dark:bg-surface-dark ${
          error ? 'border-bad dark:border-bad-dark' : 'border-line dark:border-line-dark'
        }`}
      >
        {/* En web el <input> tiene ancho intrínseco: el View con min-w-0 le deja encoger y la unidad no se sale. */}
        <View className="min-w-0 flex-1">
          <TextInput
            testID={id}
            accessibilityLabelledBy={`${id}-label`}
            accessibilityLabel={label}
            className="min-h-11 w-full text-base text-ink dark:text-ink-dark"
            keyboardType="decimal-pad"
            inputMode="decimal"
            value={value}
            onChangeText={onChange}
          />
        </View>
        <Text className="pl-2 text-sm text-muted dark:text-muted-dark">{unit}</Text>
      </View>
      {error ? <Text className="text-xs text-bad dark:text-bad-dark">{error}</Text> : null}
    </View>
  );
}

export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string; hint?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-muted dark:text-muted-dark">{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              className={`min-h-11 justify-center rounded-xl border px-3 py-2 ${
                selected
                  ? 'border-brand bg-brand-soft dark:bg-brand-soft-dark'
                  : 'border-line bg-surface dark:border-line-dark dark:bg-surface-dark'
              }`}
              onPress={() => onChange(option.value)}
            >
              <Text className={`text-sm font-semibold ${selected ? 'text-brand' : 'text-ink dark:text-ink-dark'}`}>
                {option.label}
              </Text>
              {option.hint ? <Text className="text-xs text-muted dark:text-muted-dark">{option.hint}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-canvas p-8 dark:bg-canvas-dark">
      <ActivityIndicator color="#0E7C74" />
      <Text className="text-sm text-muted dark:text-muted-dark">{label}</Text>
    </View>
  );
}
