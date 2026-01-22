import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { cn } from '@/utils/cn';

const textVariants = cva('text-gray-900', {
  variants: {
    variant: {
      default: '',
      heading: 'font-bold',
      subheading: 'font-semibold',
      muted: 'text-gray-500',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'base',
  },
});

export interface TextProps extends RNTextProps, VariantProps<typeof textVariants> {
  className?: string;
}

export const Text = forwardRef<RNText, TextProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <RNText
        ref={ref}
        className={cn(textVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
