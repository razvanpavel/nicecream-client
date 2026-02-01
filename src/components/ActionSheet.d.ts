// Shared types for ActionSheet component
// Platform-specific implementations in ActionSheet.native.tsx and ActionSheet.web.tsx

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
}

export function ActionSheet(props: ActionSheetProps): React.ReactElement;
