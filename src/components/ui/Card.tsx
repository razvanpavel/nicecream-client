import { forwardRef } from 'react';
import { View, type ViewProps } from 'react-native';

import { cn } from '@/utils/cn';

import { Text } from './Text';

export interface CardProps extends ViewProps {
  className?: string;
}

export const Card = forwardRef<View, CardProps>(({ className, ...props }, ref) => {
  return (
    <View
      ref={ref}
      className={cn('rounded-lg border border-gray-200 bg-white p-4 shadow-sm', className)}
      {...props}
    />
  );
});

Card.displayName = 'Card';

export interface CardHeaderProps extends ViewProps {
  className?: string;
}

export const CardHeader = forwardRef<View, CardHeaderProps>(({ className, ...props }, ref) => {
  return <View ref={ref} className={cn('mb-2', className)} {...props} />;
});

CardHeader.displayName = 'CardHeader';

export interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps): JSX.Element {
  return (
    <Text variant="heading" size="xl" className={cn('', className)}>
      {children}
    </Text>
  );
}

export interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps): JSX.Element {
  return (
    <Text variant="muted" size="sm" className={cn('', className)}>
      {children}
    </Text>
  );
}

export interface CardContentProps extends ViewProps {
  className?: string;
}

export const CardContent = forwardRef<View, CardContentProps>(({ className, ...props }, ref) => {
  return <View ref={ref} className={cn('', className)} {...props} />;
});

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends ViewProps {
  className?: string;
}

export const CardFooter = forwardRef<View, CardFooterProps>(({ className, ...props }, ref) => {
  return <View ref={ref} className={cn('mt-4 flex-row items-center', className)} {...props} />;
});

CardFooter.displayName = 'CardFooter';
